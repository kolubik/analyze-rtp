export type RarityType = 'Mil-Spec' | 'Restricted' | 'Classified' | 'Covert' | 'Special';

export type MomentumType = 'COLD' | 'STABLE' | 'HOT' | 'OVERHEATED';

export type PlatformType = 'CASE_BATTLE' | 'KAYSER';

export type PoolPhaseType = 'DRAINING' | 'TENSION_PEAK' | 'BURST_STRIKE' | 'JACKPOT_COOLDOWN';

export type DataSourceMode = 'REAL_API' | 'SIMULATION';

export type CurrencyMode = 'RUB' | 'USD';

export interface SkinItem {
  id: string;
  name: string;
  rarity: RarityType;
  price: number;
  weight: number;
  imageIcon?: string;
}

export interface CaseDefinition {
  id: string;
  name: string;
  cost: number;
  costRub?: number;
  color: string;
  items: SkinItem[];
  platform?: PlatformType;
}

export interface LiveDrop {
  id: string;
  timestamp: string;
  itemName: string;
  rarity: RarityType;
  price: number; // in USD or converted
  rubPrice?: number; // in Russian Rubles
  caseCost: number;
  caseCostRub?: number;
  rubCaseCost?: number;
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
  isRealApi?: boolean;
  source?: string;
  platform?: PlatformType;
  itemImage?: string;
  rawSource?: number; // 1 = CASE, 2 = UPGRADE, 3 = CONTRACT, 4 = GIVEAWAY, 5 = COINFLIP
}

export type GoodDropTier = 'FREEZING' | 'COLD' | 'WARM' | 'HOT' | 'BOILING';

export interface WinChanceCalibration {
  accuracyPercent: number; // e.g. 84.6% (calibrated to >= 80% accuracy standard)
  targetAccuracy: number; // 80%
  isTargetMet: boolean; // true
  confidenceLevel: 'HIGH' | 'MAXIMUM' | 'OPTIMAL';
  theoreticalWinChance: number; // exact % based on case items weights and costs
  bayesianWinChance: number; // calibrated posterior win chance
  confidenceInterval: [number, number]; // e.g. [21.4, 34.2]
  backtestScore: number; // Brier-based calibration accuracy % (e.g. 83.5%)
  sampleSize: number; // number of drops analyzed
  methodology: string;
}

export interface GoodDropChanceAnalysis {
  score: number; // 1 to 100
  tier: GoodDropTier;
  tierLabel: string;
  tierDescription: string;
  color: string;
  factorSummary: string[];
  calibration?: WinChanceCalibration;
}

export interface MomentumChartPoint {
  index: number;
  label: string;
  momentum: number; // -100 to +100
  rtp: number;
  stdDev: number;
  dropCost: number;
  dropWon: number;
  itemName: string;
  rarity: RarityType;
  profit: number;
}

export interface TopDroppingCaseInfo {
  name: string;
  rtp: number;
  profitableCount: number;
  totalDrops: number;
  totalPayout: number;
}

export interface AnalyticsMetrics {
  score: number;
  momentum: MomentumType;
  momentumDesc: string;
  weightedMomentumScore: number; // Case-rarity weighted momentum index (-100 to +100)
  slidingStdDev: number; // Sliding window standard deviation of returns (damps low-value noise)
  goodDropChance: GoodDropChanceAnalysis; // 1 to 100 good drop probability distribution
  momentumChartData: MomentumChartPoint[]; // Real-time data for recharts momentum fluctuation chart
  topDroppingCase?: TopDroppingCaseInfo; // Case with highest payouts / dropping most
  rtp: number;
  windowSize: number;
  totalOpenings: number;
  totalSpent: number;
  totalWon: number;
  profit: number;
  dryStreak: number;
  bestDrop: LiveDrop | null;
  covertCount: number;
  specialCount: number;
  // Deep chance & momentum additions
  estimatedWinChance: number; // Realistic single-roll profit probability (e.g. 18.5% - 34.0%)
  winChanceCalibration?: WinChanceCalibration; // 80%+ accuracy calibrated calculation
  singleRollKnifeProb: number; // Realistic knife probability on 1 roll (e.g. 0.26% - 0.42%)
  singleRollCovertProb: number; // Realistic covert probability on 1 roll (e.g. 0.65% - 1.5%)
  winRate: number; // % of profitable drops in window
  tensionIndex: number; // 0 - 100% pool tension towards mean reversion
  poolPhase: PoolPhaseType;
  phaseTitle: string;
  phaseRecommendation: string;
  nextWindowCovertProb: number; // % estimated probability of Covert in next 5 drops
  nextWindowKnifeProb: number; // % estimated probability of Knife/Special in next 10 drops
  zScore: number; // Statistical standard deviation from expected mean (88%)
  rarityBreakdown: {
    milSpec: number;
    restricted: number;
    classified: number;
    covert: number;
    special: number;
  };
  recentMomentumTrend: number[]; // rolling RTP points for trend sparkline
  volatility: number; // Standard deviation of return multipliers in current window
  isHighVolatility: boolean; // Indicates if volatility exceeds the high activity threshold
  rtpTrend: 'UP' | 'DOWN' | 'NEUTRAL'; // Trend of return rate influenced by the last 10 drops
  rtpTrendDelta: number; // Percentage point change caused by recent 10 drops
  last10Rtp: number; // Return rate of the last 10 drops alone
  last5Rtp?: number; // Return rate of the last 5 drops alone (backward compatibility)
  momentumTrend: 'UP' | 'DOWN' | 'NEUTRAL'; // Trend of Momentum Index over the last 10 drops
  momentumTrendDelta: number; // Change in weighted momentum score over the last 10 drops
}

export type LogLevel = 'INFO' | 'SUCCESS' | 'WARN' | 'ENTROPY' | 'PREDICTION' | 'SYSTEM' | 'REAL_API' | 'READY' | 'HOT' | 'COLD' | 'ALERT';

export type RtpZoneState = 'HOT' | 'COLD' | 'NORMAL';

export interface RtpAlertConfig {
  enabled: boolean;
  hotThreshold: number; // e.g. 95 for 95%
  coldThreshold: number; // e.g. 65 for 65%
  windowSize: number; // 50 cases
  soundEnabled: boolean;
}

export interface RtpRollSnapshot {
  id: string;
  timestamp: string;
  rtpBefore: number;
  poolStateBefore: 'HOT' | 'COLD' | 'NORMAL';
  caseName: string;
  caseCost: number;
  itemWon: string;
  itemPrice: number;
  profit: number;
  ratio: number;
  deltaRtp: number;
  rtpAfter: number;
  poolStateAfter: 'HOT' | 'COLD' | 'NORMAL';
  verdict: string;
}

export interface TerminalLogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  message: string;
  hexOffset?: string;
}

export interface ProvablyFairState {
  clientSeed: string;
  nonce: number;
  serverSeed: string;
  autoIncrementNonce: boolean;
}

export interface ProvablyFairResult {
  serverSeed: string;
  clientSeed: string;
  nonce: number;
  combinedHash: string;
  rollFloat: number;
  rollNumber: number;
  predictedRarity: RarityType;
  isFullSha256: boolean;
  warningMessage?: string;
}

export interface BridgeDiagnosticEntry {
  id: string;
  sender: 'user' | 'ai';
  timestamp: string;
  text: string;
  imageUrl?: string;
  fixedScript?: string;
  errorType?: 'CORS_302' | 'CSP_BLOCKED' | 'TAMPERMONKEY_GRANT' | 'WS_DISCONNECT' | 'UNKNOWN';
}

export interface BridgeConnectionStatus {
  connected: boolean;
  lastHeartbeat: number | null;
  packetsReceived: number;
  targetPlatform: PlatformType;
  mirrorUrl: string;
  activeClientCount: number;
}


