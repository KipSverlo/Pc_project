from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, JSON, Numeric, ForeignKey, DateTime, CheckConstraint
from .database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    username = Column(String(80), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)

class Category(Base):
    __tablename__ = "categories"
    id = Column(Integer, primary_key=True)
    name = Column(String(100), unique=True, nullable=False)

class Component(Base):
    __tablename__ = "components"
    __table_args__ = (CheckConstraint("price >= 0"), CheckConstraint("stock_quantity >= 0"))
    id = Column(Integer, primary_key=True)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False)
    name = Column(String(200), nullable=False)
    specs_json = Column(JSON, nullable=False, default=dict)
    price = Column(Numeric(12, 2), nullable=False)
    stock_quantity = Column(Integer, nullable=False, default=0)
    image_url = Column(String(1000), default="")

class ReadyBuild(Base):
    __tablename__ = "ready_builds"
    __table_args__ = (CheckConstraint("price >= 0"),)
    id = Column(Integer, primary_key=True)
    name = Column(String(200), nullable=False)
    description = Column(Text, default="")
    price = Column(Numeric(12, 2), nullable=False)
    image_url = Column(String(1000), default="")
    components_json = Column(JSON, nullable=False, default=list)

class Order(Base):
    __tablename__ = "orders"
    id = Column(Integer, primary_key=True)
    customer_name = Column(String(100), nullable=False)
    phone = Column(String(30), nullable=False)
    type = Column(String(10), nullable=False)
    details_json = Column(JSON, nullable=False)
    total_price = Column(Numeric(12, 2), nullable=False)
    status = Column(String(30), nullable=False, default="Новый")
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

