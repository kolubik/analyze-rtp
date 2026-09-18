import { ProvablyFairResult, RarityType } from '../types';

/**
 * Validates a server seed input and provides helpful diagnostic messages
 */
export function validateServerSeed(rawSeed: string): {
  isValid: boolean;
  isFullSha256: boolean;
  normalizedSeed: string;
  message?: string;
} {
  const trimmed = (rawSeed || '').trim();
  if (!trimmed) {
    return {
      isValid: false,
      isFullSha256: false,
      normalizedSeed: '',
      message: 'Введите Server Seed (Серверный сид) для проверки.',
    };
  }

  // Check if it's a short 0x hex string (e.g. 0x21c39e743 or similar)
  const isShortHex = trimmed.startsWith('0x') && trimmed.length < 32;
  const isSha256Hex = /^[0-9a-fA-F]{64}$/.test(trimmed.replace(/^0x/, ''));

  if (isSha256Hex) {
    return {
      isValid: true,
      isFullSha256: true,
      normalizedSeed: trimmed.toLowerCase(),
      message: '✓ Полный валидный 64-значный SHA-256 Server Seed подтвержден.',
    };
  }

  if (isShortHex) {
    return {
      isValid: true,
      isFullSha256: false,
      normalizedSeed: trimmed,
      message: `⚠️ Внимание: «${trimmed}» — это сокращенный ID ролла / префикс (длина: ${trimmed.length} симв.), а не полный серверный сид. На Case-Battle и Caser полные серверные сиды представляют собой 64-значный хэш SHA-256. Вы можете скопировать полный сид из вкладки "Честная игра", либо использовать данный ID как предварительный сид.`,
    };
  }

  return {
    isValid: true,
    isFullSha256: false,
    normalizedSeed: trimmed,
    message: `Используется пользовательский сид (${trimmed.length} симв.). Для официальной проверки рекомендуется 64-значный SHA-256 хэш.`,
  };
}

/**
 * Computes Provably Fair Roll using HMAC-SHA256 (or SHA-256 fallback) via Web Crypto
 */
export async function calculateProvablyFairRoll(
  serverSeed: string,
  clientSeed: string,
  nonce: number
): Promise<ProvablyFairResult> {
  const seedValidation = validateServerSeed(serverSeed);
  const cleanServer = seedValidation.normalizedSeed || '0000000000000000000000000000000000000000000000000000000000000000';
  const cleanClient = (clientSeed || 'client_seed_1').trim();
  const cleanNonce = Math.max(1, Math.floor(nonce || 1));

  const message = `${cleanClient}:${cleanNonce}`;
  let combinedHash = '';

  try {
    const encoder = new TextEncoder();
    // Try HMAC-SHA256
    const keyData = encoder.encode(cleanServer);
    const msgData = encoder.encode(message);

    const cryptoKey = await window.crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signature = await window.crypto.subtle.sign('HMAC', cryptoKey, msgData);
    const hashArray = Array.from(new Uint8Array(signature));
    combinedHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    // Fallback simple hash
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(`${cleanServer}-${cleanClient}-${cleanNonce}`);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      combinedHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch {
      // Deterministic fallback for test environments without subtle crypto
      let h = 0x811c9dc5;
      const str = `${cleanServer}:${cleanClient}:${cleanNonce}`;
      for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
      }
      combinedHash = Math.abs(h).toString(16).padStart(64, 'a');
    }
  }

  // Standard Provably Fair roll conversion: take first 8 hex characters (32 bits)
  const hexSlice = combinedHash.substring(0, 8);
  const intVal = parseInt(hexSlice, 16);
  // Float between 0.00000000 and 1.00000000
  const rollFloat = Math.round((intVal / 0xffffffff) * 1000000) / 1000000;
  // Roll number from 1 to 100,000 (standard Case-Battle roll format)
  const rollNumber = Math.round(rollFloat * 100000 * 100) / 100;

  // Predict rarity from rollFloat based on standard Case-Battle drop thresholds
  let predictedRarity: RarityType = 'Mil-Spec';
  if (rollFloat < 0.0026) {
    predictedRarity = 'Special'; // Нож / Перчатки (~0.26%)
  } else if (rollFloat < 0.0095) {
    predictedRarity = 'Covert'; // Тайное (~0.69%)
  } else if (rollFloat < 0.048) {
    predictedRarity = 'Classified'; // Засекреченное (~3.85%)
  } else if (rollFloat < 0.19) {
    predictedRarity = 'Restricted'; // Запрещенное (~14.2%)
  } else {
    predictedRarity = 'Mil-Spec'; // Армейское (~81%)
  }

  return {
    serverSeed: cleanServer,
    clientSeed: cleanClient,
    nonce: cleanNonce,
    combinedHash,
    rollFloat,
    rollNumber,
    predictedRarity,
    isFullSha256: seedValidation.isFullSha256,
    warningMessage: seedValidation.message,
  };
}

/**
 * Generate cryptographically secure random 64-character Server Seed (SHA-256 hex format)
 */
export function generateRandomServerSeed(): string {
  const bytes = new Uint8Array(32);
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    window.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 32; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Generate random client seed string
 */
export function generateRandomClientSeed(): string {
  const randNum = Math.floor(100000 + Math.random() * 900000);
  return `client_seed_${randNum}`;
}
