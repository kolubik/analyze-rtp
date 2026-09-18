"""
CASE BATTLE HELPER - Аналитический математический модуль
Отвечает за расчет RTP, Momentum (COLD / HOT / STABLE) и динамического Score.
"""

from collections import deque
from typing import List, Dict, Any, Tuple
import math

class AnalyticsEngine:
    def __init__(self, window_size: int = 30):
        self.window_size = window_size
        self.history: deque = deque(maxlen=window_size)
        self.total_openings = 0
        self.total_spent = 0.0
        self.total_won = 0.0
        self.covert_streak = 0
        self.dry_streak = 0  # Количество дешевых дропов подряд

    def add_drop(self, drop: Dict[str, Any], case_cost: float) -> None:
        """Добавляет новое открытие в аналитическую историю."""
        self.total_openings += 1
        self.total_spent += case_cost
        self.total_won += drop["price"]
        
        entry = {
            "price": drop["price"],
            "cost": case_cost,
            "rarity": drop["rarity"],
            "profit": drop["price"] - case_cost,
            "ratio": drop["price"] / max(case_cost, 0.01)
        }
        self.history.append(entry)

        # Анализ стриков
        if drop["rarity"] in ("Covert", "Special"):
            self.covert_streak += 1
            self.dry_streak = 0
        else:
            self.dry_streak += 1
            self.covert_streak = max(0, self.covert_streak - 1)

    def calculate_rtp(self) -> float:
        """Расчет текущей окупаемости (Return to Player) за последние N открытий."""
        if not self.history:
            return 100.0
        total_window_won = sum(e["price"] for e in self.history)
        total_window_spent = sum(e["cost"] for e in self.history)
        if total_window_spent <= 0:
            return 100.0
        return round((total_window_won / total_window_spent) * 100.0, 2)

    def calculate_momentum(self) -> Tuple[str, str, str]:
        """
        Определяет статус рынка:
        - COLD: окупаемость сильно ниже нормы, длительная серия дешевых предметов.
        - STABLE: средние показатели, умеренная дисперсия.
        - HOT: всплеск дорогих предметов, высокий RTP за последнее окно.
        - OVERHEATED: выбиты сверхдорогие ножи/перчатки (риск отката).
        
        Возвращает: (status, color_tag, description)
        """
        if len(self.history) < 5:
            return "STABLE", "cyan", "Инициализация выборки..."

        rtp = self.calculate_rtp()
        recent_5 = list(self.history)[-5:]
        recent_high_tier = sum(1 for e in recent_5 if e["rarity"] in ("Covert", "Special"))

        if any(e["rarity"] == "Special" for e in recent_5) or rtp > 220.0:
            return "OVERHEATED", "magenta", "Сверхприбыль! Пик отдачи"
        elif rtp > 115.0 or recent_high_tier >= 2:
            return "HOT", "green", "Высокая отдача, серия прибыли"
        elif rtp < 65.0 or self.dry_streak >= 8:
            return "COLD", "blue", "Накопление дисперсии (затишье)"
        else:
            return "STABLE", "yellow", "Стабильный коридор распределения"

    def calculate_score(self) -> float:
        """
        Генерирует псевдо-индекс вероятности/шанса (SCORE от 0 до 100).
        Имитирует сложный квантовый/байесовский анализ распределения seed-хешей,
        реагируя на частоту выпадения и длину серии дешевых предметов.
        """
        base_score = 50.0

        # Если долго не падал дорогой предмет, «напряжение» и score растут
        dry_factor = min(self.dry_streak * 4.2, 35.0)
        
        # Влияние RTP: если RTP низкий, теоретический возврат к среднему тянет скор вверх
        rtp = self.calculate_rtp()
        if rtp < 80.0:
            rtp_factor = (80.0 - rtp) * 0.4
        else:
            rtp_factor = -((rtp - 80.0) * 0.3)

        # Динамические гармонические колебания для эффекта живого терминала
        harmonic = math.sin(self.total_openings * 0.7) * 6.5

        score = base_score + dry_factor + rtp_factor + harmonic
        # Ограничение диапазона от 5 до 99.4
        score = max(5.0, min(99.4, score))
        return round(score, 1)

    def get_summary(self) -> Dict[str, Any]:
        """Возвращает агрегированный словарь метрик."""
        momentum, mom_color, mom_desc = self.calculate_momentum()
        return {
            "total_openings": self.total_openings,
            "total_spent": round(self.total_spent, 2),
            "total_won": round(self.total_won, 2),
            "profit": round(self.total_won - self.total_spent, 2),
            "rtp": self.calculate_rtp(),
            "momentum": momentum,
            "momentum_color": mom_color,
            "momentum_desc": mom_desc,
            "score": self.calculate_score(),
            "dry_streak": self.dry_streak,
            "window_size": len(self.history)
        }
