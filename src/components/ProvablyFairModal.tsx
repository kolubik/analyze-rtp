import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldCheck,
  Key,
  Hash,
  RefreshCw,
  Copy,
  Check,
  AlertTriangle,
  Cpu,
  Sparkles,
  ArrowRight,
  HelpCircle,
} from 'lucide-react';
import { ProvablyFairResult, RarityType } from '../types';
import {
  calculateProvablyFairRoll,
  validateServerSeed,
  generateRandomServerSeed,
  generateRandomClientSeed,
} from '../services/provablyFair';

interface ProvablyFairModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialServerSeed?: string;
}

export const ProvablyFairModal: React.FC<ProvablyFairModalProps> = ({
  isOpen,
  onClose,
  initialServerSeed,
}) => {
  const [clientSeed, setClientSeed] = useState<string>(generateRandomClientSeed());
  const [nonce, setNonce] = useState<number>(1);
  const [serverSeed, setServerSeed] = useState<string>(
    initialServerSeed || '0x21c39e743' // Default pre-filled with the user's example to immediately demonstrate validation!
  );
  const [result, setResult] = useState<ProvablyFairResult | null>(null);
  const [copiedHash, setCopiedHash] = useState(false);
  const [copiedSeed, setCopiedSeed] = useState(false);
  const [calculating, setCalculating] = useState(false);

  // Re-run calculation whenever inputs change
  useEffect(() => {
    if (!isOpen) return;
    setCalculating(true);
    calculateProvablyFairRoll(serverSeed, clientSeed, nonce).then((res) => {
      setResult(res);
      setCalculating(false);
    });
  }, [serverSeed, clientSeed, nonce, isOpen]);

  if (!isOpen) return null;

  const seedValidation = validateServerSeed(serverSeed);

  const handleCopyHash = () => {
    if (result) {
      navigator.clipboard.writeText(result.combinedHash);
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2000);
    }
  };

  const handleCopyServerSeed = () => {
    navigator.clipboard.writeText(serverSeed);
    setCopiedSeed(true);
    setTimeout(() => setCopiedSeed(false), 2000);
  };

  const handleGenerateRandomServerSeed = () => {
    const newSeed = generateRandomServerSeed();
    setServerSeed(newSeed);
  };

  const handleGenerateRandomClientSeed = () => {
    const newSeed = generateRandomClientSeed();
    setClientSeed(newSeed);
  };

  const getRarityBadge = (rarity: RarityType) => {
    switch (rarity) {
      case 'Special':
        return 'bg-amber-500/20 text-amber-400 border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.4)]';
      case 'Covert':
        return 'bg-rose-500/20 text-rose-400 border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.4)]';
      case 'Classified':
        return 'bg-fuchsia-500/20 text-fuchsia-400 border-fuchsia-500';
      case 'Restricted':
        return 'bg-indigo-500/20 text-indigo-400 border-indigo-500';
      default:
        return 'bg-blue-500/20 text-blue-400 border-blue-500';
    }
  };

  return (
    <div
      id="provably-fair-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in"
      onClick={onClose}
    >
      <div
        id="provably-fair-modal-container"
        className="relative w-full max-w-2xl max-h-[92vh] flex flex-col bg-[#0a0c12] border border-cyan-500/40 rounded-2xl shadow-[0_0_50px_rgba(6,182,212,0.25)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 bg-[#0e121a]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-950/60 border border-cyan-500/60 text-cyan-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold font-mono text-zinc-100 flex items-center gap-2">
                <span>PROVABLY FAIR (КРИПТО-ПРОВЕРКА РОЛЛОВ)</span>
                <span className="px-2 py-0.5 rounded text-[10px] bg-cyan-500 text-black font-extrabold uppercase">
                  SHA-256 / HMAC
                </span>
              </h2>
              <p className="text-xs text-zinc-400 font-mono">
                Математическая валидация сидов и расчет вероятности выпадения дропа
              </p>
            </div>
          </div>
          <button
            id="close-provably-fair-modal-btn"
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 font-mono text-xs text-zinc-300 scrollbar-thin">
          {/* Explanation Banner */}
          <div className="p-3.5 bg-cyan-950/30 border border-cyan-500/30 rounded-xl flex items-start gap-3">
            <Cpu className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
            <div className="text-[11px] leading-relaxed">
              <span className="font-bold text-cyan-300">Как устроена система честности (Provably Fair):</span>
              <p className="text-zinc-300 mt-0.5">
                Результат ролла на Case-Battle и Caser определяется криптографической комбинацией трех параметров:
                <strong className="text-white"> Server Seed</strong> (от сайта),{' '}
                <strong className="text-white">Client Seed</strong> (от вашего браузера) и{' '}
                <strong className="text-white">Nonce</strong> (номер прокрутки).
              </p>
            </div>
          </div>

          {/* Form Inputs Grid */}
          <div className="space-y-4">
            {/* 1. Full Server Seed */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-amber-400" />
                  <span>Полный Server Seed (Серверный сид сайта):</span>
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleGenerateRandomServerSeed}
                    className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 hover:underline"
                  >
                    <RefreshCw className="w-2.5 h-2.5" />
                    <span>Сгенерировать 64-символьный</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setServerSeed('0x21c39e743')}
                    className="text-[10px] text-zinc-400 hover:text-zinc-200 hover:underline"
                  >
                    Тест 0x21c39e743
                  </button>
                </div>
              </div>

              <div className="relative">
                <textarea
                  id="provably-server-seed-input"
                  value={serverSeed}
                  onChange={(e) => setServerSeed(e.target.value)}
                  rows={2}
                  placeholder="Вставьте полный 64-значный SHA-256 Server Seed или ID ролла (напр. 0x21c39e743)"
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-cyan-500 font-mono text-xs resize-none"
                />
                <button
                  onClick={handleCopyServerSeed}
                  className="absolute right-2.5 top-2.5 p-1 text-zinc-400 hover:text-white rounded bg-zinc-800/80"
                  title="Скопировать"
                >
                  {copiedSeed ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* Seed Validation Alert */}
              {seedValidation.isFullSha256 ? (
                <div className="flex items-center gap-2 text-[11px] text-emerald-400 bg-emerald-950/30 border border-emerald-500/30 p-2.5 rounded-lg">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>{seedValidation.message}</span>
                </div>
              ) : (
                <div className="flex items-start gap-2 text-[11px] text-amber-300 bg-amber-950/30 border border-amber-500/40 p-2.5 rounded-lg">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                  <div className="leading-snug">{seedValidation.message}</div>
                </div>
              )}
            </div>

            {/* 2. Client Seed & Nonce in 2-column grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Client Seed */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                    <Hash className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Client Seed (Сид клиента):</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleGenerateRandomClientSeed}
                    className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 hover:underline"
                  >
                    <RefreshCw className="w-2.5 h-2.5" />
                    <span>Случайный</span>
                  </button>
                </div>
                <input
                  id="provably-client-seed-input"
                  type="text"
                  value={clientSeed}
                  onChange={(e) => setClientSeed(e.target.value)}
                  placeholder="Строка или число клиента"
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-cyan-500 font-mono text-xs"
                />
                <p className="text-[10px] text-zinc-500">
                  Генерируется вашим браузером или задается вручную.
                </p>
              </div>

              {/* Nonce */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                  <span>Nonce (Номер раунда / прокрутки):</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="provably-nonce-input"
                    type="number"
                    min={1}
                    value={nonce}
                    onChange={(e) => setNonce(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-cyan-500 font-mono text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setNonce((prev) => Math.max(1, prev - 1))}
                    className="px-2.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl font-bold"
                  >
                    -1
                  </button>
                  <button
                    type="button"
                    onClick={() => setNonce((prev) => prev + 1)}
                    className="px-2.5 py-2 bg-cyan-600 hover:bg-cyan-500 text-black font-extrabold rounded-xl"
                  >
                    +1
                  </button>
                </div>
                <p className="text-[10px] text-zinc-500">
                  Порядковый номер ролла (1, 2, 15...) на этой паре сидов.
                </p>
              </div>
            </div>
          </div>

          {/* Cryptographic Roll Result Card */}
          {result && (
            <div className="p-4 bg-zinc-900/90 border border-cyan-500/40 rounded-xl space-y-3 shadow-lg">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                <span className="text-xs font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Cpu className="w-4 h-4 text-cyan-400" />
                  <span>РЕЗУЛЬТАТ КРИПТО-РОЛЛА:</span>
                </span>
                <span className={`px-2.5 py-1 rounded-full border text-xs font-extrabold ${getRarityBadge(result.predictedRarity)}`}>
                  {result.predictedRarity === 'Special'
                    ? '★ НОЖ / ПЕРЧАТКИ'
                    : result.predictedRarity === 'Covert'
                    ? 'ТАЙНОЕ ОРУЖИЕ'
                    : result.predictedRarity === 'Classified'
                    ? 'ЗАСЕКРЕЧЕННОЕ'
                    : result.predictedRarity === 'Restricted'
                    ? 'ЗАПРЕЩЕННОЕ'
                    : 'АРМЕЙСКОЕ'}
                </span>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg">
                  <div className="text-[10px] text-zinc-500 uppercase">Roll Float (0.0 - 1.0)</div>
                  <div className="text-base font-extrabold text-cyan-400">{result.rollFloat}</div>
                </div>
                <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg">
                  <div className="text-[10px] text-zinc-500 uppercase">Roll Number (1 - 100k)</div>
                  <div className="text-base font-extrabold text-amber-400">{result.rollNumber}</div>
                </div>
                <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg">
                  <div className="text-[10px] text-zinc-500 uppercase">Процент удачи</div>
                  <div className="text-base font-extrabold text-emerald-400">
                    {(result.rollFloat * 100).toFixed(4)}%
                  </div>
                </div>
              </div>

              {/* Combined Hash String */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] text-zinc-400">
                  <span>Результирующий HMAC-SHA256 хэш:</span>
                  <button
                    onClick={handleCopyHash}
                    className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 hover:underline"
                  >
                    {copiedHash ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedHash ? 'Скопировано!' : 'Скопировать хэш'}</span>
                  </button>
                </div>
                <div className="p-2.5 bg-black border border-zinc-800 rounded-lg break-all font-mono text-[11px] text-zinc-300 select-all">
                  {result.combinedHash}
                </div>
              </div>
            </div>
          )}

          {/* Transparent Formula Guide */}
          <div className="p-3 bg-zinc-950 border border-zinc-800/80 rounded-xl space-y-1 text-[11px] text-zinc-400">
            <span className="font-bold text-zinc-300 flex items-center gap-1">
              <HelpCircle className="w-3.5 h-3.5 text-cyan-400" />
              <span>Формула вычисления:</span>
            </span>
            <p className="font-mono text-zinc-400">
              <code>HMAC_SHA256(ServerSeed, &quot;{clientSeed}:{nonce}&quot;)</code>
            </p>
            <p className="text-[10px] text-zinc-500">
              Первые 8 шестнадцатеричных символов хэша переводятся в 32-битное целое число и делятся на 0xFFFFFFFF для получения точного Float ролла.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-zinc-800 bg-[#0e121a]">
          <span className="text-[11px] text-zinc-500 font-mono">
            Полное соответствие стандартам Provably Fair CS2
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black font-extrabold font-mono text-xs transition-colors"
          >
            ЗАКРЫТЬ
          </button>
        </div>
      </div>
    </div>
  );
};
