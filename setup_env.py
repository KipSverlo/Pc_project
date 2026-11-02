"""Создаёт локальный .env один раз; существующий файл не перезаписывается."""
import secrets
from pathlib import Path

path = Path(__file__).resolve().parent / ".env"
if path.exists():
    print(".env уже существует, оставлен без изменений.")
else:
    username = input("Логин демо-администратора: ").strip()
    password = input("Пароль демо-администратора: ").strip()
    if not username or not password:
        raise SystemExit("Логин и пароль обязательны.")
    with path.open("x", encoding="utf-8") as stream:
        stream.write(f"SECRET_KEY={secrets.token_urlsafe(48)}\nADMIN_USERNAME={username}\nADMIN_PASSWORD={password}\nCOOKIE_SECURE=false\n")
    print(".env создан. Перед публикацией смените демо-пароль и включите COOKIE_SECURE.")

