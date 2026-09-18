import React from 'react';
import { Terminal, Radio, Volume2, VolumeX, Eye, Code, Play, Pause, Zap, Globe, DollarSign, Flame, ShieldCheck, Scale } from 'lucide-react';
import { CaseDefinition, DataSourceMode, CurrencyMode, PlatformType } from '../types';

interface HeaderProps {
  platform: PlatformType;
  onSelectPlatform: (platform: PlatformType) => void;
  currentCase: CaseDefinition;
  cases: CaseDefinition[];
  onSelectCase: (caseDef: CaseDefinition) => void;
  isRunning: boolean;
  onToggleRunning: () => void;
  audioMuted: boolean;
  onToggleAudio: () => void;
  streamerMode: boolean;
  onToggleStreamerMode: () => void;
  onOpenPythonModal: () => void;
  onOpenRealFeedModal: () => void;
  onOpenProvablyFairModal?: () => void;
  onOpenRtpCheckerModal?: () => void;
  pingMs: number;
  openSpeed: number;
  onChangeSpeed: (speed: number) => void;
  dataSourceMode: DataSourceMode;
  onToggleDataSource: () => void;
  currency: CurrencyMode;
  onToggleCurrency: () => void;
  activeMirror: string;
  realDropsCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  platform,
  onSelectPlatform,
  currentCase,
  cases,
  onSelectCase,
  isRunning,
  onToggleRunning,
  audioMuted,
  onToggleAudio,
  streamerMode,
  onToggleStreamerMode,
  onOpenPythonModal,
  onOpenRealFeedModal,
  onOpenProvablyFairModal,
  onOpenRtpCheckerModal,
  pingMs,
  openSpeed,
  onChangeSpeed,
  dataSourceMode,
  onToggleDataSource,
  currency,
  onToggleCurrency,
  activeMirror,
  realDropsCount,
}) => {
  const isReal = dataSourceMode === 'REAL_API';
  const isCB = platform === 'CASE_BATTLE';

  return (
    <header
      id="app-header"
      className="border-b border-zinc-800/80 bg-[#0a0c10]/95 backdrop-blur-md px-3 sm:px-4 py-2.5 sticky top-0 z-40"
    >
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Logo & Title & Platform Toggle */}
        <div className="flex items-center gap-3">
          <div className={`relative flex items-center justify-center w-10 h-10 rounded-lg ${isCB ? 'bg-orange-950/40 border-orange-500/50 shadow-[0_0_12px_rgba(255,107,0,0.3)]' : 'bg-cyan-950/40 border-cyan-500/50 shadow-[0_0_12px_rgba(6,182,212,0.3)]'} border`}>
            {isCB ? (
              <Flame className="w-5 h-5 text-orange-400 animate-pulse" />
            ) : (
              <Zap className="w-5 h-5 text-cyan-400 animate-pulse" />
            )}
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isReal ? 'bg-red-400' : 'bg-emerald-400'}`}></span>
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isReal ? 'bg-red-500' : 'bg-emerald-500'}`}></span>
            </span>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold tracking-wider font-mono text-zinc-100 flex items-center gap-2">
                <span className={isCB ? 'text-orange-500' : 'text-cyan-400'}>
                  {isCB ? 'CASE-BATTLE.LTD' : 'CASER.GG'}
                </span>
                <span className={isReal ? 'text-red-400' : 'text-emerald-400'}>
                  {isReal ? 'LIVE HUD' : 'HELPER'}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700 font-sans">
                  v2.6
                </span>
              </h1>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-zinc-400 font-mono">
              <button
                onClick={onOpenRealFeedModal}
                className="flex items-center gap-1.5 hover:text-orange-400 transition-colors cursor-pointer"
                title="Настроить зеркало и мост"
              >
                <Radio className={`w-3.5 h-3.5 animate-pulse ${isReal ? 'text-red-400' : 'text-emerald-400'}`} />
                <span className={isReal ? 'text-red-400 font-bold' : 'text-emerald-400 font-semibold'}>
                  {isReal ? 'LIVE STREAM' : 'SIMULATION'}
                </span>
                <span className="text-zinc-500">({pingMs}ms)</span>
              </button>
              <span className="text-zinc-600">|</span>
              <span className="text-zinc-400 hidden sm:inline truncate max-w-[160px]">
                {isReal ? activeMirror.replace('https://', '') : 'ВИТРИНА КЕЙСОВ'}
              </span>
            </div>
          </div>
        </div>

        {/* Center: Dedicated Platform Switcher (Case-Battle vs Кейсер) */}
        <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded-xl p-1 text-xs font-mono shadow-[0_0_15px_rgba(0,0,0,0.5)]">
          <button
            id="platform-casebattle-btn"
            onClick={() => onSelectPlatform('CASE_BATTLE')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all font-bold ${
              isCB
                ? 'bg-orange-500 text-black shadow-[0_0_14px_rgba(255,107,0,0.6)]'
                : 'text-zinc-400 hover:text-orange-300'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>CASE-BATTLE.LTD</span>
          </button>
          <button
            id="platform-kayser-btn"
            onClick={() => onSelectPlatform('KAYSER')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all font-bold ${
              !isCB
                ? 'bg-cyan-500 text-black shadow-[0_0_14px_rgba(6,182,212,0.6)]'
                : 'text-zinc-400 hover:text-cyan-300'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>CASER.GG</span>
          </button>
        </div>

        {/* Real API / Simulator Mode Switcher + Controls */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Main Mode Toggle: Real API vs Simulation */}
          <div className="flex items-center bg-zinc-900 border border-zinc-700/80 rounded-lg p-0.5 text-xs font-mono">
            <button
              id="mode-real-api-btn"
              onClick={() => {
                if (!isReal) onToggleDataSource();
              }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded transition-all ${
                isReal
                  ? 'bg-red-600 text-white font-bold shadow-[0_0_10px_rgba(239,68,68,0.5)]'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <span className="h-2 w-2 rounded-full bg-red-400 animate-pulse"></span>
              <span>РЕАЛЬНОЕ АПИ</span>
            </button>
            <button
              id="mode-simulator-btn"
              onClick={() => {
                if (isReal) onToggleDataSource();
              }}
              className={`px-2.5 py-1 rounded transition-all ${
                !isReal
                  ? 'bg-zinc-700 text-white font-bold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              СИМУЛЯТОР
            </button>
          </div>

          {/* Currency Toggle: RUB (₽) vs USD ($) */}
          <button
            id="toggle-currency-btn"
            onClick={onToggleCurrency}
            title="Сменить валюту: Рубли (₽) / Доллары ($)"
            className="flex items-center gap-1 px-2 py-1 bg-zinc-900 border border-zinc-700 hover:border-orange-500/60 rounded-lg text-xs font-mono font-bold text-orange-400 transition-colors"
          >
            <span>{currency === 'RUB' ? '₽ RUB' : '$ USD'}</span>
          </button>

          {/* Mirror & Bridge Modal Button */}
          <button
            id="open-mirror-settings-btn"
            onClick={onOpenRealFeedModal}
            title="Настройка зеркал, проверка связи и исправление ошибок моста"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono bg-zinc-900 border border-zinc-700 hover:border-orange-500/80 text-zinc-200 transition-colors"
          >
            <Globe className="w-3.5 h-3.5 text-orange-400" />
            <span className="hidden md:inline">МОСТ / ЧАТ ОШИБОК</span>
          </button>

          {/* Provably Fair Cryptographic Modal Button */}
          {onOpenProvablyFairModal && (
            <button
              id="open-provably-fair-btn"
              onClick={onOpenProvablyFairModal}
              title="Проверка честности Provably Fair (Client Seed, Nonce, Server Seed)"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono bg-cyan-950/60 border border-cyan-500/50 hover:border-cyan-400 text-cyan-300 transition-all shadow-[0_0_10px_rgba(6,182,212,0.2)]"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline font-bold">PROVABLY FAIR</span>
              <span className="text-[10px] px-1 rounded bg-cyan-500 text-black font-extrabold">СИДЫ</span>
            </button>
          )}

          {/* RTP & Timing Roll Checker Button */}
          {onOpenRtpCheckerModal && (
            <button
              id="open-rtp-checker-btn"
              onClick={onOpenRtpCheckerModal}
              title="Чекер фиксации шансов и тайминга ролла (RTP 80+)"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono bg-gradient-to-r from-orange-950/70 to-amber-950/60 border border-orange-500/60 hover:border-orange-400 text-orange-300 transition-all shadow-[0_0_12px_rgba(255,107,0,0.25)] cursor-pointer"
            >
              <Scale className="w-3.5 h-3.5 text-orange-400" />
              <span className="hidden sm:inline font-bold">ЧЕКЕР RTP</span>
              <span className="text-[10px] px-1 rounded bg-orange-500 text-black font-extrabold">80+</span>
            </button>
          )}

          {/* Case Picker (Active in Simulation mode) */}
          {!isReal && (
            <div className="flex items-center bg-zinc-900 border border-zinc-700/80 rounded-lg px-2 py-1 text-xs font-mono">
              <span className="text-zinc-400 mr-1.5 flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-orange-400" />
              </span>
              <select
                id="case-selector"
                value={currentCase.id}
                onChange={(e) => {
                  const found = cases.find((c) => c.id === e.target.value);
                  if (found) onSelectCase(found);
                }}
                aria-label="Select active case"
                className="bg-transparent text-orange-400 font-bold focus:outline-none cursor-pointer max-w-[130px] truncate"
              >
                {cases.map((c) => (
                  <option key={c.id} value={c.id} className="bg-zinc-900 text-zinc-200">
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Speed Selector */}
          <div className="hidden lg:flex items-center bg-zinc-900/90 border border-zinc-800 rounded-lg p-0.5 text-xs font-mono">
            <button
              onClick={() => onChangeSpeed(2500)}
              className={`px-2 py-1 rounded transition-all ${
                openSpeed === 2500 ? 'bg-orange-500 text-black font-bold' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              2.5s
            </button>
            <button
              onClick={() => onChangeSpeed(1400)}
              className={`px-2 py-1 rounded transition-all ${
                openSpeed === 1400 ? 'bg-orange-500 text-black font-bold' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              1.4s
            </button>
            <button
              onClick={() => onChangeSpeed(700)}
              className={`px-2 py-1 rounded transition-all ${
                openSpeed === 700 ? 'bg-orange-500 text-black font-bold' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              0.7s
            </button>
          </div>

          {/* Pause / Play Button */}
          <button
            id="toggle-stream-btn"
            onClick={onToggleRunning}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold transition-all border ${
              isRunning
                ? 'bg-emerald-950/40 text-emerald-400 border-emerald-500/40 hover:bg-emerald-900/40 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
                : 'bg-yellow-950/40 text-yellow-400 border-yellow-500/40 hover:bg-yellow-900/40'
            }`}
          >
            {isRunning ? (
              <>
                <Pause className="w-3.5 h-3.5" /> PAUSE
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" /> RESUME
              </>
            )}
          </button>

          {/* Audio toggle */}
          <button
            id="toggle-audio-btn"
            onClick={onToggleAudio}
            title={audioMuted ? 'Включить киберпанк звук' : 'Выключить звук'}
            aria-label={audioMuted ? 'Включить киберпанк звук' : 'Выключить звук'}
            className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-orange-400 hover:border-orange-500/40 transition-colors"
          >
            {audioMuted ? <VolumeX className="w-4 h-4 text-zinc-500" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          </button>

          {/* Streamer Mode Toggle */}
          <button
            id="toggle-streamer-mode-btn"
            onClick={onToggleStreamerMode}
            title="Режим стримера (крупный SCORE, скрытие лишних окон)"
            aria-label="Toggle streamer mode"
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold transition-all border ${
              streamerMode
                ? 'bg-orange-500 text-black border-orange-400 shadow-[0_0_12px_rgba(255,107,0,0.5)]'
                : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">STREAMER</span>
          </button>

          {/* Python script modal trigger */}
          <button
            id="open-python-code-btn"
            onClick={onOpenPythonModal}
            title="Открыть оригинальный автономный Python/Tkinter скрипт"
            aria-label="Open python script"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 hover:border-zinc-700 transition-colors"
          >
            <Code className="w-3.5 h-3.5 text-orange-400" />
            <span className="hidden sm:inline">PYTHON</span>
          </button>
        </div>
      </div>
    </header>
  );
};
