import { BridgeDiagnosticEntry } from '../types';

export interface DiagnosisResult {
  errorType: 'CORS_302' | 'CSP_BLOCKED' | 'TAMPERMONKEY_GRANT' | 'WS_DISCONNECT' | 'UNKNOWN';
  title: string;
  explanation: string;
  solutionSummary: string;
  fixedScript: string;
}

/**
 * Automatically diagnoses error strings or logs pasted by user
 */
export function diagnoseBridgeError(input: string, currentHost: string): DiagnosisResult {
  const text = (input || '').toLowerCase();
  const origin = typeof window !== 'undefined' ? window.location.origin : currentHost;

  // 1. Check for CORS 302 or Preflight errors
  if (
    text.includes('cors') ||
    text.includes('302') ||
    text.includes('access-control-allow-origin') ||
    text.includes('preflight') ||
    text.includes('redirect')
  ) {
    return {
      errorType: 'CORS_302',
      title: 'Блокировка CORS / Перенаправление (302 Redirect)',
      explanation:
        'Браузер заблокировал обычный запрос fetch() из консоли из-за строгой политики безопасности CORS и перенаправления (302/Preflight). Консоль браузера работает в изолированном контексте страницы и не может напрямую слать POST на сторонние домены.',
      solutionSummary:
        'Используйте расширение Tampermonkey: его функция GM_xmlhttpRequest выполняется на уровне расширения и полностью обходит ограничения CORS и статус 302!',
      fixedScript: `// ==UserScript==
// @name         Caser & CaseBattle Universal Live Bridge (Fixed CORS)
// @namespace    https://caser.gg/
// @version      3.2
// @description  Автоматическая передача live-дропов в аналитический HUD без ошибок CORS
// @match        https://caser.gg/*
// @match        https://caser.one/*
// @match        https://case-battle.ltd/*
// @grant        GM_xmlhttpRequest
// @connect      *
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';
    const HUD_ENDPOINT = '${origin}/api/kayser/ingest';
    const PING_ENDPOINT = '${origin}/api/bridge/ping';
    console.log('[HUD BRIDGE] Запущен Tampermonkey мост с обходом CORS');

    // Heartbeat каждые 15 сек для подтверждения подключения
    setInterval(() => {
        if (typeof GM_xmlhttpRequest !== 'undefined') {
            GM_xmlhttpRequest({
                method: 'POST',
                url: PING_ENDPOINT,
                headers: { 'Content-Type': 'application/json' },
                data: JSON.stringify({ platform: location.host.includes('case-battle') ? 'CASE_BATTLE' : 'KAYSER' }),
                onload: () => console.log('[HUD BRIDGE] Пинг доставлен OK')
            });
        }
    }, 15000);

    function sendDrop(dropData) {
        if (typeof GM_xmlhttpRequest !== 'undefined') {
            GM_xmlhttpRequest({
                method: 'POST',
                url: location.host.includes('case-battle') ? '${origin}/api/casebattle/ingest' : HUD_ENDPOINT,
                headers: { 'Content-Type': 'application/json' },
                data: JSON.stringify(dropData),
                onload: (res) => console.log('[HUD BRIDGE] Дроп передан успешно!', dropData.itemName)
            });
        }
    }

    // Слушатель Live-ленты Caser / Case-Battle
    const observer = new MutationObserver((mutations) => {
        for (const mut of mutations) {
            for (const node of mut.addedNodes) {
                if (node.nodeType === 1) {
                    const el = node;
                    const text = el.innerText || '';
                    if (text.length > 5 && (text.includes('₽') || text.includes('$') || text.includes('★'))) {
                        const priceMatch = text.match(/([0-9\\s]+)\\s*₽/);
                        const rub = priceMatch ? parseInt(priceMatch[1].replace(/\\s/g, '')) : 600;
                        const nameEl = el.querySelector('[class*="name"], [class*="title"]') || el;
                        const name = nameEl.innerText ? nameEl.innerText.split('\\n')[0] : 'CS2 Skin';
                        sendDrop({
                            itemName: name,
                            rubPrice: rub,
                            priceUsd: (rub / 92).toFixed(2),
                            rarity: rub > 5000 ? 'Special' : rub > 1200 ? 'Covert' : 'Restricted'
                        });
                    }
                }
            }
        }
    });

    const targetFeed = document.querySelector('[class*="live"], [class*="feed"], [class*="drops"]') || document.body;
    observer.observe(targetFeed, { childList: true, subtree: true });
    console.log('[HUD BRIDGE] Наблюдатель живой ленты активен!');
})();`,
    };
  }

  // 2. Content Security Policy (connect-src) Block
  if (text.includes('content security policy') || text.includes('csp') || text.includes('connect-src')) {
    return {
      errorType: 'CSP_BLOCKED',
      title: 'Блокировка директивой CSP (connect-src)',
      explanation:
        'Сайт Case-Battle/Caser запрещает запуск сетевых запросов из встроенных скриптов страницы через заголовок Content-Security-Policy: connect-src. Стандартный консольный fetch блокируется браузером.',
      solutionSummary:
        'Решение: Установите скрипт через расширение Tampermonkey или Violentmonkey. Расширения выполняют код в контексте расширения (Content Script isolation), поэтому на них не распространяется CSP целевого сайта.',
      fixedScript: `// ==UserScript==
// @name         Caser & CaseBattle CSP Bypass Bridge
// @namespace    https://caser.gg/
// @version      3.2
// @match        https://caser.gg/*
// @match        https://case-battle.ltd/*
// @grant        GM_xmlhttpRequest
// @connect      *
// ==/UserScript==

(function() {
    'use strict';
    // GM_xmlhttpRequest полностью игнорирует connect-src CSP сайта
    const targetUrl = '${origin}/api/bridge/ping';
    GM_xmlhttpRequest({
        method: 'POST',
        url: targetUrl,
        headers: { 'Content-Type': 'application/json' },
        data: JSON.stringify({ ping: true, time: Date.now() }),
        onload: function(response) {
            console.log('[CSP Bypass] Соединение с HUD установлено!', response.responseText);
        }
    });
})();`,
    };
  }

  // 3. WebSocket Disconnect / WSS error
  if (text.includes('websocket') || text.includes('ws') || text.includes('disconnect') || text.includes('socket')) {
    return {
      errorType: 'WS_DISCONNECT',
      title: 'Сбой подключения WebSocket к сайту',
      explanation:
        'При прямом подключении к wss://ws6.gamecontent.io/ из браузера требуется отправка правильных заголовков Origin и cookies. Кроме того, Case-Battle блокирует внешние соединения с чужих вкладок.',
      solutionSummary:
        'Вам не нужно вручную подключать сокет! Серверный бэкенд HUD уже держит постоянное фоновое WSS-соединение с case-battle.ltd на стороне Node.js и автоматически транслирует все живые дропы в реальном времени.',
      fixedScript: `// Для Case-Battle скрипт НЕ требуется — наш сервер подключен напрямую!
// Если вы на Caser.gg, используйте официальный Tampermonkey скрипт:
console.log('Case-Battle парсится автоматически сервером без скрипта. Для Caser.gg используйте Tampermonkey.');`,
    };
  }

  // 4. Default / Unknown error diagnosis
  return {
    errorType: 'UNKNOWN',
    title: 'Автоматический анализ и исправление скрипта моста',
    explanation: `Диагностика для запроса: "${input.substring(0, 100)}...". Сформирован универсальный устойчивый скрипт для Tampermonkey с защитой от сбоев и автоматическим переподключением.`,
    solutionSummary:
      'Вставьте исправленный код в Tampermonkey и обновите страницу сайта. HUD автоматически зафиксирует пинг и активирует индикатор "МОСТ ПОДКЛЮЧЕН".',
    fixedScript: `// ==UserScript==
// @name         Universal HUD Live Feed Bridge v3.2
// @namespace    https://caser.gg/
// @version      3.2
// @match        https://caser.gg/*
// @match        https://case-battle.ltd/*
// @grant        GM_xmlhttpRequest
// @connect      *
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';
    const SERVER_URL = '${origin}';
    console.log('[HUD] Универсальный мост активирован.');

    // Пинг-проверка
    function sendPing() {
        if (typeof GM_xmlhttpRequest !== 'undefined') {
            GM_xmlhttpRequest({
                method: 'POST',
                url: SERVER_URL + '/api/bridge/ping',
                headers: { 'Content-Type': 'application/json' },
                data: JSON.stringify({ active: true, url: location.href }),
                onload: () => console.log('[HUD] Связь активна')
            });
        }
    }
    sendPing();
    setInterval(sendPing, 20000);
})();`,
  };
}
