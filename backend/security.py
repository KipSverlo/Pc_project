import secrets
from passlib.context import CryptContext
from fastapi import HTTPException

passwords = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

def csrf_token(request):
    if "csrf" not in request.session:
        request.session["csrf"] = secrets.token_urlsafe(32)
    return request.session["csrf"]

def check_csrf(request, value):
    expected = request.session.get("csrf")
    if not expected or not value or not secrets.compare_digest(expected, str(value)):
        raise HTTPException(403, "Сессия формы истекла. Обновите страницу.")

