from fastapi import FastAPI, APIRouter, HTTPException, Query
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="Shiv Sampada Parking API")
api_router = APIRouter(prefix="/api")


# ---------- Models ----------
class VehicleBase(BaseModel):
    model_config = ConfigDict(extra="ignore")
    owner_name: str = Field(..., min_length=1, max_length=80)
    phone: str = Field(..., min_length=6, max_length=20)
    flat_number: str = Field(..., min_length=1, max_length=20)
    vehicle_number: str = Field(..., min_length=2, max_length=20)


class VehicleCreate(VehicleBase):
    pass


class VehicleUpdate(BaseModel):
    owner_name: Optional[str] = Field(None, min_length=1, max_length=80)
    phone: Optional[str] = Field(None, min_length=6, max_length=20)
    flat_number: Optional[str] = Field(None, min_length=1, max_length=20)
    vehicle_number: Optional[str] = Field(None, min_length=2, max_length=20)


class Vehicle(VehicleBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


def _normalize_plate(plate: str) -> str:
    return "".join(ch for ch in plate.upper() if ch.isalnum())


def _serialize(doc: dict) -> dict:
    doc.pop("_id", None)
    if isinstance(doc.get("created_at"), str):
        try:
            doc["created_at"] = datetime.fromisoformat(doc["created_at"])
        except ValueError:
            pass
    return doc


# ---------- Routes ----------
@api_router.get("/")
async def root():
    return {"message": "Shiv Sampada Parking API"}


@api_router.post("/vehicles", response_model=Vehicle, status_code=201)
async def create_vehicle(payload: VehicleCreate):
    normalized = _normalize_plate(payload.vehicle_number)
    if not normalized:
        raise HTTPException(status_code=400, detail="Invalid vehicle number")

    existing = await db.vehicles.find_one({"vehicle_number_normalized": normalized})
    if existing:
        raise HTTPException(status_code=409, detail="This vehicle number is already registered")

    vehicle = Vehicle(
        owner_name=payload.owner_name.strip(),
        phone=payload.phone.strip(),
        flat_number=payload.flat_number.strip().upper(),
        vehicle_number=payload.vehicle_number.strip().upper(),
    )
    doc = vehicle.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    doc["vehicle_number_normalized"] = normalized
    await db.vehicles.insert_one(doc)
    return vehicle


@api_router.get("/vehicles", response_model=List[Vehicle])
async def list_vehicles(search: Optional[str] = Query(None)):
    query = {}
    if search:
        normalized = _normalize_plate(search)
        if normalized:
            query["vehicle_number_normalized"] = {"$regex": normalized, "$options": "i"}

    cursor = db.vehicles.find(query, {"_id": 0, "vehicle_number_normalized": 0}).sort("created_at", -1)
    docs = await cursor.to_list(1000)
    return [Vehicle(**_serialize(d)) for d in docs]


@api_router.get("/vehicles/{vehicle_id}", response_model=Vehicle)
async def get_vehicle(vehicle_id: str):
    doc = await db.vehicles.find_one({"id": vehicle_id}, {"_id": 0, "vehicle_number_normalized": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return Vehicle(**_serialize(doc))


@api_router.put("/vehicles/{vehicle_id}", response_model=Vehicle)
async def update_vehicle(vehicle_id: str, payload: VehicleUpdate):
    existing = await db.vehicles.find_one({"id": vehicle_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    updates = {}
    if payload.owner_name is not None:
        updates["owner_name"] = payload.owner_name.strip()
    if payload.phone is not None:
        updates["phone"] = payload.phone.strip()
    if payload.flat_number is not None:
        updates["flat_number"] = payload.flat_number.strip().upper()
    if payload.vehicle_number is not None:
        new_num = payload.vehicle_number.strip().upper()
        new_norm = _normalize_plate(new_num)
        if not new_norm:
            raise HTTPException(status_code=400, detail="Invalid vehicle number")
        clash = await db.vehicles.find_one(
            {"vehicle_number_normalized": new_norm, "id": {"$ne": vehicle_id}}
        )
        if clash:
            raise HTTPException(status_code=409, detail="This vehicle number is already registered")
        updates["vehicle_number"] = new_num
        updates["vehicle_number_normalized"] = new_norm

    if updates:
        await db.vehicles.update_one({"id": vehicle_id}, {"$set": updates})

    doc = await db.vehicles.find_one({"id": vehicle_id}, {"_id": 0, "vehicle_number_normalized": 0})
    return Vehicle(**_serialize(doc))


@api_router.delete("/vehicles/{vehicle_id}", status_code=204)
async def delete_vehicle(vehicle_id: str):
    result = await db.vehicles.delete_one({"id": vehicle_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return None


@api_router.get("/stats")
async def stats():
    total = await db.vehicles.count_documents({})
    return {"total_vehicles": total}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
