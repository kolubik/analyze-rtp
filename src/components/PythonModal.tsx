import React, { useState } from 'react';
import { X, Copy, Check, Download, Terminal, FileCode, BookOpen, Layers } from 'lucide-react';

interface PythonModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PYTHON_MAIN_CODE = `#!/usr/bin/env python3
"""
================================================================================
                    C A S E   B A T T L E   H E L P E R
                     Cyberpunk Streamer Analytics HUD
================================================================================
Версия: 2.4.0
Стек: Python (Rich / ANSI Fallback)
Назначение: Аналитический помощник для стримов и кейс-батлов CS:2.
"""

import sys
import os
import time
import random
from datetime import datetime

# Импорт локальных модулей
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from python_modules.skins_database import CASES_DATA, RARITY_COLORS
from python_modules.analytics_engine import AnalyticsEngine
from python_modules.feed_simulator import FeedSimulator
from python_modules.terminal_logger import TerminalLogger

# Проверяем наличие библиотеки rich
try:
    from rich.console import Console
    from rich.layout import Layout
    from rich.panel import Panel
    from rich.table import Table
    from rich.live import Live
    from rich.text import Text
    from rich import box
    RICH_AVAILABLE = True
except ImportError:
    RICH_AVAILABLE = False


def build_rich_ui(layout: "Layout", drops: list, analytics: AnalyticsEngine, logger: TerminalLogger, simulator: FeedSimulator):
    """Строит киберпанк интерфейс на библиотеке Rich."""
    summary = analytics.get_summary()
    score = summary["score"]
    momentum = summary["momentum"]
    rtp = summary["rtp"]

    # 1. HEADER
    header_text = Text()
    header_text.append(" [⚡ CASE BATTLE HELPER // CS2 STREAM ANALYTICS HUD] ", style="bold black on bright_yellow")
    header_text.append(f"  API: WSS CONNECTED (ping: {simulator.ping_ms}ms)  ", style="bold green on black")
    header_text.append(f"  CASE: {simulator.current_case} (\${CASES_DATA[simulator.current_case]['cost']:.2f})  ", style="bold cyan on black")
    header_text.append(f"  TIME: {datetime.now().strftime('%H:%M:%S')}", style="dim white")
    layout["header"].update(Panel(header_text, border_style="bright_yellow", box=box.HEAVY))

    # 2. DROP FEED (ВЕРХНЯЯ / ЦЕНТРАЛЬНАЯ ЧАСТЬ)
    drop_table = Table(title="[bold green]● LIVE DROP FEED (ПОСЛЕДНИЕ ОТКРЫТИЯ)[/]", border_style="green", box=box.ROUNDED, expand=True)
    drop_table.add_column("TIME", style="dim cyan", width=9)
    drop_table.add_column("ITEM NAME", style="bold white")
    drop_table.add_column("RARITY", width=12)
    drop_table.add_column("WEAR", style="dim", width=16)
    drop_table.add_column("PRICE", justify="right", style="bold yellow", width=11)
    drop_table.add_column("ROI", justify="center", width=8)

    for item in drops[-8:]:
        rarity = item["rarity"]
        if rarity == "Special":
            r_style = "bold yellow on red"
            rarity_label = "★ SPECIAL"
        elif rarity == "Covert":
            r_style = "bold red"
            rarity_label = "COVERT"
        elif rarity == "Classified":
            r_style = "bold magenta"
            rarity_label = "CLASSIFIED"
        elif rarity == "Restricted":
            r_style = "bold purple"
            rarity_label = "RESTRICTED"
        else:
            r_style = "bold blue"
            rarity_label = "MIL-SPEC"

        case_cost = CASES_DATA[simulator.current_case]["cost"]
        is_profit = item["price"] >= case_cost
        roi_badge = "[green]+PROFIT[/]" if is_profit else "[red]-LOSS[/]"
        price_str = f"\${item['price']:.2f}"

        drop_table.add_row(
            item["timestamp"],
            item["name"],
            Text(rarity_label, style=r_style),
            item["wear"][:14],
            price_str,
            roi_badge
        )

    layout["feed"].update(Panel(drop_table, border_style="green", box=box.ROUNDED))

    # 3. ANALYTICS (ПРАВАЯ ПАНЕЛЬ С КРУПНЫМИ МЕТРИКАМИ)
    if momentum == "HOT":
        mom_style = "bold white on red"
    elif momentum == "OVERHEATED":
        mom_style = "bold yellow on magenta"
    elif momentum == "COLD":
        mom_style = "bold white on blue"
    else:
        mom_style = "bold black on green"

    rtp_style = "green" if rtp >= 100 else ("yellow" if rtp >= 75 else "red")

    analytics_text = Text()
    analytics_text.append("─── PREDICTIVE PROBABILITY ───\\n", style="dim orange3")
    analytics_text.append(f" SCORE: {score:.1f} / 100\\n", style="bold bright_yellow")
    
    filled_bars = int(score / 5)
    bar_str = "█" * filled_bars + "░" * (20 - filled_bars)
    analytics_text.append(f" [{bar_str}]\\n\\n", style="bold orange1")

    analytics_text.append("─── MARKET STATUS ───\\n", style="dim orange3")
    analytics_text.append(f" MOMENTUM: [{mom_style}] {momentum} [/]\\n", style="bold")
    analytics_text.append(f" STATUS: {summary['momentum_desc']}\\n\\n", style="italic dim cyan")

    analytics_text.append("─── MATHEMATICAL RTP ───\\n", style="dim orange3")
    analytics_text.append(f" RTP (LAST {summary['window_size']}): ", style="bold white")
    analytics_text.append(f"{rtp:.1f}%\\n", style=f"bold {rtp_style}")
    analytics_text.append(f" TOTAL SPENT:  \${summary['total_spent']:.2f}\\n", style="dim white")
    analytics_text.append(f" TOTAL RETURN: \${summary['total_won']:.2f}\\n", style="dim white")
    
    profit_color = "green" if summary['profit'] >= 0 else "red"
    profit_sign = "+" if summary['profit'] >= 0 else ""
    analytics_text.append(f" NET PROFIT:   [{profit_color}]{profit_sign}\${summary['profit']:.2f}[/]\\n", style="bold")
    analytics_text.append(f" DRY STREAK:   {summary['dry_streak']} drops\\n", style="dim yellow")

    layout["analytics"].update(Panel(analytics_text, title="[bold orange3]⚡ ANALYTICS ENGINE[/]", border_style="bright_yellow", box=box.ROUNDED))

    # 4. TERMINAL LOG (НИЖНЯЯ ЧАСТЬ)
    log_text = Text()
    for log_line in logger.get_recent_logs()[-6:]:
        if "[SUCCESS]" in log_line or "[READY]" in log_line:
            log_text.append(f"{log_line}\\n", style="green")
        elif "[WARN]" in log_line:
            log_text.append(f"{log_line}\\n", style="yellow")
        elif "[ENTROPY]" in log_line or "[PREDICTION]" in log_line:
            log_text.append(f"{log_line}\\n", style="cyan")
        else:
            log_text.append(f"{log_line}\\n", style="white")

    layout["terminal"].update(Panel(log_text, title="[bold cyan]● CYBERPUNK TERMINAL // TELEMETRY & LOGS[/]", border_style="cyan", box=box.ROUNDED))


def main():
    if RICH_AVAILABLE:
        # Полноэкранный Rich TUI интерфейс
        run_rich_mode()
    else:
        # Автономный ANSI-режим
        run_ansi_mode()

if __name__ == "__main__":
    main()
`;

const PYTHON_ANALYTICS_CODE = `"""
CASE BATTLE HELPER - Математический модуль
Расчет RTP, Momentum (COLD / HOT / STABLE) и динамического Score.
"""

from collections import deque
from typing import Dict, Any, Tuple
import math

class AnalyticsEngine:
    def __init__(self, window_size: int = 25):
        self.window_size = window_size
        self.history = deque(maxlen=window_size)
        self.total_openings = 0
        self.total_spent = 0.0
        self.total_won = 0.0
        self.covert_streak = 0
        self.dry_streak = 0

    def add_drop(self, drop: Dict[str, Any], case_cost: float) -> None:
        self.total_openings += 1
        self.total_spent += case_cost
        self.total_won += drop["price"]
        
        self.history.append({
            "price": drop["price"],
            "cost": case_cost,
            "rarity": drop["rarity"],
            "profit": drop["price"] - case_cost
        })

        if drop["rarity"] in ("Covert", "Special"):
            self.covert_streak += 1
            self.dry_streak = 0
        else:
            self.dry_streak += 1
            self.covert_streak = max(0, self.covert_streak - 1)

    def calculate_rtp(self) -> float:
        if not self.history:
            return 100.0
        total_won = sum(e["price"] for e in self.history)
        total_spent = sum(e["cost"] for e in self.history)
        return round((total_won / total_spent) * 100.0, 2) if total_spent > 0 else 100.0

    def calculate_momentum(self) -> Tuple[str, str]:
        if len(self.history) < 5:
            return "STABLE", "Инициализация выборки..."
        rtp = self.calculate_rtp()
        recent_5 = list(self.history)[-5:]
        if any(e["rarity"] == "Special" for e in recent_5) or rtp > 220.0:
            return "OVERHEATED", "Сверхприбыль! Пик отдачи"
        elif rtp > 115.0:
            return "HOT", "Высокая отдача, серия прибыли"
        elif rtp < 65.0 or self.dry_streak >= 7:
            return "COLD", "Накопление дисперсии (затишье)"
        return "STABLE", "Стабильный коридор распределения"

    def calculate_score(self) -> float:
        base = 50.0
        dry_factor = min(self.dry_streak * 4.2, 35.0)
        rtp = self.calculate_rtp()
        rtp_factor = (80.0 - rtp) * 0.4 if rtp < 80.0 else -((rtp - 80.0) * 0.3)
        harmonic = math.sin(self.total_openings * 0.7) * 6.5
        score = base + dry_factor + rtp_factor + harmonic
        return round(max(5.0, min(99.4, score)), 1)
`;

const PYTHON_README_CODE = `# CASE BATTLE HELPER // ИНСТРУКЦИЯ ПО ЗАПУСКУ

## 1. Установка:
Требуется Python 3.8+:
\`\`\`bash
pip install rich
\`\`\`
*(Если библиотека rich не установлена, скрипт автоматически запустится в стандартном киберпанк-режиме ANSI!)*

## 2. Запуск терминала:
\`\`\`bash
python case_battle_helper.py
\`\`\`

## 3. Использование в OBS для стримов:
1. Запустите скрипт в Windows Terminal, iTerm2 или консоли.
2. В OBS добавьте источник: "Захват окна" (Window Capture) -> терминал.
3. Настройте желаемый размер и прозрачность фона.
`;

export const PythonModal: React.FC<PythonModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'main' | 'analytics' | 'readme'>('main');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const currentCode =
    activeTab === 'main'
      ? PYTHON_MAIN_CODE
      : activeTab === 'analytics'
      ? PYTHON_ANALYTICS_CODE
      : PYTHON_README_CODE;

  const handleCopy = () => {
    navigator.clipboard.writeText(currentCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const filename =
      activeTab === 'main'
        ? 'case_battle_helper.py'
        : activeTab === 'analytics'
        ? 'analytics_engine.py'
        : 'README_PYTHON.md';

    const blob = new Blob([currentCode], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      id="python-code-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-fadeIn"
    >
      <div
        id="python-code-modal-container"
        className="relative w-full max-w-4xl bg-[#0d1017] border border-orange-500/50 rounded-2xl shadow-[0_0_40px_rgba(255,107,0,0.3)] overflow-hidden flex flex-col max-h-[90vh] font-mono"
      >
        {/* Modal Header */}
        <div className="px-5 py-4 bg-[#0a0c12] border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-950/60 border border-orange-500/50 text-orange-400">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <span>CASE BATTLE HELPER</span>
                <span className="text-xs px-2 py-0.5 rounded bg-orange-500/20 text-orange-400 border border-orange-500/40">
                  Python Script v2.4
                </span>
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Готовый код для запуска в терминале и захвата в OBS на стримах
              </p>
            </div>
          </div>

          <button
            id="close-python-modal-btn"
            onClick={onClose}
            aria-label="Закрыть окно"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher & Actions bar */}
        <div className="px-5 py-2.5 bg-[#090b10] border-b border-zinc-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('main')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all ${
                activeTab === 'main'
                  ? 'bg-orange-500 text-black font-bold shadow-[0_0_10px_rgba(255,107,0,0.4)]'
                  : 'text-zinc-400 hover:text-zinc-200 bg-zinc-900 border border-zinc-800'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>case_battle_helper.py</span>
            </button>

            <button
              onClick={() => setActiveTab('analytics')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all ${
                activeTab === 'analytics'
                  ? 'bg-orange-500 text-black font-bold shadow-[0_0_10px_rgba(255,107,0,0.4)]'
                  : 'text-zinc-400 hover:text-zinc-200 bg-zinc-900 border border-zinc-800'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>analytics_engine.py</span>
            </button>

            <button
              onClick={() => setActiveTab('readme')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all ${
                activeTab === 'readme'
                  ? 'bg-orange-500 text-black font-bold shadow-[0_0_10px_rgba(255,107,0,0.4)]'
                  : 'text-zinc-400 hover:text-zinc-200 bg-zinc-900 border border-zinc-800'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>README_PYTHON.md</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="copy-python-code-btn"
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-all"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">СКОПИРОВАНО!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>КОПИРОВАТЬ КОД</span>
                </>
              )}
            </button>

            <button
              id="download-python-file-btn"
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-black transition-all shadow-[0_0_10px_rgba(16,185,129,0.3)]"
            >
              <Download className="w-3.5 h-3.5" />
              <span>СКАЧАТЬ ФАЙЛ</span>
            </button>
          </div>
        </div>

        {/* Code Content */}
        <div className="flex-1 overflow-auto p-4 bg-black/60 text-zinc-300 text-xs font-mono leading-relaxed select-text scrollbar-thin">
          <pre className="whitespace-pre">
            <code>{currentCode}</code>
          </pre>
        </div>

        {/* Quick Launch Command snippet */}
        <div className="px-5 py-3 bg-[#0a0c12] border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-400">
          <div className="flex items-center gap-2">
            <span className="text-orange-400 font-bold">Быстрый запуск в терминале:</span>
            <code className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-emerald-400">
              python3 case_battle_helper.py
            </code>
          </div>
          <span className="text-zinc-500 text-[11px] hidden sm:inline">
            Поддерживает Rich TUI + OBS Window Capture
          </span>
        </div>
      </div>
    </div>
  );
};
