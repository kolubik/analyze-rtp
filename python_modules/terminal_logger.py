"""
CASE BATTLE HELPER - Модуль логгера терминала в стиле киберпанк/хакер
Генерирует псевдо-вычисления, анализ сидов и статусы подключения.
"""

from collections import deque
from datetime import datetime
from typing import List
import random

PSEUDO_LOGS = [
    "[INFO] Analyzing drop sequence stream via WSS protocol...",
    "[INFO] Received packet signature: verified SHA-256",
    "[SUCCESS] Momentum index updated -> rolling variance recalibrated",
    "[ENTROPY] PRNG seed divergence checked: normal distribution",
    "[ANALYSIS] Rolling RTP window calculating over recent drops...",
    "[PREDICTION] Volatility corridor delta: +0.142σ",
    "[MEMORY] Heap buffer sync ok: 0x8FA420 -> 0x8FA4B0",
    "[WARN] High deviation spike detected in case price vector",
    "[SUCCESS] Quantum entropy cache refreshed (buffer: 1024b)",
    "[STREAM] Frame sync: 60fps telemetry locked with server feed"
]

class TerminalLogger:
    def __init__(self, max_lines: int = 8):
        self.logs: deque = deque(maxlen=max_lines)
        self.add_system_log("[BOOT] Case Battle Helper v2.4 initialized")
        self.add_system_log("[CONNECT] Connecting to CS2 stream gateway (wss://feed.casebattle.net)...")
        self.add_system_log("[READY] Link established. Ping: 18ms. Awaiting drop events...")

    def add_log(self, text: str, tag: str = "INFO") -> None:
        ts = datetime.now().strftime("%H:%M:%S")
        self.logs.append(f"[{ts}] [{tag}] {text}")

    def add_system_log(self, raw_msg: str) -> None:
        ts = datetime.now().strftime("%H:%M:%S")
        self.logs.append(f"[{ts}] {raw_msg}")

    def generate_random_tick_log(self) -> None:
        """Периодически добавляет атмосферные псевдо-вычисления."""
        msg = random.choice(PSEUDO_LOGS)
        self.add_system_log(msg)

    def get_recent_logs(self) -> List[str]:
        return list(self.logs)
