"""Проверяет страницы и авторизованный вход у запущенного локального сервера."""
import os
import re
import httpx
from dotenv import load_dotenv
from backend.database import ROOT

load_dotenv(ROOT / ".env")
with httpx.Client(base_url="http://127.0.0.1:8000", follow_redirects=True) as client:
    for path in ("/", "/configurator", "/admin/login", "/api/catalog"):
        response = client.get(path)
        response.raise_for_status()
        print(path, response.status_code)
    page = client.get("/admin/login")
    token = re.search(r'name="csrf-token" content="([^"]+)"', page.text).group(1)
    response = client.post("/admin/login", data={"csrf": token,
        "username": os.environ["ADMIN_USERNAME"], "password": os.environ["ADMIN_PASSWORD"]})
    assert response.status_code == 200 and response.url.path == "/admin", "Вход не выполнен"
    assert "Магазин под контролем" in response.text
    print("Authenticated /admin: 200 OK")

