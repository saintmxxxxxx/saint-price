from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException, status, Header
from fastapi.middleware.cors import CORSMiddleware
import httpx
import bcrypt
import jwt
from datetime import datetime, timedelta
from pydantic import BaseModel
from typing import List, Optional
import time

# --- Supabase Config ---
SUPABASE_URL = "https://xfrjklqahgpskjzvcdsw.supabase.co"
SUPABASE_KEY = "sb_publishable_VkyN5YaPuPTLUVDOKO5skA_LxR9-BFT"
SUPABASE_HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}

# --- JWT Config ---
SECRET_KEY = "SUPER_SECRET_LUXURY_GOLD_KEY_2025"
ALGORITHM = "HS256"

http_client: httpx.AsyncClient

@asynccontextmanager
async def lifespan(app: FastAPI):
    global http_client
    http_client = httpx.AsyncClient()
    print("Cliente HTTP global iniciado.")
    yield
    await http_client.aclose()
    print("Cliente HTTP global cerrado.")

app = FastAPI(lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Pydantic Models ---
class UserCreate(BaseModel):
    username: str
    password: str

class LoginRequest(BaseModel):
    username: str
    password: str

class TransactionCreate(BaseModel):
    type: str
    amount: float
    category: str
    description: str

# --- Helpers ---
def create_access_token(username: str) -> str:
    expire = datetime.utcnow() + timedelta(days=7)
    payload = {"sub": username, "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def get_current_username(authorization: Optional[str] = Header(None)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token requerido")
    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        if not username:
            raise HTTPException(status_code=401, detail="Token invalido")
        return username
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except:
        raise HTTPException(status_code=401, detail="Token invalido")

async def get_user_by_username(username: str) -> Optional[dict]:
    res = await http_client.get(
        f"{SUPABASE_URL}/rest/v1/users",
        headers=SUPABASE_HEADERS,
        params={"username": f"eq.{username}", "select": "id,username,password_hash"}
    )
    data = res.json()
    return data[0] if data else None

async def get_user_id(username: str) -> int:
    user = await get_user_by_username(username)
    if not user:
        raise HTTPException(status_code=401, detail="Usuario no encontrado")
    return user["id"]

# --- Endpoints ---
@app.post("/register", status_code=201)
async def register(user: UserCreate):
    existing = await get_user_by_username(user.username)
    if existing:
        raise HTTPException(status_code=400, detail="El usuario ya existe")

    hashed = bcrypt.hashpw(user.password.encode(), bcrypt.gensalt()).decode()

    res = await http_client.post(
        f"{SUPABASE_URL}/rest/v1/users",
        headers=SUPABASE_HEADERS,
        json={"username": user.username, "password_hash": hashed}
    )
    if res.status_code not in (200, 201):
        raise HTTPException(status_code=500, detail="Error al crear usuario")

    return {"msg": "Usuario creado exitosamente"}

@app.post("/login")
async def login(credentials: LoginRequest):
    user = await get_user_by_username(credentials.username)
    if not user:
        raise HTTPException(status_code=400, detail="Usuario o contraseña incorrectos")
    if not bcrypt.checkpw(credentials.password.encode(), user["password_hash"].encode()):
        raise HTTPException(status_code=400, detail="Usuario o contraseña incorrectos")

    token = create_access_token(credentials.username)
    return {"access_token": token, "token_type": "bearer"}

@app.get("/api/transactions")
async def get_transactions(username: str = Depends(get_current_username)):
    user_id = await get_user_id(username)
    res = await http_client.get(
        f"{SUPABASE_URL}/rest/v1/transactions",
        headers=SUPABASE_HEADERS,
        params={"user_id": f"eq.{user_id}", "order": "txn_time.desc"}
    )
    if res.status_code != 200:
        raise HTTPException(status_code=500, detail="Error al obtener transacciones de la nube")
    return res.json()

@app.post("/api/transactions", status_code=201)
async def add_transaction(tx: TransactionCreate, username: str = Depends(get_current_username)):
    user_id = await get_user_id(username)
    payload = {
        "user_id": user_id,
        "type": tx.type,
        "amount": tx.amount,
        "category": tx.category,
        "memo": tx.description,   # Mapeado a 'description' del modelo pydantic
        "txn_time": time.time() * 1000  # Mapeado a 'timestamp' del modelo pydantic
    }
    res = await http_client.post(
        f"{SUPABASE_URL}/rest/v1/transactions",
        headers=SUPABASE_HEADERS,
        json=payload
    )
    if res.status_code not in (200, 201):
        raise HTTPException(status_code=500, detail="Error guardando transaccion en la nube")
        
    data = res.json()
    return data[0] if isinstance(data, list) and data else data

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8008, reload=True)
