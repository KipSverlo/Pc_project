import os
from sqlalchemy import select
from backend.database import Base, engine, SessionLocal
from backend.models import User, Category, Component, ReadyBuild
from backend.security import passwords

def seed():
    Base.metadata.create_all(engine)
    username, password = os.getenv("ADMIN_USERNAME"), os.getenv("ADMIN_PASSWORD")
    if not username or not password:
        raise RuntimeError("Задайте ADMIN_USERNAME и ADMIN_PASSWORD в .env.")
    with SessionLocal() as db:
        if not db.scalar(select(User).where(User.username == username)):
            db.add(User(username=username, password_hash=passwords.hash(password)))
        names = ["Процессор", "Материнская плата", "ОЗУ", "Видеокарта", "Накопитель", "Блок питания", "Корпус"]
        for name in names:
            if not db.scalar(select(Category).where(Category.name == name)):
                db.add(Category(name=name))
        db.flush()
        cats = {c.name: c.id for c in db.scalars(select(Category))}
        rows = [
            ("Процессор", "Intel Core i5-13400F", {"socket": "LGA1700", "ram_type": "DDR5", "power": 148}, 21990),
            ("Процессор", "AMD Ryzen 5 7600", {"socket": "AM5", "ram_type": "DDR5", "power": 65}, 23990),
            ("Материнская плата", "B760 DDR5", {"socket": "LGA1700", "ram_type": "DDR5"}, 14990),
            ("Материнская плата", "B650 DDR5", {"socket": "AM5", "ram_type": "DDR5"}, 16990),
            ("ОЗУ", "Kingston Fury 32 GB DDR5", {"ram_type": "DDR5", "capacity": "32 GB"}, 9990),
            ("ОЗУ", "Kingston Fury 16 GB DDR4", {"ram_type": "DDR4", "capacity": "16 GB"}, 3990),
            ("Видеокарта", "GeForce RTX 4060 8 GB", {"power": 115, "memory": "8 GB"}, 35990),
            ("Накопитель", "NVMe SSD 1 TB", {"capacity": "1 TB"}, 5990),
            ("Блок питания", "650W Bronze", {"power": 650}, 5990),
            ("Корпус", "Airflow Tower", {"format": "ATX"}, 4990),
        ]
        for category, name, specs, price in rows:
            if not db.scalar(select(Component).where(Component.name == name)):
                db.add(Component(category_id=cats[category], name=name, specs_json=specs, price=price, stock_quantity=10))
        db.flush()
        ids = {c.name: c.id for c in db.scalars(select(Component))}
        if not db.scalar(select(ReadyBuild).where(ReadyBuild.name == "NEON / START")):
            parts = [rows[i][1] for i in (0, 2, 4, 6, 7, 8, 9)]
            db.add(ReadyBuild(name="NEON / START", description="Демонстрационная сборка для игр и работы. Intel Core i5 / RTX 4060 / 32 GB DDR5 / SSD 1 TB.", price=99900, components_json=[ids[n] for n in parts]))
        db.commit()
    print("База подготовлена. Повторный запуск не дублирует данные и не сбрасывает остатки.")
if __name__ == "__main__":
    seed()

