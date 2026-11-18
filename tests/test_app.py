import os
import re
import secrets
import tempfile
import unittest
from pathlib import Path

# Отдельная база: проверки не затрагивают рабочие заявки и остатки.
sandbox = tempfile.TemporaryDirectory(prefix="pc-store-tests-", dir=Path(__file__).resolve().parent)
os.environ["DATABASE_URL"] = "sqlite:///" + str(Path(sandbox.name) / "test.db")
os.environ["SECRET_KEY"] = secrets.token_urlsafe(48)
os.environ["ADMIN_USERNAME"] = "test-operator"
os.environ["ADMIN_PASSWORD"] = secrets.token_urlsafe(20)
from fastapi.testclient import TestClient
from backend.main import app
from backend.database import Base, engine, SessionLocal
from backend.models import Component, Order, ReadyBuild
from seed import seed

def tearDownModule():
    engine.dispose()
    sandbox.cleanup()

class StoreTests(unittest.TestCase):
    def tearDown(self):
        self.client.close()

    def setUp(self):
        Base.metadata.drop_all(engine)
        seed()
        self.client = TestClient(app)
        page = self.client.get("/")
        self.csrf = re.search(r'name="csrf-token" content="([^"]+)"', page.text).group(1)
        self.headers = {"X-CSRF-Token": self.csrf}

    def order(self, ids, **extra):
        return self.client.post("/api/orders", headers=self.headers, json={
            "type": "config", "component_ids": ids, "customer_name": "Тестовый клиент",
            "phone": "+7 (000) 000-00-00", "consent": True, **extra})

    def login(self):
        response = self.client.post("/admin/login", data={"csrf": self.csrf,
            "username": os.environ["ADMIN_USERNAME"], "password": os.environ["ADMIN_PASSWORD"]})
        self.assertEqual(response.status_code, 200)
        self.csrf = re.search(r'name="csrf-token" content="([^"]+)"', response.text).group(1)

    def test_pages_and_access(self):
        for path in ("/", "/builds", "/configurator", "/privacy", "/favicon.ico",
                     "/admin/login", "/api/catalog", "/static/style.css", "/static/app.js"):
            self.assertEqual(self.client.get(path).status_code, 200, path)
        self.assertEqual(self.client.get("/admin", follow_redirects=False).status_code, 303)
        self.assertEqual(self.client.post("/api/orders", json={}).status_code, 403)
        self.assertEqual(self.client.post("/admin/components/save", data={},
                                        follow_redirects=False).status_code, 303)

    def test_compatibility_and_price(self):
        self.assertEqual(self.order([1, 4]).status_code, 400)
        self.assertEqual(self.order([1, 3, 6]).status_code, 400)
        self.assertEqual(self.order([1, 2]).status_code, 400)
        self.assertEqual(self.order([999]).status_code, 400)
        result = self.order([1, 3, 5], total_price=1)
        self.assertEqual(result.status_code, 201, result.text)
        self.assertEqual(result.json()["total_price"], "46970.00")
        with SessionLocal() as db:
            self.assertEqual(db.get(Component, 1).stock_quantity, 9)
            self.assertEqual(db.get(Order, result.json()["id"]).details_json["components"][0]["name"], "Intel Core i5-13400F")

    def test_stock_rollback(self):
        with SessionLocal() as db:
            db.get(Component, 3).stock_quantity = 0
            db.commit()
        self.assertEqual(self.order([1, 3]).status_code, 409)
        with SessionLocal() as db:
            self.assertEqual(db.get(Component, 1).stock_quantity, 10)

    def test_ready_order_and_status(self):
        response = self.order([], type="ready", build_id=1)
        self.assertEqual(response.status_code, 201, response.text)
        order_id = response.json()["id"]
        self.assertEqual(response.json()["total_price"], "99900.00")
        self.login()
        for status in ("В работе", "Выполнен"):
            response = self.client.post(f"/admin/orders/{order_id}/status",
                data={"csrf": self.csrf, "status": status})
            self.assertEqual(response.status_code, 200)
        self.assertEqual(self.client.post(f"/admin/orders/{order_id}/status",
            data={"csrf": self.csrf, "status": "Новый"}).status_code, 400)

    def test_admin_crud_validation(self):
        self.login()
        for kind in ("components", "builds"):
            self.assertEqual(self.client.get(f"/admin/{kind}/edit/0").status_code, 200)
            self.assertEqual(self.client.get(f"/admin/{kind}/edit/1").status_code, 200)
        payload = {"csrf": self.csrf, "id": 0, "name": "Тестовый SSD", "price": "1200.50",
                   "image_url": "", "category_id": 5, "stock_quantity": 2, "specs_json": "{}"}
        response = self.client.post("/admin/components/save", data=payload)
        self.assertEqual(response.status_code, 200, response.text)
        with SessionLocal() as db:
            item = db.query(Component).filter_by(name="Тестовый SSD").one()
            item_id = item.id
        payload.update(id=item_id, price="1300.50")
        self.assertEqual(self.client.post("/admin/components/save", data=payload).status_code, 200)
        payload["specs_json"] = "broken json"
        self.assertEqual(self.client.post("/admin/components/save", data=payload).status_code, 400)
        self.assertEqual(self.client.post(f"/admin/components/delete/{item_id}", data={"csrf": self.csrf}).status_code, 200)
        self.assertEqual(self.client.post("/admin/components/delete/1", data={"csrf": self.csrf}).status_code, 409)
        ready = {"csrf": self.csrf, "id": 0, "name": "Тест", "price": "50000", "description": "Тест",
                 "image_url": "", "components_json": "[1,3,5]"}
        self.assertEqual(self.client.post("/admin/builds/save", data=ready).status_code, 200)
        with SessionLocal() as db:
            build_id = db.query(ReadyBuild).filter_by(name="Тест").one().id
        ready.update(id=build_id, name="Обновлено")
        self.assertEqual(self.client.post("/admin/builds/save", data=ready).status_code, 200)
        self.assertEqual(self.client.post(f"/admin/builds/delete/{build_id}", data={"csrf": self.csrf}).status_code, 200)

    def test_consent_and_public_texts(self):
        without = self.order([1], consent=False)
        self.assertEqual(without.status_code, 400)
        self.assertIn("согласия", without.json()["detail"])
        privacy = self.client.get("/privacy")
        self.assertIn("Политика конфиденциальности", privacy.text)
        self.assertIn("152-ФЗ", privacy.text)
        home = self.client.get("/")
        self.assertIn("Доставка, оплата и гарантия", home.text)
        self.assertIn("политикой конфиденциальности", home.text)
        self.assertNotIn("undefined", home.text)

    def test_seed_repeat_and_input(self):
        seed()
        with SessionLocal() as db:
            self.assertEqual(db.query(Component).count(), 10)
        self.assertEqual(self.order([1], phone="не телефон").status_code, 400)
        self.assertEqual(self.order([1,1]).status_code, 400)
        self.assertEqual(self.order([True]).status_code, 400)

if __name__ == "__main__":
    try:
        unittest.main()
    finally:
        engine.dispose()
        sandbox.cleanup()

