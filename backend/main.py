from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client
import subprocess
import os
import shutil
import requests

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"], 
    allow_credentials=True,
    allow_methods=["*"], 
    allow_headers=["*"], 
)

SUPABASE_URL = "http://127.0.0.1:54321"
SUPABASE_KEY = "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH"
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

POTREE_CONVERTER_PATH = "./PotreeConverter/PotreeConverter.exe" 
TEMP_DIR = "./temp_processing"

job_statuses = {}

class ConvertRequest(BaseModel):
    project_id: str
    bucket_name: str     
    file_path: str    

def process_pointcloud(project_id: str, bucket_name: str, file_path: str):
    job_statuses[project_id] = {"status": "starting", "message": "Initializing process..."}
    
    file_name = file_path.split("/")[-1]
    input_path = os.path.join(TEMP_DIR, file_name)
    output_dir = os.path.join(TEMP_DIR, f"output_{project_id}")
    
    os.makedirs(TEMP_DIR, exist_ok=True)
    
    try:
        # ==========================================
        # 1. Download file
        # ==========================================
        job_statuses[project_id] = {"status": "downloading", "message": "Downloading .las file from Supabase..."}
        
        file_url = f"{SUPABASE_URL}/storage/v1/object/public/{bucket_name}/{file_path}"
        with requests.get(file_url, stream=True) as r:
            r.raise_for_status()
            with open(input_path, 'wb') as f:
                for chunk in r.iter_content(chunk_size=8192): 
                    f.write(chunk)

        # ==========================================
        # 2. PotreeConverter
        # ==========================================
        job_statuses[project_id] = {"status": "converting", "message": "Converting file to Potree Format (this might take a while)..."}
        command = [
            POTREE_CONVERTER_PATH,
            input_path,
            "-o", output_dir
        ]
        subprocess.run(command, check=True)

        # ==========================================
        # 3. Upload back to Supabase
        # ==========================================
        job_statuses[project_id] = {"status": "uploading", "message": "Uploading converted files back to Supabase..."}
        base_upload_path = f"converted/{project_id}"
        
        for root, _, files in os.walk(output_dir):
            for file in files:
                local_file_path = os.path.join(root, file)
                relative_path = os.path.relpath(local_file_path, output_dir)
                supabase_path = f"{base_upload_path}/{relative_path}".replace("\\", "/")
                
                with open(local_file_path, "rb") as f:
                    supabase.storage.from_(bucket_name).upload(
                        path=supabase_path,
                        file=f,
                        file_options={"upsert": "true"}
                    )
        
        try:
            print("Updating Database...")
            potree_metadata_url = f"{SUPABASE_URL}/storage/v1/object/public/{bucket_name}/{base_upload_path}/metadata.json"
            
            # อัปเดตตาราง
            supabase.table("project_point_clouds").update({
                "potree_url": potree_metadata_url,
                "processing_status": "completed"
            }).eq("project_id", project_id).execute()
            print("Database updated successfully!")
            
        except Exception as db_err:
            print(f"Database Update Error: {db_err}")
        
        # ==========================================
        # 4. Clear Temp & Finish
        # ==========================================
        shutil.rmtree(output_dir)
        os.remove(input_path)
        
        job_statuses[project_id] = {
            "status": "completed", 
            "message": "Conversion and upload successful!",
            "result_path": base_upload_path
        }

    except Exception as e:
        job_statuses[project_id] = {"status": "error", "message": f"Error occurred: {str(e)}"}
        print(f"error: {e}")

@app.post("/api/convert-pointcloud")
async def start_conversion(request: ConvertRequest, background_tasks: BackgroundTasks):
    if not os.path.exists(POTREE_CONVERTER_PATH):
        raise HTTPException(status_code=500, detail="PotreeConverter.exe not found.")
    
    job_statuses[request.project_id] = {"status": "pending", "message": "Job added to queue"}
    
    background_tasks.add_task(process_pointcloud, request.project_id, request.bucket_name, request.file_path)
    
    return {
        "status": "processing", 
        "project_id": request.project_id,
        "message": f"ได้รับคำสั่งแปลงไฟล์ {request.file_path} แล้ว ระบบกำลังทำงานอยู่เบื้องหลัง"
    }

@app.get("/api/status/{project_id}")
async def get_conversion_status(project_id: str):
    status_info = job_statuses.get(project_id)
    
    if not status_info:
        raise HTTPException(status_code=404, detail="Project ID not found or no conversion task started.")
        
    return {
        "project_id": project_id,
        **status_info
    }