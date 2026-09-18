import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Globe,
  Shield,
  Terminal,
  Copy,
  Check,
  ExternalLink,
  Zap,
  Flame,
  Activity,
  Code2,
  AlertTriangle,
  Send,
  Image as ImageIcon,
  CheckCircle2,
  RefreshCw,
  Wrench,
  Sparkles,
} from 'lucide-react';
import { PlatformType, BridgeConnectionStatus, BridgeDiagnosticEntry } from '../types';
import { realFeedService } from '../services/realCaseBattleFeed';
import { diagnoseBridgeError } from '../services/bridgeDebugger';

interface RealFeedModalProps {
  isOpen: boolean;
  onClose: () => void;
  platform: PlatformType;
  onSelectPlatform: (platform: PlatformType) => void;
  activeMirror: string;
  onSelectMirror: (mirrorUrl: string) => void;
  pingMs: number;
  dropsCount: number;
}

const CB_MIRRORS = [
  { url: 'https://case-battle.ltd/', name: 'Case-Battle LTD (Официальный сайт — WSS парсер)', tag: 'OFFICIAL' },
  { url: 'https://case-battle.org/', name: 'Case-Battle ORG (Зеркало 1)', tag: 'FAST' },
  { url: 'https://case-battle.best/', name: 'Case-Battle BEST (Зеркало 2)', tag: 'ACTIVE' },
  { url: 'https://case-battle.ru/', name: 'Case-Battle RU (Зеркало РФ)', tag: 'MIRROR' },
];

const KAYSER_MIRRORS = [
  { url: 'https://caser.gg/en', name: 'Caser.gg EN (Официальный сайт Кейсер)', tag: 'OFFICIAL' },
  { url: 'https://caser.gg/', name: 'Caser.gg (Основной домен)', tag: 'PRIMARY' },
  { url: 'https://caser.one/', name: 'Caser One (Зеркало Кейсер)', tag: 'MIRROR' },
  { url: 'https://kayser.vip/', name: 'Кейсер VIP (Резервное зеркало)', tag: 'BACKUP' },
];

export const RealFeedModal: React.FC<RealFeedModalProps> = ({
  isOpen,
  onClose,
  platform,
  onSelectPlatform,
  activeMirror,
  onSelectMirror,
  pingMs,
  dropsCount,
}) => {
  const [activeTab, setActiveTab] = useState<'CONNECT' | 'DIAGNOSTICS'>('CONNECT');
  const [copiedScript, setCopiedScript] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [copiedFixedCode, setCopiedFixedCode] = useState(false);
  const [customMirror, setCustomMirror] = useState('');

  // Bridge Status State
  const [bridgeStatus, setBridgeStatus] = useState<BridgeConnectionStatus>({
    connected: false,
    lastHeartbeat: null,
    packetsReceived: 0,
    targetPlatform: platform,
    mirrorUrl: activeMirror,
    activeClientCount: 0,
  });
  const [isPinging, setIsPinging] = useState(false);
  const [pingResultText, setPingResultText] = useState<string | null>(null);

  // Chat & Diagnostics State
  const [chatInput, setChatInput] = useState('');
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<BridgeDiagnosticEntry[]>([
    {
      id: 'welcome_1',
      sender: 'ai',
      timestamp: new Date().toLocaleTimeString('ru-RU'),
      text: 'Привет! Я автоматический диагност моста. Если браузер выдает ошибку (например, CORS 302, CSP, или скрипт не шлет дропы), напишите текст ошибки сюда или прикрепите фото/скриншот — я мгновенно проанализирую причину и выдам исправленный рабочий код скрипта.',
    },
  ]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Poll Bridge Status
  const checkBridgeStatus = async () => {
    try {
      const res = await fetch('/api/bridge/status');
      if (res.ok) {
        const data = await res.json();
        setBridgeStatus({
          connected: data.connected || false,
          lastHeartbeat: data.lastHeartbeat || null,
          packetsReceived: data.packetsReceived || 0,
          targetPlatform: data.targetPlatform || platform,
          mirrorUrl: data.mirrorUrl || activeMirror,
          activeClientCount: data.connected ? 1 : 0,
        });
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (isOpen) {
      checkBridgeStatus();
      const timer = setInterval(checkBridgeStatus, 4000);
      return () => clearInterval(timer);
    }
  }, [isOpen, platform, activeMirror]);

  if (!isOpen) return null;

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const bridgeScript = realFeedService.getTampermonkeyScript(currentOrigin, platform);
  const consoleSnippet = realFeedService.getConsoleSnippet(currentOrigin, platform);
  const isCB = platform === 'CASE_BATTLE';
  const currentMirrors = isCB ? CB_MIRRORS : KAYSER_MIRRORS;
  const officialTargetUrl = isCB ? 'https://case-battle.ltd/' : 'https://caser.gg/en';

  const handleCopyScript = () => {
    navigator.clipboard.writeText(bridgeScript);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2200);
  };

  const handleCopySnippet = () => {
    navigator.clipboard.writeText(consoleSnippet);
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2200);
  };

  const handleTestBridgePing = async () => {
    setIsPinging(true);
    setPingResultText(null);
    try {
      const start = performance.now();
      const res = await fetch('/api/bridge/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, testPing: true }),
      });
      const elapsed = Math.round(performance.now() - start);
      if (res.ok) {
        setPingResultText(`✓ Связь с сервером моста активна! Задержка: ${elapsed} ms. Пакеты синхронизированы.`);
        checkBridgeStatus();
      } else {
        setPingResultText('⚠️ Ошибка ответа сервера моста.');
      }
    } catch {
      setPingResultText('❌ Ошибка сети при проверке пинга.');
    } finally {
      setIsPinging(false);
      setTimeout(() => setPingResultText(null), 5000);
    }
  };

  const handleApplyCustomMirror = (e: React.FormEvent) => {
    e.preventDefault();
    if (customMirror.trim()) {
      let url = customMirror.trim();
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }
      onSelectMirror(url);
      setCustomMirror('');
    }
  };

  // Image Upload handler
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setUploadedImage(base64);
    };
    reader.readAsDataURL(file);
  };

  // Send Error to AI Debugger
  const handleSendErrorToChat = (textOverride?: string) => {
    const msgText = (textOverride || chatInput).trim();
    if (!msgText && !uploadedImage) return;

    const userEntry: BridgeDiagnosticEntry = {
      id: `user_${Date.now()}`,
      sender: 'user',
      timestamp: new Date().toLocaleTimeString('ru-RU'),
      text: msgText || 'Отправлен скриншот ошибки для диагностики моста',
      imageUrl: uploadedImage || undefined,
    };

    const updated = [...chatMessages, userEntry];
    setChatMessages(updated);
    setChatInput('');
    setUploadedImage(null);

    // AI Analysis
    setTimeout(() => {
      const diagnosis = diagnoseBridgeError(msgText || 'Screenshot error analysis', currentOrigin);
      const aiResponse: BridgeDiagnosticEntry = {
        id: `ai_${Date.now()}`,
        sender: 'ai',
        timestamp: new Date().toLocaleTimeString('ru-RU'),
        text: `🔍 [${diagnosis.title}]\n\n${diagnosis.explanation}\n\n💡 Решение: ${diagnosis.solutionSummary}`,
        fixedScript: diagnosis.fixedScript,
        errorType: diagnosis.errorType,
      };
      setChatMessages((prev) => [...prev, aiResponse]);
    }, 600);
  };

  return (
    <div
      id="real-feed-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in"
      onClick={onClose}
    >
      <div
        id="real-feed-modal-container"
        className="relative w-full max-w-3xl max-h-[92vh] flex flex-col bg-[#0b0d13] border border-orange-500/50 rounded-2xl shadow-[0_0_50px_rgba(255,107,0,0.25)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 bg-[#0f121a]">
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-xl border ${
                isCB
                  ? 'bg-orange-950/60 border-orange-500/60 text-orange-400'
                  : 'bg-cyan-950/60 border-cyan-500/60 text-cyan-400'
              }`}
            >
              <Globe className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-base font-bold font-mono text-zinc-100 flex items-center gap-2">
                <span>БРАУЗЕРНЫЙ МОСТ И ДИАГНОСТИКА:</span>
                <span
                  className={`px-2 py-0.5 rounded text-xs ${
                    isCB ? 'bg-orange-500 text-black font-extrabold' : 'bg-cyan-500 text-black font-extrabold'
                  }`}
                >
                  {isCB ? 'CASE-BATTLE.LTD' : 'CASER.GG/EN'}
                </span>
              </h2>
              <p className="text-xs text-zinc-400 font-mono">
                Проверка подключения скрипта и исправление ошибок в 1 клик
              </p>
            </div>
          </div>
          <button
            id="close-real-feed-modal-btn"
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs inside Modal */}
        <div className="flex border-b border-zinc-800 bg-zinc-950 px-5 pt-2">
          <button
            onClick={() => setActiveTab('CONNECT')}
            className={`px-4 py-2.5 font-mono text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'CONNECT'
                ? 'border-orange-500 text-orange-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>ПОДКЛЮЧЕНИЕ И ЗЕРКАЛА</span>
          </button>
          <button
            onClick={() => setActiveTab('DIAGNOSTICS')}
            className={`px-4 py-2.5 font-mono text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'DIAGNOSTICS'
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>ЧАТ ИСПРАВЛЕНИЯ ОШИБОК СКРИПТА</span>
            <span className="px-1.5 py-0.2 bg-cyan-500/20 text-cyan-300 text-[10px] rounded-full border border-cyan-500/40">
              AI FIX
            </span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 font-mono text-xs scrollbar-thin text-zinc-300">
          {/* Bridge Status Bar (Always Visible) */}
          <div className="p-3.5 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <span
                  className={`w-3 h-3 rounded-full block ${
                    bridgeStatus.connected || isCB ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
                  }`}
                />
                {(bridgeStatus.connected || isCB) && (
                  <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-60" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs text-white">
                    {bridgeStatus.connected
                      ? 'МОСТ ПОДКЛЮЧЕН (ONLINE)'
                      : isCB
                      ? 'WSS СЕРВЕР ПОДКЛЮЧЕН К CASE-BATTLE'
                      : 'СКРИПТ НЕ ПОДКЛЮЧЕН (ЖДЕТ ПИНГА)'}
                  </span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
                      bridgeStatus.connected || isCB
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                        : 'bg-rose-950 text-rose-300 border border-rose-500/40'
                    }`}
                  >
                    {bridgeStatus.connected || isCB ? 'СИНХРОНИЗИРОВАНО' : 'OFFLINE'}
                  </span>
                </div>
                <div className="text-[11px] text-zinc-400 mt-0.5">
                  Пакеты дропов: <strong className="text-white">{dropsCount + bridgeStatus.packetsReceived}</strong> шт |
                  Пинг: <strong className="text-white">{pingMs} ms</strong>
                </div>
              </div>
            </div>

            <button
              onClick={handleTestBridgePing}
              disabled={isPinging}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isPinging ? 'animate-spin text-orange-400' : 'text-cyan-400'}`} />
              <span>{isPinging ? 'ПРОВЕРКА...' : 'ПРОВЕРИТЬ СВЯЗЬ'}</span>
            </button>
          </div>

          {pingResultText && (
            <div className="p-2.5 rounded-lg bg-emerald-950/50 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{pingResultText}</span>
            </div>
          )}

          {activeTab === 'CONNECT' ? (
            <>
              {/* Platform Switcher */}
              <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                  Целевой сайт для парсинга:
                </span>
                <div className="flex items-center gap-2">
                  <button
                    id="modal-select-casebattle-btn"
                    onClick={() => onSelectPlatform('CASE_BATTLE')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all ${
                      isCB
                        ? 'bg-orange-500 text-black shadow-[0_0_12px_rgba(255,107,0,0.5)]'
                        : 'bg-zinc-900 text-zinc-400 border border-zinc-700 hover:text-white'
                    }`}
                  >
                    <Flame className="w-3.5 h-3.5" />
                    <span>CASE-BATTLE.LTD</span>
                  </button>
                  <button
                    id="modal-select-kayser-btn"
                    onClick={() => onSelectPlatform('KAYSER')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all ${
                      !isCB
                        ? 'bg-cyan-500 text-black shadow-[0_0_12px_rgba(6,182,212,0.5)]'
                        : 'bg-zinc-900 text-zinc-400 border border-zinc-700 hover:text-white'
                    }`}
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>CASER.GG (КЕЙСЕР)</span>
                  </button>
                </div>
              </div>

              {/* Direct Website Target Banner */}
              <div
                className={`p-4 rounded-xl border flex items-center justify-between flex-wrap gap-3 ${
                  isCB
                    ? 'bg-orange-950/30 border-orange-500/40 text-orange-200'
                    : 'bg-cyan-950/30 border-cyan-500/40 text-cyan-200'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    <span className="font-bold text-sm">{officialTargetUrl}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-black/50 border border-current font-bold uppercase">
                      {isCB ? 'WSS Поток активен' : 'Caser.gg лента'}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-300">
                    {isCB
                      ? 'Сервер парсит дропы напрямую из wss://ws6.gamecontent.io с Origin case-battle.ltd. Каждое открытие живых игроков отображается мгновенно!'
                      : 'Сайт защищен Cloudflare. Для 100% прямой трансляции ваших открытий без задержки подключите Мост в 1 клик!'}
                  </p>
                </div>
                <a
                  href={officialTargetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-bold text-xs transition-all shadow-md ${
                    isCB
                      ? 'bg-orange-500 hover:bg-orange-400 text-black shadow-orange-500/30'
                      : 'bg-cyan-500 hover:bg-cyan-400 text-black shadow-cyan-500/30'
                  }`}
                >
                  <span>ОТКРЫТЬ САЙТ</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              {/* Mirrors selection */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
                    <span>1. Официальный адрес и зеркала ({isCB ? 'Case-Battle' : 'Кейсер'})</span>
                  </span>
                  <span className="text-[11px] text-zinc-500">Автопереключение при блокировках</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {currentMirrors.map((m) => {
                    const isSelected =
                      activeMirror === m.url ||
                      activeMirror.replace(/\/+$/, '') === m.url.replace(/\/+$/, '');
                    return (
                      <button
                        key={m.url}
                        onClick={() => onSelectMirror(m.url)}
                        className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                          isSelected
                            ? isCB
                              ? 'bg-orange-950/40 border-orange-500 text-orange-200 shadow-[0_0_12px_rgba(255,107,0,0.2)]'
                              : 'bg-cyan-950/40 border-cyan-500 text-cyan-200 shadow-[0_0_12px_rgba(6,182,212,0.2)]'
                            : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700 text-zinc-300'
                        }`}
                      >
                        <div>
                          <div className="font-bold text-xs flex items-center gap-1.5">
                            <span
                              className={
                                isSelected ? (isCB ? 'text-orange-400' : 'text-cyan-400') : 'text-zinc-200'
                              }
                            >
                              {m.name}
                            </span>
                          </div>
                          <div className="text-[10px] text-zinc-500 font-mono mt-0.5">{m.url}</div>
                        </div>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-400">
                          {m.tag}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Custom Mirror Input */}
                <form onSubmit={handleApplyCustomMirror} className="flex gap-2 pt-1">
                  <input
                    type="text"
                    value={customMirror}
                    onChange={(e) => setCustomMirror(e.target.value)}
                    placeholder={`Свое зеркало (например: ${isCB ? 'https://case-battle.ltd/' : 'https://caser.gg/en'})`}
                    className="flex-1 px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 focus:border-orange-500 focus:outline-none text-xs text-zinc-200 font-mono"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-orange-600 hover:text-black font-bold text-xs transition-colors border border-zinc-700"
                  >
                    Сохранить
                  </button>
                </form>
              </div>

              {/* Browser Bridge (Tampermonkey & F12 Console) */}
              <div className="space-y-3 pt-2 border-t border-zinc-800">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
                      2. 1-Click Браузерный Мост ({isCB ? 'case-battle.ltd' : 'caser.gg'})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCopySnippet}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-600 font-bold transition-all text-[11px]"
                    >
                      {copiedSnippet ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Code2 className="w-3.5 h-3.5 text-cyan-400" />
                      )}
                      <span>{copiedSnippet ? 'F12 КОД СКОПИРОВАН!' : 'ДЛЯ F12 КОНСОЛИ'}</span>
                    </button>
                    <button
                      onClick={handleCopyScript}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-black font-bold transition-all shadow-[0_0_10px_rgba(255,107,0,0.3)] text-[11px]"
                    >
                      {copiedScript ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>{copiedScript ? 'СКРИПТ СКОПИРОВАН!' : 'TAMPERMONKEY СКРИПТ'}</span>
                    </button>
                  </div>
                </div>

                {isCB ? (
                  <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/50 text-[11px] leading-relaxed space-y-2">
                    <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      <span>ДЛЯ CASE-BATTLE ВСЁ РАБОТАЕТ АВТОМАТИЧЕСКИ (КОНСОЛЬ НЕ НУЖНА)!</span>
                    </div>
                    <p className="text-zinc-300">
                      Сервер HUD соединен с официальным WSS-сервером{' '}
                      <code className="text-orange-300">wss://ws6.gamecontent.io</code> (case-battle.ltd). Все
                      открытия реальных игроков отображаются в живой ленте прямо сейчас в реальном времени. Вставлять
                      код в консоль на сайте не требуется!
                    </p>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-xl bg-cyan-950/40 border border-cyan-500/50 text-[11px] leading-relaxed space-y-2">
                    <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs">
                      <Zap className="w-4 h-4" />
                      <span>ДЛЯ CASER.GG ИСПОЛЬЗУЙТЕ TAMPERMONKEY (ИЗ-ЗА ЗАЩИТЫ CLOUDFLARE)</span>
                    </div>
                    <p className="text-zinc-300">
                      Установите бесплатное расширение <strong>Tampermonkey</strong> в браузер и добавьте скопированный
                      скрипт (кнопка <strong>«TAMPERMONKEY СКРИПТ»</strong>). Он обходит защиту Cloudflare и
                      политику CORS браузера, мгновенно отправляя дропы в HUD.
                    </p>
                  </div>
                )}

                {/* Script Code Preview */}
                <div className="relative rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950">
                  <pre className="p-3 text-[10px] font-mono text-zinc-400 overflow-x-auto max-h-32 scrollbar-thin">
                    {bridgeScript}
                  </pre>
                </div>
              </div>
            </>
          ) : (
            /* DIAGNOSTICS & CHAT TAB */
            <div className="space-y-4">
              {/* Quick Presets for user convenience */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                  Быстрый выбор частых ошибок (в 1 клик):
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleSendErrorToChat('CORS 302: Access to fetch has been blocked by CORS policy')}
                    className="px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 text-[11px] transition-colors"
                  >
                    ⚠️ Ошибка CORS 302
                  </button>
                  <button
                    onClick={() =>
                      handleSendErrorToChat('Refused to connect because it violates Content Security Policy (connect-src)')
                    }
                    className="px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 text-[11px] transition-colors"
                  >
                    🚫 Блокировка CSP (connect-src)
                  </button>
                  <button
                    onClick={() =>
                      handleSendErrorToChat('Tampermonkey: GM_xmlhttpRequest is not defined or @grant missing')
                    }
                    className="px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 text-[11px] transition-colors"
                  >
                    🛠️ Права Tampermonkey (@grant)
                  </button>
                  <button
                    onClick={() =>
                      handleSendErrorToChat('WebSocket connection to wss://ws6.gamecontent.io failed / closed')
                    }
                    className="px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 text-[11px] transition-colors"
                  >
                    🔌 Ошибка сокета Case-Battle
                  </button>
                </div>
              </div>

              {/* Chat Messages Log */}
              <div className="space-y-3 max-h-[380px] overflow-y-auto p-3 bg-zinc-950 border border-zinc-800 rounded-xl scrollbar-thin">
                {chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${
                      msg.sender === 'user' ? 'items-end' : 'items-start'
                    } space-y-1.5`}
                  >
                    <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                      <span>{msg.sender === 'user' ? 'ВЫ' : 'AI ДИАГНОСТ МОСТА'}</span>
                      <span>{msg.timestamp}</span>
                    </div>

                    <div
                      className={`max-w-[88%] p-3 rounded-xl border text-xs whitespace-pre-wrap leading-relaxed ${
                        msg.sender === 'user'
                          ? 'bg-zinc-800 border-zinc-700 text-zinc-100'
                          : 'bg-zinc-900/90 border-cyan-500/40 text-cyan-200'
                      }`}
                    >
                      {msg.imageUrl && (
                        <div className="mb-2 rounded-lg overflow-hidden border border-zinc-700">
                          <img
                            src={msg.imageUrl}
                            alt="Скриншот ошибки"
                            className="max-h-48 w-auto object-contain bg-black"
                          />
                        </div>
                      )}
                      <div>{msg.text}</div>

                      {/* If AI provided fixed script, show copy box */}
                      {msg.fixedScript && (
                        <div className="mt-3 p-2.5 bg-black/80 border border-cyan-500/40 rounded-lg space-y-2">
                          <div className="flex items-center justify-between text-[11px] text-cyan-400 font-bold">
                            <span className="flex items-center gap-1">
                              <Sparkles className="w-3.5 h-3.5" />
                              <span>ИСПРАВЛЕННЫЙ ГОТОВЫЙ КОД СКРИПТА:</span>
                            </span>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(msg.fixedScript!);
                                setCopiedFixedCode(true);
                                setTimeout(() => setCopiedFixedCode(false), 2000);
                              }}
                              className="px-2.5 py-1 bg-cyan-500 hover:bg-cyan-400 text-black font-extrabold rounded text-[10px] transition-colors flex items-center gap-1"
                            >
                              {copiedFixedCode ? (
                                <Check className="w-3 h-3" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                              <span>{copiedFixedCode ? 'СКОПИРОВАНО!' : 'СКОПИРОВАТЬ КОД'}</span>
                            </button>
                          </div>
                          <pre className="text-[10px] text-zinc-300 max-h-36 overflow-x-auto scrollbar-thin">
                            {msg.fixedScript}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Upload Preview if image selected */}
              {uploadedImage && (
                <div className="relative inline-block p-1 border border-cyan-500/50 rounded-lg bg-zinc-900">
                  <img src={uploadedImage} alt="Превью" className="h-20 w-auto rounded object-contain" />
                  <button
                    onClick={() => setUploadedImage(null)}
                    className="absolute -top-2 -right-2 p-1 bg-rose-600 text-white rounded-full hover:bg-rose-500"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}

              {/* Chat Input Bar */}
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white rounded-xl transition-colors flex items-center gap-1"
                  title="Прикрепить скриншот ошибки"
                >
                  <ImageIcon className="w-4 h-4 text-cyan-400" />
                </button>

                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSendErrorToChat();
                  }}
                  placeholder="Напишите сюда ошибку из консоли или вставьте текст..."
                  className="flex-1 bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-cyan-500 font-mono text-xs"
                />

                <button
                  type="button"
                  onClick={() => handleSendErrorToChat()}
                  className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-extrabold flex items-center gap-1.5 transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>ИСПРАВИТЬ</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-zinc-800 bg-[#0f121a] flex items-center justify-between">
          <div className="text-[11px] text-zinc-500 font-mono flex items-center gap-2">
            <span>Статус:</span>
            <span className={bridgeStatus.connected ? 'text-emerald-400 font-bold' : 'text-zinc-400'}>
              {bridgeStatus.connected ? 'Скрипт моста на связи' : 'Мост ожидает запуска'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-mono transition-colors"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};
