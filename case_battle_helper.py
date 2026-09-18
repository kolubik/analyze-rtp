#!/usr/bin/env python3
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
from python_modules.real_feed_client import CaseBattleRealClient

# Проверяем наличие библиотеки rich
try:
    from rich.console import Console
    from rich.layout import Layout
    from rich.panel import Panel
    from rich.table import Table
    from rich.live import Live
    from rich.text import Text
    from rich.progress_bar import ProgressBar
    from rich import box
    RICH_AVAILABLE = True
except ImportError:
    RICH_AVAILABLE = False


def build_rich_ui(layout: "Layout", drops: list, analytics: AnalyticsEngine, logger: TerminalLogger, ping_ms: int, mode_label: str = "CASE-BATTLE API [LIVE]"):
    """Строит киберпанк интерфейс на библиотеке Rich."""
    summary = analytics.get_summary()
    score = summary["score"]
    momentum = summary["momentum"]
    rtp = summary["rtp"]

    # 1. HEADER
    header_text = Text()
    header_text.append(" [⚡ CASE BATTLE HELPER // CS2 STREAM ANALYTICS HUD] ", style="bold black on bright_yellow")
    header_text.append(f"  SOURCE: {mode_label}  ", style="bold green on black")
    header_text.append(f"  PING: {ping_ms}ms  ", style="bold cyan on black")
    header_text.append(f"  TIME: {datetime.now().strftime('%H:%M:%S')}", style="dim white")
    layout["header"].update(Panel(header_text, border_style="bright_yellow", box=box.HEAVY))

    # 2. DROP FEED (ВЕРХНЯЯ / ЦЕНТРАЛЬНАЯ ЧАСТЬ)
    drop_table = Table(title="[bold green]● LIVE DROP FEED (РЕАЛЬНАЯ ЛЕНТА ДРОПОВ С САЙТА)[/]", border_style="green", box=box.ROUNDED, expand=True)
    drop_table.add_column("TIME", style="dim cyan", width=9)
    drop_table.add_column("PLAYER", style="bold white", width=14)
    drop_table.add_column("ITEM NAME", style="bold white")
    drop_table.add_column("RARITY", width=12)
    drop_table.add_column("CASE", style="dim cyan", width=16)
    drop_table.add_column("PRICE", justify="right", style="bold yellow", width=14)
    drop_table.add_column("ROI", justify="center", width=8)

    for item in drops[-8:]:
        # Цвет редкости
        rarity = item.get("rarity", "Mil-Spec")
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

        case_cost = item.get("case_cost", 1.5)
        is_profit = item["price"] >= case_cost
        roi_badge = "[green]+PROFIT[/]" if is_profit else "[red]-LOSS[/]"
        
        rub_price = item.get("rub_price")
        price_str = f"{int(rub_price)} ₽ / ${item['price']:.2f}" if rub_price else f"${item['price']:.2f}"
        player_name = item.get("user", "CB_Player")[:13]
        case_name = item.get("case_name", "Case Battle")[:15]

        drop_table.add_row(
            item["timestamp"],
            player_name,
            item["name"],
            Text(rarity_label, style=r_style),
            case_name,
            price_str,
            roi_badge
        )

    layout["feed"].update(Panel(drop_table, border_style="green", box=box.ROUNDED))

    # 3. ANALYTICS (ПРАВАЯ ПАНЕЛЬ С КРУПНЫМИ МЕТРИКАМИ)
    # Цвета для Momentum
    if momentum == "HOT":
        mom_style = "bold white on red"
    elif momentum == "OVERHEATED":
        mom_style = "bold yellow on magenta"
    elif momentum == "COLD":
        mom_style = "bold white on blue"
    else:
        mom_style = "bold black on green"

    # Цвет для RTP
    rtp_style = "green" if rtp >= 100 else ("yellow" if rtp >= 75 else "red")

    analytics_table = Table.grid(padding=(0, 1))
    analytics_table.add_column("Label", justify="left")
    analytics_table.add_column("Value", justify="right")

    analytics_text = Text()
    analytics_text.append("─── PREDICTIVE PROBABILITY ───\n", style="dim orange3")
    analytics_text.append(f" SCORE: {score:.1f} / 100\n", style="bold bright_yellow")
    
    # Визуальный индикатор Score
    filled_bars = int(score / 5)
    bar_str = "█" * filled_bars + "░" * (20 - filled_bars)
    analytics_text.append(f" [{bar_str}]\n\n", style="bold orange1")

    analytics_text.append("─── MARKET STATUS ───\n", style="dim orange3")
    analytics_text.append(f" MOMENTUM: [{mom_style}] {momentum} [/]\n", style="bold")
    analytics_text.append(f" STATUS: {summary['momentum_desc']}\n\n", style="italic dim cyan")

    analytics_text.append("─── MATHEMATICAL RTP ───\n", style="dim orange3")
    analytics_text.append(f" RTP (LAST {summary['window_size']}): ", style="bold white")
    analytics_text.append(f"{rtp:.1f}%\n", style=f"bold {rtp_style}")
    analytics_text.append(f" TOTAL SPENT:  ${summary['total_spent']:.2f}\n", style="dim white")
    analytics_text.append(f" TOTAL RETURN: ${summary['total_won']:.2f}\n", style="dim white")
    
    profit_color = "green" if summary['profit'] >= 0 else "red"
    profit_sign = "+" if summary['profit'] >= 0 else ""
    analytics_text.append(f" NET PROFIT:   [{profit_color}]{profit_sign}${summary['profit']:.2f}[/]\n", style="bold")
    analytics_text.append(f" DRY STREAK:   {summary['dry_streak']} drops\n", style="dim yellow")

    layout["analytics"].update(Panel(analytics_text, title="[bold orange3]⚡ ANALYTICS ENGINE[/]", border_style="bright_yellow", box=box.ROUNDED))

    # 4. TERMINAL LOG (НИЖНЯЯ ЧАСТЬ)
    log_text = Text()
    for log_line in logger.get_recent_logs()[-6:]:
        if "[SUCCESS]" in log_line or "[READY]" in log_line:
            log_text.append(f"{log_line}\n", style="green")
        elif "[WARN]" in log_line:
            log_text.append(f"{log_line}\n", style="yellow")
        elif "[ENTROPY]" in log_line or "[PREDICTION]" in log_line:
            log_text.append(f"{log_line}\n", style="cyan")
        else:
            log_text.append(f"{log_line}\n", style="white")

    layout["terminal"].update(Panel(log_text, title="[bold cyan]● CYBERPUNK TERMINAL // TELEMETRY & LOGS[/]", border_style="cyan", box=box.ROUNDED))


def run_rich_mode(use_real_api: bool = True, max_iterations: int = None):
    """Запуск полнофункционального TUI интерфейса на библиотеке Rich."""
    console = Console()
    layout = Layout()

    # Сетка: Header (сверху), Body (посередине: Feed слева/центр, Analytics справа), Terminal (снизу)
    layout.split(
        Layout(name="header", size=3),
        Layout(name="body", ratio=1),
        Layout(name="terminal", size=9)
    )
    layout["body"].split_row(
        Layout(name="feed", ratio=3),
        Layout(name="analytics", ratio=2)
    )

    analytics = AnalyticsEngine(window_size=25)
    real_client = CaseBattleRealClient()
    simulator = FeedSimulator("Revolution Case")
    logger = TerminalLogger(max_lines=8)
    drops = []

    logger.add_log("Connecting to Case-Battle Real Live Tape Stream...", "READY")
    logger.add_log(f"Active mirror: {real_client.mirror} (protocol: HTTP/WSS Live Tape)", "INFO")

    # Стартовые данные
    for _ in range(5):
        if use_real_api:
            drop = real_client.fetch_live_drop()
            cost = drop["case_cost"]
        else:
            drop, cost = simulator.generate_drop()
        drops.append(drop)
        analytics.add_drop(drop, cost)

    iteration = 0
    mode_label = f"CASE-BATTLE ({real_client.mirror.replace('https://', '')}) [LIVE]" if use_real_api else "SIMULATOR [TEST]"

    with Live(layout, refresh_per_second=4, screen=True) as live:
        while True:
            iteration += 1
            if use_real_api:
                drop = real_client.fetch_live_drop()
                cost = drop["case_cost"]
                ping = real_client.ping_ms
            else:
                drop, cost = simulator.generate_drop()
                ping = simulator.ping_ms

            drops.append(drop)
            analytics.add_drop(drop, cost)

            # Логируем событие в терминал
            if drop["rarity"] in ("Covert", "Special"):
                rub_info = f" ({int(drop.get('rub_price', 0))} ₽)" if drop.get('rub_price') else ""
                logger.add_log(f"HIGH-TIER DROP: {drop['name']}{rub_info} by {drop.get('user', 'User')}", "SUCCESS")
                logger.add_log("Momentum tensor shifting -> Recalculating tension matrix", "PREDICTION")
            else:
                if random.random() < 0.35:
                    logger.generate_random_tick_log()

            build_rich_ui(layout, drops, analytics, logger, ping, mode_label)

            if max_iterations and iteration >= max_iterations:
                break

            time.sleep(1.4)


def run_ansi_mode(use_real_api: bool = True, max_iterations: int = None):
    """
    Запасной режим работы на чистом Python (без сторонних библиотек),
    использует стандартные ANSI-цвета терминала.
    """
    os.system('cls' if os.name == 'nt' else 'clear')
    analytics = AnalyticsEngine(window_size=25)
    real_client = CaseBattleRealClient()
    simulator = FeedSimulator("Revolution Case")
    logger = TerminalLogger(max_lines=6)
    drops = []

    print("\033[38;5;208m" + "="*78)
    print("  CASE BATTLE HELPER // REAL API LIVE FEED (ANSI STANDARD MODE)")
    print("  Для максимального графического HUD установите rich: pip install rich")
    print("="*78 + "\033[0m\n")

    iteration = 0
    try:
        while True:
            iteration += 1
            if use_real_api:
                drop = real_client.fetch_live_drop()
                cost = drop["case_cost"]
                ping = real_client.ping_ms
                source_label = f"REAL API ({real_client.mirror.replace('https://', '')})"
            else:
                drop, cost = simulator.generate_drop()
                ping = simulator.ping_ms
                source_label = "SIMULATOR"

            drops.append(drop)
            analytics.add_drop(drop, cost)

            if drop["rarity"] in ("Covert", "Special"):
                logger.add_log(f"ALERT! {drop['name']} (${drop['price']:.2f})", "SUCCESS")
            elif random.random() < 0.35:
                logger.generate_random_tick_log()

            summary = analytics.get_summary()

            # Очистка и отрисовка кадра
            os.system('cls' if os.name == 'nt' else 'clear')
            print("\033[38;5;208m╔" + "═"*76 + "╗")
            print(f"║ \033[1;33mCASE BATTLE HELPER\033[0m | \033[32m{source_label} ({ping}ms)\033[0m | \033[36mDROPS: {len(drops)}\033[0m ║")
            print("\033[38;5;208m╠" + "═"*50 + "╦" + "═"*25 + "╣\033[0m")
            print("║ \033[1;32mРЕАЛЬНАЯ ЛЕНТА ОТКРЫТИЙ (LIVE FEED)\033[0m            ║ \033[1;33mАНАЛИТИКА / METRICS\033[0m    ║")
            print("\033[38;5;208m╠" + "═"*50 + "╬" + "═"*25 + "╣\033[0m")

            # Вывод строк ленты и аналитики
            recent = drops[-6:]
            for idx in range(6):
                feed_col = " " * 48
                if idx < len(recent):
                    d = recent[idx]
                    color = RARITY_COLORS.get(d["rarity"], "\033[0m")
                    user = d.get("user", "Player")[:9]
                    name_short = (d["name"][:20] + "..") if len(d["name"]) > 22 else d["name"]
                    rub = f"{int(d.get('rub_price', 0))}₽" if d.get('rub_price') else f"${d['price']:.2f}"
                    feed_col = f"{d['timestamp']} \033[36m{user:<9}\033[0m {color}{name_short:<22}\033[0m {rub:>9}"

                # Столбец аналитики
                if idx == 0:
                    right_col = f"\033[1;33mSCORE:\033[0m {summary['score']:>5.1f} / 100"
                elif idx == 1:
                    filled = int(summary['score'] / 10)
                    right_col = f"[{'#' * filled}{'.' * (10 - filled)}]"
                elif idx == 2:
                    m_color = "\033[1;31m" if summary['momentum'] == "HOT" else "\033[1;32m"
                    right_col = f"\033[1;33mMOMENTUM:\033[0m {m_color}{summary['momentum']:<7}\033[0m"
                elif idx == 3:
                    rtp_color = "\033[32m" if summary['rtp'] >= 100 else "\033[31m"
                    right_col = f"\033[1;33mRTP:\033[0m {rtp_color}{summary['rtp']:>6.1f}%\033[0m"
                elif idx == 4:
                    right_col = f"Spent: ${summary['total_spent']:>8.2f}"
                else:
                    prof = summary['profit']
                    p_col = "\033[32m" if prof >= 0 else "\033[31m"
                    right_col = f"Prof: {p_col}${prof:>9.2f}\033[0m"

                print(f"║ {feed_col:<48} ║ {right_col:<23} ║")

            print("\033[38;5;208m╠" + "═"*76 + "╣\033[0m")
            print("║ \033[1;36mТЕРМИНАЛ / ТЕЛЕМЕТРИЯ (LOGS)\033[0m                                               ║")
            print("\033[38;5;208m╠" + "═"*76 + "╣\033[0m")
            for log in logger.get_recent_logs()[-4:]:
                clean_log = log[:72]
                print(f"║ \033[37m{clean_log:<74}\033[0m ║")
            print("\033[38;5;208m╚" + "═"*76 + "╝\033[0m")

            if max_iterations and iteration >= max_iterations:
                break

            time.sleep(1.3)
    except KeyboardInterrupt:
        print("\n\033[33m[EXIT] Сессия остановлена пользователем.\033[0m")


def main():
    max_iter = None
    use_real = True

    if "--sim" in sys.argv:
        use_real = False
    elif "--real" in sys.argv:
        use_real = True

    if "--test" in sys.argv:
        max_iter = 3

    if RICH_AVAILABLE:
        try:
            run_rich_mode(use_real_api=use_real, max_iterations=max_iter)
        except KeyboardInterrupt:
            print("\n[INFO] Case Battle Helper остановлен.")
    else:
        run_ansi_mode(use_real_api=use_real, max_iterations=max_iter)



if __name__ == "__main__":
    main()
