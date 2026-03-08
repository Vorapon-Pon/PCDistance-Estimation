import os
from dotenv import load_dotenv
from sqlmodel import SQLModel, create_engine, Session

load_dotenv()   

database_url = os.getenv("DATABASE_URL")
if not database_url:
    raise ValueError(" DATABASE_URL not found in environment variables")

engine = create_engine(database_url)

def get_session():
    with Session(engine) as session:
        yield session