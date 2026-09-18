"""
CASE BATTLE HELPER - База данных скинов и кейсов CS:2
Содержит список предметов, редкости, цены и вероятности выпадения.
"""

from typing import Dict, List, Any

# Цвета редкостей для терминала (ANSI)
RARITY_COLORS = {
    "Mil-Spec": "\033[94m",       # Синий (Армейское)
    "Restricted": "\033[95m",     # Фиолетовый (Запрещенное)
    "Classified": "\033[91m",     # Розовый (Засекреченное)
    "Covert": "\033[38;5;196m",   # Красный (Тайное)
    "Special": "\033[38;5;220m"   # Золотой (Ножи / Перчатки)
}

# База данных кейсов
CASES_DATA: Dict[str, Dict[str, Any]] = {
    "Revolution Case": {
        "cost": 2.50,
        "items": [
            {"name": "MAG-7 | Insomnia", "rarity": "Mil-Spec", "price": 0.35, "weight": 40},
            {"name": "SCAR-20 | Fragments", "rarity": "Mil-Spec", "price": 0.40, "weight": 35},
            {"name": "MP5-SD | Liquidation", "rarity": "Mil-Spec", "price": 0.50, "weight": 35},
            {"name": "P2000 | Wicked Sick", "rarity": "Restricted", "price": 1.80, "weight": 16},
            {"name": "MAC-10 | Sakkaku", "rarity": "Restricted", "price": 2.40, "weight": 14},
            {"name": "M4A1-S | Emphorosaur-S", "rarity": "Restricted", "price": 3.20, "weight": 12},
            {"name": "Glock-18 | Umbral Rabbit", "rarity": "Classified", "price": 11.50, "weight": 5},
            {"name": "P90 | Neoqueen", "rarity": "Classified", "price": 14.80, "weight": 4},
            {"name": "AK-47 | Head Shot", "rarity": "Covert", "price": 78.00, "weight": 1.2},
            {"name": "M4A4 | Temukau", "rarity": "Covert", "price": 95.00, "weight": 1.0},
            {"name": "★ Butterfly Knife | Doppler", "rarity": "Special", "price": 1450.00, "weight": 0.25},
            {"name": "★ Karambit | Fade", "rarity": "Special", "price": 1820.00, "weight": 0.15}
        ]
    },
    "Dreams & Nightmares": {
        "cost": 1.90,
        "items": [
            {"name": "Five-SeveN | Scrawl", "rarity": "Mil-Spec", "price": 0.28, "weight": 42},
            {"name": "MP9 | Starlight Protector", "rarity": "Covert", "price": 65.00, "weight": 1.2},
            {"name": "AK-47 | Nightwish", "rarity": "Covert", "price": 85.00, "weight": 1.0},
            {"name": "Dual Berettas | Melondrama", "rarity": "Classified", "price": 9.50, "weight": 5},
            {"name": "FAMAS | Rapid Eye Movement", "rarity": "Classified", "price": 12.00, "weight": 4.5},
            {"name": "USP-S | Ticket to Hell", "rarity": "Restricted", "price": 2.10, "weight": 15},
            {"name": "G3SG1 | Dream Glade", "rarity": "Restricted", "price": 1.60, "weight": 16},
            {"name": "★ Butterfly Knife | Gamma Doppler", "rarity": "Special", "price": 1650.00, "weight": 0.2},
            {"name": "★ Skeleton Knife | Case Hardened", "rarity": "Special", "price": 890.00, "weight": 0.3}
        ]
    },
    "High Roller Battle": {
        "cost": 25.00,
        "items": [
            {"name": "Desert Eagle | Printstream", "rarity": "Covert", "price": 95.00, "weight": 12},
            {"name": "AK-47 | Vulcan (Field-Tested)", "rarity": "Covert", "price": 310.00, "weight": 6},
            {"name": "M4A4 | Eye of Horus", "rarity": "Covert", "price": 380.00, "weight": 4},
            {"name": "AWP | Asiimov", "rarity": "Covert", "price": 120.00, "weight": 10},
            {"name": "USP-S | Kill Confirmed", "rarity": "Covert", "price": 140.00, "weight": 8},
            {"name": "AK-47 | Redline", "rarity": "Classified", "price": 18.00, "weight": 25},
            {"name": "★ Sport Gloves | Vice", "rarity": "Special", "price": 2400.00, "weight": 0.6},
            {"name": "★ Karambit | Marble Fade", "rarity": "Special", "price": 1950.00, "weight": 0.8},
            {"name": "★ Talon Knife | Slaughter", "rarity": "Special", "price": 720.00, "weight": 1.5}
        ]
    }
}
