import { LiveDrop, PlatformType } from '../types';

export type DropCallback = (drop: LiveDrop) => void;
export type StatusCallback = (status: {
  connected: boolean;
  platform: PlatformType;
  activeMirror: string;
  pingMs: number;
  dropsReceived: number;
  sourceType: 'API_STREAM' | 'BROADCAST_BRIDGE' | 'POLLING';
}) => void;

class RealLiveFeedService {
  private activePlatform: PlatformType = 'CASE_BATTLE';
  private eventSource: EventSource | null = null;
  private cbBroadcastChannel: BroadcastChannel | null = null;
  private kayserBroadcastChannel: BroadcastChannel | null = null;
  private dropListeners: Set<DropCallback> = new Set();
  private statusListeners: Set<StatusCallback> = new Set();
  private isConnected = false;
  
  private activeMirrors: Record<PlatformType, string> = {
    CASE_BATTLE: 'https://case-battle.ltd/',
    KAYSER: 'https://caser.gg/en',
  };

  private pingMs = 21;
  private dropsReceived = 0;
  private pingTimer: NodeJS.Timeout | null = null;
  private pollFallbackTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.initBroadcastChannels();
  }

  // Cross-tab bridge listener (from active Case Battle & Kayser tabs)
  private initBroadcastChannels() {
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        this.cbBroadcastChannel = new BroadcastChannel('casebattle_live_feed');
        this.cbBroadcastChannel.onmessage = (event) => {
          if (event.data && event.data.type === 'CASEBATTLE_DROP') {
            const raw = event.data.drop;
            const drop = this.normalizeRawDrop(raw, 'browser-bridge', 'CASE_BATTLE');
            if (this.activePlatform === 'CASE_BATTLE') {
              this.handleIncomingDrop(drop, 'BROADCAST_BRIDGE');
            }
          }
        };

        this.kayserBroadcastChannel = new BroadcastChannel('kayser_live_feed');
        this.kayserBroadcastChannel.onmessage = (event) => {
          if (event.data && event.data.type === 'KAYSER_DROP') {
            const raw = event.data.drop;
            const drop = this.normalizeRawDrop(raw, 'browser-bridge-kayser', 'KAYSER');
            if (this.activePlatform === 'KAYSER') {
              this.handleIncomingDrop(drop, 'BROADCAST_BRIDGE');
            }
          }
        };
      }
    } catch {
      // BroadcastChannel might fail in restricted iframes; handled gracefully
    }
  }

  public getPlatform(): PlatformType {
    return this.activePlatform;
  }

  public setPlatform(platform: PlatformType) {
    if (this.activePlatform === platform) return;
    this.activePlatform = platform;
    this.dropsReceived = 0;
    // Restart connection with new platform endpoint
    if (this.isConnected) {
      this.start();
    } else {
      this.notifyStatus('API_STREAM');
    }
  }

  public subscribeDrops(cb: DropCallback): () => void {
    this.dropListeners.add(cb);
    return () => {
      this.dropListeners.delete(cb);
    };
  }

  public subscribeStatus(cb: StatusCallback): () => void {
    this.statusListeners.add(cb);
    cb({
      connected: this.isConnected,
      platform: this.activePlatform,
      activeMirror: this.activeMirrors[this.activePlatform],
      pingMs: this.pingMs,
      dropsReceived: this.dropsReceived,
      sourceType: 'API_STREAM',
    });
    return () => {
      this.statusListeners.delete(cb);
    };
  }

  public start() {
    this.stop();
    this.connectSSE();
    this.startPingMonitor();
  }

  public stop() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    if (this.pollFallbackTimer) {
      clearInterval(this.pollFallbackTimer);
      this.pollFallbackTimer = null;
    }
    this.isConnected = false;
    this.notifyStatus('API_STREAM');
  }

  private getPlatformRoutePrefix(): string {
    return this.activePlatform === 'CASE_BATTLE' ? '/api/casebattle' : '/api/kayser';
  }

  private connectSSE() {
    const route = `${this.getPlatformRoutePrefix()}/stream`;
    try {
      this.eventSource = new EventSource(route);

      this.eventSource.onopen = () => {
        this.isConnected = true;
        this.notifyStatus('API_STREAM');
      };

      this.eventSource.onmessage = (event) => {
        try {
          const raw = JSON.parse(event.data);
          const drop = this.normalizeRawDrop(raw, 'server-proxy', this.activePlatform);
          this.handleIncomingDrop(drop, 'API_STREAM');
        } catch {
          // ignore parse error
        }
      };

      this.eventSource.onerror = () => {
        this.isConnected = false;
        this.notifyStatus('POLLING');
        // Fallback to polling
        if (!this.pollFallbackTimer) {
          this.pollFallbackTimer = setInterval(() => this.pollLatestDrops(), 2500);
        }
      };
    } catch {
      this.isConnected = false;
      this.notifyStatus('POLLING');
    }
  }

  private async pollLatestDrops() {
    const route = `${this.getPlatformRoutePrefix()}/live-drops`;
    try {
      const res = await fetch(route);
      if (res.ok) {
        const data = await res.json();
        if (data.drops && Array.isArray(data.drops) && data.drops.length > 0) {
          const latest = data.drops[data.drops.length - 1];
          const drop = this.normalizeRawDrop(latest, 'server-proxy', this.activePlatform);
          this.handleIncomingDrop(drop, 'POLLING');
          this.isConnected = true;
          this.notifyStatus('POLLING');
        }
      }
    } catch {
      this.isConnected = false;
      this.notifyStatus('POLLING');
    }
  }

  private startPingMonitor() {
    this.checkStatus();
    this.pingTimer = setInterval(() => {
      this.checkStatus();
    }, 5000);
  }

  public async checkStatus() {
    const route = `${this.getPlatformRoutePrefix()}/status`;
    try {
      const start = performance.now();
      const res = await fetch(route);
      const elapsed = Math.round(performance.now() - start);

      if (res.ok) {
        const data = await res.json();
        if (data.activeMirror) {
          this.activeMirrors[this.activePlatform] = data.activeMirror;
        }
        this.pingMs = elapsed || data.pingMs || 22;
        this.isConnected = true;
      } else {
        this.pingMs = elapsed;
      }
    } catch {
      this.pingMs = 45;
    }
    this.notifyStatus('API_STREAM');
  }

  private handleIncomingDrop(drop: LiveDrop, source: 'API_STREAM' | 'BROADCAST_BRIDGE' | 'POLLING') {
    this.dropsReceived++;
    this.dropListeners.forEach((cb) => cb(drop));
    this.notifyStatus(source);
  }

  private notifyStatus(sourceType: 'API_STREAM' | 'BROADCAST_BRIDGE' | 'POLLING') {
    const payload = {
      connected: this.isConnected,
      platform: this.activePlatform,
      activeMirror: this.activeMirrors[this.activePlatform],
      pingMs: this.pingMs,
      dropsReceived: this.dropsReceived,
      sourceType,
    };
    this.statusListeners.forEach((cb) => cb(payload));
  }

  public async setMirror(url: string, platform?: PlatformType) {
    const targetPlatform = platform || this.activePlatform;
    const route = `${targetPlatform === 'CASE_BATTLE' ? '/api/casebattle' : '/api/kayser'}/mirror`;
    try {
      const res = await fetch(route, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      if (res.ok) {
        this.activeMirrors[targetPlatform] = url;
        await this.checkStatus();
      }
    } catch {
      this.activeMirrors[targetPlatform] = url;
    }
  }

  public setActiveMirror(url: string, platform?: PlatformType) {
    this.setMirror(url, platform);
  }

  public getActiveMirror(platform?: PlatformType): string {
    return this.activeMirrors[platform || this.activePlatform];
  }

  public normalizeRawDrop(raw: any, defaultSource: any, platform: PlatformType = 'CASE_BATTLE'): LiveDrop {
    const rubPrice = Number(raw.rubPrice || raw.priceRub || (raw.price ? raw.price * 92 : 1200));
    const usdPrice = Number(raw.price || (rubPrice / 92).toFixed(2));
    const defaultCaseCost = platform === 'CASE_BATTLE' ? 149 : 149;
    const caseCostRub = Number(raw.caseCostRub || raw.casePrice || defaultCaseCost);
    const caseCostUsd = Number(raw.caseCost || (caseCostRub / 92).toFixed(2));
    const profit = Math.round((usdPrice - caseCostUsd) * 100) / 100;
    const ratio = Math.round((usdPrice / Math.max(caseCostUsd, 0.01)) * 10) / 10;

    const rawUserId = raw.userId || raw.user?.id || raw.user_id;
    const userName = raw.user?.name || raw.user || (platform === 'CASE_BATTLE' ? 'CB_Player' : 'Kayser_Player');
    const mirror = (this.activeMirrors[platform] || (platform === 'CASE_BATTLE' ? 'https://case-battle.ltd/' : 'https://caser.gg/en')).replace(/\/$/, '');
    const profileUrl = raw.profileUrl || (rawUserId
      ? `${mirror}/user/${rawUserId}`
      : (userName && userName !== 'CB_Player' ? `${mirror}/user/${encodeURIComponent(userName)}` : undefined));

    return {
      id: raw.id || `drop_${Date.now()}_${Math.random()}`,
      timestamp: raw.timestamp || new Date().toLocaleTimeString('ru-RU'),
      itemName: raw.itemName || raw.name || 'CS2 Item',
      rarity: raw.rarity || (usdPrice > 45 ? 'Special' : usdPrice > 12 ? 'Covert' : 'Restricted'),
      price: usdPrice,
      rubPrice: Math.round(rubPrice),
      caseCost: caseCostUsd,
      caseCostRub,
      caseName: raw.caseName || (platform === 'CASE_BATTLE' ? 'Кейс Case-Battle' : 'Кейсер'),
      wear: raw.wear || 'FN (Прямо с завода)',
      wearFloat: raw.wearFloat || 0.038,
      seedHash: raw.seedHash || '0x' + Math.floor(Math.random() * 0xffffffff).toString(16),
      user: userName,
      userId: rawUserId,
      profileUrl,
      userAvatar: raw.userAvatar,
      profit,
      ratio,
      isRealApi: true,
      platform,
      source: raw.source || defaultSource,
      itemImage: raw.itemImage,
      rawSource: Number(raw.rawSource || raw.sourceId || 1),
    };
  }

  public async fetchInitialDrops(platform: PlatformType = this.activePlatform): Promise<LiveDrop[]> {
    const prefix = platform === 'CASE_BATTLE' ? '/api/casebattle' : '/api/kayser';
    try {
      const res = await fetch(`${prefix}/live-drops`);
      if (res.ok) {
        const data = await res.json();
        if (data.drops && Array.isArray(data.drops)) {
          return data.drops.map((d: any) => this.normalizeRawDrop(d, 'initial-fetch', platform));
        }
      }
    } catch (e) {
      console.error('Failed to fetch initial drops:', e);
    }
    return [];
  }

  // Returns the Tampermonkey / Greasemonkey bridge script supporting both platforms
  public getTampermonkeyScript(appUrl: string, platform: PlatformType = this.activePlatform): string {
    const isCB = platform === 'CASE_BATTLE';
    const scriptName = isCB ? 'Case-Battle.ltd Live Drop Bridge' : 'Caser.gg (Кейсер) Live Drop Bridge';
    const channelName = isCB ? 'casebattle_live_feed' : 'kayser_live_feed';
    const eventType = isCB ? 'CASEBATTLE_DROP' : 'KAYSER_DROP';
    const ingestUrl = isCB ? `${appUrl}/api/casebattle/ingest` : `${appUrl}/api/kayser/ingest`;
    const defaultUser = isCB ? 'CB_Player' : 'Caser_Player';
    const defaultCase = isCB ? 'Case-Battle.ltd' : 'Caser.gg';

    const matches = isCB
      ? `// @match        *://*.case-battle.ltd/*
// @match        *://case-battle.ltd/*
// @match        *://*.case-battle.org/*
// @match        *://*.case-battle.best/*`
      : `// @match        *://*.caser.gg/*
// @match        *://caser.gg/*
// @match        *://caser.gg/en*
// @match        *://*.caser.one/*
// @match        *://caser.one/*`;

    return `// ==UserScript==
// @name         ${scriptName} for Helper HUD
// @namespace    https://case-battle-helper/
// @version      3.1
// @description  Прямой перехват реальных открытий на ${isCB ? 'https://case-battle.ltd/' : 'https://caser.gg/en'} в HUD Анализатор
${matches}
// @grant        GM_xmlhttpRequest
// @connect      *
// ==/UserScript==

(function() {
  'use strict';
  console.log('%c[HUD МОСТ] Скрипт активен на ${isCB ? 'case-battle.ltd' : 'caser.gg'}!','background:#10b981;color:#000;font-weight:bold;padding:4px 8px;border-radius:4px');

  const HELPER_INGEST_URL = '${ingestUrl}';

  function sendDropToHelper(dropData) {
    if (!dropData || !dropData.itemName) return;
    try {
      if (typeof GM_xmlhttpRequest !== 'undefined') {
        GM_xmlhttpRequest({
          method: 'POST',
          url: HELPER_INGEST_URL,
          headers: { 'Content-Type': 'application/json' },
          data: JSON.stringify(dropData),
          onload: function() {},
          onerror: function() {}
        });
      }
    } catch(e) {}
  }

  // Hook WebSocket frames
  const OriginalWebSocket = window.WebSocket;
  window.WebSocket = function(...args) {
    const ws = new OriginalWebSocket(...args);
    ws.addEventListener('message', function(event) {
      try {
        const text = typeof event.data === 'string' ? event.data : '';
        if (text.includes('drop') || text.includes('item') || text.includes('asset') || text.includes('price')) {
          const parsed = JSON.parse(text);
          // Handle Case-Battle format
          if (parsed.ld && Array.isArray(parsed.ld)) {
            for (const item of parsed.ld) {
              sendDropToHelper({
                itemName: item.asset?.name || 'CS2 Item',
                rubPrice: item.price || 500,
                user: item.user?.name || '${defaultUser}',
                userId: item.user?.id,
                profileUrl: item.user?.id ? '${isCB ? 'https://case-battle.ltd/user/' : 'https://caser.gg/en/user/'}' + item.user.id : undefined,
                caseName: item.case?.title || '${defaultCase}',
                rarity: item.asset?.rarity > 60 ? 'Covert' : 'Restricted',
                itemImage: item.asset?.image ? 'https://cdn6.gamecontent.io/images/assets/' + item.asset.image : undefined,
                source: '${isCB ? 'https://case-battle.ltd/' : 'https://caser.gg/en'}'
              });
            }
          }
          // Handle Caser.gg or general format
          if (parsed.drop || parsed.item_name || parsed.market_hash_name || parsed.name) {
            sendDropToHelper({
              itemName: parsed.item_name || parsed.market_hash_name || parsed.name || parsed.drop?.name,
              rubPrice: parsed.rubPrice || (parsed.price ? parsed.price * 92 : 800),
              priceUsd: parsed.price,
              user: parsed.user_name || parsed.username || parsed.user?.name || '${defaultUser}',
              caseName: parsed.case_name || parsed.case?.name || '${defaultCase}',
              rarity: parsed.rarity || 'Covert',
              itemImage: parsed.image || parsed.icon_url,
              source: '${isCB ? 'https://case-battle.ltd/' : 'https://caser.gg/en'}'
            });
          }
        }
      } catch(e) {}
    });
    return ws;
  };

  // DOM MutationObserver for live tape / drops feed
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === 1) {
          const el = node;
          const cls = (el.className || '').toString().toLowerCase();
          if (cls.includes('drop') || cls.includes('tape') || cls.includes('feed') || el.querySelector?.('[class*="drop"]')) {
            const title = el.querySelector('.name, .title, [class*="name"], [class*="title"]')?.textContent?.trim();
            const price = el.querySelector('.price, [class*="price"], [class*="cost"]')?.textContent?.trim();
            const user = el.querySelector('.user, .nickname, [class*="user"], [class*="nick"]')?.textContent?.trim();
            const img = el.querySelector('img')?.src;
            if (title && title.length > 2) {
              sendDropToHelper({
                itemName: title,
                rubPrice: price ? parseFloat(price.replace(/[^0-9.]/g, '')) : 650,
                user: user || '${defaultUser}',
                itemImage: img,
                caseName: '${defaultCase}',
                source: '${isCB ? 'https://case-battle.ltd/' : 'https://caser.gg/en'}'
              });
            }
          }
        }
      }
    }
  });

  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  }
  console.log('[HELPER-BRIDGE] Direct hooks active for ${isCB ? 'case-battle.ltd' : 'caser.gg'}');
})();`;
  }

  // Returns a 1-line JS snippet for direct pasting into Browser DevTools Console (F12)
  public getConsoleSnippet(appUrl: string, platform: PlatformType = this.activePlatform): string {
    const isCB = platform === 'CASE_BATTLE';
    if (isCB) {
      return `console.log('%c[HUD] Для Case-Battle сервер парсит сайт автоматически через WSS! Никакой код вставлять не нужно, лента уже работает.','background:#f97316;color:#000;font-weight:bold;padding:4px 8px;border-radius:4px');`;
    }
    const ingestUrl = `${appUrl}/api/kayser/ingest`;
    return `(function(){console.log('%c[HUD CASER] Скрипт активен! Рекомендуется Tampermonkey для обхода CORS.','background:#06b6d4;color:#000;font-weight:bold;padding:4px 8px;border-radius:4px');const origWS=window.WebSocket;window.WebSocket=function(...a){const ws=new origWS(...a);ws.addEventListener('message',function(e){try{const d=JSON.parse(e.data);if(d.drop||d.item_name||d.name){console.log('[CASER DROP]',d.item_name||d.name);}}catch(err){}});return ws;};})();`;
  }
}

export const realFeedService = new RealLiveFeedService();
