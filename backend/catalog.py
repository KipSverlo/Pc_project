from decimal import Decimal
from fastapi import HTTPException
from sqlalchemy import select
from .models import Component, Category

def selected_components(db, ids):
    if not ids or len(ids) != len(set(ids)):
        raise HTTPException(400, "Выберите комплектующие без повторов.")
    items = list(db.scalars(select(Component).where(Component.id.in_(ids))))
    if len(items) != len(ids):
        raise HTTPException(400, "Некоторые комплектующие больше не доступны.")
    if len({item.category_id for item in items}) != len(items):
        raise HTTPException(400, "Можно выбрать только один товар из каждой категории.")
    categories = {c.id: c.name for c in db.scalars(select(Category))}
    by_name = {categories[item.category_id]: item for item in items}
    cpu, board, ram = (by_name.get(name) for name in ("Процессор", "Материнская плата", "ОЗУ"))
    if cpu and board and cpu.specs_json.get("socket") != board.specs_json.get("socket"):
        raise HTTPException(400, "Сокеты процессора и материнской платы не совпадают.")
    for first, second in ((cpu, board), (board, ram), (cpu, ram)):
        if first and second:
            left, right = first.specs_json.get("ram_type"), second.specs_json.get("ram_type")
            if left and right and left != right:
                raise HTTPException(400, "Типы оперативной памяти не совпадают.")
    return items

def snapshot(items):
    return [{"id": i.id, "name": i.name, "price": str(i.price), "specs": i.specs_json} for i in items]

def total(items):
    return sum((i.price for i in items), Decimal("0.00"))

