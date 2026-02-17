from typing import Optional, List
from sqlmodel import SQLModel, Field, Relationship

class Users(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(index=True, unique=True)
    username: Optional[str] = None
    