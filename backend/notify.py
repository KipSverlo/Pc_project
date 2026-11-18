"""Уведомление менеджера о новой заявке.

Работает, только если в `.env` заданы TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID.
Ошибка отправки не должна ломать оформление заявки: она пишется в лог,
а заявка остаётся в базе и в админке.
"""

import logging
import os

import httpx

log = logging.getLogger("pc.notify")


def _config() -> tuple[str, str]:
    return (
        (os.getenv("TELEGRAM_BOT_TOKEN") or "").strip(),
        (os.getenv("TELEGRAM_CHAT_ID") or "").strip(),
    )


def telegram_configured() -> bool:
    return all(_config())


def _format(order_id: int, customer: str, phone: str, kind: str, total: str,
            positions: list[dict], build_name: str | None) -> str:
    title = "Заявка на готовую сборку" if kind == "ready" else "Заявка на конфигурацию"
    lines = [
        f"Новая заявка №{order_id}",
        f"{title}",
        "",
        f"Клиент: {customer}",
        f"Телефон: {phone}",
    ]
    if build_name:
        lines.append(f"Сборка: {build_name}")
    else:
        lines.append("Состав:")
        for item in positions:
            lines.append(f"• {item['name']} — {item['price']} ₽")
    lines += ["", f"Итого: {total} ₽"]
    return "\n".join(lines)


def notify_order(order_id: int, customer: str, phone: str, kind: str, total: str,
                 positions: list[dict], build_name: str | None = None) -> bool:
    token, chat_id = _config()
    if not token or not chat_id:
        return False
    text = _format(order_id, customer, phone, kind, total, positions, build_name)
    try:
        response = httpx.post(
            f"https://api.telegram.org/bot{token}/sendMessage",
            json={"chat_id": chat_id, "text": text, "disable_web_page_preview": True},
            timeout=8,
        )
        if response.status_code >= 400:
            log.warning("Telegram отклонил уведомление: HTTP %s", response.status_code)
            return False
        return True
    except Exception as exc:  # сеть недоступна — заявка всё равно уже сохранена
        log.warning("Не удалось отправить уведомление в Telegram: %s", exc)
        return False
