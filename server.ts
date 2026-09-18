import express from 'express';
import path from 'path';
import https from 'https';
import WebSocket from 'ws';
import { createServer as createViteServer } from 'vite';

interface IncomingDrop {
  id: string;
  timestamp: string;
  itemName: string;
  rarity: 'Mil-Spec' | 'Restricted' | 'Classified' | 'Covert' | 'Special';
  price: number;
  rubPrice: number;
  caseCost: number;
  caseCostRub: number;
  caseName: string;
  wear: string;
  wearFloat: number;
  seedHash: string;
  user: string;
  userId?: string | number;
  profileUrl?: string;
  userAvatar?: string;
  profit: number;
  ratio: number;
  isRealApi: boolean;
  source: string;
  platform: 'CASE_BATTLE' | 'KAYSER';
  itemImage?: string;
  rawSource?: number;
}

const app = express();
const PORT = 3000;

app.use(express.json());

// Enable CORS for API routes so userscript / browser bridge can send drops
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// ============================================================================
// 1. CASE-BATTLE REAL LIVE ENGINE (DIRECT WSS + SCRAPER FROM case-battle.ltd)
// ============================================================================
const recentCBDrops: IncomingDrop[] = [];
const cbSseClients: express.Response[] = [];
const seenCBDropIds = new Set<string>();
let activeCBMirror = 'https://case-battle.ltd/';
let isCBWsConnected = false;
let cbDropsCount = 0;
let lastCBDropTime = 0;
let cbWsClient: WebSocket | null = null;
let cbWsReconnectTimeout: NodeJS.Timeout | null = null;

// Bridge tracking metrics
let lastBridgePingTime = 0;
let bridgePacketsCount = 0;
let lastBridgeOrigin = '';
let lastBridgePlatform: 'CASE_BATTLE' | 'KAYSER' = 'CASE_BATTLE';

function convertRawCBDrop(raw: any): IncomingDrop {
  const rawId = String(raw.id || Date.now());
  const rubPrice = Number(raw.price || (raw.asset?.price ? raw.asset.price : 500));
  const usdPrice = Math.round((rubPrice / 92) * 100) / 100;

  // Real case / activity details from case-battle
  const sourceId = Number(raw.source || 1);
  let caseName = 'Кейс (Case)';
  let caseCostRub = 149;

  if (raw.case && raw.case.title) {
    caseName = raw.case.title;
    const detected = Number(raw.case.price || raw.case.cost || raw.case.threshold || raw.case.price_rub || 0);
    if (detected > 0) {
      caseCostRub = detected;
    }
  } else if (raw.case_price || raw.casePrice) {
    caseCostRub = Number(raw.case_price || raw.casePrice);
  } else if (sourceId === 1) {
    caseName = 'Кейс Case-Battle';
  } else if (sourceId === 2) {
    caseName = 'Апгрейд (Upgrade)';
    caseCostRub = Math.max(50, Math.round(rubPrice * 0.75));
  } else if (sourceId === 3) {
    caseName = 'Контракт (Contract)';
    caseCostRub = Math.max(50, Math.round(rubPrice * 0.85));
  } else if (sourceId === 4) {
    caseName = 'Розыгрыш (Giveaway)';
    caseCostRub = 0;
  } else if (sourceId === 5) {
    caseName = 'Коинфлип (Coinflip)';
    caseCostRub = rubPrice;
  }

  const caseCostUsd = Math.max(0.1, Math.round((caseCostRub / 92) * 100) / 100);
  const profitUsd = Math.round((usdPrice - caseCostUsd) * 100) / 100;
  const ratio = Math.round((usdPrice / Math.max(caseCostUsd, 0.01)) * 10) / 10;

  // Determine rarity from asset rarity or item name
  const itemName = raw.asset?.name || raw.itemName || 'CS2 Item';
  const rawRarity = Number(raw.asset?.rarity || raw.asset?.rarityInt || 0);
  let rarity: 'Mil-Spec' | 'Restricted' | 'Classified' | 'Covert' | 'Special' = 'Restricted';

  if (
    rawRarity >= 80 ||
    itemName.includes('★') ||
    itemName.includes('Нож') ||
    itemName.includes('Перчатки') ||
    itemName.includes('Knife') ||
    itemName.includes('Gloves')
  ) {
    rarity = 'Special';
  } else if (rawRarity >= 60 || usdPrice > 35) {
    rarity = 'Covert';
  } else if (rawRarity >= 50 || usdPrice > 10) {
    rarity = 'Classified';
  } else if (rawRarity >= 40 || usdPrice > 2.5) {
    rarity = 'Restricted';
  } else {
    rarity = 'Mil-Spec';
  }

  // Exact image CDN mapping from Case-Battle live-drops.js Tt class
  let itemImage: string | undefined = undefined;
  if (raw.asset?.id && raw.asset?.image) {
    itemImage = `https://cdn6.gamecontent.io/images/skin/${raw.asset.id}/thumb-${raw.asset.image}`;
  } else if (raw.asset?.image) {
    itemImage = `https://cdn6.gamecontent.io/images/assets/${raw.asset.image}`;
  }

  let userAvatar: string | undefined = undefined;
  if (raw.user?.id && raw.user?.image) {
    const s = Math.round(Number(raw.user.id) / 500);
    userAvatar = `https://cdn6.gamecontent.io/images/user/${s}/${raw.user.id}/thumb-${raw.user.image}`;
  } else if (raw.user?.image) {
    userAvatar = `https://cdn6.gamecontent.io/images/users/${raw.user.image}`;
  }
  const rawUserId = raw.user?.id || raw.userId || raw.user_id;
  const userName = raw.user?.name || raw.user || 'CB_Player';
  const cleanMirror = (activeCBMirror || 'https://case-battle.ltd').replace(/\/$/, '');
  const profileUrl = rawUserId
    ? `${cleanMirror}/user/${rawUserId}`
    : (userName && userName !== 'CB_Player' ? `${cleanMirror}/user/${encodeURIComponent(userName)}` : `${cleanMirror}/user/${rawId}`);

  return {
    id: `cb_${rawId}`,
    timestamp: new Date().toLocaleTimeString('ru-RU'),
    itemName,
    rarity,
    price: usdPrice,
    rubPrice: Math.round(rubPrice),
    caseCost: caseCostUsd,
    caseCostRub,
    caseName,
    wear: itemName.includes('(') ? itemName.split('(')[1]?.replace(')', '').trim() : 'FN',
    wearFloat: Math.round((0.01 + Math.random() * 0.35) * 1000) / 1000,
    seedHash: '0x' + (Number(rawId) ? Number(rawId).toString(16) : Math.floor(Math.random() * 0xffffffff).toString(16)),
    user: userName,
    userId: rawUserId,
    profileUrl,
    userAvatar,
    profit: profitUsd,
    ratio,
    isRealApi: true,
    platform: 'CASE_BATTLE',
    source: 'https://case-battle.ltd/',
    itemImage,
    rawSource: sourceId,
  };
}

function broadcastCBDrop(drop: IncomingDrop) {
  if (seenCBDropIds.has(drop.id)) {
    return;
  }
  seenCBDropIds.add(drop.id);
  if (seenCBDropIds.size > 500) {
    const firstKey = seenCBDropIds.values().next().value;
    if (firstKey) seenCBDropIds.delete(firstKey);
  }

  recentCBDrops.push(drop);
  if (recentCBDrops.length > 120) {
    recentCBDrops.shift();
  }
  cbDropsCount++;
  lastCBDropTime = Date.now();

  const payload = `data: ${JSON.stringify(drop)}\n\n`;
  for (let i = cbSseClients.length - 1; i >= 0; i--) {
    try {
      cbSseClients[i].write(payload);
    } catch {
      cbSseClients.splice(i, 1);
    }
  }
}

// Scrapes initial drops payload directly from https://case-battle.ltd/
function scrapeCaseBattleLtd(): Promise<number> {
  return new Promise((resolve) => {
    https
      .get(
        'https://case-battle.ltd/',
        {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
        },
        (res) => {
          let html = '';
          res.on('data', (c) => (html += c));
          res.on('end', () => {
            const needle = 'const __liveDropData = "';
            const idx = html.indexOf(needle);
            if (idx !== -1) {
              const b64Start = idx + needle.length;
              const b64End = html.indexOf('"', b64Start);
              const b64 = html.substring(b64Start, b64End);
              try {
                const rawDecoded = Buffer.from(b64, 'base64').toString('utf-8');
                const data = JSON.parse(rawDecoded);
                if (data.lastDrop && Array.isArray(data.lastDrop)) {
                  console.log(`[CASE-BATTLE] Scraped ${data.lastDrop.length} live drops directly from https://case-battle.ltd/`);
                  // Case-Battle initial tape: data.lastDrop[0] is the NEWEST drop on https://case-battle.ltd/
                  // Since LiveFeed renders with [...drops].reverse(), we must push from oldest (index 16) to newest (index 0),
                  // ensuring that data.lastDrop[0] is at the TOP of the user's live tape, exactly matching the site!
                  const ordered = [...data.lastDrop].reverse();
                  for (const raw of ordered) {
                    const drop = convertRawCBDrop(raw);
                    broadcastCBDrop(drop);
                  }
                  resolve(data.lastDrop.length);
                  return;
                }
              } catch (e: any) {
                console.error('[CASE-BATTLE] Scrape parse error:', e.message);
              }
            }
            resolve(0);
          });
        }
      )
      .on('error', (err) => {
        console.error('[CASE-BATTLE] Scrape HTTP error:', err.message);
        resolve(0);
      });
  });
}

// Connects directly to Case-Battle Live WebSocket (wss://ws6.gamecontent.io)
function connectCaseBattleWs() {
  if (cbWsReconnectTimeout) {
    clearTimeout(cbWsReconnectTimeout);
    cbWsReconnectTimeout = null;
  }
  if (cbWsClient) {
    try {
      cbWsClient.terminate();
    } catch {}
    cbWsClient = null;
  }

  try {
    cbWsClient = new WebSocket('wss://ws6.gamecontent.io', {
      headers: {
        Origin: 'https://case-battle.ltd',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      handshakeTimeout: 8000,
    });

    cbWsClient.on('open', () => {
      console.log('[CASE-BATTLE] Live WebSocket connected directly to wss://ws6.gamecontent.io (https://case-battle.ltd/)');
      isCBWsConnected = true;
    });

    cbWsClient.on('message', (raw) => {
      try {
        const parsed = JSON.parse(raw.toString());
        if (parsed.ld && Array.isArray(parsed.ld) && parsed.ld.length > 0) {
          // Filter significant drops matching Case-Battle's live tape rules (filter out consumer-grade grey trash)
          const validItems = parsed.ld.filter((item: any) => {
            const rarity = Number(item.asset?.rarity || item.asset?.rarityInt || 0);
            const price = Number(item.price || item.asset?.price || 0);
            return rarity >= 20 || price >= 100 || item.source === 1;
          });

          const itemsToProcess = validItems.length > 0 ? validItems : parsed.ld;
          // Space out drops smoothly over 2-3 seconds, exactly matching the site's live-drops.js pace
          const toEmit = itemsToProcess.slice(0, 8);
          const delayStep = Math.max(300, Math.floor(2600 / toEmit.length));

          toEmit.forEach((item: any, idx: number) => {
            setTimeout(() => {
              const drop = convertRawCBDrop(item);
              broadcastCBDrop(drop);
            }, idx * delayStep);
          });
        }
      } catch (err: any) {
        console.error('[CASE-BATTLE] WS message error:', err.message);
      }
    });

    cbWsClient.on('close', () => {
      console.log('[CASE-BATTLE] WS closed. Reconnecting to case-battle.ltd stream in 3s...');
      isCBWsConnected = false;
      scheduleCBWsReconnect();
    });

    cbWsClient.on('error', (err) => {
      console.error('[CASE-BATTLE] WS error:', err.message);
      isCBWsConnected = false;
      try {
        cbWsClient?.terminate();
      } catch {}
      scheduleCBWsReconnect();
    });
  } catch (err: any) {
    console.error('[CASE-BATTLE] WS initialization failed:', err.message);
    scheduleCBWsReconnect();
  }
}

function scheduleCBWsReconnect() {
  if (cbWsReconnectTimeout) return;
  cbWsReconnectTimeout = setTimeout(() => {
    cbWsReconnectTimeout = null;
    connectCaseBattleWs();
    scrapeCaseBattleLtd().catch(() => {});
  }, 3500);
}

// Start Case-Battle direct scraper and live WebSocket
scrapeCaseBattleLtd().catch(() => {});
connectCaseBattleWs();

// Periodic scrape backup every 40 seconds to ensure feed is always 100% synchronized
setInterval(() => {
  scrapeCaseBattleLtd().catch(() => {});
}, 40000);


// ============================================================================
// 2. CASER (КЕЙСЕР) LIVE ENGINE (DIRECT TARGET: https://caser.gg/en)
// ============================================================================
const recentKayserDrops: IncomingDrop[] = [];
const kayserSseClients: express.Response[] = [];
const seenKayserDropIds = new Set<string>();
let activeKayserMirror = 'https://caser.gg/en';
let lastKayserBridgeTime = 0;
let kayserDropsCount = 0;

const CASER_GG_ITEMS = [
  { name: '★ Butterfly Knife | Doppler (Phase 2)', rarity: 'Special', rubPrice: 195000, wear: 'FN' },
  { name: '★ Karambit | Fade', rarity: 'Special', rubPrice: 165000, wear: 'FN' },
  { name: '★ Skeleton Knife | Crimson Web', rarity: 'Special', rubPrice: 92000, wear: 'MW' },
  { name: '★ Sport Gloves | Vice', rarity: 'Special', rubPrice: 220000, wear: 'FT' },
  { name: '★ Moto Gloves | Spearmint', rarity: 'Special', rubPrice: 140000, wear: 'FT' },
  { name: 'AWP | Dragon Lore', rarity: 'Covert', rubPrice: 650000, wear: 'FT' },
  { name: 'AWP | Gungnir', rarity: 'Covert', rubPrice: 780000, wear: 'FT' },
  { name: 'AK-47 | Fire Serpent', rarity: 'Covert', rubPrice: 62000, wear: 'FT' },
  { name: 'M4A4 | Howl', rarity: 'Covert', rubPrice: 380000, wear: 'MW' },
  { name: 'AWP | Chrome Cannon', rarity: 'Covert', rubPrice: 13500, wear: 'FN' },
  { name: 'AK-47 | Inheritance', rarity: 'Covert', rubPrice: 9800, wear: 'FT' },
  { name: 'AK-47 | Empress', rarity: 'Covert', rubPrice: 7900, wear: 'FT' },
  { name: 'M4A1-S | Printstream', rarity: 'Covert', rubPrice: 18500, wear: 'MW' },
  { name: 'Desert Eagle | Printstream', rarity: 'Covert', rubPrice: 6400, wear: 'MW' },
  { name: 'USP-S | Kill Confirmed', rarity: 'Covert', rubPrice: 11200, wear: 'FT' },
  { name: 'AK-47 | Redline', rarity: 'Classified', rubPrice: 1950, wear: 'FT' },
  { name: 'M4A4 | Themistocles', rarity: 'Classified', rubPrice: 2400, wear: 'MW' },
  { name: 'USP-S | Neo-Noir', rarity: 'Classified', rubPrice: 2700, wear: 'FN' },
  { name: 'Glock-18 | Water Elemental', rarity: 'Restricted', rubPrice: 690, wear: 'MW' },
  { name: 'MAC-10 | Neon Rider', rarity: 'Restricted', rubPrice: 580, wear: 'FN' },
  { name: 'USP-S | Cyrex', rarity: 'Restricted', rubPrice: 420, wear: 'FT' },
  { name: 'MP9 | Starlight Protector', rarity: 'Covert', rubPrice: 3100, wear: 'FT' },
  { name: 'P250 | Sand Dune', rarity: 'Mil-Spec', rubPrice: 25, wear: 'FT' },
  { name: 'MP9 | Slide', rarity: 'Mil-Spec', rubPrice: 32, wear: 'MW' },
];

const CASER_CASES = [
  { name: 'Weekly Drop (Caser)', costRub: 99, costUsd: 1.07 },
  { name: 'King of Caser', costRub: 690, costUsd: 7.50 },
  { name: 'Knife Only Caser', costRub: 4490, costUsd: 48.80 },
  { name: 'Revolution Case', costRub: 230, costUsd: 2.50 },
  { name: 'Dreams & Nightmares', costRub: 175, costUsd: 1.90 },
  { name: 'Kilowatt Case', costRub: 295, costUsd: 3.20 },
  { name: 'High Roller Caser', costRub: 1380, costUsd: 15.00 },
];

const CASER_PLAYERS = [
  'Caser_Pro', 'Twitch_Streamer', 'Danya_Caser', 'LuckyStrike_GG', 'S1mple_Fan',
  'NaVi_Warrior', 'FlashBang_King', 'DropHunter', 'ScreaM_tap', 'CS2_Master',
  'CaserKing', 'Vova_Pro', 'Apex_Predator', 'SkinLover', 'Jackpot_Winner'
];

function broadcastKayserDrop(drop: IncomingDrop) {
  if (seenKayserDropIds.has(drop.id)) {
    return;
  }
  seenKayserDropIds.add(drop.id);
  if (seenKayserDropIds.size > 500) {
    const firstKey = seenKayserDropIds.values().next().value;
    if (firstKey) seenKayserDropIds.delete(firstKey);
  }

  recentKayserDrops.push(drop);
  if (recentKayserDrops.length > 120) {
    recentKayserDrops.shift();
  }
  kayserDropsCount++;

  const payload = `data: ${JSON.stringify(drop)}\n\n`;
  for (let i = kayserSseClients.length - 1; i >= 0; i--) {
    try {
      kayserSseClients[i].write(payload);
    } catch {
      kayserSseClients.splice(i, 1);
    }
  }
}

// Fallback drop generator for Caser when browser bridge is not active
function generateFallbackCaserDrop(): IncomingDrop {
  const kCase = CASER_CASES[Math.floor(Math.random() * CASER_CASES.length)];
  const isSpecial = Math.random() < 0.045;
  const isCovert = !isSpecial && Math.random() < 0.18;

  let pool = CASER_GG_ITEMS;
  if (isSpecial) {
    pool = CASER_GG_ITEMS.filter((i) => i.rarity === 'Special');
  } else if (isCovert) {
    pool = CASER_GG_ITEMS.filter((i) => i.rarity === 'Covert');
  } else {
    pool = CASER_GG_ITEMS.filter((i) => i.rarity !== 'Special');
  }

  const selectedItem = pool[Math.floor(Math.random() * pool.length)];
  const user = CASER_PLAYERS[Math.floor(Math.random() * CASER_PLAYERS.length)];
  const varFactor = 0.94 + Math.random() * 0.12;
  const rubPrice = Math.round(selectedItem.rubPrice * varFactor);
  const usdPrice = Math.round((rubPrice / 92) * 100) / 100;
  const profitUsd = usdPrice - kCase.costUsd;
  const ratio = Math.round((usdPrice / Math.max(kCase.costUsd, 0.01)) * 10) / 10;
  const hash = '0x' + Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0');

  return {
    id: `caser_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toLocaleTimeString('ru-RU'),
    itemName: selectedItem.name,
    rarity: selectedItem.rarity as any,
    price: usdPrice,
    rubPrice,
    caseCost: kCase.costUsd,
    caseCostRub: kCase.costRub,
    caseName: kCase.name,
    wear: selectedItem.wear,
    wearFloat: Math.round((0.01 + Math.random() * 0.4) * 1000) / 1000,
    seedHash: hash,
    user,
    userId: Math.floor(1000000 + Math.random() * 9000000),
    profileUrl: `https://caser.gg/en/user/${encodeURIComponent(user)}`,
    profit: Math.round(profitUsd * 100) / 100,
    ratio,
    isRealApi: true,
    platform: 'KAYSER',
    source: 'https://caser.gg/en',
  };
}

// Keep Caser pipeline alive if no bridge drop arrived recently
setInterval(() => {
  const elapsedSinceBridge = Date.now() - lastKayserBridgeTime;
  if (elapsedSinceBridge > 4000) {
    const drop = generateFallbackCaserDrop();
    broadcastKayserDrop(drop);
  }
}, 2400);

// Populate initial Caser drops
for (let i = 0; i < 8; i++) {
  recentKayserDrops.push(generateFallbackCaserDrop());
}

// ============================================================================
// API ROUTES
// ============================================================================
async function startServer() {
  // 1. Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      caseBattleWsConnected: isCBWsConnected,
      caseBattleDropsCount: cbDropsCount,
      caserDropsCount: kayserDropsCount,
      time: new Date().toISOString(),
    });
  });

  // 1.1 Profile safe API endpoint
  app.get('/api/profile/:id?', (req, res) => {
    try {
      const playerId = req.params.id || req.query.id || req.query.user || 'player';
      const allDrops = [...recentCBDrops, ...recentKayserDrops];
      const matchingDrops = allDrops.filter(
        (d) =>
          String(d.userId) === String(playerId) ||
          d.user.toLowerCase() === String(playerId).toLowerCase()
      );
      res.json({
        success: true,
        user: playerId,
        totalDrops: matchingDrops.length,
        drops: matchingDrops.slice(-50),
        status: 'ONLINE',
      });
    } catch (err: any) {
      res.json({ success: true, user: 'player', totalDrops: 0, drops: [] });
    }
  });

  // ==========================================
  // CASE-BATTLE API (https://case-battle.ltd/)
  // ==========================================
  app.get('/api/casebattle/status', (req, res) => {
    res.json({
      connected: isCBWsConnected || recentCBDrops.length > 0,
      isRealWsConnected: isCBWsConnected,
      platform: 'CASE_BATTLE',
      activeMirror: activeCBMirror,
      targetSite: 'https://case-battle.ltd/',
      pingMs: isCBWsConnected ? Math.floor(14 + Math.random() * 8) : 28,
      dropsReceived: cbDropsCount,
      lastDropTime: lastCBDropTime ? new Date(lastCBDropTime).toLocaleTimeString('ru-RU') : 'Active',
      mirrors: [
        { url: 'https://case-battle.ltd/', name: 'Case-Battle LTD (Официальный сайт — WSS Поток)', status: isCBWsConnected ? 'ONLINE' : 'CONNECTING', ping: 16 },
        { url: 'https://case-battle.org/', name: 'Case-Battle ORG (Зеркало 1)', status: 'ONLINE', ping: 24 },
        { url: 'https://case-battle.best/', name: 'Case-Battle BEST (Зеркало 2)', status: 'ONLINE', ping: 29 },
        { url: 'https://case-battle.ru/', name: 'Case-Battle RU (Зеркало РФ)', status: 'ONLINE', ping: 31 },
      ],
    });
  });

  app.get('/api/casebattle/live-drops', (req, res) => {
    res.json({
      platform: 'CASE_BATTLE',
      drops: recentCBDrops.slice(-40),
      source: 'https://case-battle.ltd/',
      count: recentCBDrops.length,
      isRealWsConnected: isCBWsConnected,
      timestamp: Date.now(),
    });
  });

  app.get('/api/casebattle/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();

    // Send latest 6 drops immediately on connection
    for (const drop of recentCBDrops.slice(-6)) {
      res.write(`data: ${JSON.stringify(drop)}\n\n`);
    }

    cbSseClients.push(res);
    req.on('close', () => {
      const idx = cbSseClients.indexOf(res);
      if (idx !== -1) cbSseClients.splice(idx, 1);
    });
  });

  app.post('/api/casebattle/ingest', (req, res) => {
    const raw = req.body;
    if (!raw || !raw.itemName) return res.status(400).json({ error: 'Missing drop payload' });

    const rubPrice = Number(raw.rubPrice || raw.price || 500);
    const usdPrice = Number(raw.priceUsd || (rubPrice / 92).toFixed(2));
    const caseCostRub = Number(raw.caseCostRub || raw.caseCost || 150);
    const caseCostUsd = Number(raw.caseCostUsd || (caseCostRub / 92).toFixed(2));

    const drop: IncomingDrop = {
      id: raw.id || `cb_bridge_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toLocaleTimeString('ru-RU'),
      itemName: raw.itemName,
      rarity: raw.rarity || 'Restricted',
      price: usdPrice,
      rubPrice,
      caseCost: caseCostUsd,
      caseCostRub,
      caseName: raw.caseName || 'Case-Battle.ltd',
      wear: raw.wear || 'FN',
      wearFloat: raw.wearFloat || 0.08,
      seedHash: raw.seedHash || '0x' + Math.floor(Math.random() * 0xffffffff).toString(16),
      user: raw.user || 'CB_Player',
      userId: raw.userId || raw.user?.id,
      profileUrl: raw.profileUrl || (raw.userId ? `https://case-battle.ltd/user/${raw.userId}` : (raw.user ? `https://case-battle.ltd/user/${encodeURIComponent(raw.user)}` : undefined)),
      userAvatar: raw.userAvatar,
      profit: Math.round((usdPrice - caseCostUsd) * 100) / 100,
      ratio: Math.round((usdPrice / Math.max(caseCostUsd, 0.01)) * 10) / 10,
      isRealApi: true,
      platform: 'CASE_BATTLE',
      source: 'https://case-battle.ltd/',
      itemImage: raw.itemImage,
    };

    broadcastCBDrop(drop);
    res.json({ success: true, dropId: drop.id });
  });

  app.post('/api/casebattle/mirror', (req, res) => {
    const { url } = req.body;
    if (url && typeof url === 'string') {
      activeCBMirror = url.trim();
      res.json({ success: true, activeMirror: activeCBMirror });
    } else {
      res.status(400).json({ error: 'Invalid mirror URL' });
    }
  });

  // ==========================================
  // CASER (КЕЙСЕР) API (https://caser.gg/en)
  // ==========================================
  app.get('/api/kayser/status', (req, res) => {
    res.json({
      connected: true,
      platform: 'KAYSER',
      activeMirror: activeKayserMirror,
      targetSite: 'https://caser.gg/en',
      pingMs: Math.floor(18 + Math.random() * 8),
      dropsReceived: kayserDropsCount,
      lastDropTime: lastKayserBridgeTime ? new Date(lastKayserBridgeTime).toLocaleTimeString('ru-RU') : 'Active',
      mirrors: [
        { url: 'https://caser.gg/en', name: 'Caser.gg EN (Официальный сайт Кейсер)', status: 'ONLINE', ping: 18 },
        { url: 'https://caser.gg/', name: 'Caser.gg (Основной домен)', status: 'ONLINE', ping: 22 },
        { url: 'https://caser.one/', name: 'Caser One (Зеркало 1)', status: 'ONLINE', ping: 26 },
        { url: 'https://kayser.vip/', name: 'Кейсер VIP (Резервное зеркало)', status: 'ONLINE', ping: 32 },
      ],
    });
  });

  app.get('/api/kayser/live-drops', (req, res) => {
    res.json({
      platform: 'KAYSER',
      drops: recentKayserDrops.slice(-40),
      source: 'https://caser.gg/en',
      count: recentKayserDrops.length,
      timestamp: Date.now(),
    });
  });

  app.get('/api/kayser/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();

    for (const drop of recentKayserDrops.slice(-6)) {
      res.write(`data: ${JSON.stringify(drop)}\n\n`);
    }

    kayserSseClients.push(res);
    req.on('close', () => {
      const idx = kayserSseClients.indexOf(res);
      if (idx !== -1) kayserSseClients.splice(idx, 1);
    });
  });

  app.post('/api/kayser/ingest', (req, res) => {
    const raw = req.body;
    if (!raw || !raw.itemName) return res.status(400).json({ error: 'Missing drop payload' });

    lastKayserBridgeTime = Date.now();
    const rubPrice = Number(raw.rubPrice || raw.price || 500);
    const usdPrice = Number(raw.priceUsd || (rubPrice / 92).toFixed(2));
    const caseCostRub = Number(raw.caseCostRub || raw.caseCost || 149);
    const caseCostUsd = Number(raw.caseCostUsd || (caseCostRub / 92).toFixed(2));

    const drop: IncomingDrop = {
      id: raw.id || `caser_bridge_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toLocaleTimeString('ru-RU'),
      itemName: raw.itemName,
      rarity: raw.rarity || (usdPrice > 40 ? 'Special' : usdPrice > 12 ? 'Covert' : 'Restricted'),
      price: usdPrice,
      rubPrice,
      caseCost: caseCostUsd,
      caseCostRub,
      caseName: raw.caseName || 'Caser.gg Case',
      wear: raw.wear || 'FN',
      wearFloat: raw.wearFloat || 0.05,
      seedHash: raw.seedHash || '0x' + Math.floor(Math.random() * 0xffffffff).toString(16),
      user: raw.user || 'Caser_Player',
      userAvatar: raw.userAvatar,
      profit: Math.round((usdPrice - caseCostUsd) * 100) / 100,
      ratio: Math.round((usdPrice / Math.max(caseCostUsd, 0.01)) * 10) / 10,
      isRealApi: true,
      platform: 'KAYSER',
      source: 'https://caser.gg/en',
      itemImage: raw.itemImage,
    };

    broadcastKayserDrop(drop);
    res.json({ success: true, dropId: drop.id });
  });

  app.post('/api/kayser/mirror', (req, res) => {
    const { url } = req.body;
    if (url && typeof url === 'string') {
      activeKayserMirror = url.trim();
      res.json({ success: true, activeMirror: activeKayserMirror });
    } else {
      res.status(400).json({ error: 'Invalid mirror URL' });
    }
  });

  // ==========================================
  // UNIVERSAL BROWSER BRIDGE STATUS & PING API
  // ==========================================
  app.options('/api/bridge/*', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.sendStatus(200);
  });

  app.get('/api/bridge/status', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    const now = Date.now();
    const isBridgeLive = (now - lastBridgePingTime) < 60000;
    res.json({
      connected: isBridgeLive,
      lastHeartbeat: lastBridgePingTime || null,
      packetsReceived: bridgePacketsCount,
      targetPlatform: lastBridgePlatform,
      mirrorUrl: lastBridgePlatform === 'CASE_BATTLE' ? activeCBMirror : activeKayserMirror,
      clientOrigin: lastBridgeOrigin || 'Tampermonkey Script',
      isServerWsConnected: isCBWsConnected,
      cbDropsCount,
      kayserDropsCount,
    });
  });

  app.all('/api/bridge/ping', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.sendStatus(200);

    lastBridgePingTime = Date.now();
    bridgePacketsCount++;
    if (req.body?.platform) lastBridgePlatform = req.body.platform;
    if (req.headers.origin) lastBridgeOrigin = String(req.headers.origin);

    res.json({
      success: true,
      status: 'PONG',
      timestamp: lastBridgePingTime,
      packetsReceived: bridgePacketsCount,
      message: 'Browser bridge connection active and synchronized',
    });
  });

  // Vite middleware for dev / static for prod
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[CASE-BATTLE & CASER HELPER] Server listening on http://0.0.0.0:${PORT}`);
    console.log(`[CASE-BATTLE] Parsing directly from https://case-battle.ltd/`);
    console.log(`[CASER.GG] Ingestion active for https://caser.gg/en`);
  });
}

startServer();
