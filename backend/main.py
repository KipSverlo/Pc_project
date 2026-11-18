import json
import os
import re
import time
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from urllib.parse import urlparse
from fastapi import BackgroundTasks, FastAPI, Request, Depends, HTTPException
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy import select, update
from starlette.middleware.sessions import SessionMiddleware
from .database import ROOT, SessionLocal
from .models import User, Category, Component, ReadyBuild, Order
from .security import passwords, csrf_token, check_csrf
from .catalog import selected_components, snapshot, total
from .site import SITE
from .notify import notify_order, telegram_configured

secret = os.getenv("SECRET_KEY", "")
if len(secret) < 32:
    raise RuntimeError("Создайте .env: SECRET_KEY должен содержать минимум 32 символа.")
app = FastAPI(title="NEON / PC — магазин сборок")
app.add_middleware(SessionMiddleware, secret_key=secret, same_site="lax",
                   https_only=os.getenv("COOKIE_SECURE") == "true", max_age=14400)
app.mount("/static", StaticFiles(directory=ROOT / "static"), name="static")
app.mount("/models", StaticFiles(directory=ROOT / "frontend" / "assets" / "models"), name="models")
templates = Jinja2Templates(directory=ROOT / "templates")
templates.env.filters["rub"] = lambda value: f"{Decimal(value):,.0f}".replace(",", " ") + " ₽"
attempts = {}

def database():
    with SessionLocal() as db:
        yield db

def admin(request: Request, db=Depends(database)):
    user = db.get(User, request.session.get("uid")) if request.session.get("uid") else None
    if not user:
        raise HTTPException(303, headers={"Location": "/admin/login"})
    return user

def render(request, name, **context):
    return templates.TemplateResponse(request=request, name=name,
        context={"csrf": csrf_token(request), "site": SITE, **context})

@app.middleware("http")
async def headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Content-Security-Policy"] = "default-src 'self'; connect-src 'self' blob:; img-src 'self' https: data: blob:; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self' 'wasm-unsafe-eval'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
    if request.url.path.startswith("/admin"):
        response.headers["Cache-Control"] = "no-store"
    return response

@app.get("/")
def landing(request: Request, db=Depends(database)):
    return render(request, "index.html", builds=db.scalars(select(ReadyBuild)).all())

@app.get("/builds")
def builds_page(request: Request, db=Depends(database)):
    return render(request, "builds.html", builds=db.scalars(select(ReadyBuild)).all())

@app.get("/configurator")
def configurator(request: Request):
    return render(request, "configurator.html")

@app.get("/privacy")
def privacy(request: Request):
    return render(request, "privacy.html")

@app.get("/favicon.ico", include_in_schema=False)
def favicon():
    return RedirectResponse("/static/favicon.svg", 308)

@app.get("/api/catalog")
def catalog(db=Depends(database)):
    model_names = {'Процессор': 'cpu', 'Материнская плата': 'motherboard', 'ОЗУ': 'ram', 'Видеокарта': 'gpu', 'Накопитель': 'storage'}
    category_models = {c.id: model_names.get(c.name) for c in db.scalars(select(Category))}
    def model_url(component):
        name = category_models.get(component.category_id)
        path = ROOT / "frontend" / "assets" / "models" / f"{name}.glb"
        return f"/models/{name}.glb" if name and path.is_file() else None
    return {"categories": [{"id": c.id, "name": c.name} for c in db.scalars(select(Category))],
            "components": [{"id": c.id, "category_id": c.category_id, "name": c.name,
                "specs_json": c.specs_json, "price": str(c.price), "stock_quantity": c.stock_quantity,
                "image_url": c.image_url, "model_url": model_url(c)} for c in db.scalars(select(Component))]}

@app.post("/api/orders", status_code=201)
async def create_order(request: Request, background_tasks: BackgroundTasks, db=Depends(database)):
    check_csrf(request, request.headers.get("X-CSRF-Token"))
    try:
        data = await request.json()
    except ValueError:
        raise HTTPException(400, "Некорректный JSON.")
    if not isinstance(data, dict):
        raise HTTPException(400, "Ожидается объект заказа.")
    name, phone = str(data.get("customer_name", "")).strip(), str(data.get("phone", "")).strip()
    if not 2 <= len(name) <= 100 or not re.fullmatch(r"[+\d ()-]{10,25}", phone) or not 10 <= len(re.sub(r"\D", "", phone)) <= 15:
        raise HTTPException(400, "Укажите имя и корректный телефон (10–15 цифр).")
    if data.get("consent") not in (True, "on", "true", "1", 1):
        raise HTTPException(400, "Без согласия на обработку персональных данных заявку принять нельзя.")
    kind = data.get("type")
    if kind == "ready":
        build_id = data.get("build_id")
        if type(build_id) is not int:
            raise HTTPException(400, "Выберите сборку.")
        build = db.get(ReadyBuild, build_id)
        if not build:
            raise HTTPException(404, "Сборка не найдена.")
        ids = build.components_json
        amount = build.price
    elif kind == "config":
        ids = data.get("component_ids")
    else:
        raise HTTPException(400, "Неизвестный тип заказа.")
    if not isinstance(ids, list) or not ids or len(ids) > 50 or any(type(i) is not int for i in ids):
        raise HTTPException(400, "Неверный состав заказа.")
    items = selected_components(db, ids)
    if kind == "config":
        amount = total(items)
    # Условный UPDATE резервирует остатки атомарно; при ошибке вся транзакция откатывается.
    for item in sorted(items, key=lambda i: i.id):
        result = db.execute(update(Component).where(Component.id == item.id, Component.stock_quantity > 0)
                            .values(stock_quantity=Component.stock_quantity - 1))
        if result.rowcount != 1:
            db.rollback()
            raise HTTPException(409, "Товар закончился. Обновите каталог.")
    details = {"components": snapshot(items), "consent": {
        "policy": "/privacy", "accepted": True,
        "at": datetime.now(timezone.utc).isoformat(timespec="seconds")}}
    if kind == "ready":
        details["build_name"] = build.name
    order = Order(customer_name=name, phone=phone, type=kind, details_json=details, total_price=amount)
    db.add(order)
    db.commit()
    background_tasks.add_task(notify_order, order.id, name, phone, kind,
        str(order.total_price), details["components"], details.get("build_name"))
    return {"id": order.id, "message": "Спасибо, мы свяжемся с вами", "total_price": str(order.total_price)}

@app.get("/admin/login")
def login_page(request: Request):
    return render(request, "login.html", error=None)

@app.post("/admin/login")
async def login(request: Request, db=Depends(database)):
    form = await request.form()
    check_csrf(request, form.get("csrf"))
    ip = request.client.host
    now = time.monotonic()
    attempts[ip] = [stamp for stamp in attempts.get(ip, []) if now - stamp < 300]
    if len(attempts[ip]) >= 10:
        raise HTTPException(429, "Слишком много попыток. Повторите через 5 минут.")
    user = db.scalar(select(User).where(User.username == str(form.get("username", ""))))
    if not user or not passwords.verify(str(form.get("password", "")), user.password_hash):
        attempts[ip].append(now)
        return render(request, "login.html", error="Неверный логин или пароль")
    attempts.pop(ip, None)
    request.session.clear()
    request.session["uid"] = user.id
    return RedirectResponse("/admin", 303)

@app.post("/admin/logout")
async def logout(request: Request, user=Depends(admin)):
    form = await request.form()
    check_csrf(request, form.get("csrf"))
    request.session.clear()
    return RedirectResponse("/", 303)

@app.get("/admin")
def dashboard(request: Request, user=Depends(admin), db=Depends(database)):
    return render(request, "admin.html", components=db.scalars(select(Component)).all(),
        categories=db.scalars(select(Category)).all(), builds=db.scalars(select(ReadyBuild)).all(),
        orders=db.scalars(select(Order).order_by(Order.created_at.desc())).all(),
        telegram=telegram_configured())

def model_for(kind):
    if kind not in ("components", "builds"):
        raise HTTPException(404)
    return Component if kind == "components" else ReadyBuild

@app.get("/admin/{kind}/edit/{item_id}")
def edit_page(kind: str, item_id: int, request: Request, user=Depends(admin), db=Depends(database)):
    model = model_for(kind)
    item = db.get(model, item_id) if item_id else None
    if item_id and not item:
        raise HTTPException(404)
    return render(request, "edit.html", item=item, kind=kind,
                  categories=db.scalars(select(Category)).all(), error=None)

@app.post("/admin/{kind}/save")
async def save(kind: str, request: Request, user=Depends(admin), db=Depends(database)):
    model = model_for(kind)
    form = await request.form()
    check_csrf(request, form.get("csrf"))
    try:
        item_id = int(form.get("id", 0))
        item = db.get(model, item_id) if item_id else model()
        if item is None:
            raise ValueError("Запись не найдена")
        name = str(form.get("name", "")).strip()
        price = Decimal(str(form.get("price", "")))
        url = str(form.get("image_url", "")).strip()
        if not name or len(name) > 200 or not price.is_finite() or price < 0 or price > 99999999 or price.as_tuple().exponent < -2:
            raise ValueError("Проверьте название и цену (до двух знаков после запятой)")
        if url and (urlparse(url).scheme != "https" or not urlparse(url).netloc):
            raise ValueError("Фото: укажите HTTPS-ссылку или оставьте поле пустым")
        values = dict(name=name, price=price, image_url=url)
        if kind == "components":
            category_id = int(form.get("category_id", 0))
            specs = json.loads(str(form.get("specs_json", "{}")))
            stock = int(form.get("stock_quantity", 0))
            if not db.get(Category, category_id) or not isinstance(specs, dict) or not 0 <= stock <= 100000:
                raise ValueError("Проверьте категорию, JSON характеристик и остаток")
            category = db.get(Category, category_id).name
            required = {"Процессор": ("socket", "ram_type"), "Материнская плата": ("socket", "ram_type"), "ОЗУ": ("ram_type",)}.get(category, ())
            if any(not isinstance(specs.get(key), str) or not specs[key].strip() for key in required):
                raise ValueError("Обязательные характеристики: " + ", ".join(required))
            values.update(category_id=category_id, specs_json=specs, stock_quantity=stock)
        else:
            ids = json.loads(str(form.get("components_json", "[]")))
            if not isinstance(ids, list) or any(type(i) is not int for i in ids):
                raise ValueError("Состав: JSON-массив ID комплектующих")
            selected_components(db, ids)
            values.update(description=str(form.get("description", ""))[:5000], components_json=ids)
        for key, value in values.items():
            setattr(item, key, value)
        db.add(item)
        db.commit()
    except (ValueError, InvalidOperation) as exc:
        db.rollback()
        raise HTTPException(400, str(exc))
    return RedirectResponse("/admin", 303)

@app.post("/admin/{kind}/delete/{item_id}")
async def delete(kind: str, item_id: int, request: Request, user=Depends(admin), db=Depends(database)):
    form = await request.form()
    check_csrf(request, form.get("csrf"))
    item = db.get(model_for(kind), item_id)
    if not item:
        raise HTTPException(404)
    if kind == "components" and any(item_id in b.components_json for b in db.scalars(select(ReadyBuild))):
        raise HTTPException(409, "Комплектующее входит в готовую сборку. Сначала измените её состав.")
    db.delete(item)
    db.commit()
    return RedirectResponse("/admin", 303)

@app.post("/admin/orders/{order_id}/status")
async def status(order_id: int, request: Request, user=Depends(admin), db=Depends(database)):
    form = await request.form()
    check_csrf(request, form.get("csrf"))
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(404)
    transitions = {"Новый": "В работе", "В работе": "Выполнен"}
    if form.get("status") != transitions.get(order.status):
        raise HTTPException(400, "Недопустимый переход статуса")
    order.status = form["status"]
    db.commit()
    return RedirectResponse("/admin", 303)

