"""Данные продавца и тексты витрины.

Всё, что меняется от клиента к клиенту, живёт в `.env`: реквизиты ИП, контакты,
условия доставки и гарантии. Шаблоны читают значения отсюда и не содержат
зашитых телефонов и адресов.
"""

import os
import re


def _value(name: str, default: str = "") -> str:
    return (os.getenv(name) or default).strip()


SITE = {
    "name": _value("SITE_NAME", "NEON / PC"),
    "legal_name": _value("SELLER_LEGAL_NAME"),
    "inn": _value("SELLER_INN"),
    "ogrn": _value("SELLER_OGRN"),
    "phone": _value("SELLER_PHONE"),
    "email": _value("SELLER_EMAIL"),
    "telegram": _value("SELLER_TELEGRAM").lstrip("@"),
    "address": _value("SELLER_ADDRESS"),
    "hours": _value("SELLER_HOURS", "Пн–Сб, 10:00–20:00"),
    "delivery": _value(
        "SITE_DELIVERY",
        "Собираем и тестируем ПК перед отправкой. Доставка по городу — курьером, "
        "по России — СДЭК или другой службой по согласованию. Сроки и стоимость "
        "подтверждаем до оплаты.",
    ),
    "warranty": _value(
        "SITE_WARRANTY",
        "На сборку даём 12 месяцев гарантии, на комплектующие действует гарантия "
        "производителя. Если что-то не запустилось — привозим, диагностируем и "
        "чиним сами.",
    ),
    "payment": _value(
        "SITE_PAYMENT",
        "Онлайн-оплаты на сайте нет: сначала согласуем конфигурацию и наличие, "
        "потом выставляем счёт. Предоплата и окончательный расчёт — по договорённости.",
    ),
}

SITE["phone_href"] = re.sub(r"[^\d+]", "", SITE["phone"])
SITE["telegram_url"] = f"https://t.me/{SITE['telegram']}" if SITE["telegram"] else ""
SITE["has_contacts"] = any(SITE[key] for key in ("phone", "email", "telegram", "address"))
SITE["has_requisites"] = bool(SITE["legal_name"])
