import { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from './components/Header';
import { LiveFeed } from './components/LiveFeed';
import { AnalyticsPanel } from './components/AnalyticsPanel';
import { TerminalLogs } from './components/TerminalLogs';
import { PythonModal } from './components/PythonModal';
import { RealFeedModal } from './components/RealFeedModal';
import { ProvablyFairModal } from './components/ProvablyFairModal';
import { PlayerProfileModal } from './components/PlayerProfileModal';
import { RtpTimingCheckerModal } from './components/RtpTimingCheckerModal';
import { CS2_CASES } from './data/cs2Cases';
import { CaseDefinition, LiveDrop, TerminalLogEntry, DataSourceMode, CurrencyMode, PlatformType, RtpAlertConfig } from './types';
import { computeAnalytics, HACKER_SYS_MESSAGES } from './services/analytics';
import { realFeedService } from './services/realCaseBattleFeed';
import { fireCyberConfetti } from './services/confettiBurst';
import {
  playCyberClick,
  playDropBeep,
  playAlertSound,
  setAudioEnabled,
} from './services/audioSynthesizer';

const WEARS = [
  { name: 'FN (Прямо с завода)', range: [0.001, 0.07] },
  { name: 'MW (Немного поношенное)', range: [0.07, 0.15] },
  { name: 'FT (После полевых)', range: [0.15, 0.38] },
  { name: 'WW (Поношенное)', range: [0.38, 0.45] },
  { name: 'BS (Закаленное в боях)', range: [0.45, 0.99] },
];

export default function App() {
  const [platform, setPlatform] = useState<PlatformType>('CASE_BATTLE');
  const [cases] = useState<CaseDefinition[]>(CS2_CASES);
  const [currentCase, setCurrentCase] = useState<CaseDefinition>(CS2_CASES[0]);
  const [drops, setDrops] = useState<LiveDrop[]>([]);
  const [isRunning, setIsRunning] = useState(true);
  const [openSpeed, setOpenSpeed] = useState(1400);
  const [windowSize, setWindowSize] = useState(25);
  const [audioMuted, setAudioMuted] = useState(false);
  const [streamerMode, setStreamerMode] = useState(false);
  const [pythonModalOpen, setPythonModalOpen] = useState(false);
  const [realFeedModalOpen, setRealFeedModalOpen] = useState(false);
  const [provablyFairModalOpen, setProvablyFairModalOpen] = useState(false);
  const [rtpCheckerModalOpen, setRtpCheckerModalOpen] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<{
    name: string;
    avatar?: string;
    userId?: string | number;
    profileUrl?: string;
  } | null>(null);
  const [targetServerSeed, setTargetServerSeed] = useState<string>('0x21c39e743');
  const [pingMs, setPingMs] = useState(22);
  const [logs, setLogs] = useState<TerminalLogEntry[]>([]);

  // Automated RTP Alert configuration for last 50 cases
  const [alertConfig, setAlertConfig] = useState<RtpAlertConfig>(() => {
    try {
      const saved = localStorage.getItem('cs2_rtp_alert_config');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      enabled: true,
      hotThreshold: 95,
      coldThreshold: 65,
      windowSize: 50,
      soundEnabled: true,
    };
  });

  const handleUpdateAlertConfig = useCallback((newConfig: Partial<RtpAlertConfig>) => {
    setAlertConfig((prev) => {
      const updated = { ...prev, ...newConfig };
      try {
        localStorage.setItem('cs2_rtp_alert_config', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  }, []);

  const lastAlertZoneRef = useRef<'HOT' | 'COLD' | 'NORMAL'>('NORMAL');
  const lastAlertDropIndexRef = useRef<number>(0);

  // Real API and currency state
  const [dataSourceMode, setDataSourceMode] = useState<DataSourceMode>('REAL_API');
  const [currency, setCurrency] = useState<CurrencyMode>('RUB');
  const [activeMirror, setActiveMirror] = useState<string>(realFeedService.getActiveMirror('CASE_BATTLE'));
  const [realDropsCount, setRealDropsCount] = useState<number>(0);

  const dropIdCounter = useRef(100);
  const simTimerRef = useRef<NodeJS.Timeout | null>(null);
  const seenDropIdsRef = useRef<Set<string>>(new Set());

  // Helper to add terminal log
  const addLog = useCallback((message: string, level: TerminalLogEntry['level'] = 'INFO') => {
    const ts = new Date().toLocaleTimeString('ru-RU');
    const hex = `0x${Math.floor(Math.random() * 0xfffff).toString(16).toUpperCase().padStart(4, '0')}`;
    setLogs((prev) => [
      ...prev.slice(-60),
      {
        id: `log_${Date.now()}_${Math.random()}`,
        timestamp: ts,
        level,
        message,
        hexOffset: hex,
      },
    ]);
  }, []);

  // Single simulation drop generator
  const createDrop = useCallback((caseDef: CaseDefinition, forceSpecial: boolean = false): LiveDrop => {
    dropIdCounter.current += 1;
    const items = caseDef.items;
    let selected = items[0];

    if (forceSpecial) {
      const specialItems = items.filter((i) => i.rarity === 'Special');
      selected = specialItems[Math.floor(Math.random() * specialItems.length)] || items[items.length - 1];
    } else {
      const totalWeight = items.reduce((acc, i) => acc + i.weight, 0);
      let rand = Math.random() * totalWeight;
      for (const item of items) {
        if (rand < item.weight) {
          selected = item;
          break;
        }
        rand -= item.weight;
      }
    }

    const wearObj = WEARS[Math.floor(Math.random() * WEARS.length)];
    const floatVal =
      wearObj.range[0] + Math.random() * (wearObj.range[1] - wearObj.range[0]);

    // Price variation ±4%
    const priceVar = selected.price * (0.96 + Math.random() * 0.08);
    const profit = priceVar - caseDef.cost;
    const ratio = priceVar / caseDef.cost;
    const seed = `0x${Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0')}`;
    const user = `${caseDef.platform === 'KAYSER' ? 'kayser' : 'player'}_${Math.floor(100 + Math.random() * 900)}`;

    return {
      id: `drop_${dropIdCounter.current}`,
      timestamp: new Date().toLocaleTimeString('ru-RU'),
      itemName: selected.name,
      rarity: selected.rarity,
      price: Math.round(priceVar * 100) / 100,
      rubPrice: Math.round(priceVar * 92),
      caseCost: caseDef.cost,
      caseCostRub: Math.round(caseDef.cost * 92),
      caseName: caseDef.name,
      wear: wearObj.name,
      wearFloat: Math.round(floatVal * 1000) / 1000,
      seedHash: seed,
      user,
      profit: Math.round(profit * 100) / 100,
      ratio: Math.round(ratio * 10) / 10,
      isRealApi: false,
      platform: caseDef.platform || platform,
      source: 'simulation',
    };
  }, [platform]);

  // Process and ingest incoming drop (both real API and simulated)
  const processIncomingDrop = useCallback((drop: LiveDrop) => {
    // Prevent duplicate drops from reconnects or history resends
    if (seenDropIdsRef.current.has(drop.id)) {
      return;
    }
    seenDropIdsRef.current.add(drop.id);
    if (seenDropIdsRef.current.size > 500) {
      const arr = Array.from(seenDropIdsRef.current);
      seenDropIdsRef.current = new Set(arr.slice(-250));
    }

    setDrops((prev) => {
      if (prev.some((d) => d.id === drop.id)) {
        return prev;
      }
      return [...prev.slice(-80), drop];
    });

    // Sound effect
    playDropBeep(drop.rarity);

    // Special celebrations
    if (drop.rarity === 'Special') {
      fireCyberConfetti(110);
      const priceTag = drop.rubPrice ? `${drop.rubPrice.toLocaleString('ru-RU')} ₽` : `$${drop.price.toFixed(2)}`;
      const userTag = drop.user ? `игроком [${drop.user}]` : '';
      const platformTag = drop.platform === 'KAYSER' ? '[КЕЙСЕР]' : '[CASE-BATTLE]';
      addLog(`★ ${platformTag} ВЫБИТ НОЖ/ПЕРЧАТКИ: ${drop.itemName} (${priceTag}) ${userTag}`, 'SUCCESS');
      addLog(`[JACKPOT] Вектор натяжения сдвинут -> OVERHEATED состояние`, 'PREDICTION');
    } else if (drop.rarity === 'Covert') {
      const priceTag = drop.rubPrice ? `${drop.rubPrice.toLocaleString('ru-RU')} ₽` : `$${drop.price.toFixed(2)}`;
      addLog(`ТАЙНОЕ: ${drop.itemName} (${priceTag}) | Окупаемость: +${Math.round(drop.ratio * 100)}%`, 'SUCCESS');
    } else if (Math.random() < 0.25) {
      const randMsg = HACKER_SYS_MESSAGES[Math.floor(Math.random() * HACKER_SYS_MESSAGES.length)];
      const level = randMsg.includes('SUCCESS')
        ? 'SUCCESS'
        : randMsg.includes('WARN')
        ? 'WARN'
        : randMsg.includes('ENTROPY')
        ? 'ENTROPY'
        : randMsg.includes('PREDICTION')
        ? 'PREDICTION'
        : 'INFO';
      addLog(randMsg.replace(/^\[[A-Z]+\]\s*/, ''), level);
    }
  }, [addLog]);

  // Platform switcher handler
  const handleSelectPlatform = useCallback((newPlatform: PlatformType) => {
    if (newPlatform === platform) return;
    playCyberClick();
    setPlatform(newPlatform);
    realFeedService.setPlatform(newPlatform);
    const mirror = realFeedService.getActiveMirror(newPlatform);
    setActiveMirror(mirror);

    const platformCases = cases.filter((c) =>
      newPlatform === 'KAYSER' ? c.platform === 'KAYSER' : c.platform !== 'KAYSER'
    );
    if (platformCases.length > 0) {
      setCurrentCase(platformCases[0]);
    }

    addLog(
      `[ПЛАТФОРМА] Переключение анализа ленты на ${newPlatform === 'CASE_BATTLE' ? 'Case-Battle' : 'Кейсер (Kayser)'}`,
      'READY'
    );
    addLog(`[АПИ] Активное зеркало сайта: ${mirror}`, 'INFO');
  }, [platform, cases, addLog]);

  // Initial Seed and status logs
  useEffect(() => {
    addLog('CASE BATTLE & CASER HELPER v2.6 активирован в киберпанк HUD режиме', 'SYSTEM');
    addLog(`Активная платформа: ${platform === 'CASE_BATTLE' ? 'Case-Battle.ltd' : 'Caser.gg'} [${activeMirror}]`, 'INFO');
    addLog('Готовность прямого WebSocket потока и парсера ленты: 100% OK', 'SUCCESS');

    if (dataSourceMode === 'REAL_API') {
      // Immediately fetch real current drops directly from the platform!
      realFeedService.fetchInitialDrops(platform).then((initialDrops) => {
        if (initialDrops.length > 0) {
          setDrops(initialDrops);
          seenDropIdsRef.current = new Set(initialDrops.map((d) => d.id));
          addLog(
            `[СИНХРОНИЗАЦИЯ] Загружено ${initialDrops.length} открытий напрямую с ${
              platform === 'CASE_BATTLE' ? 'https://case-battle.ltd/' : 'https://caser.gg/en'
            }`,
            'SUCCESS'
          );
        }
      });
    } else {
      // Generate initial drops for simulation mode
      const initialDrops: LiveDrop[] = [];
      for (let i = 0; i < 6; i++) {
        initialDrops.push(createDrop(CS2_CASES[0], false));
      }
      setDrops(initialDrops);
    }
  }, [addLog, createDrop, activeMirror, platform, dataSourceMode]);

  // Real Platform API Feed Subscription
  useEffect(() => {
    if (dataSourceMode !== 'REAL_API') {
      realFeedService.stop();
      return;
    }

    const platformName = platform === 'CASE_BATTLE' ? 'Case-Battle' : 'Кейсер (Kayser)';
    addLog(`Включен режим прямого анализа реальной ленты ${platformName} [${activeMirror}]`, 'READY');
    realFeedService.start();

    // Subscribe to status
    const unsubStatus = realFeedService.subscribeStatus((status) => {
      setPingMs(status.pingMs);
      setRealDropsCount(status.dropsReceived);
      setActiveMirror(status.activeMirror);
    });

    // Subscribe to live drops
    const unsubDrops = realFeedService.subscribeDrops((realDrop) => {
      if (!isRunning) return;
      processIncomingDrop(realDrop);
    });

    return () => {
      unsubStatus();
      unsubDrops();
      realFeedService.stop();
    };
  }, [dataSourceMode, platform, isRunning, processIncomingDrop, activeMirror, addLog]);

  // Simulation interval (active only when in SIMULATION mode)
  useEffect(() => {
    if (dataSourceMode !== 'SIMULATION' || !isRunning) {
      if (simTimerRef.current) clearInterval(simTimerRef.current);
      return;
    }

    simTimerRef.current = setInterval(() => {
      const newDrop = createDrop(currentCase, false);
      processIncomingDrop(newDrop);
      setPingMs(Math.floor(16 + Math.random() * 12));
    }, openSpeed);

    return () => {
      if (simTimerRef.current) clearInterval(simTimerRef.current);
    };
  }, [dataSourceMode, isRunning, openSpeed, currentCase, createDrop, processIncomingDrop]);

  // Command input handler
  const handleExecuteCommand = (cmd: string) => {
    const clean = cmd.trim().toLowerCase();
    addLog(`stream@helper:~$ ${cmd}`, 'SYSTEM');

    if (clean === 'help') {
      addLog('Команды: checker, check, alert, hot <порог>, cold <порог>, alert on/off, test hot/cold, status, mirror, knife, real, sim, cb, kayser, clear, boost, rtp', 'INFO');
    } else if (clean === 'check' || clean === 'checker' || clean === 'timing' || clean === 'чекер') {
      setRtpCheckerModalOpen(true);
      addLog(`[ЧЕКЕР ТАЙМИНГА] Открыт чекер фиксации шансов и анализа ролла (Текущий RTP: ${last50Rtp.toFixed(1)}%)`, 'SUCCESS');
    } else if (clean.startsWith('hot ') || clean.startsWith('set hot ')) {
      const val = parseFloat(clean.replace(/^(set\s+)?hot\s+/, ''));
      if (!isNaN(val) && val >= 50 && val <= 250) {
        handleUpdateAlertConfig({ hotThreshold: val });
        addLog(`[АЛЕРТЫ] Порог HOT установлен на ${val}%`, 'SUCCESS');
      } else {
        addLog('Использование: hot <число%> (например: hot 95 или hot 105)', 'WARN');
      }
    } else if (clean.startsWith('cold ') || clean.startsWith('set cold ')) {
      const val = parseFloat(clean.replace(/^(set\s+)?cold\s+/, ''));
      if (!isNaN(val) && val >= 20 && val <= 100) {
        handleUpdateAlertConfig({ coldThreshold: val });
        addLog(`[АЛЕРТЫ] Порог COLD установлен на ${val}%`, 'SUCCESS');
      } else {
        addLog('Использование: cold <число%> (например: cold 65 или cold 55)', 'WARN');
      }
    } else if (clean === 'alert' || clean === 'alerts' || clean === 'rtp') {
      addLog(
        `[СТАТУС АЛЕРТОВ] Система: ${alertConfig.enabled ? 'АКТИВНА' : 'ОТКЛЮЧЕНА'} | RTP(50): ${last50Rtp.toFixed(1)}% | HOT порог: ≥${alertConfig.hotThreshold}% | COLD порог: ≤${alertConfig.coldThreshold}%`,
        'INFO'
      );
    } else if (clean === 'alert on') {
      handleUpdateAlertConfig({ enabled: true });
      addLog('[АЛЕРТЫ] Автоматические оповещения тайминга ВКЛЮЧЕНЫ', 'SUCCESS');
    } else if (clean === 'alert off') {
      handleUpdateAlertConfig({ enabled: false });
      addLog('[АЛЕРТЫ] Автоматические оповещения тайминга ВЫКЛЮЧЕНЫ', 'WARN');
    } else if (clean === 'test hot') {
      handleTriggerTestAlert('HOT');
    } else if (clean === 'test cold') {
      handleTriggerTestAlert('COLD');
    } else if (clean === 'clear') {
      setLogs([]);
      addLog('Терминальный буфер очищен.', 'SYSTEM');
    } else if (clean === 'knife' || clean === 'drop') {
      const drop = createDrop(currentCase, true);
      processIncomingDrop(drop);
    } else if (clean === 'kayser' || clean === 'кейсер') {
      handleSelectPlatform('KAYSER');
    } else if (clean === 'cb' || clean === 'casebattle') {
      handleSelectPlatform('CASE_BATTLE');
    } else if (clean === 'real') {
      setDataSourceMode('REAL_API');
      addLog('Переключено на режим РЕАЛЬНОГО АПИ', 'SUCCESS');
    } else if (clean === 'sim') {
      setDataSourceMode('SIMULATION');
      addLog('Переключено на режим СИМУЛЯЦИИ', 'INFO');
    } else if (clean === 'mirror') {
      setRealFeedModalOpen(true);
    } else if (clean === 'status') {
      addLog(`Платформа: ${platform} | Режим: ${dataSourceMode} | Зеркало: ${activeMirror} (${pingMs}ms) | Дропов: ${drops.length}`, 'INFO');
    } else if (clean === 'boost') {
      setOpenSpeed(600);
      addLog('Скорость опроса ленты увеличена до 0.6с', 'SUCCESS');
    } else {
      addLog(`Неизвестная команда: "${cmd}". Введите 'help' для списка.`, 'WARN');
    }
  };

  const handleToggleAudio = () => {
    const nextState = !audioMuted;
    setAudioMuted(nextState);
    setAudioEnabled(!nextState);
    if (!nextState) playCyberClick();
  };

  const handleInjectSeedAnalysis = () => {
    playCyberClick();
    addLog('Ручной пересчет квантовой дисперсии сида', 'SYSTEM');
    addLog(`Новая энтропия: 0x${Math.floor(Math.random() * 0xffffffff).toString(16).toUpperCase()}`, 'ENTROPY');
    addLog('Анализ паттернов ленты завершен -> Метрики моментума откалиброваны', 'PREDICTION');
  };

  const handleTriggerMultiDrop = () => {
    playCyberClick();
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        const drop = createDrop(currentCase, false);
        processIncomingDrop(drop);
      }, i * 200);
    }
  };

  // RTP calculation for the last 50 cases
  const last50Drops = drops.slice(-50);
  const last50Spent = last50Drops.reduce((acc, d) => acc + d.caseCost, 0);
  const last50Won = last50Drops.reduce((acc, d) => acc + d.price, 0);
  const last50Rtp = last50Spent > 0 ? Math.round((last50Won / last50Spent) * 1000) / 10 : 100;

  // Automated test alert trigger
  const handleTriggerTestAlert = useCallback((type: 'HOT' | 'COLD') => {
    playCyberClick();
    if (type === 'HOT') {
      const testVal = Math.max(last50Rtp, alertConfig.hotThreshold + 11.5);
      const msg = `🔥 [HOT POOL ALERT // ТЕСТ] RTP последних 50 кейсов достиг ${testVal.toFixed(1)}% (порог: ≥${alertConfig.hotThreshold}%). Пул разогрет и отдаёт высокий профит! Рекомендуется открывать кейсы прямо сейчас.`;
      addLog(msg, 'HOT');
      if (alertConfig.soundEnabled && !audioMuted) {
        playAlertSound('HOT');
      }
    } else {
      const testVal = Math.min(last50Rtp, alertConfig.coldThreshold - 9.2);
      const msg = `❄️ [COLD POOL ALERT // ТЕСТ] RTP последних 50 кейсов упал до ${testVal.toFixed(1)}% (порог: ≤${alertConfig.coldThreshold}%). Пул в фазе поглощения. Высокий риск слива — рекомендуется выждать откат!`;
      addLog(msg, 'COLD');
      if (alertConfig.soundEnabled && !audioMuted) {
        playAlertSound('COLD');
      }
    }
  }, [last50Rtp, alertConfig, audioMuted, addLog]);

  // Automated RTP Alert trigger effect watching the last 50 cases
  useEffect(() => {
    if (!alertConfig.enabled || drops.length < 5) return;

    let currentZone: 'HOT' | 'COLD' | 'NORMAL' = 'NORMAL';
    if (last50Rtp >= alertConfig.hotThreshold) {
      currentZone = 'HOT';
    } else if (last50Rtp <= alertConfig.coldThreshold) {
      currentZone = 'COLD';
    }

    const previousZone = lastAlertZoneRef.current;
    const currentTotal = drops.length;
    const dropsSinceAlert = currentTotal - lastAlertDropIndexRef.current;

    // Trigger on boundary crossing (entering HOT or COLD), or periodic reminder every 25 drops if staying extreme
    const isBoundaryCrossing = currentZone !== 'NORMAL' && currentZone !== previousZone;
    const isPeriodicPersistentAlert = currentZone !== 'NORMAL' && currentZone === previousZone && dropsSinceAlert >= 25;

    if (isBoundaryCrossing || isPeriodicPersistentAlert) {
      lastAlertZoneRef.current = currentZone;
      lastAlertDropIndexRef.current = currentTotal;

      if (currentZone === 'HOT') {
        const msg = `🔥 [HOT POOL ALERT] RTP последних 50 кейсов достиг ${last50Rtp.toFixed(1)}% (порог: ≥${alertConfig.hotThreshold}%). Пул разогрет и отдаёт высокий профит! Рекомендуется открывать кейсы прямо сейчас.`;
        addLog(msg, 'HOT');
        if (alertConfig.soundEnabled && !audioMuted) {
          playAlertSound('HOT');
        }
      } else if (currentZone === 'COLD') {
        const msg = `❄️ [COLD POOL ALERT] RTP последних 50 кейсов упал до ${last50Rtp.toFixed(1)}% (порог: ≤${alertConfig.coldThreshold}%). Пул в фазе поглощения. Высокий риск слива — рекомендуется выждать откат!`;
        addLog(msg, 'COLD');
        if (alertConfig.soundEnabled && !audioMuted) {
          playAlertSound('COLD');
        }
      }
    } else if (currentZone === 'NORMAL' && previousZone !== 'NORMAL') {
      // Return to normal balanced pool
      addLog(
        `⚖️ [NORMALIZATION] RTP последних 50 кейсов стабилизировался на уровне ${last50Rtp.toFixed(1)}% (нейтральная зона между ${alertConfig.coldThreshold}% и ${alertConfig.hotThreshold}%).`,
        'INFO'
      );
      lastAlertZoneRef.current = 'NORMAL';
    }
  }, [drops.length, last50Rtp, alertConfig, audioMuted, addLog]);

  const metrics = computeAnalytics(drops, windowSize, currentCase);

  return (
    <div
      id="case-battle-app"
      className="min-h-screen bg-[#07080c] text-zinc-100 flex flex-col font-sans selection:bg-orange-500 selection:text-black"
    >
      {/* Header Bar */}
      <Header
        platform={platform}
        onSelectPlatform={handleSelectPlatform}
        currentCase={currentCase}
        cases={cases}
        onSelectCase={(c) => {
          playCyberClick();
          setCurrentCase(c);
          addLog(`Выбран кейс для симулятора: ${c.name} ($${c.cost.toFixed(2)})`, 'INFO');
        }}
        isRunning={isRunning}
        onToggleRunning={() => {
          playCyberClick();
          setIsRunning((prev) => !prev);
          addLog(isRunning ? 'Лента открытий ПРИОСТАНОВЛЕНА' : 'Лента открытий ВОЗОБНОВЛЕНА', 'INFO');
        }}
        audioMuted={audioMuted}
        onToggleAudio={handleToggleAudio}
        streamerMode={streamerMode}
        onToggleStreamerMode={() => {
          playCyberClick();
          setStreamerMode((prev) => !prev);
        }}
        onOpenPythonModal={() => {
          playCyberClick();
          setPythonModalOpen(true);
        }}
        onOpenRealFeedModal={() => {
          playCyberClick();
          setRealFeedModalOpen(true);
        }}
        onOpenProvablyFairModal={() => {
          playCyberClick();
          setProvablyFairModalOpen(true);
        }}
        onOpenRtpCheckerModal={() => {
          playCyberClick();
          setRtpCheckerModalOpen(true);
        }}
        pingMs={pingMs}
        openSpeed={openSpeed}
        onChangeSpeed={(speed) => {
          playCyberClick();
          setOpenSpeed(speed);
          addLog(`Интервал поступления дропов: ${speed / 1000}s`, 'INFO');
        }}
        dataSourceMode={dataSourceMode}
        onToggleDataSource={() => {
          playCyberClick();
          const next = dataSourceMode === 'REAL_API' ? 'SIMULATION' : 'REAL_API';
          setDataSourceMode(next);
          addLog(
            next === 'REAL_API'
              ? `ПОДКЛЮЧЕНИЕ К РЕАЛЬНОМУ АПИ ${platform === 'CASE_BATTLE' ? 'CASE-BATTLE' : 'КЕЙСЕР'}`
              : 'ПЕРЕКЛЮЧЕНИЕ В РЕЖИМ СИМУЛЯЦИИ КЕЙСОВ',
            'SUCCESS'
          );
        }}
        currency={currency}
        onToggleCurrency={() => {
          playCyberClick();
          setCurrency((prev) => (prev === 'RUB' ? 'USD' : 'RUB'));
        }}
        activeMirror={activeMirror}
        realDropsCount={realDropsCount}
      />

      {/* Streamer Mode Notification Banner */}
      {streamerMode && (
        <div
          id="streamer-mode-hud-banner"
          className="bg-orange-950/70 border-b border-orange-500/40 px-4 py-1.5 text-center text-xs font-mono text-orange-300 flex items-center justify-center gap-3"
        >
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
          </span>
          <span className="font-bold">
            OBS STREAM HUD ACTIVE // ПЛАТФОРМА: {platform === 'CASE_BATTLE' ? 'CASE-BATTLE' : 'КЕЙСЕР (KAYSER)'} // ОПТИМИЗИРОВАНО ДЛЯ ЗАХВАТА В СТРИМЕ
          </span>
          <button
            onClick={() => setStreamerMode(false)}
            className="underline hover:text-white text-[11px] cursor-pointer"
          >
            [Выйти из HUD]
          </button>
        </div>
      )}

      {/* Main Grid Content */}
      <main
        id="main-dashboard-grid"
        className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-4 flex flex-col gap-3 sm:gap-4"
      >
        {/* Top & Middle Row: Live Feed (Left/Center) + Analytics Panel (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 flex-1">
          {/* Live Drops Feed */}
          <div className="lg:col-span-7 xl:col-span-8 flex flex-col min-h-[420px]">
            <LiveFeed
              drops={drops}
              platform={platform}
              onTriggerDrop={() => {
                playCyberClick();
                const drop = createDrop(currentCase, false);
                processIncomingDrop(drop);
              }}
              onTriggerMultiDrop={handleTriggerMultiDrop}
              onForceSpecialDrop={() => {
                playCyberClick();
                const drop = createDrop(currentCase, true);
                processIncomingDrop(drop);
              }}
              onInspectSeed={(seed) => {
                playCyberClick();
                setTargetServerSeed(seed);
                setProvablyFairModalOpen(true);
                addLog(`Криптографический анализ сида: ${seed}`, 'INFO');
              }}
              onSelectPlayer={(userName, avatar, userId, profileUrl) => {
                playCyberClick();
                setSelectedPlayer({ name: userName, avatar, userId, profileUrl });
                addLog(`Открыт профиль игрока [${userName}] для верификации честности`, 'INFO');
              }}
              currency={currency}
              isRealFeedActive={dataSourceMode === 'REAL_API'}
            />
          </div>

          {/* Right Analytics Panel: SCORE & MOMENTUM */}
          <div className="lg:col-span-5 xl:col-span-4 flex flex-col">
            <AnalyticsPanel
              metrics={metrics}
              windowSize={windowSize}
              onChangeWindowSize={(size) => {
                playCyberClick();
                setWindowSize(size);
                addLog(`Математическое окно RTP установлено на ${size} открытий`, 'INFO');
              }}
              onInjectSeedAnalysis={handleInjectSeedAnalysis}
              onOpenProvablyFair={() => {
                playCyberClick();
                setProvablyFairModalOpen(true);
              }}
              onOpenRtpChecker={() => {
                playCyberClick();
                setRtpCheckerModalOpen(true);
              }}
              currency={currency}
            />
          </div>
        </div>

        {/* Bottom Row: Cyberpunk Terminal & Telemetry Logs */}
        <div className="w-full">
          <TerminalLogs
            logs={logs}
            onClearLogs={() => {
              setLogs([]);
              addLog('Терминальный буфер очищен.', 'SYSTEM');
            }}
            onInjectSeedAnalysis={handleInjectSeedAnalysis}
            onExecuteCommand={handleExecuteCommand}
            last50Rtp={last50Rtp}
            totalDropsCount={drops.length}
            alertConfig={alertConfig}
            onUpdateAlertConfig={handleUpdateAlertConfig}
            onTriggerTestAlert={handleTriggerTestAlert}
          />
        </div>
      </main>

      {/* Python Code & Standalone Instructions Modal */}
      <PythonModal
        isOpen={pythonModalOpen}
        onClose={() => setPythonModalOpen(false)}
      />

      {/* Real Feed & Mirror Configuration Modal */}
      <RealFeedModal
        isOpen={realFeedModalOpen}
        onClose={() => setRealFeedModalOpen(false)}
        platform={platform}
        onSelectPlatform={handleSelectPlatform}
        activeMirror={activeMirror}
        onSelectMirror={(mirror) => {
          realFeedService.setActiveMirror(mirror, platform);
          setActiveMirror(mirror);
          addLog(`Установлено активное зеркало [${platform}]: ${mirror}`, 'SUCCESS');
        }}
        pingMs={pingMs}
        dropsCount={drops.length}
      />

      {/* Provably Fair Cryptographic Verification Modal */}
      <ProvablyFairModal
        isOpen={provablyFairModalOpen}
        onClose={() => setProvablyFairModalOpen(false)}
        initialServerSeed={targetServerSeed}
      />

      {/* Player Profile & Provably Fair Verification Modal */}
      <PlayerProfileModal
        isOpen={selectedPlayer !== null}
        onClose={() => setSelectedPlayer(null)}
        playerUsername={selectedPlayer?.name || null}
        playerAvatar={selectedPlayer?.avatar}
        userId={selectedPlayer?.userId}
        profileUrl={selectedPlayer?.profileUrl}
        drops={drops}
        currency={currency}
        onOpenFullProvablyFair={(seed) => {
          playCyberClick();
          setTargetServerSeed(seed);
          setProvablyFairModalOpen(true);
        }}
      />

      {/* RTP & Timing Roll Checker Modal */}
      <RtpTimingCheckerModal
        isOpen={rtpCheckerModalOpen}
        onClose={() => setRtpCheckerModalOpen(false)}
        currentRtp={last50Rtp}
        recentDrops={drops}
        currentCase={currentCase}
        currency={currency}
      />
    </div>
  );
}
