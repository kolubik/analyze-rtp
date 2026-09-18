"""
CASE BATTLE HELPER - Модуль имитации потока данных (WebSocket / Live Stream API)
Генерирует реалистичный поток открытий с сервера с задержками и псевдо-подключением.
"""

import random
import time
from datetime import datetime
from typing import Dict, Any, Tuple
from python_modules.skins_database import CASES_DATA

WEAR_LIST = ["FN (Прямо с завода)", "MW (Немного поношенное)", "FT (После полевых)", "WW (Поношенное)", "BS (Закаленное в боях)"]

class FeedSimulator:
    def __init__(self, default_case: str = "Revolution Case"):
        self.current_case = default_case
        self.connected = True
        self.ping_ms = 18
        self.packet_id = 1000

    def set_case(self, case_name: str) -> None:
        if case_name in CASES_DATA:
            self.current_case = case_name

    def generate_drop(self) -> Tuple[Dict[str, Any], float]:
        """
        Выбирает предмет из кейса с учетом весов редкости (вероятностей).
        Возвращает: (словарь_предмета, стоимость_кейса)
        """
        case_info = CASES_DATA[self.current_case]
        items = case_info["items"]
        cost = case_info["cost"]

        weights = [item["weight"] for item in items]
        selected = random.choices(items, weights=weights, k=1)[0]
        
        self.packet_id += 1
        self.ping_ms = random.randint(14, 28)

        # Случайное состояние износа и небольшая вариация цены (±5%)
        wear = random.choice(WEAR_LIST)
        price_variation = selected["price"] * random.uniform(0.95, 1.05)
        
        # Хеш сида
        seed_hash = f"0x{random.randint(0x10000000, 0xFFFFFFFF):08x}"

        drop_packet = {
            "id": self.packet_id,
            "name": selected["name"],
            "rarity": selected["rarity"],
            "price": round(price_variation, 2),
            "case": self.current_case,
            "wear": wear,
            "timestamp": datetime.now().strftime("%H:%M:%S"),
            "seed_hash": seed_hash,
            "user": f"player_{random.randint(100, 999)}"
        }

        return drop_packet, cost
