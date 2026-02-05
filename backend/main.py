from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

class DetectionResult(BaseModel):
    id: int
    class_name: str
    distance: float
    
@app.get("/")
def read_root():
    return {"message": "API is running"}

@app.get("/results", response_model=list[DetectionResult])
def get_results():
    return [
        {"id": 1, "class_name": "lightpole", "distance": 3.5},
        {"id": 2, "class_name": "electricpole", "distance": 5.2},
    ]