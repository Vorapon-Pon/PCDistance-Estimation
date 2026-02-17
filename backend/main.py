from fastapi import FastAPI, Depends, HTTPException
from passlib.context import CryptContext
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select
from auth_deps import get_current_user
from models import Users
from database import engine

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_session():
    with Session(engine) as session:
        yield session

@app.get("/")
def read_root():
    return {"message": "LiDAR API is running!"}

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

class LoginRequest(BaseModel):
    email: str
    password: str
    
class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str

@app.get("/my-profile")
def read_profile(user_id: str = Depends(get_current_user)):
    user = session.get(User, user_id)
    return user