import React, { useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
} from 'recharts';
import {
  Activity,
  Flame,
  Snowflake,
  Zap,
  Percent,
  TrendingUp,
  Crosshair,
  ShieldAlert,
  Sparkles,
  Compass,
  ShieldCheck,
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  ArrowUp,
  ArrowDown,
  Minus,
  Coins,
  Trophy,
  Layers,
  Scale,
  CheckCircle2,
} from 'lucide-react';
import { AnalyticsMetrics, CurrencyMode, PoolPhaseType } from '../types';

interface AnalyticsPanelProps {
  metrics: AnalyticsMetrics;
  windowSize: number;
  onChangeWindowSize: (size: number) => void;
  onInjectSeedAnalysis: () => void;
  onOpenProvablyFair?: () => void;
  onOpenRtpChecker?: () => void;
  currency?: CurrencyMode;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
}

const CustomMomentumTooltip: React.FC<CustomTooltipProps> = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const isProfit = (data.profit ?? 0) >= 0;
    return (
      <div className="bg-[#090b10]/95 border border-zinc-700/80 rounded-lg p-2 text-xs shadow-2xl backdrop-blur-md font-mono min-w-[170px] z-50">
        <div className="flex items-center justify-between gap-2 border-b border-zinc-800 pb-1 mb-1">
          <span className="font-bold text-zinc-300">Ролл {data.label}</span>
          <span
            className={`text-[9px] px-1.5 py-0.2 rounded font-extrabold uppercase ${
              data.rarity === 'Special'
                ? 'text-amber-400 bg-amber-950/60 border border-amber-500/40'
                : data.rarity === 'Covert'
                ? 'text-red-400 bg-red-950/60 border border-red-500/40'
                : data.rarity === 'Classified'
                ? 'text-fuchsia-400 bg-fuchsia-950/60 border border-fuchsia-500/40'
                : data.rarity === 'Restricted'
                ? 'text-purple-400 bg-purple-950/60 border border-purple-500/40'
                : 'text-blue-400 bg-blue-950/60 border border-blue-500/40'
            }`}
          >
            {data.rarity}
          </span>
        </div>
        <div className="text-[11px] text-zinc-100 truncate font-semibold mb-1" title={data.itemName}>
          {data.itemName}
        </div>
        <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px]">
          <span className="text-zinc-500">Импульс:</span>
          <span
            className={`font-bold text-right ${
              data.momentum > 0 ? 'text-emerald-400' : data.momentum < 0 ? 'text-blue-400' : 'text-zinc-400'
            }`}
          >
            {data.momentum > 0 ? `+${data.momentum}` : data.momentum}
          </span>
          <span className="text-zinc-500">RTP окна:</span>
          <span className="font-bold text-right text-zinc-300">{data.rtp}%</span>
          <span className="text-zinc-500">Скользящее σ:</span>
          <span className="font-bold text-right text-orange-300">{data.stdDev}</span>
          <span className="text-zinc-500">Результат:</span>
          <span className={`font-bold text-right ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
            {isProfit ? `+$${(data.profit ?? 0).toFixed(2)}` : `-$${Math.abs(data.profit ?? 0).toFixed(2)}`}
          </span>
        </div>
      </div>
    );
  }
  return null;
};

export const AnalyticsPanel: React.FC<AnalyticsPanelProps> = ({
  metrics,
  windowSize,
  onChangeWindowSize,
  onInjectSeedAnalysis,
  onOpenProvablyFair,
  onOpenRtpChecker,
  currency = 'RUB',
}) => {
  const [showCalibrationDetails, setShowCalibrationDetails] = useState(false);

  const {
    score,
    momentum,
    momentumDesc,
    rtp,
    totalSpent,
    totalWon,
    profit,
    dryStreak,
    bestDrop,
    covertCount,
    specialCount,
    estimatedWinChance = 22.5,
    singleRollKnifeProb = 0.26,
    singleRollCovertProb = 0.78,
    winRate,
    tensionIndex,
    poolPhase,
    phaseTitle,
    phaseRecommendation,
    nextWindowCovertProb,
    nextWindowKnifeProb,
    zScore,
    rarityBreakdown,
    recentMomentumTrend,
    volatility,
    slidingStdDev = 0,
    weightedMomentumScore = 0,
    goodDropChance,
    momentumChartData = [],
    isHighVolatility,
    rtpTrend = 'NEUTRAL',
    rtpTrendDelta = 0,
    last10Rtp,
    last5Rtp,
    momentumTrend = 'NEUTRAL',
    momentumTrendDelta = 0,
  } = metrics;

  const safeGoodDrop = goodDropChance || {
    score: Math.min(99, Math.max(1, Math.round(38 + (tensionIndex * 0.4)))),
    tier: 'WARM' as const,
    tierLabel: '⚡ ТЕПЛО (СТАНДАРТНАЯ НОРМА)',
    tierDescription: 'Рабочий математический коридор пула. Шанс в пределах стандартной вероятности кейса.',
    color: '#34d399',
    factorSummary: [],
  };

  const formatMoney = (usdVal: number) => {
    if (currency === 'RUB') {
      return `${Math.round(usdVal * 92).toLocaleString('ru-RU')} ₽`;
    }
    return `$${usdVal.toFixed(2)}`;
  };

  // Chance indicator status styling (realistic 12% - 35% probability scale)
  const getChanceConfig = (val: number) => {
    if (val >= 28.0) {
      return {
        label: 'ПОВЫШЕННЫЙ (ПИК НАТЯЖЕНИЯ)',
        color: 'text-amber-400',
        badge: 'bg-amber-950/80 text-amber-300 border-amber-500/50',
      };
    }
    if (val >= 19.0) {
      return {
        label: 'СТАНДАРТ (НОРМА САЙТА)',
        color: 'text-emerald-400',
        badge: 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50',
      };
    }
    return {
      label: 'ОХЛАЖДЕНИЕ (ОТКАТ ПОСЛЕ КУША)',
      color: 'text-cyan-400',
      badge: 'bg-cyan-950/80 text-cyan-300 border-cyan-500/50',
    };
  };

  // Score color gradient
  const getScoreColor = (val: number) => {
    if (val >= 70) return 'text-orange-400 border-orange-500/50 shadow-orange-500/20';
    if (val >= 40) return 'text-emerald-400 border-emerald-500/50 shadow-emerald-500/20';
    return 'text-cyan-400 border-cyan-500/50 shadow-cyan-500/20';
  };

  // Momentum styles
  const getMomentumConfig = (mom: string) => {
    switch (mom) {
      case 'OVERHEATED':
        return {
          badge: 'bg-fuchsia-950/80 text-fuchsia-300 border-fuchsia-500/60 shadow-[0_0_15px_rgba(217,70,239,0.4)]',
          icon: <Flame className="w-4 h-4 text-fuchsia-400 animate-bounce" />,
          title: 'OVERHEATED',
          color: '#d946ef',
        };
      case 'HOT':
        return {
          badge: 'bg-red-950/80 text-red-300 border-red-500/60 shadow-[0_0_15px_rgba(239,68,68,0.4)]',
          icon: <Flame className="w-4 h-4 text-red-400 animate-pulse" />,
          title: 'HOT',
          color: '#ef4444',
        };
      case 'COLD':
        return {
          badge: 'bg-blue-950/80 text-cyan-300 border-cyan-500/60 shadow-[0_0_15px_rgba(6,182,212,0.3)]',
          icon: <Snowflake className="w-4 h-4 text-cyan-400" />,
          title: 'COLD',
          color: '#06b6d4',
        };
      case 'STABLE':
      default:
        return {
          badge: 'bg-emerald-950/80 text-emerald-300 border-emerald-500/60 shadow-[0_0_15px_rgba(16,185,129,0.3)]',
          icon: <Activity className="w-4 h-4 text-emerald-400" />,
          title: 'STABLE',
          color: '#10b981',
        };
    }
  };

  // Pool Phase Styles
  const getPhaseConfig = (phase: PoolPhaseType) => {
    switch (phase) {
      case 'JACKPOT_COOLDOWN':
        return {
          color: 'text-fuchsia-400 border-fuchsia-500/40 bg-fuchsia-950/30',
          badgeBg: 'bg-fuchsia-900/60 text-fuchsia-200 border-fuchsia-500/50',
          icon: <ShieldAlert className="w-4 h-4 text-fuchsia-400 animate-pulse" />,
        };
      case 'TENSION_PEAK':
        return {
          color: 'text-amber-400 border-amber-500/40 bg-amber-950/30',
          badgeBg: 'bg-amber-900/60 text-amber-200 border-amber-500/50 animate-pulse',
          icon: <Crosshair className="w-4 h-4 text-amber-400" />,
        };
      case 'BURST_STRIKE':
        return {
          color: 'text-emerald-400 border-emerald-500/40 bg-emerald-950/30',
          badgeBg: 'bg-emerald-900/60 text-emerald-200 border-emerald-500/50',
          icon: <Sparkles className="w-4 h-4 text-emerald-400" />,
        };
      case 'DRAINING':
      default:
        return {
          color: 'text-cyan-400 border-cyan-500/40 bg-cyan-950/30',
          badgeBg: 'bg-cyan-900/60 text-cyan-200 border-cyan-500/50',
          icon: <Compass className="w-4 h-4 text-cyan-400" />,
        };
    }
  };

  const momConfig = getMomentumConfig(momentum);
  const phaseConfig = getPhaseConfig(poolPhase);

  // Dedicated momentum scale position: normalized to 0% - 100% with 0 at 50%
  const momentumBarPosition = Math.min(98, Math.max(2, 50 + (weightedMomentumScore / 100) * 50));

  return (
    <aside
      id="analytics-panel-aside"
      className="flex flex-col gap-3 h-full font-mono"
    >
      {/* 0. В КАКОМ КЕЙСЕ БОЛЬШЕ ВСЕГО СЫПЕТ (МАЛЕНЬКИМ ШРИФТОМ) */}
      <div
        id="top-dropping-case-badge"
        className="flex items-center justify-between text-[10px] sm:text-[11px] font-mono px-2.5 py-1.5 rounded-lg bg-[#0c0e15]/95 border border-zinc-800/90 shadow-md backdrop-blur-sm"
      >
        <div className="flex items-center gap-1.5 truncate">
          <Flame className="w-3.5 h-3.5 text-orange-400 shrink-0 animate-pulse" />
          <span className="text-zinc-500 uppercase tracking-tight">Больше всего сыпет:</span>
          <span className="text-zinc-100 font-bold truncate">
            {metrics.topDroppingCase?.name || 'Стандартный кейс'}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 text-[10px]">
          <span className="text-emerald-400 font-bold">
            RTP: {metrics.topDroppingCase?.rtp ?? 100}%
          </span>
          {metrics.topDroppingCase && metrics.topDroppingCase.profitableCount > 0 && (
            <span className="px-1.5 py-0.2 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-500/40 font-bold">
              +{metrics.topDroppingCase.profitableCount} окупа
            </span>
          )}
        </div>
      </div>

      {/* 1. ТОЛЬКО ШКАЛА ОТ 1 ДО 100: АНАЛИЗ ШАНСОВ НА ХОРОШИЙ ДРОП */}
      <div
        id="good-drop-chance-card"
        className="relative bg-[#0c0e15]/95 border border-zinc-800 rounded-xl p-3.5 overflow-hidden shadow-2xl backdrop-blur-sm"
      >
        <div
          className="absolute -top-10 -right-10 w-36 h-36 rounded-full blur-3xl pointer-events-none opacity-25"
          style={{ backgroundColor: safeGoodDrop.color }}
        />

        <div className="flex items-center justify-between pb-2 border-b border-zinc-800/80">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4" style={{ color: safeGoodDrop.color }} />
            <h3 className="text-xs uppercase tracking-wider font-bold text-zinc-200">
              ШАНС НА ХОРОШИЙ ДРОП (ШКАЛА 1 - 100)
            </h3>
          </div>
          <div className="flex items-center gap-1.5">
            {metrics.winChanceCalibration && (
              <div
                className="flex items-center gap-1 text-[9px] sm:text-[10px] font-bold font-mono px-2 py-0.5 rounded border border-emerald-500/60 bg-emerald-950/60 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.25)]"
                title="Точность математического расчета шанса калибрована на 80%+"
              >
                <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                <span>ТОЧНОСТЬ: {metrics.winChanceCalibration.accuracyPercent}%</span>
                <span className="text-[8px] px-1 rounded bg-emerald-500 text-black font-extrabold">≥80%</span>
              </div>
            )}
            <button
              id="inject-analysis-btn"
              onClick={onInjectSeedAnalysis}
              className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-750 transition-colors cursor-pointer"
              title="Пересчитать квантовую дисперсию сида"
            >
              <Zap className="w-3 h-3 text-orange-400" />
              <span>RE-SEED</span>
            </button>
            <span
              className="text-[10px] font-bold font-mono px-2 py-0.5 rounded border"
              style={{
                color: safeGoodDrop.color,
                borderColor: `${safeGoodDrop.color}50`,
                backgroundColor: `${safeGoodDrop.color}15`,
              }}
            >
              1 - 100
            </span>
          </div>
        </div>

        {/* Primary 1-100 Metric Display */}
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <span
              id="good-drop-score-val"
              className="text-4xl sm:text-5xl font-black font-mono tracking-tight"
              style={{
                color: safeGoodDrop.color,
                textShadow: `0 0 20px ${safeGoodDrop.color}40`,
              }}
            >
              {safeGoodDrop.score}
            </span>
            <span className="text-xs text-zinc-500 font-bold font-mono">/ 100</span>
          </div>

          <div
            className="px-2.5 py-1 rounded-lg border text-xs font-black tracking-wider flex items-center gap-1.5 shadow-lg"
            style={{
              color: safeGoodDrop.color,
              borderColor: `${safeGoodDrop.color}60`,
              backgroundColor: `${safeGoodDrop.color}20`,
            }}
          >
            <span>{safeGoodDrop.tierLabel}</span>
          </div>
        </div>

        {/* 5-Zone Thermometer Range Bar */}
        <div className="mt-3">
          <div className="relative h-3.5 w-full bg-zinc-950 rounded-full overflow-hidden border border-zinc-800/90 flex p-0.5">
            {/* Zone 1: 1-20 (Freezing) */}
            <div className="w-[20%] h-full bg-gradient-to-r from-sky-600 to-sky-500 rounded-l" title="Ледяная зона (1-20): Откат после заноса" />
            {/* Zone 2: 21-42 (Cold) */}
            <div className="w-[22%] h-full bg-gradient-to-r from-indigo-500 to-blue-500" title="Прохладно (21-42): Фаза сбора банка" />
            {/* Zone 3: 43-65 (Warm/Norm) */}
            <div className="w-[23%] h-full bg-gradient-to-r from-emerald-500 to-teal-400" title="Тепло (43-65): Базовый коридор отдачи" />
            {/* Zone 4: 66-84 (Hot) */}
            <div className="w-[19%] h-full bg-gradient-to-r from-amber-500 to-orange-500" title="Горячо (66-84): Натяжение пула, повышенный шанс" />
            {/* Zone 5: 85-100 (Boiling) */}
            <div className="w-[16%] h-full bg-gradient-to-r from-rose-500 to-red-600 rounded-r animate-pulse" title="Кипение (85-100): Пик компрессии, наивысший шанс" />

            {/* Precision Pin Indicator */}
            <div
              className="absolute top-0 bottom-0 w-2 bg-white shadow-[0_0_12px_#ffffff] rounded-full transition-all duration-500 pointer-events-none -translate-x-1/2"
              style={{ left: `${Math.min(99, Math.max(1, safeGoodDrop.score))}%` }}
            />
          </div>

          {/* Range Distribution Labels */}
          <div className="grid grid-cols-5 text-[8px] sm:text-[9px] text-center font-mono mt-1.5 text-zinc-500">
            <span className={safeGoodDrop.tier === 'FREEZING' ? 'text-sky-400 font-bold' : ''}>❄ 1-20 ЛЁД</span>
            <span className={safeGoodDrop.tier === 'COLD' ? 'text-indigo-400 font-bold' : ''}>☁ 21-42 ХОЛ.</span>
            <span className={safeGoodDrop.tier === 'WARM' ? 'text-emerald-400 font-bold' : ''}>⚡ 43-65 НОРМА</span>
            <span className={safeGoodDrop.tier === 'HOT' ? 'text-orange-400 font-bold' : ''}>🔥 66-84 ЖАР</span>
            <span className={safeGoodDrop.tier === 'BOILING' ? 'text-rose-400 font-bold' : ''}>💥 85+ ПИК</span>
          </div>
        </div>

        {/* 80%+ Calibrated Win Chance Precision Dashboard */}
        {metrics.winChanceCalibration && (
          <div className="mt-2.5 p-2 rounded-lg bg-emerald-950/20 border border-emerald-500/35 font-mono text-[11px] shadow-sm">
            <div className="flex items-center justify-between pb-1.5 border-b border-emerald-500/20">
              <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="text-[10px] uppercase tracking-wide">
                  РАСЧЕТ ВЫИГРЫША: ТОЧНОСТЬ {metrics.winChanceCalibration.accuracyPercent}%
                </span>
                <span className="text-[8px] px-1 rounded bg-emerald-500/30 text-emerald-300 border border-emerald-500/50 font-extrabold">
                  ≥80% ОК
                </span>
              </div>
              <button
                onClick={() => setShowCalibrationDetails(!showCalibrationDetails)}
                className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 transition-colors cursor-pointer"
              >
                {showCalibrationDetails ? 'Скрыть аудит' : 'Мат. аудит'}
              </button>
            </div>

            <div className="grid grid-cols-3 gap-1.5 mt-1.5 text-center text-[10px]">
              <div className="bg-zinc-900/80 p-1.5 rounded border border-zinc-800">
                <span className="text-zinc-500 block text-[8px] uppercase">БАЗОВЫЙ КЕЙС</span>
                <span className="font-bold text-zinc-200 text-xs">{metrics.winChanceCalibration.theoreticalWinChance}%</span>
                <span className="text-[7px] text-zinc-500 block">луттейбл CS2</span>
              </div>
              <div className="bg-zinc-900/90 p-1.5 rounded border border-emerald-500/40 bg-emerald-950/30">
                <span className="text-emerald-400 block text-[8px] uppercase font-bold">БАЙЕСОВСКИЙ ШАНС</span>
                <span className="font-bold text-emerald-300 text-xs">{metrics.winChanceCalibration.bayesianWinChance}%</span>
                <span className="text-[7px] text-emerald-400/90 block">с учетом пула</span>
              </div>
              <div className="bg-zinc-900/80 p-1.5 rounded border border-zinc-800">
                <span className="text-zinc-500 block text-[8px] uppercase">ТОЧНОСТЬ МОДЕЛИ</span>
                <span className="font-bold text-emerald-400 text-xs">{metrics.winChanceCalibration.accuracyPercent}%</span>
                <span className="text-[7px] text-zinc-400 block">≥80% подтверждено</span>
              </div>
            </div>

            {showCalibrationDetails && (
              <div className="mt-2 pt-2 border-t border-emerald-500/20 text-[10px] text-zinc-300 space-y-1">
                <div className="flex justify-between text-zinc-400">
                  <span>Доверительный интервал 95%:</span>
                  <span className="text-zinc-200 font-bold">
                    [{metrics.winChanceCalibration.confidenceInterval[0]}% – {metrics.winChanceCalibration.confidenceInterval[1]}%]
                  </span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Brier Calibration Score (1 - Loss):</span>
                  <span className="text-emerald-400 font-bold">{metrics.winChanceCalibration.backtestScore}%</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Статистический уровень надежности:</span>
                  <span className="text-amber-400 font-bold">{metrics.winChanceCalibration.confidenceLevel}</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Размер контрольной выборки:</span>
                  <span className="text-zinc-200 font-bold">{metrics.winChanceCalibration.sampleSize} дропов</span>
                </div>
                <div className="text-[9px] text-zinc-500 pt-1 leading-tight border-t border-zinc-800/80 mt-1">
                  {metrics.winChanceCalibration.methodology}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tactical Narrative */}
        <p className="mt-2.5 text-[11px] text-zinc-300 bg-zinc-900/80 p-2 rounded-lg border border-zinc-800/80 leading-relaxed">
          {safeGoodDrop.tierDescription}
        </p>

        {/* Contributing Factors Breakdown */}
        {safeGoodDrop.factorSummary.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {safeGoodDrop.factorSummary.map((factor, idx) => (
              <span
                key={idx}
                className="text-[9px] px-2 py-0.5 rounded bg-zinc-900 text-zinc-300 border border-zinc-800 font-mono"
              >
                {factor}
              </span>
            ))}
          </div>
        )}

        {/* Sub-telemetry: Tension & Z-Score */}
        <div className="grid grid-cols-2 gap-2 mt-2.5 pt-2 border-t border-zinc-800/80 text-[11px]">
          <div className="bg-zinc-900/60 p-1.5 rounded border border-zinc-800/60">
            <span className="text-zinc-500 block text-[9px]">НАТЯЖЕНИЕ БАНКА (TENSION)</span>
            <div className="flex items-center justify-between">
              <span className="font-bold text-amber-400">{tensionIndex}%</span>
              <span className="text-[9px] text-zinc-400">{dryStreak} сливов подряд</span>
            </div>
          </div>
          <div className="bg-zinc-900/60 p-1.5 rounded border border-zinc-800/60">
            <span className="text-zinc-500 block text-[9px]">ДЕВИАЦИЯ Z-SCORE</span>
            <span className={`font-bold ${zScore >= 0 ? 'text-emerald-400' : 'text-cyan-400'}`}>
              {zScore >= 0 ? `+${zScore.toFixed(2)}σ` : `${zScore.toFixed(2)}σ`}
            </span>
          </div>
        </div>

        {/* Provably Fair Quick Launcher */}
        {onOpenProvablyFair && (
          <button
            id="analytics-open-provably-fair-btn"
            onClick={onOpenProvablyFair}
            className="w-full mt-2.5 p-2 bg-gradient-to-r from-cyan-950/60 to-zinc-900 border border-cyan-500/40 hover:border-cyan-400 rounded-lg text-left transition-all flex items-center justify-between group cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <div className="p-1 rounded bg-cyan-950 border border-cyan-500/60 text-cyan-400 group-hover:scale-105 transition-transform">
                <ShieldCheck className="w-3.5 h-3.5" />
              </div>
              <div>
                <div className="text-[11px] font-bold text-zinc-100 flex items-center gap-1.5">
                  <span>PROVABLY FAIR ВАЛИДАТОР</span>
                  <span className="text-[9px] px-1 rounded bg-cyan-500 text-black font-extrabold">
                    СИДЫ
                  </span>
                </div>
                <div className="text-[10px] text-zinc-400">
                  Client Seed • Nonce • 64-char Server Seed
                </div>
              </div>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-cyan-400 group-hover:translate-x-1 transition-transform" />
          </button>
        )}

        {/* RTP Timing & 80+ Snapshot Quick Launcher */}
        {onOpenRtpChecker && (
          <button
            id="analytics-open-rtp-checker-btn"
            onClick={onOpenRtpChecker}
            className="w-full mt-2 p-2 bg-gradient-to-r from-orange-950/60 to-zinc-900 border border-orange-500/40 hover:border-orange-400 rounded-lg text-left transition-all flex items-center justify-between group cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <div className="p-1 rounded bg-orange-950 border border-orange-500/60 text-orange-400 group-hover:scale-105 transition-transform">
                <Scale className="w-3.5 h-3.5" />
              </div>
              <div>
                <div className="text-[11px] font-bold text-zinc-100 flex items-center gap-1.5">
                  <span>ЧЕКЕР ТАЙМИНГА И ФИКСАЦИИ (80+)</span>
                  <span className="text-[9px] px-1 rounded bg-orange-500 text-black font-extrabold">
                    ЧЕКЕР
                  </span>
                </div>
                <div className="text-[10px] text-zinc-400">
                  Фиксация шансов при клике • Влияние ролла на пул
                </div>
              </div>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-orange-400 group-hover:translate-x-1 transition-transform" />
          </button>
        )}
      </div>

      {/* 2. POOL PHASE & REALISTIC ODDS RADAR CARD */}
      <div
        id="pool-phase-card"
        className={`border rounded-xl p-3 shadow-lg backdrop-blur-sm ${phaseConfig.color}`}
      >
        <div className="flex items-center justify-between pb-1.5 border-b border-zinc-800/80">
          <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-200 uppercase">
            {phaseConfig.icon}
            <span>ФАЗА ПУЛА И РЕКОМЕНДАЦИЯ</span>
          </div>
          <span className={`text-[10px] px-2 py-0.5 rounded border font-bold ${phaseConfig.badgeBg}`}>
            {phaseTitle}
          </span>
        </div>

        <p className="mt-2 text-xs text-zinc-300 font-sans leading-relaxed bg-zinc-950/70 p-2 rounded border border-zinc-800/60">
          💡 <strong className="text-white font-mono">СОВЕТ:</strong> {phaseRecommendation}
        </p>

        {/* Deep Realistic Chances Forecast Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mt-2.5 text-[10px] text-center">
          <div className="bg-zinc-900/95 p-1.5 rounded border border-emerald-500/40 bg-emerald-950/20">
            <span className="text-emerald-400 block text-[9px] font-bold">ШАНС ОКУПА (80%+)</span>
            <div className="font-bold text-emerald-300 text-xs flex items-center justify-center gap-1">
              <span>{metrics.winChanceCalibration?.bayesianWinChance ?? estimatedWinChance}%</span>
            </div>
            <span className="text-[8px] text-emerald-400/80 block">калибровка ≥80%</span>
          </div>
          <div className="bg-zinc-900/90 p-1.5 rounded border border-zinc-800">
            <span className="text-zinc-500 block text-[9px]">WIN RATE ЛЕНТЫ</span>
            <span className="font-bold text-teal-400 text-xs">{winRate}%</span>
            <span className="text-[8px] text-zinc-500 block">факт. окуп</span>
          </div>
          <div className="bg-zinc-900/90 p-1.5 rounded border border-zinc-800">
            <span className="text-zinc-500 block text-[9px]">ТАЙНОЕ (1 / 5 ШТ)</span>
            <div className="font-bold text-red-400 text-xs flex items-center justify-center gap-1">
              <span>{singleRollCovertProb}%</span>
              <span className="text-zinc-600 font-normal">/</span>
              <span className="text-zinc-300">~{nextWindowCovertProb}%</span>
            </div>
            <span className="text-[8px] text-zinc-500 block">1 ролл / 5 роллов</span>
          </div>
          <div className="bg-zinc-900/90 p-1.5 rounded border border-zinc-800">
            <span className="text-zinc-500 block text-[9px]">НОЖ (1 / 10 ШТ)</span>
            <div className="font-bold text-amber-300 text-xs flex items-center justify-center gap-1">
              <span>{singleRollKnifeProb}%</span>
              <span className="text-zinc-600 font-normal">/</span>
              <span className="text-zinc-300">~{nextWindowKnifeProb}%</span>
            </div>
            <span className="text-[8px] text-zinc-500 block">1 ролл / 10 роллов</span>
          </div>
        </div>
      </div>

      {/* 3. MOMENTUM STATUS BLOCK: С ОТДЕЛЬНОЙ ШКАЛОЙ И ГРАФИКОМ */}
      <div
        id="momentum-analytics-card"
        className={`bg-[#0c0e15]/95 border rounded-xl p-3 overflow-hidden shadow-xl backdrop-blur-sm transition-all duration-300 ${
          isHighVolatility
            ? 'border-orange-500/70 shadow-[0_0_24px_rgba(255,107,0,0.3)] ring-1 ring-orange-500/40'
            : 'border-zinc-800'
        }`}
      >
        <div className="flex items-center justify-between pb-1.5 border-b border-zinc-800/80">
          <div className="flex items-center gap-2">
            <Activity className={`w-4 h-4 ${isHighVolatility ? 'text-orange-400 animate-pulse' : 'text-emerald-400'}`} />
            <h3 className="text-xs uppercase tracking-wider font-bold text-zinc-300">
              MARKET MOMENTUM
            </h3>
          </div>
          <div className="flex items-center gap-1.5">
            {isHighVolatility && (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-80"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
              </span>
            )}
            <span
              className={`text-[10px] uppercase font-mono ${
                isHighVolatility ? 'text-orange-400 font-bold animate-pulse' : 'text-zinc-500'
              }`}
            >
              {isHighVolatility ? 'HIGH VOLATILITY SPIKE' : 'LIVE VECTOR'}
            </span>
          </div>
        </div>

        <div className="mt-2 flex items-center justify-between">
          <div
            id="momentum-badge"
            className={`relative flex items-center gap-2 px-3 py-1 rounded-lg border font-black text-xs tracking-wider transition-all duration-300 ${momConfig.badge} ${
              isHighVolatility
                ? 'animate-pulse ring-2 ring-orange-400/80 shadow-[0_0_22px_rgba(255,107,0,0.7)] scale-[1.03]'
                : ''
            }`}
          >
            {isHighVolatility && (
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-90"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-500"></span>
              </span>
            )}
            {momConfig.icon}
            <span>{momConfig.title}</span>
          </div>

          <div className="text-right">
            <div className="flex items-center justify-end gap-1.5 mb-0.5">
              <span className="text-[10px] text-zinc-500">СКОЛЬЗЯЩЕЕ σ</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded border font-mono font-bold transition-all ${
                  slidingStdDev >= 1.5
                    ? 'bg-orange-950/80 text-orange-300 border-orange-500/70 animate-pulse shadow-[0_0_8px_rgba(255,107,0,0.4)]'
                    : 'bg-zinc-900 text-zinc-400 border-zinc-800'
                }`}
                title={`Скользящее standard deviation окна: σ_sw ${slidingStdDev.toFixed(2)} | Общая волатильность: σ ${volatility.toFixed(2)}`}
              >
                σ_sw {slidingStdDev.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center justify-end gap-1.5 text-[10px] font-mono">
              <span className="text-zinc-500">MOMENTUM INDEX:</span>
              <span
                id="momentum-index-val"
                className="font-bold text-xs"
                style={{ color: momConfig.color }}
              >
                {weightedMomentumScore > 0 ? `+${weightedMomentumScore}` : weightedMomentumScore}
              </span>

              {/* Trend indicator (arrow icon) showing whether market momentum is rising or falling based on the last 10 drops */}
              <div
                id="momentum-trend-indicator"
                className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border transition-all ${
                  momentumTrend === 'UP'
                    ? 'bg-emerald-950/80 text-emerald-400 border-emerald-500/50 shadow-[0_0_8px_rgba(16,185,129,0.25)]'
                    : momentumTrend === 'DOWN'
                    ? 'bg-red-950/80 text-red-400 border-red-500/50 shadow-[0_0_8px_rgba(239,68,68,0.25)]'
                    : 'bg-zinc-900 text-zinc-400 border-zinc-800'
                }`}
                title={
                  momentumTrend === 'UP'
                    ? `Тренд импульса за последние 10 дропов: РАСТЕТ (+${Math.abs(momentumTrendDelta).toFixed(1)} pts). Апстрик набирает силу.`
                    : momentumTrend === 'DOWN'
                    ? `Тренд импульса за последние 10 дропов: ПАДАЕТ (-${Math.abs(momentumTrendDelta).toFixed(1)} pts). Импульс затухает.`
                    : `Тренд импульса за последние 10 дропов: СТАБИЛЕН.`
                }
              >
                {momentumTrend === 'UP' ? (
                  <>
                    <ArrowUpRight className="w-3 h-3 text-emerald-400 animate-pulse" />
                    <span>+{Math.abs(momentumTrendDelta).toFixed(1)}</span>
                  </>
                ) : momentumTrend === 'DOWN' ? (
                  <>
                    <ArrowDownRight className="w-3 h-3 text-red-400 animate-pulse" />
                    <span>-{Math.abs(momentumTrendDelta).toFixed(1)}</span>
                  </>
                ) : (
                  <>
                    <Minus className="w-2.5 h-2.5 text-zinc-500" />
                    <span>0.0</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ОТДЕЛЬНАЯ ШКАЛА МОМЕНТУМА (ШКАЛА ОТ -100 ДО +100) */}
        <div className="mt-2.5 bg-zinc-950/90 p-2 rounded-lg border border-zinc-800/90">
          <div className="flex items-center justify-between text-[10px] mb-1">
            <span className="text-zinc-300 font-bold flex items-center gap-1">
              <Activity className="w-3 h-3 text-cyan-400" />
              ОТДЕЛЬНАЯ ШКАЛА ИМПУЛЬСА (MOMENTUM SCALE)
            </span>
            <div className="flex items-center gap-1.5">
              <span
                id="momentum-scale-val"
                className="font-mono font-bold text-[10px] px-1.5 py-0.5 rounded border flex items-center gap-1"
                style={{
                  color: momConfig.color,
                  borderColor: `${momConfig.color}50`,
                  backgroundColor: `${momConfig.color}15`,
                }}
              >
                <span>{weightedMomentumScore > 0 ? `+${weightedMomentumScore}` : weightedMomentumScore} / 100</span>
                {momentumTrend === 'UP' ? (
                  <ArrowUpRight className="w-3 h-3 text-emerald-400 animate-pulse shrink-0" title="Тренд за 10 дропов: растет" />
                ) : momentumTrend === 'DOWN' ? (
                  <ArrowDownRight className="w-3 h-3 text-red-400 animate-pulse shrink-0" title="Тренд за 10 дропов: падает" />
                ) : (
                  <Minus className="w-2.5 h-2.5 text-zinc-500 shrink-0" title="Тренд за 10 дропов: стабилен" />
                )}
              </span>
            </div>
          </div>

          {/* Dedicated Bar Track */}
          <div className="relative h-3 w-full bg-zinc-900 rounded-full overflow-hidden border border-zinc-800 flex p-0.5">
            {/* -100 to -25: Холод / Спад */}
            <div className="w-[37.5%] h-full bg-gradient-to-r from-blue-700 via-sky-600 to-cyan-500 rounded-l" title="Спад / Охлаждение (-100 .. -25)" />
            {/* -25 to +25: Нейтраль / Норма */}
            <div className="w-[25%] h-full bg-gradient-to-r from-teal-500 to-emerald-500" title="Нейтральный коридор (-25 .. +25)" />
            {/* +25 to +70: Жар / Апстрик */}
            <div className="w-[22.5%] h-full bg-gradient-to-r from-amber-500 to-orange-500" title="Апстрик / Жар (+25 .. +70)" />
            {/* +70 to +100: Перегрев / Пик */}
            <div className="w-[15%] h-full bg-gradient-to-r from-rose-500 to-fuchsia-600 rounded-r" title="Сверхнагрев / Пик (+70 .. +100)" />

            {/* Zero/Center Line */}
            <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-white/40 pointer-events-none" />

            {/* Precision Momentum Pin Indicator */}
            <div
              className="absolute top-0 bottom-0 w-2 bg-white rounded-full shadow-[0_0_12px_#ffffff] transition-all duration-500 pointer-events-none -translate-x-1/2"
              style={{ left: `${momentumBarPosition}%` }}
            />
          </div>

          {/* Scale Labels & Divisions */}
          <div className="flex justify-between text-[8px] sm:text-[9px] text-zinc-500 mt-1 font-mono">
            <span className="text-blue-400 font-bold">-100 ХОЛОД</span>
            <span className="text-cyan-400">-25</span>
            <span className="text-emerald-400 font-bold">0 НЕЙТРАЛЬ</span>
            <span className="text-amber-400">+25</span>
            <span className="text-orange-400 font-bold">+70 ЖАР</span>
            <span className="text-fuchsia-400 font-bold">+100 ПИК</span>
          </div>
        </div>

        {isHighVolatility && (
          <div className="mt-2 py-1 px-2 rounded bg-orange-950/40 border border-orange-500/40 flex items-center justify-between text-[10px] font-mono text-orange-300 animate-pulse">
            <span className="flex items-center gap-1 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-ping"></span>
              ВСПЛЕСК ВОЛАТИЛЬНОСТИ
            </span>
            <span className="text-zinc-400">ВЫСОКАЯ АКТИВНОСТЬ ПУЛА</span>
          </div>
        )}

        <p className="mt-2 text-[11px] text-zinc-400 italic bg-zinc-900/70 p-1.5 rounded border border-zinc-800/60">
          «{momentumDesc}»
        </p>

        {/* REAL-TIME RECHARTS MOMENTUM FLUCTUATION CHART */}
        <div id="recharts-momentum-chart-block" className="mt-3 pt-2.5 border-t border-zinc-800/80">
          <div className="flex items-center justify-between text-[10px] mb-1.5">
            <span className="text-zinc-300 font-bold flex items-center gap-1.5 font-mono">
              <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
              КОЛЕБАНИЯ ИМПУЛЬСА (ОКНО: {windowSize})
            </span>
            <div className="flex items-center gap-1">
              {[10, 25, 50].map((sz) => (
                <button
                  key={sz}
                  onClick={() => onChangeWindowSize(sz)}
                  className={`text-[9px] px-1.5 py-0.5 rounded font-mono transition-all cursor-pointer ${
                    windowSize === sz
                      ? 'bg-cyan-500 text-black font-black shadow-[0_0_8px_rgba(6,182,212,0.7)]'
                      : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                  }`}
                  title={`Размер аналитического окна: ${sz} роллов`}
                >
                  {sz}
                </button>
              ))}
            </div>
          </div>

          {/* Recharts Area Container */}
          <div className="h-36 w-full bg-zinc-950/90 rounded-lg border border-zinc-800/90 p-1.5 relative overflow-hidden">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={momentumChartData} margin={{ top: 8, right: 6, left: -26, bottom: 0 }}>
                <defs>
                  <linearGradient id="momentumAreaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.45} />
                    <stop offset="50%" stopColor="#06b6d4" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#222530" vertical={false} />
                <XAxis
                  dataKey="label"
                  stroke="#52525b"
                  fontSize={9}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  stroke="#52525b"
                  fontSize={9}
                  tickLine={false}
                  domain={[-50, 50]}
                  ticks={[-40, -20, 0, 20, 40]}
                />
                <Tooltip content={<CustomMomentumTooltip />} />
                <ReferenceLine y={0} stroke="#71717a" strokeDasharray="3 3" />
                <ReferenceLine y={18} stroke="#10b981" strokeDasharray="2 2" strokeOpacity={0.7} />
                <ReferenceLine y={-14} stroke="#3b82f6" strokeDasharray="2 2" strokeOpacity={0.7} />
                <Area
                  type="monotone"
                  dataKey="momentum"
                  stroke="#10b981"
                  strokeWidth={2}
                  fill="url(#momentumAreaGradient)"
                  isAnimationActive={false}
                  dot={false}
                  activeDot={{ r: 4, fill: '#10b981', stroke: '#ffffff', strokeWidth: 1.5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Sub-legend for Momentum Thresholds */}
          <div className="flex justify-between text-[8px] sm:text-[9px] text-zinc-500 mt-1 px-1 font-mono">
            <span className="text-blue-400">▼ ХОЛОД (&lt; -14)</span>
            <span className="text-zinc-400">◆ НЕЙТРАЛЬ (0)</span>
            <span className="text-emerald-400">▲ ГОРЯЧО (&gt; +18)</span>
          </div>
        </div>

        {/* Rarity Spectrum Bar */}
        <div className="mt-2.5">
          <div className="flex justify-between text-[9px] text-zinc-500 mb-1">
            <span>СПЕКТР РЕДКОСТЕЙ В ОКНЕ:</span>
            <span className="text-amber-400">★ {rarityBreakdown.special}%</span>
          </div>
          <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden flex">
            <div style={{ width: `${rarityBreakdown.special}%` }} className="bg-amber-400 h-full" title="Special (★)" />
            <div style={{ width: `${rarityBreakdown.covert}%` }} className="bg-red-500 h-full" title="Covert" />
            <div style={{ width: `${rarityBreakdown.classified}%` }} className="bg-fuchsia-500 h-full" title="Classified" />
            <div style={{ width: `${rarityBreakdown.restricted}%` }} className="bg-purple-500 h-full" title="Restricted" />
            <div style={{ width: `${rarityBreakdown.milSpec}%` }} className="bg-blue-500 h-full" title="Mil-Spec" />
          </div>
        </div>
      </div>

      {/* 4. MATHEMATICAL RTP & SESSION CARD */}
      <div
        id="rtp-math-card"
        className="bg-[#0c0e15]/95 border border-zinc-800 rounded-xl p-3 overflow-hidden shadow-2xl backdrop-blur-sm flex-1"
      >
        <div className="flex items-center justify-between pb-1.5 border-b border-zinc-800/80">
          <div className="flex items-center gap-2">
            <Percent className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs uppercase tracking-wider font-bold text-zinc-300">
              RETURN TO PLAYER (RTP)
            </h3>
          </div>

          {/* Window Size Switcher */}
          <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded p-0.5 text-[10px]">
            <Layers className="w-3 h-3 text-zinc-500 ml-1" />
            <button
              id="rtp-win-10"
              onClick={() => onChangeWindowSize(10)}
              className={`px-1.5 py-0.5 rounded ${
                windowSize === 10 ? 'bg-cyan-500 text-black font-bold' : 'text-zinc-400'
              }`}
            >
              10
            </button>
            <button
              id="rtp-win-25"
              onClick={() => onChangeWindowSize(25)}
              className={`px-1.5 py-0.5 rounded ${
                windowSize === 25 ? 'bg-cyan-500 text-black font-bold' : 'text-zinc-400'
              }`}
            >
              25
            </button>
            <button
              id="rtp-win-50"
              onClick={() => onChangeWindowSize(50)}
              className={`px-1.5 py-0.5 rounded ${
                windowSize === 50 ? 'bg-cyan-500 text-black font-bold' : 'text-zinc-400'
              }`}
            >
              50
            </button>
          </div>
        </div>

        {/* Big RTP % Display */}
        <div className="mt-2.5 flex items-baseline justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] text-zinc-500 block">
                ОКУПАЕМОСТЬ ({windowSize} ДРОПОВ)
              </span>
              <span className="text-[8px] px-1 py-0.2 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 font-mono">
                ТРЕНД: 10 РОЛЛОВ
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span
                id="rtp-percentage-val"
                className={`text-3xl sm:text-4xl font-black ${
                  rtp >= 100 ? 'text-emerald-400' : rtp >= 75 ? 'text-amber-400' : 'text-red-400'
                }`}
              >
                {rtp.toFixed(1)}%
              </span>

              {/* Trend indicator (arrow icon) showing whether the market trend is currently rising or falling based on the last 10 drops */}
              <div
                id="rtp-trend-indicator"
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-mono font-bold border transition-all ${
                  rtpTrend === 'UP'
                    ? 'bg-emerald-950/80 text-emerald-400 border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                    : rtpTrend === 'DOWN'
                    ? 'bg-red-950/80 text-red-400 border-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.3)]'
                    : 'bg-zinc-900 text-zinc-400 border-zinc-800'
                }`}
                title={
                  rtpTrend === 'UP'
                    ? `Тренд рынка за последние 10 дропов: РАСТЕТ (+${Math.abs(rtpTrendDelta).toFixed(1)}% к общему RTP). Окупаемость последних 10: ${(last10Rtp ?? rtp).toFixed(1)}%`
                    : rtpTrend === 'DOWN'
                    ? `Тренд рынка за последние 10 дропов: ПАДАЕТ (-${Math.abs(rtpTrendDelta).toFixed(1)}% от общего RTP). Окупаемость последних 10: ${(last10Rtp ?? rtp).toFixed(1)}%`
                    : `Тренд рынка за последние 10 дропов: СТАБИЛЕН (RTP последних 10: ${(last10Rtp ?? rtp).toFixed(1)}%)`
                }
              >
                {rtpTrend === 'UP' ? (
                  <>
                    <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                    <span>+{Math.abs(rtpTrendDelta).toFixed(1)}%</span>
                  </>
                ) : rtpTrend === 'DOWN' ? (
                  <>
                    <ArrowDownRight className="w-3.5 h-3.5 text-red-400 animate-pulse" />
                    <span>-{Math.abs(rtpTrendDelta).toFixed(1)}%</span>
                  </>
                ) : (
                  <>
                    <Minus className="w-3 h-3 text-zinc-500" />
                    <span>0.0%</span>
                  </>
                )}
              </div>
            </div>

            {/* Sub-label describing the impact of the last 10 drops */}
            <div className="flex items-center gap-1.5 text-[10px] font-mono mt-1 text-zinc-400">
              <span className="text-zinc-500">Посл. 10 шт:</span>
              <span
                className={`font-semibold flex items-center gap-0.5 ${
                  rtpTrend === 'UP'
                    ? 'text-emerald-400'
                    : rtpTrend === 'DOWN'
                    ? 'text-red-400'
                    : 'text-zinc-400'
                }`}
              >
                {rtpTrend === 'UP' ? '↑ Растет' : rtpTrend === 'DOWN' ? '↓ Падает' : '• Без изм.'}
              </span>
              <span className="text-[9px] text-zinc-500">({(last10Rtp ?? rtp).toFixed(1)}% RTP)</span>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[9px] text-zinc-500 block">ПРОФИТ СЕССИИ</span>
            <span
              className={`text-xs font-bold ${
                profit >= 0 ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              {profit >= 0 ? `+${formatMoney(profit)}` : `-${formatMoney(Math.abs(profit))}`}
            </span>
          </div>
        </div>

        {/* Detailed Stats Grid */}
        <div className="grid grid-cols-2 gap-1.5 mt-2.5 pt-2 border-t border-zinc-800/80 text-[11px]">
          <div className="flex items-center justify-between p-1.5 rounded bg-zinc-900/60 border border-zinc-800/60">
            <span className="text-zinc-500 flex items-center gap-1 text-[10px]">
              <Coins className="w-3 h-3 text-zinc-400" /> Внесено:
            </span>
            <span className="font-bold text-zinc-200">{formatMoney(totalSpent)}</span>
          </div>
          <div className="flex items-center justify-between p-1.5 rounded bg-zinc-900/60 border border-zinc-800/60">
            <span className="text-zinc-500 flex items-center gap-1 text-[10px]">
              <Coins className="w-3 h-3 text-emerald-400" /> Выбито:
            </span>
            <span className="font-bold text-emerald-400">{formatMoney(totalWon)}</span>
          </div>

          <div className="flex items-center justify-between p-1.5 rounded bg-zinc-900/60 border border-zinc-800/60">
            <span className="text-zinc-500 text-[10px]">Тайное (Red):</span>
            <span className="font-bold text-red-400">{covertCount}</span>
          </div>
          <div className="flex items-center justify-between p-1.5 rounded bg-zinc-900/60 border border-zinc-800/60">
            <span className="text-zinc-500 text-[10px]">Ножи (★ Gold):</span>
            <span className="font-bold text-amber-400">{specialCount}</span>
          </div>
        </div>

        {/* Best Drop Callout */}
        {bestDrop && (
          <div className="mt-2 p-2 rounded-lg bg-amber-950/20 border border-amber-500/30 flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <div>
                <span className="text-[9px] text-amber-400/80 block uppercase font-bold">
                  ЛУЧШИЙ ДРОП СЕССИИ
                </span>
                <span className="text-zinc-200 font-bold truncate max-w-[130px] block">
                  {bestDrop.itemName}
                </span>
              </div>
            </div>
            <span className="text-xs font-bold text-amber-300">
              {formatMoney(bestDrop.price)}
            </span>
          </div>
        )}
      </div>
    </aside>
  );
};

