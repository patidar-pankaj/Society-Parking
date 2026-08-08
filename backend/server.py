from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import logging
import uuid
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from typing import List, Optional

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Query
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, ConfigDict


# ---------- Config ----------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGORITHM = "HS256"
TOKEN_TTL_DAYS = 30
ADMIN_FLAT = os.environ.get('ADMIN_FLAT', 'ADMIN')
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'admin123')

# 60 valid flats: floors 1-5, units 01-12
VALID_FLATS = {f"{floor}{unit:02d}" for floor in range(1, 6) for unit in range(1, 13)}

MAX_FAILED_ATTEMPTS = 5
LOCKOUT_MINUTES = 15
MAX_PHOTO_BYTES = 700_000  # ~700 KB after client compression


# ---------- App ----------
app = FastAPI(title="Shiv Sampada Parking API")
api_router = APIRouter(prefix="/api")
auth_router = APIRouter(prefix="/api/auth", tags=["auth"])


# ---------- Helpers ----------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user_id: str, flat_number: str, is_admin: bool) -> str:
    payload = {
        "sub": user_id,
        "flat": flat_number,
        "adm": is_admin,
        "exp": datetime.now(timezone.utc) + timedelta(days=TOKEN_TTL_DAYS),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def _normalize_plate(plate: str) -> str:
    return "".join(ch for ch in plate.upper() if ch.isalnum())


def _normalize_flat(flat: str) -> str:
    return (flat or "").strip().upper()


def _user_public(u: dict) -> dict:
    return {
        "id": u["id"],
        "flat_number": u["flat_number"],
        "owner_name": u.get("owner_name", ""),
        "phone": u.get("phone", ""),
        "is_admin": bool(u.get("is_admin", False)),
    }


async def get_current_user(request: Request) -> dict:
    auth_header = request.headers.get("Authorization", "")
    token = auth_header[7:] if auth_header.startswith("Bearer ") else None
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expired, please sign in again")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = await db.users.find_one({"id": payload["sub"]})
    if not user:
        raise HTTPException(status_code=401, detail="User no longer exists")
    return user


async def get_current_user_optional(request: Request) -> Optional[dict]:
    try:
        return await get_current_user(request)
    except HTTPException:
        return None


# ---------- Models ----------
class SignupPayload(BaseModel):
    model_config = ConfigDict(extra="ignore")
    flat_number: str = Field(..., min_length=1, max_length=10)
    vehicle_number: str = Field(..., min_length=2, max_length=20)
    owner_name: str = Field(..., min_length=1, max_length=80)
    phone: str = Field(..., min_length=6, max_length=20)
    password: str = Field(..., min_length=6, max_length=100)
    confirm_password: str = Field(..., min_length=6, max_length=100)


class LoginPayload(BaseModel):
    flat_number: str
    password: str


class VehicleCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    owner_name: str = Field(..., min_length=1, max_length=80)
    phone: str = Field(..., min_length=6, max_length=20)
    flat_number: str = Field(..., min_length=1, max_length=10)
    vehicle_number: str = Field(..., min_length=2, max_length=20)
    is_guest: bool = False
    photo: Optional[str] = None


class VehicleUpdate(BaseModel):
    owner_name: Optional[str] = None
    phone: Optional[str] = None
    flat_number: Optional[str] = None
    vehicle_number: Optional[str] = None
    photo: Optional[str] = None  # empty string clears the photo


class Vehicle(BaseModel):
    id: str
    owner_name: str
    phone: str
    flat_number: str
    vehicle_number: str
    is_guest: bool = False
    user_id: Optional[str] = None
    photo: Optional[str] = None
    created_at: datetime


def _validate_photo(photo: Optional[str]) -> Optional[str]:
    if photo is None or photo == "":
        return photo
    if not photo.startswith("data:image/"):
        raise HTTPException(status_code=400, detail="Photo must be an image data URL")
    if len(photo) > MAX_PHOTO_BYTES:
        raise HTTPException(status_code=400, detail="Photo too large; please pick a smaller image")
    return photo


def _serialize_vehicle(doc: dict) -> dict:
    doc.pop("_id", None)
    doc.pop("vehicle_number_normalized", None)
    if isinstance(doc.get("created_at"), str):
        try:
            doc["created_at"] = datetime.fromisoformat(doc["created_at"])
        except ValueError:
            pass
    return doc


# ---------- Auth endpoints ----------
@auth_router.post("/signup", status_code=201)
async def signup(payload: SignupPayload):
    flat = _normalize_flat(payload.flat_number)
    if flat not in VALID_FLATS:
        raise HTTPException(
            status_code=400,
            detail="Flat number must be between 101-112, 201-212, ..., 501-512",
        )
    if payload.password != payload.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")

    existing_user = await db.users.find_one({"flat_number": flat})
    if existing_user:
        raise HTTPException(
            status_code=409,
            detail=f"Flat {flat} is already registered. Please sign in instead.",
        )

    vplate = _normalize_plate(payload.vehicle_number)
    if not vplate:
        raise HTTPException(status_code=400, detail="Invalid vehicle number")
    dup = await db.vehicles.find_one({"vehicle_number_normalized": vplate})
    if dup:
        raise HTTPException(status_code=409, detail="This vehicle number is already registered")

    user_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    user_doc = {
        "id": user_id,
        "flat_number": flat,
        "owner_name": payload.owner_name.strip(),
        "phone": payload.phone.strip(),
        "password_hash": hash_password(payload.password),
        "is_admin": False,
        "created_at": now.isoformat(),
    }
    await db.users.insert_one(user_doc)

    vehicle_id = str(uuid.uuid4())
    vehicle_doc = {
        "id": vehicle_id,
        "owner_name": payload.owner_name.strip(),
        "phone": payload.phone.strip(),
        "flat_number": flat,
        "vehicle_number": payload.vehicle_number.strip().upper(),
        "vehicle_number_normalized": vplate,
        "is_guest": False,
        "user_id": user_id,
        "created_at": now.isoformat(),
    }
    await db.vehicles.insert_one(vehicle_doc)

    token = create_access_token(user_id, flat, False)
    return {"token": token, "user": _user_public(user_doc)}


@auth_router.post("/login")
async def login(payload: LoginPayload, request: Request):
    flat = _normalize_flat(payload.flat_number)

    # brute force lockout
    ip = request.client.host if request.client else "unknown"
    identifier = f"{ip}:{flat}"
    attempt = await db.login_attempts.find_one({"identifier": identifier})
    now = datetime.now(timezone.utc)
    if attempt and attempt.get("locked_until"):
        locked_until = attempt["locked_until"]
        if isinstance(locked_until, str):
            locked_until = datetime.fromisoformat(locked_until)
        if locked_until > now:
            raise HTTPException(status_code=429, detail="Too many attempts. Try again later.")

    user = await db.users.find_one({"flat_number": flat})
    if not user or not verify_password(payload.password, user["password_hash"]):
        count = (attempt.get("count", 0) if attempt else 0) + 1
        update = {"identifier": identifier, "count": count, "updated_at": now.isoformat()}
        if count >= MAX_FAILED_ATTEMPTS:
            update["locked_until"] = (now + timedelta(minutes=LOCKOUT_MINUTES)).isoformat()
            update["count"] = 0
        await db.login_attempts.update_one(
            {"identifier": identifier}, {"$set": update}, upsert=True
        )
        raise HTTPException(status_code=401, detail="Invalid flat number or password")

    await db.login_attempts.delete_one({"identifier": identifier})
    token = create_access_token(user["id"], user["flat_number"], bool(user.get("is_admin", False)))
    return {"token": token, "user": _user_public(user)}


@auth_router.get("/me")
async def me(user=Depends(get_current_user)):
    return _user_public(user)


# ---------- Vehicle endpoints (public list, protected write) ----------
@api_router.get("/")
async def root():
    return {"message": "Shiv Sampada Parking API"}


@api_router.get("/vehicles", response_model=List[Vehicle])
async def list_vehicles(search: Optional[str] = Query(None)):
    query = {}
    if search:
        normalized = _normalize_plate(search)
        if normalized:
            query["vehicle_number_normalized"] = {"$regex": normalized, "$options": "i"}
    docs = await db.vehicles.find(query).sort("created_at", -1).to_list(1000)
    return [Vehicle(**_serialize_vehicle(d)) for d in docs]


@api_router.get("/vehicles/{vehicle_id}", response_model=Vehicle)
async def get_vehicle(vehicle_id: str):
    doc = await db.vehicles.find_one({"id": vehicle_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return Vehicle(**_serialize_vehicle(doc))


@api_router.post("/vehicles", response_model=Vehicle, status_code=201)
async def create_vehicle(payload: VehicleCreate, user=Depends(get_current_user)):
    vplate = _normalize_plate(payload.vehicle_number)
    if not vplate:
        raise HTTPException(status_code=400, detail="Invalid vehicle number")

    dup = await db.vehicles.find_one({"vehicle_number_normalized": vplate})
    if dup:
        raise HTTPException(status_code=409, detail="This vehicle number is already registered")

    # For member vehicles, flat_number must be user's own flat (unless admin).
    flat = _normalize_flat(payload.flat_number)
    if not payload.is_guest and not user.get("is_admin"):
        if flat != user["flat_number"]:
            raise HTTPException(
                status_code=403,
                detail="You can only add vehicles for your own flat",
            )

    now = datetime.now(timezone.utc)
    doc = {
        "id": str(uuid.uuid4()),
        "owner_name": payload.owner_name.strip(),
        "phone": payload.phone.strip(),
        "flat_number": flat,
        "vehicle_number": payload.vehicle_number.strip().upper(),
        "vehicle_number_normalized": vplate,
        "is_guest": bool(payload.is_guest),
        "user_id": user["id"],
        "photo": _validate_photo(payload.photo),
        "created_at": now.isoformat(),
    }
    await db.vehicles.insert_one(doc)
    return Vehicle(**_serialize_vehicle(dict(doc)))


@api_router.put("/vehicles/{vehicle_id}", response_model=Vehicle)
async def update_vehicle(vehicle_id: str, payload: VehicleUpdate, user=Depends(get_current_user)):
    existing = await db.vehicles.find_one({"id": vehicle_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    is_owner = existing.get("user_id") == user["id"]
    if not is_owner and not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="You cannot edit this vehicle")

    updates = {}
    if payload.owner_name is not None:
        updates["owner_name"] = payload.owner_name.strip()
    if payload.phone is not None:
        updates["phone"] = payload.phone.strip()
    if payload.flat_number is not None:
        updates["flat_number"] = _normalize_flat(payload.flat_number)
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
    if payload.photo is not None:
        updates["photo"] = _validate_photo(payload.photo) if payload.photo else None

    if updates:
        await db.vehicles.update_one({"id": vehicle_id}, {"$set": updates})

    doc = await db.vehicles.find_one({"id": vehicle_id})
    return Vehicle(**_serialize_vehicle(doc))


@api_router.delete("/vehicles/{vehicle_id}", status_code=204)
async def delete_vehicle(vehicle_id: str, user=Depends(get_current_user)):
    existing = await db.vehicles.find_one({"id": vehicle_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    is_owner = existing.get("user_id") == user["id"]
    if not is_owner and not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="You cannot delete this vehicle")
    await db.vehicles.delete_one({"id": vehicle_id})
    return None


@api_router.get("/stats")
async def stats():
    total_vehicles = await db.vehicles.count_documents({})
    total_users = await db.users.count_documents({})
    return {"total_vehicles": total_vehicles, "total_users": total_users}


@api_router.get("/config/valid-flats")
async def valid_flats():
    return {"flats": sorted(VALID_FLATS)}


# ---------- Admin endpoints ----------
def _require_admin(user: dict):
    if not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")


@api_router.get("/admin/users")
async def admin_list_users(user=Depends(get_current_user)):
    _require_admin(user)
    docs = await db.users.find({}, {"_id": 0, "password_hash": 0}).sort("flat_number", 1).to_list(200)
    # attach vehicle count per user
    result = []
    for u in docs:
        if u.get("flat_number") == ADMIN_FLAT:
            continue
        count = await db.vehicles.count_documents({"user_id": u["id"]})
        u["vehicle_count"] = count
        result.append(u)
    return result


@api_router.delete("/admin/users/{user_id}", status_code=204)
async def admin_reset_flat(user_id: str, user=Depends(get_current_user)):
    """Reset a flat: delete the resident and all their vehicles.
    The flat can then be re-registered by a new owner via signup."""
    _require_admin(user)
    target = await db.users.find_one({"id": user_id})
    if not target:
        raise HTTPException(status_code=404, detail="Resident not found")
    if target.get("flat_number") == ADMIN_FLAT:
        raise HTTPException(status_code=400, detail="Cannot reset the admin account")
    await db.vehicles.delete_many({"user_id": user_id})
    await db.users.delete_one({"id": user_id})
    return None


# ---------- Startup / seed ----------
@app.on_event("startup")
async def on_startup():
    await db.users.create_index("flat_number", unique=True)
    await db.users.create_index("id", unique=True)
    await db.vehicles.create_index("vehicle_number_normalized", unique=True)
    await db.vehicles.create_index("id", unique=True)
    await db.login_attempts.create_index("identifier")

    admin = await db.users.find_one({"flat_number": ADMIN_FLAT})
    if admin is None:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "flat_number": ADMIN_FLAT,
            "owner_name": "Society Admin",
            "phone": "",
            "password_hash": hash_password(ADMIN_PASSWORD),
            "is_admin": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        logging.info("Seeded admin user %s", ADMIN_FLAT)
    elif not verify_password(ADMIN_PASSWORD, admin["password_hash"]):
        await db.users.update_one(
            {"flat_number": ADMIN_FLAT},
            {"$set": {"password_hash": hash_password(ADMIN_PASSWORD), "is_admin": True}},
        )
        logging.info("Rotated admin password for %s", ADMIN_FLAT)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()


# ---------- Wire it up ----------
app.include_router(auth_router)
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
