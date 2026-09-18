import React, { useState, useMemo } from 'react';
import { Sparkles, TrendingUp, TrendingDown, Clock, ShieldCheck, Flame, User, Filter, Box, Zap, Award, ExternalLink } from 'lucide-react';
import { LiveDrop, CurrencyMode, PlatformType } from '../types';
import { RARITY_THEMES } from '../data/cs2Cases';

interface LiveFeedProps {
  drops: LiveDrop[];
  onTriggerDrop: () => void;
  onTriggerMultiDrop: () => void;
  onForceSpecialDrop: () => void;
  onInspectSeed?: (seed: string) => void;
  onSelectPlayer?: (user: string, avatar?: string, userId?: string | number, profileUrl?: string) => void;
  currency?: CurrencyMode;
  isRealFeedActive?: boolean;
  platform?: PlatformType;
}

type FeedFilter = 'ALL' | 'CASES' | 'UPGRADES' | 'TOP';

export const LiveFeed: React.FC<LiveFeedProps> = ({
  drops,
  onTriggerDrop,
  onTriggerMultiDrop,
  onForceSpecialDrop,
  onInspectSeed,
  onSelectPlayer,
  currency = 'RUB',
  isRealFeedActive = true,
  platform = 'CASE_BATTLE',
}) => {
  const isCB = platform === 'CASE_BATTLE';
  const [filter, setFilter] = useState<FeedFilter>('ALL');

  const formatMoney = (usdVal: number, rubVal?: number) => {
    if (currency === 'RUB') {
      const rub = rubVal !== undefined ? Math.round(rubVal) : Math.round(usdVal * 92);
      return `${rub.toLocaleString('ru-RU')} ₽`;
    }
    return `$${usdVal.toFixed(2)}`;
  };

  const splitItemName = (name: string) => {
    const parts = name.split(' | ');
    if (parts.length > 1) {
      return { weapon: parts[0], skin: parts.slice(1).join(' | ') };
    }
    return { weapon: name, skin: '' };
  };

  const filteredDrops = useMemo(() => {
    if (filter === 'ALL') return drops;
    if (filter === 'CASES') {
      return drops.filter((d) => d.rawSource === 1 || (!d.caseName?.includes('Апгрейд') && !d.caseName?.includes('Контракт')));
    }
    if (filter === 'UPGRADES') {
      return drops.filter((d) => d.rawSource === 2 || d.caseName?.includes('Апгрейд'));
    }
    if (filter === 'TOP') {
      return drops.filter((d) => (d.rubPrice || d.price * 92) >= 1000);
    }
    return drops;
  }, [drops, filter]);

  const latestDrop = drops[drops.length - 1];

  return (
    <section
      id="live-drop-feed-section"
      className="flex flex-col h-full bg-[#0b0d13]/90 border border-zinc-800/90 rounded-xl overflow-hidden shadow-2xl backdrop-blur-sm"
    >
      {/* Top Header of Feed */}
      <div className="px-4 py-3 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-2 bg-[#0e111a]/80">
        <div className="flex items-center gap-2">
          <span className="flex h-2.5 w-2.5 relative">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isRealFeedActive ? (isCB ? 'bg-orange-400' : 'bg-cyan-400') : 'bg-emerald-400'}`}></span>
            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isRealFeedActive ? (isCB ? 'bg-orange-500' : 'bg-cyan-500') : 'bg-emerald-500'}`}></span>
          </span>
          <h2 className="text-xs sm:text-sm font-bold font-mono tracking-wider text-zinc-200 uppercase flex items-center gap-1.5">
            <span className={isRealFeedActive ? (isCB ? 'text-orange-400' : 'text-cyan-400') : 'text-emerald-400'}>
              {isRealFeedActive
                ? isCB
                  ? '● РЕАЛЬНАЯ ЛЕНТА CASE-BATTLE.LTD'
                  : '● РЕАЛЬНАЯ ЛЕНТА CASER.GG'
                : '● LIVE DROP FEED'}
            </span>
            <span className="text-zinc-500 text-xs hidden sm:inline">
              {isRealFeedActive
                ? (isCB ? '// ПРЯМОЙ WSS С CASE-BATTLE.LTD' : '// ПРЯМОЙ ПОТОК С CASER.GG/EN')
                : '// ПОТОК ОТКРЫТИЙ В РЕАЛЬНОМ ВРЕМЕНИ'}
            </span>
          </h2>
        </div>

        {/* Quick simulation action buttons */}
        <div className="flex items-center gap-1.5">
          <button
            id="trigger-1x-drop-btn"
            onClick={onTriggerDrop}
            className="px-2.5 py-1 text-xs font-mono font-semibold rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors"
          >
            +1 DROP
          </button>
          <button
            id="trigger-5x-drop-btn"
            onClick={onTriggerMultiDrop}
            className="px-2.5 py-1 text-xs font-mono font-semibold rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors"
          >
            +5 RAPID
          </button>
          <button
            id="force-knife-btn"
            onClick={onForceSpecialDrop}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-mono font-bold rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/60 shadow-[0_0_10px_rgba(245,158,11,0.3)] transition-all"
            title="Спровоцировать выпадение ножа для проверки стрим-анимации"
          >
            <Sparkles className="w-3 h-3 text-amber-400 animate-spin" />
            <span>★ FORCE KNIFE</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs Toolbar (Directly mirrors Case-Battle's live tape categories) */}
      <div className="px-4 py-1.5 bg-[#090b10] border-b border-zinc-800/80 flex items-center justify-between gap-2 overflow-x-auto text-xs font-mono">
        <div className="flex items-center gap-1">
          <span className="text-zinc-500 flex items-center gap-1 mr-1 text-[11px]">
            <Filter className="w-3 h-3 text-zinc-400" />
            ЛЕНТА:
          </span>
          <button
            onClick={() => setFilter('ALL')}
            className={`px-2 py-0.5 rounded transition-all text-[11px] font-bold ${
              filter === 'ALL'
                ? 'bg-zinc-700 text-white border border-zinc-600'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
            }`}
          >
            ВСЕ ({drops.length})
          </button>
          <button
            onClick={() => setFilter('CASES')}
            className={`px-2 py-0.5 rounded transition-all text-[11px] font-bold flex items-center gap-1 ${
              filter === 'CASES'
                ? 'bg-orange-500/20 text-orange-300 border border-orange-500/50'
                : 'text-zinc-400 hover:text-orange-400 hover:bg-zinc-800/60'
            }`}
          >
            <Box className="w-3 h-3" />
            ТОЛЬКО КЕЙСЫ
          </button>
          <button
            onClick={() => setFilter('UPGRADES')}
            className={`px-2 py-0.5 rounded transition-all text-[11px] font-bold flex items-center gap-1 ${
              filter === 'UPGRADES'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/50'
                : 'text-zinc-400 hover:text-purple-400 hover:bg-zinc-800/60'
            }`}
          >
            <Zap className="w-3 h-3" />
            АПГРЕЙДЫ
          </button>
          <button
            onClick={() => setFilter('TOP')}
            className={`px-2 py-0.5 rounded transition-all text-[11px] font-bold flex items-center gap-1 ${
              filter === 'TOP'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
                : 'text-zinc-400 hover:text-amber-400 hover:bg-zinc-800/60'
            }`}
          >
            <Award className="w-3 h-3" />
            ТОП (≥1 000 ₽)
          </button>
        </div>

        <div className="text-[10px] text-zinc-500 hidden sm:flex items-center gap-1">
          <span>Синхронизировано:</span>
          <span className="text-emerald-400 font-bold">100% REAL-TIME WSS</span>
        </div>
      </div>

      {/* Featured Latest High-Impact Drop Banner if special/covert */}
      {latestDrop && (latestDrop.rarity === 'Special' || latestDrop.rarity === 'Covert') && (
        <div
          id="featured-drop-alert"
          className={`px-4 py-2 text-xs font-mono border-b flex items-center justify-between transition-all ${
            latestDrop.rarity === 'Special'
              ? 'bg-amber-950/40 border-amber-500/60 text-amber-200 animate-special-alert-flicker shadow-[inset_0_0_20px_rgba(245,158,11,0.25)]'
              : 'bg-red-950/40 border-red-500/50 text-red-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-orange-400 animate-bounce" />
            <span className="font-bold tracking-wider">
              {latestDrop.rarity === 'Special' ? '★ JACKPOT SPECIAL DROP DETECTED!' : 'HOT COVERT DROP!'}
            </span>
            <span className="text-zinc-400 hidden md:inline">({latestDrop.itemName})</span>
            {latestDrop.user && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectPlayer?.(latestDrop.user!, latestDrop.userAvatar, latestDrop.userId, latestDrop.profileUrl);
                  }}
                  title="Перейти в профиль игрока и проверить подлинность (Provably Fair)"
                  className="text-amber-400 text-[11px] hidden sm:inline font-bold hover:underline hover:text-amber-300 cursor-pointer"
                >
                  [{latestDrop.user}]
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectPlayer?.(latestDrop.user!, latestDrop.userAvatar, latestDrop.userId, latestDrop.profileUrl);
                  }}
                  title="Открыть профиль игрока и проверить честность (Provably Fair / Steam)"
                  className="hidden sm:inline-flex items-center gap-1 text-[10px] text-sky-400 hover:text-sky-300 bg-sky-950/70 hover:bg-sky-900 px-1.5 py-0.5 rounded border border-sky-500/50 transition-colors cursor-pointer"
                >
                  <User className="w-2.5 h-2.5" />
                  <span>Профиль</span>
                </button>
              </div>
            )}
          </div>
          <div className="font-bold text-emerald-400 flex items-center gap-1.5">
            <span>+{formatMoney(latestDrop.profit, latestDrop.rubPrice ? (latestDrop.rubPrice - (latestDrop.rubCaseCost || 0)) : undefined)}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/40">
              +{Math.round((latestDrop.price / latestDrop.caseCost) * 100)}% ROI
            </span>
          </div>
        </div>
      )}

      {/* Drop List Cards */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-[480px] scrollbar-thin">
        {filteredDrops.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center text-zinc-500 font-mono text-xs">
            <p>ОЖИДАНИЕ ПАКЕТОВ ПОТОКА WSS...</p>
            <p className="text-[11px] text-zinc-600 mt-1">По выбранному фильтру пока нет открытий</p>
          </div>
        ) : (
          [...filteredDrops].reverse().map((drop, idx) => {
            const theme = RARITY_THEMES[drop.rarity];
            const isProfit = drop.profit >= 0;
            const isNewest = idx === 0;
            const isSpecial = drop.rarity === 'Special';
            const { weapon, skin } = splitItemName(drop.itemName);

            const profitRub = drop.rubPrice !== undefined && drop.rubCaseCost !== undefined
              ? (drop.rubPrice - drop.rubCaseCost)
              : undefined;

            return (
              <div
                key={`${drop.id}_${idx}`}
                id={`drop-card-${drop.id}`}
                className={`relative rounded-lg p-2 sm:p-2.5 border transition-all duration-300 font-mono ${
                  isSpecial
                    ? 'border-amber-400/90 bg-[#16130b]/95 shadow-[0_0_18px_rgba(245,158,11,0.35)] animate-special-flicker'
                    : isNewest
                    ? `${theme.border} bg-[#121622]/95 shadow-lg`
                    : 'border-zinc-800/80 bg-[#0d1017]/80 hover:border-zinc-700'
                }`}
              >
                {/* Rarity Glow Bar on Left */}
                <div
                  className={`absolute left-0 top-0 bottom-0 rounded-l-lg transition-all ${
                    isSpecial ? 'w-1.5 animate-special-glow-bar' : 'w-1'
                  }`}
                  style={{ backgroundColor: theme.accentColor }}
                />

                <div className="pl-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  {/* Left Column: Skin Image + Name & Metadata */}
                  <div className="flex items-center gap-3">
                    {/* Item Image Thumbnail from CDN */}
                    {drop.itemImage ? (
                      <div className={`w-12 h-12 shrink-0 rounded bg-zinc-900/90 border flex items-center justify-center p-1 relative overflow-hidden group transition-all ${
                        isSpecial
                          ? 'border-amber-400/70 bg-gradient-to-b from-amber-950/40 via-zinc-900 to-zinc-900 ring-1 ring-amber-400/40 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
                          : 'border-zinc-800'
                      }`}>
                        {isSpecial && (
                          <div className="absolute inset-0 bg-amber-500/10 pointer-events-none animate-pulse" />
                        )}
                        <img
                          src={drop.itemImage}
                          alt={drop.itemName}
                          className="w-full h-full object-contain drop-shadow relative z-10"
                          loading="lazy"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    ) : (
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded border uppercase tracking-wider shrink-0 ${
                          isSpecial ? 'animate-special-alert-flicker' : ''
                        } ${theme.badge}`}
                      >
                        {theme.label}
                      </span>
                    )}

                    <div>
                      {/* Weapon & Skin Title */}
                      <div className="flex items-baseline gap-1.5 flex-wrap">
                        <span className={`text-xs sm:text-sm font-bold ${isSpecial ? 'text-amber-200' : 'text-zinc-200'}`}>
                          {weapon}
                        </span>
                        {skin && (
                          <span className={`text-xs sm:text-sm font-semibold ${theme.textColor}`}>
                            {skin}
                          </span>
                        )}
                        {isSpecial && (
                          <span className="inline-flex items-center gap-1 ml-1 px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-400/60 text-amber-300 text-[10px] font-bold shadow-[0_0_10px_rgba(245,158,11,0.3)] animate-pulse">
                            <Sparkles className="w-3 h-3 text-amber-400 animate-spin" />
                            <span>★ SPECIAL</span>
                          </span>
                        )}
                        {drop.isRealApi && (
                          <span className={`text-[9px] px-1 py-0.2 rounded border font-bold flex items-center gap-1 ${
                            drop.platform === 'KAYSER'
                              ? 'bg-cyan-950/80 border-cyan-500/50 text-cyan-400'
                              : 'bg-orange-950/80 border-orange-500/50 text-orange-400'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full animate-ping ${drop.platform === 'KAYSER' ? 'bg-cyan-400' : 'bg-orange-400'}`}></span>
                            {drop.platform === 'KAYSER' ? 'CASER.GG' : 'CASE-BATTLE.LTD'}
                          </span>
                        )}
                      </div>

                      {/* User, Time, Case Name, Wear */}
                      <div className="flex items-center gap-2 text-[11px] text-zinc-500 mt-0.5 flex-wrap">
                        {drop.user && (
                          <div className="inline-flex items-center gap-0.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectPlayer?.(drop.user!, drop.userAvatar, drop.userId, drop.profileUrl);
                              }}
                              title="Открыть профиль игрока и проверить честность роллов"
                              className="text-zinc-300 hover:text-cyan-300 font-semibold flex items-center gap-1 bg-zinc-900 hover:bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-800 hover:border-cyan-500/50 transition-colors cursor-pointer group/user"
                            >
                              {drop.userAvatar ? (
                                <img
                                  src={drop.userAvatar}
                                  alt=""
                                  className="w-3.5 h-3.5 rounded-full group-hover/user:ring-1 ring-cyan-400 transition-all"
                                  loading="lazy"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <User className="w-3 h-3 text-cyan-400" />
                              )}
                              <span>{drop.user}</span>
                            </button>

                            {/* Open Player Profile Modal & Verification */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectPlayer?.(drop.user!, drop.userAvatar, drop.userId, drop.profileUrl);
                              }}
                              title={`Открыть профиль игрока ${drop.user} (история, статы, Steam, честность)`}
                              className="p-1 rounded text-zinc-500 hover:text-sky-400 hover:bg-sky-950/40 transition-colors cursor-pointer"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {drop.timestamp}
                        </span>
                        {drop.caseName && (
                          <>
                            <span>•</span>
                            <span className="text-orange-400/90 font-medium">[{drop.caseName}]</span>
                          </>
                        )}
                        <span>•</span>
                        <span className="text-zinc-400">{drop.wear}</span>
                        <span>•</span>
                        {onInspectSeed ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onInspectSeed(drop.seedHash);
                            }}
                            title="Открыть криптографическую проверку сида (Provably Fair)"
                            className="text-zinc-500 hover:text-cyan-300 font-mono text-[10px] hidden md:inline-flex items-center gap-1 hover:underline cursor-pointer"
                          >
                            <span>seed: {drop.seedHash}</span>
                            <span className="text-[9px] px-1 rounded bg-cyan-950 text-cyan-400 border border-cyan-800">
                              FAIR
                            </span>
                          </button>
                        ) : (
                          <span className="text-zinc-600 font-mono text-[10px] hidden md:inline">
                            seed: {drop.seedHash}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Price & ROI */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 sm:text-right pl-2 sm:pl-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-zinc-800/60 shrink-0">
                    <div className="flex flex-col">
                      <span className="text-xs sm:text-sm font-bold text-zinc-100 font-mono">
                        {formatMoney(drop.price, drop.rubPrice)}
                      </span>
                      <span className="text-[10px] text-zinc-500">
                        кейс: {formatMoney(drop.caseCost, drop.rubCaseCost)}
                      </span>
                    </div>

                    {/* ROI Pill */}
                    <div
                      className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded border shrink-0 ${
                        isProfit
                          ? 'bg-emerald-950/60 text-emerald-400 border-emerald-500/40'
                          : 'bg-red-950/50 text-red-400 border-red-500/30'
                      }`}
                    >
                      {isProfit ? (
                        <>
                          <TrendingUp className="w-3 h-3" />
                          <span>+{formatMoney(drop.profit, profitRub)}</span>
                        </>
                      ) : (
                        <>
                          <TrendingDown className="w-3 h-3" />
                          <span>-{formatMoney(Math.abs(drop.profit), profitRub !== undefined ? Math.abs(profitRub) : undefined)}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Mini Ticker Footer */}
      <div className="px-4 py-2 border-t border-zinc-800/80 bg-[#090b10] flex items-center justify-between text-[11px] font-mono text-zinc-500">
        <span className="flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>PROVABLY FAIR & LIVE STREAM TELEMETRY</span>
        </span>
        <span className="text-zinc-400">
          ВСЕГО ОТКРЫТИЙ: <strong className="text-orange-400">{drops.length}</strong>
        </span>
      </div>
    </section>
  );
};
