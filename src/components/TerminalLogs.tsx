import React, { useState, useRef, useEffect } from 'react';
import {
  Terminal,
  Trash2,
  Send,
  ShieldAlert,
  Cpu,
  Flame,
  Snowflake,
  Bell,
  BellOff,
  Sliders,
  Volume2,
  VolumeX,
  Zap,
  TrendingUp,
  TrendingDown,
  Info,
} from 'lucide-react';
import { TerminalLogEntry, LogLevel, RtpAlertConfig } from '../types';

interface TerminalLogsProps {
  logs: TerminalLogEntry[];
  onClearLogs: () => void;
  onInjectSeedAnalysis: () => void;
  onExecuteCommand: (cmd: string) => void;
  last50Rtp?: number;
  totalDropsCount?: number;
  alertConfig: RtpAlertConfig;
  onUpdateAlertConfig: (newConfig: Partial<RtpAlertConfig>) => void;
  onTriggerTestAlert?: (type: 'HOT' | 'COLD') => void;
}

export const TerminalLogs: React.FC<TerminalLogsProps> = ({
  logs,
  onClearLogs,
  onInjectSeedAnalysis,
  onExecuteCommand,
  last50Rtp = 100,
  totalDropsCount = 0,
  alertConfig,
  onUpdateAlertConfig,
  onTriggerTestAlert,
}) => {
  const [filter, setFilter] = useState<LogLevel | 'ALL'>('ALL');
  const [commandInput, setCommandInput] = useState('');
  const [showConfig, setShowConfig] = useState(false);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Auto scroll on new logs
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const filteredLogs = filter === 'ALL' ? logs : logs.filter((l) => l.level === filter);

  const isHot = last50Rtp >= alertConfig.hotThreshold;
  const isCold = last50Rtp <= alertConfig.coldThreshold;

  const handleCommandSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commandInput.trim()) return;
    onExecuteCommand(commandInput.trim());
    setCommandInput('');
  };

  const getLevelStyle = (level: LogLevel) => {
    switch (level) {
      case 'HOT':
        return 'text-orange-300 bg-orange-950/80 border-orange-500 font-bold animate-pulse shadow-orange-950/50 shadow-sm';
      case 'COLD':
        return 'text-cyan-300 bg-cyan-950/80 border-cyan-500 font-bold shadow-cyan-950/50 shadow-sm';
      case 'ALERT':
        return 'text-red-300 bg-red-950/80 border-red-500 font-bold';
      case 'SUCCESS':
        return 'text-emerald-400 bg-emerald-950/60 border-emerald-500/40';
      case 'WARN':
        return 'text-amber-400 bg-amber-950/60 border-amber-500/40';
      case 'ENTROPY':
        return 'text-cyan-400 bg-cyan-950/60 border-cyan-500/40';
      case 'PREDICTION':
        return 'text-fuchsia-400 bg-fuchsia-950/60 border-fuchsia-500/40';
      case 'SYSTEM':
        return 'text-orange-400 bg-orange-950/60 border-orange-500/40';
      case 'INFO':
      default:
        return 'text-zinc-300 bg-zinc-900 border-zinc-800';
    }
  };

  return (
    <section
      id="terminal-logs-section"
      className="bg-[#090b10] border border-zinc-800/90 rounded-xl overflow-hidden shadow-2xl backdrop-blur-md font-mono flex flex-col"
    >
      {/* Terminal Title Bar */}
      <div className="px-3 sm:px-4 py-2 bg-[#0c0f16] border-b border-zinc-800 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-emerald-400" />
          <h2 className="text-xs font-bold text-zinc-200 tracking-wider">
            CYBERPUNK TERMINAL // TELEMETRY & RTP ALERTS
          </h2>
        </div>

        {/* Live 50-Drop RTP Badge & Status */}
        <div className="flex items-center gap-2">
          <div
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold border transition-all ${
              isHot
                ? 'bg-orange-950/80 border-orange-500/80 text-orange-300 shadow-sm shadow-orange-500/20 animate-pulse'
                : isCold
                ? 'bg-cyan-950/80 border-cyan-500/80 text-cyan-300 shadow-sm shadow-cyan-500/20'
                : 'bg-zinc-900/90 border-zinc-700/80 text-zinc-300'
            }`}
            title={`RTP за последние ${Math.min(50, Math.max(1, totalDropsCount))} открытий: ${last50Rtp.toFixed(1)}%`}
          >
            {isHot ? (
              <Flame className="w-3.5 h-3.5 text-orange-400 fill-orange-400" />
            ) : isCold ? (
              <Snowflake className="w-3.5 h-3.5 text-cyan-400" />
            ) : (
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
            )}
            <span>RTP (50):</span>
            <span className={isHot ? 'text-orange-200' : isCold ? 'text-cyan-200' : 'text-emerald-400'}>
              {last50Rtp.toFixed(1)}%
            </span>
            <span className="text-[9px] uppercase px-1 rounded bg-black/40 font-semibold">
              {isHot ? 'HOT 🔥' : isCold ? 'COLD ❄️' : 'NORMAL'}
            </span>
          </div>

          {/* Toggle Alert Settings Panel */}
          <button
            type="button"
            onClick={() => setShowConfig((prev) => !prev)}
            title="Настройки автоматических алертов HOT / COLD"
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border transition-all ${
              showConfig
                ? 'bg-orange-500 text-black border-orange-400 font-bold'
                : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-zinc-700'
            }`}
          >
            <Sliders className="w-3 h-3" />
            <span className="hidden sm:inline">Пороги</span>
          </button>

          {/* Alert Enabled Toggle */}
          <button
            type="button"
            onClick={() => onUpdateAlertConfig({ enabled: !alertConfig.enabled })}
            title={alertConfig.enabled ? 'Алерты активны (кликните для отключения)' : 'Алерты отключены (кликните для включения)'}
            className={`p-1 rounded border transition-all ${
              alertConfig.enabled
                ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-400 hover:bg-emerald-900'
                : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {alertConfig.enabled ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Automated Alert Configuration Drawer */}
      {showConfig && (
        <div className="bg-[#0b0e15] border-b border-zinc-800/90 p-3 text-xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800/60 pb-2">
            <div className="flex items-center gap-1.5 text-zinc-200 font-bold">
              <ShieldAlert className="w-4 h-4 text-orange-400" />
              <span>АВТОМАТИЧЕСКАЯ СИСТЕМА ОПОВЕЩЕНИЙ ТАЙМИНГА (ПОСЛЕДНИЕ 50 КЕЙСОВ)</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onUpdateAlertConfig({ soundEnabled: !alertConfig.soundEnabled })}
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] border transition-colors ${
                  alertConfig.soundEnabled
                    ? 'bg-cyan-950/80 border-cyan-500/50 text-cyan-300'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-500'
                }`}
              >
                {alertConfig.soundEnabled ? <Volume2 className="w-3 h-3 text-cyan-400" /> : <VolumeX className="w-3 h-3" />}
                <span>Звук алертов</span>
              </button>
              {onTriggerTestAlert && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onTriggerTestAlert('HOT')}
                    className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-950/80 hover:bg-orange-900 border border-orange-500/60 text-orange-300 transition-colors"
                  >
                    Тест HOT 🔥
                  </button>
                  <button
                    type="button"
                    onClick={() => onTriggerTestAlert('COLD')}
                    className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/60 text-cyan-300 transition-colors"
                  >
                    Тест COLD ❄️
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* HOT Threshold Setting */}
            <div className="bg-black/40 border border-orange-900/40 rounded-lg p-2.5 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-orange-300 font-bold">
                  <Flame className="w-3.5 h-3.5 fill-orange-400 text-orange-400" />
                  <span>Порог &apos;HOT&apos; (Пул разогрет)</span>
                </div>
                <div className="flex items-center gap-1 text-orange-400 font-bold bg-orange-950/60 px-2 py-0.5 rounded border border-orange-500/40">
                  <TrendingUp className="w-3 h-3" />
                  <span>&ge; {alertConfig.hotThreshold}%</span>
                </div>
              </div>
              <p className="text-[11px] text-zinc-400 leading-snug">
                Оповещает, когда RTP за 50 кейсов превышает порог. Означает активную отдачу пула — оптимальный момент для открытия кейсов.
              </p>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="70"
                  max="160"
                  step="1"
                  value={alertConfig.hotThreshold}
                  onChange={(e) => onUpdateAlertConfig({ hotThreshold: Number(e.target.value) })}
                  className="flex-1 accent-orange-500 cursor-pointer h-1.5 bg-zinc-800 rounded-lg"
                />
                <input
                  type="number"
                  min="50"
                  max="250"
                  value={alertConfig.hotThreshold}
                  onChange={(e) => onUpdateAlertConfig({ hotThreshold: Math.max(50, Math.min(250, Number(e.target.value))) })}
                  className="w-16 bg-zinc-900 border border-orange-500/40 rounded px-1.5 py-0.5 text-center text-xs text-orange-300 font-bold focus:outline-none"
                />
                <span className="text-zinc-500 text-[11px]">%</span>
              </div>
            </div>

            {/* COLD Threshold Setting */}
            <div className="bg-black/40 border border-cyan-900/40 rounded-lg p-2.5 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-cyan-300 font-bold">
                  <Snowflake className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Порог &apos;COLD&apos; (Пул охлажден / слив)</span>
                </div>
                <div className="flex items-center gap-1 text-cyan-400 font-bold bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-500/40">
                  <TrendingDown className="w-3 h-3" />
                  <span>&le; {alertConfig.coldThreshold}%</span>
                </div>
              </div>
              <p className="text-[11px] text-zinc-400 leading-snug">
                Оповещает, когда RTP за 50 кейсов опускается ниже порога. Означает фазу накопления — высокий риск минуса, лучше выждать откат.
              </p>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="30"
                  max="90"
                  step="1"
                  value={alertConfig.coldThreshold}
                  onChange={(e) => onUpdateAlertConfig({ coldThreshold: Number(e.target.value) })}
                  className="flex-1 accent-cyan-500 cursor-pointer h-1.5 bg-zinc-800 rounded-lg"
                />
                <input
                  type="number"
                  min="20"
                  max="100"
                  value={alertConfig.coldThreshold}
                  onChange={(e) => onUpdateAlertConfig({ coldThreshold: Math.max(20, Math.min(100, Number(e.target.value))) })}
                  className="w-16 bg-zinc-900 border border-cyan-500/40 rounded px-1.5 py-0.5 text-center text-xs text-cyan-300 font-bold focus:outline-none"
                />
                <span className="text-zinc-500 text-[11px]">%</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter and Clear Bar */}
      <div className="px-3 sm:px-4 py-1.5 bg-[#0a0c12] border-b border-zinc-800/80 flex flex-wrap items-center justify-between gap-2 text-[10px]">
        <div className="flex items-center gap-1 overflow-x-auto py-0.5">
          <span className="text-zinc-500 text-[9px] uppercase tracking-wider mr-1 hidden sm:inline">Фильтр:</span>
          {(['ALL', 'HOT', 'COLD', 'SUCCESS', 'WARN', 'ENTROPY', 'PREDICTION', 'INFO'] as const).map((lvl) => (
            <button
              key={lvl}
              onClick={() => setFilter(lvl)}
              className={`px-2 py-0.5 rounded transition-all flex items-center gap-1 whitespace-nowrap ${
                filter === lvl
                  ? lvl === 'HOT'
                    ? 'bg-orange-500 text-black font-bold'
                    : lvl === 'COLD'
                    ? 'bg-cyan-500 text-black font-bold'
                    : 'bg-emerald-500 text-black font-bold'
                  : 'text-zinc-400 hover:text-zinc-200 bg-zinc-900 border border-zinc-800'
              }`}
            >
              {lvl === 'HOT' && <Flame className="w-2.5 h-2.5" />}
              {lvl === 'COLD' && <Snowflake className="w-2.5 h-2.5" />}
              <span>{lvl}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-zinc-500">
          <span className="text-[10px] hidden md:inline">
            Логи: {filteredLogs.length} / {logs.length}
          </span>
          <button
            id="clear-logs-btn"
            onClick={onClearLogs}
            title="Очистить терминал"
            className="p-1 rounded text-zinc-500 hover:text-red-400 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Log Output Screen */}
      <div
        ref={logContainerRef}
        className="h-44 sm:h-52 overflow-y-auto p-3 space-y-1.5 text-xs text-zinc-300 scrollbar-thin bg-black/60"
      >
        {filteredLogs.length === 0 ? (
          <div className="text-zinc-600 text-center py-6 text-[11px] flex flex-col items-center gap-1">
            <Terminal className="w-5 h-5 text-zinc-700" />
            <span>Лента терминала пуста для выбранного фильтра [{filter}]</span>
          </div>
        ) : (
          filteredLogs.map((entry, idx) => (
            <div
              key={`${entry.id}_${idx}`}
              className={`flex items-start gap-2 px-1.5 py-1 rounded transition-colors leading-relaxed ${
                entry.level === 'HOT'
                  ? 'bg-gradient-to-r from-orange-950/70 via-red-950/40 to-transparent border-l-2 border-orange-500'
                  : entry.level === 'COLD'
                  ? 'bg-gradient-to-r from-cyan-950/70 via-blue-950/40 to-transparent border-l-2 border-cyan-500'
                  : 'hover:bg-zinc-900/30'
              }`}
            >
              <span className="text-zinc-600 select-none text-[11px]">[{entry.timestamp}]</span>
              {entry.hexOffset && (
                <span className="text-zinc-600 select-none text-[10px] hidden sm:inline">
                  {entry.hexOffset}
                </span>
              )}
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded border font-semibold select-none flex items-center gap-1 ${getLevelStyle(
                  entry.level
                )}`}
              >
                {entry.level === 'HOT' && <Flame className="w-2.5 h-2.5 fill-current" />}
                {entry.level === 'COLD' && <Snowflake className="w-2.5 h-2.5" />}
                [{entry.level}]
              </span>
              <span
                className={`flex-1 break-words ${
                  entry.level === 'HOT'
                    ? 'text-orange-200 font-semibold'
                    : entry.level === 'COLD'
                    ? 'text-cyan-200 font-semibold'
                    : 'text-zinc-200'
                }`}
              >
                {entry.message}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Command prompt & telemetry status footer */}
      <div className="px-3 py-2 bg-[#0c0f16] border-t border-zinc-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
        <form onSubmit={handleCommandSubmit} className="flex-1 flex items-center gap-2">
          <span className="text-emerald-400 font-bold select-none text-xs flex items-center gap-1">
            <Cpu className="w-3.5 h-3.5 text-orange-400" />
            stream@helper:~$
          </span>
          <input
            id="terminal-command-input"
            type="text"
            value={commandInput}
            onChange={(e) => setCommandInput(e.target.value)}
            placeholder="Type 'help', 'alert', 'hot 95', 'cold 65', 'test hot', 'clear'..."
            className="flex-1 bg-transparent text-xs text-orange-300 placeholder:text-zinc-600 focus:outline-none font-mono"
          />
          <button
            type="submit"
            className="p-1 rounded bg-zinc-800 text-zinc-300 hover:text-emerald-400 transition-colors"
          >
            <Send className="w-3 h-3" />
          </button>
        </form>

        <div className="flex items-center gap-2 text-[10px] text-zinc-500 justify-end">
          <span className="flex items-center gap-1">
            <ShieldAlert className="w-3 h-3 text-cyan-400" />
            <span>RTP(50) HEURISTIC: {alertConfig.enabled ? 'ACTIVE' : 'DISABLED'}</span>
          </span>
        </div>
      </div>
    </section>
  );
};
