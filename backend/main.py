from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client
from config import settings
import subprocess
import os
import shutil
import requests
import numpy as np
import laspy
import open3d as o3d

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL], 
    allow_credentials=True,
    allow_methods=["*"], 
    allow_headers=["*"], 
)

SUPABASE_URL = settings.SUPABASE_URL
SUPABASE_KEY = settings.SUPABASE_KEY
POTREE_CONVERTER_PATH = settings.POTREE_CONVERTER_PATH
TEMP_DIR = settings.TEMP_DIR

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

job_statuses = {}

class ConvertRequest(BaseModel):
    project_id: str
    bucket_name: str     
    file_path: str    

slice_job_statuses = {}

class SliceRequest(BaseModel):
    project_id: str
    bucket_name: str     
    file_path: str #.las
    image_id: str
    user_id: str
    center_x: float
    center_y: float
    center_z: float
    radius: float = 50.0
    
def process_pointcloud(project_id: str, bucket_name: str, file_path: str):
    def update_status(status: str, message: str, progress: int):
        job_statuses[project_id] = {"status": status, "message": message, "progress": progress}
        try:
            supabase.table("project_point_clouds").update({
                "processing_status": status,
                "progress": progress
            }).eq("project_id", project_id).execute()
        except Exception as e:
            print(f"Update status to DB failed: {e}")

    file_name = file_path.split("/")[-1]
    input_path = os.path.join(TEMP_DIR, file_name)
    output_dir = os.path.join(TEMP_DIR, f"output_{project_id}")
    os.makedirs(TEMP_DIR, exist_ok=True)

    try:
        # ==========================================
        # 1. Download file
        # ==========================================
        update_status("downloading", "Downloading .las file...", 10)
        
        file_url = f"{SUPABASE_URL}/storage/v1/object/public/{bucket_name}/{file_path}"
        with requests.get(file_url, stream=True) as r:
            r.raise_for_status()
            with open(input_path, 'wb') as f:
                for chunk in r.iter_content(chunk_size=8192):
                    f.write(chunk)

        # ดึง Metadata จากไฟล์ที่โหลดมา
        update_status("analyzing", "Extracting metadata...", 20)
        las = laspy.read(input_path)
        num_points = int(las.header.point_count)
        file_format = file_name.split('.')[-1].upper()
        size_bytes = os.path.getsize(input_path)

        # ==========================================
        # 2. PotreeConverter
        # ==========================================
        update_status("converting", "Converting to Potree format...", 40)
        
        command = [POTREE_CONVERTER_PATH, input_path, "-o", output_dir]
        subprocess.run(command, check=True)

        # ==========================================
        # 3. Upload back to Supabase
        # ==========================================
        update_status("uploading", "Uploading converted files...", 70)
        base_upload_path = f"converted/{project_id}"
        
        # นับไฟล์ทั้งหมดเพื่อทำ progress แบบละเอียด (Optional)
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

        # ==========================================
        # 4. Final Database Update
        # ==========================================
        update_status("finishing", "Finalizing database...", 90)
        
        potree_metadata_url = f"{SUPABASE_URL}/storage/v1/object/public/{bucket_name}/{base_upload_path}/metadata.json" 

        db_update = (
            supabase.table("project_point_clouds")
            .update({
                "num_points": num_points,
                "format": file_format,
                "size_bytes": size_bytes,
                "potree_url": potree_metadata_url,
                "processing_status": "completed",
                "progress": 100
            })
            .eq("project_id", project_id)
            .execute()
        )
        
        print(f"Database updated: {db_update}")

        # ==========================================
        # 5. Clear Temp & Finish
        # ==========================================
        if os.path.exists(output_dir): shutil.rmtree(output_dir)
        if os.path.exists(input_path): os.remove(input_path)
        
        job_statuses[project_id] = {
            "status": "completed", 
            "message": "All done!",
            "result_path": base_upload_path
        }

    except Exception as e:
        update_status("error", str(e), 0)
        print(f"Error occurred: {e}")

def process_slice_pointcloud(request: SliceRequest):
    project_id = request.project_id
    slice_job_statuses[project_id] = {"status": "starting", "message": "Initializing slicing process..."}
    
    file_name = request.file_path.split("/")[-1]
    input_path = os.path.join(TEMP_DIR, f"slice_input_{file_name}")
    output_ply_path = os.path.join(TEMP_DIR, f"slice_{project_id}.ply")
    
    os.makedirs(TEMP_DIR, exist_ok=True)
    
    try:
        slice_job_statuses[project_id] = {"status": "downloading", "message": "Downloading original file..."}
        file_url = f"{SUPABASE_URL}/storage/v1/object/public/{request.bucket_name}/{request.file_path}"
        with requests.get(file_url, stream=True) as r:
            r.raise_for_status()
            with open(input_path, 'wb') as f:
                for chunk in r.iter_content(chunk_size=8192): 
                    f.write(chunk)

        slice_job_statuses[project_id] = {"status": "processing", "message": "Slicing points within radius..."}
        
        las = laspy.read(input_path)
        points = np.vstack((las.x, las.y, las.z)).transpose()
        
        #center = np.array([request.center_x, request.center_y, request.center_z])
        center = (points.max(axis=0) + points.min(axis=0)) / 2.0
        print(f"--- DEBUG Slicing ---")
        print(f"LAS Min Bounds: {points.min(axis=0)}")
        print(f"LAS Max Bounds: {points.max(axis=0)}")
        print(f"Camera Center: {center}")
        print(f"---------------------")
        
        distances = np.linalg.norm(points - center, axis=1)
        
        mask = distances <= request.radius
        sliced_points = points[mask]
        
        if len(sliced_points) == 0:
             raise ValueError(f"ไม่พบจุด Point Cloud ในรัศมี {request.radius} เมตร! โปรดตรวจสอบว่าพิกัดกล้องตรงกับระบบพิกัดของไฟล์ .las หรือไม่")
        
        try:
            colors = np.vstack((las.red, las.green, las.blue)).transpose() / 65535.0
            sliced_colors = colors[mask]
        except AttributeError:
            sliced_colors = np.ones_like(sliced_points) * 0.5 
            
        pcd = o3d.geometry.PointCloud()
        pcd.points = o3d.utility.Vector3dVector(sliced_points)
        pcd.colors = o3d.utility.Vector3dVector(sliced_colors)
        
        downpcd = pcd.voxel_down_sample(voxel_size=0.1) 
        
        success = o3d.io.write_point_cloud(output_ply_path, downpcd)
        if not success:
             raise RuntimeError("Open3D ไม่สามารถบันทึกไฟล์ .ply ได้ (อาจเกิดจากพาธไฟล์ไม่ถูกต้อง)")
         
        o3d.io.write_point_cloud(output_ply_path, downpcd)
        
        slice_job_statuses[project_id] = {"status": "uploading", "message": "Uploading slice to Supabase..."}
        supabase_path = f"calibration/{project_id}/slice_50m.ply"
        
        with open(output_ply_path, "rb") as f:
            supabase.storage.from_(request.bucket_name).upload(
                path=supabase_path,
                file=f,
                file_options={"upsert": "true"}
            )
            
        ply_public_url = f"{SUPABASE_URL}/storage/v1/object/public/{request.bucket_name}/{supabase_path}"
        
        try:
            slice_job_statuses[project_id]["message"] = "Updating database..."
            
            calibration_data = {
                "project_id": request.project_id,
                "reference_image_id": request.image_id,
                "ply_file_url": ply_public_url,
                "user_id": request.user_id,
                "num_points": len(downpcd.points)
            }

            response = supabase.table("project_calibrations").upsert(calibration_data).execute()   
            
            print(f"Database updated successfully: {response}")
        except Exception as db_err:
            print(f"Database Update Error: {db_err}")
            
        os.remove(input_path)
        os.remove(output_ply_path)
        
        slice_job_statuses[project_id] = {
            "status": "completed", 
            "message": "Slicing successful!",
            "ply_url": ply_public_url,
            "points_count": len(downpcd.points)
        }

    except Exception as e:
        slice_job_statuses[project_id] = {"status": "error", "message": f"Error: {str(e)}"}
        print(f"Slice Error: {e}")
         
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

@app.post("/api/slice-pointcloud")
async def start_slicing(request: SliceRequest, background_tasks: BackgroundTasks):
    slice_job_statuses[request.project_id] = {"status": "pending", "message": "Slicing job added to queue"}
    background_tasks.add_task(process_slice_pointcloud, request)
    return {
        "status": "processing",
        "project_id": request.project_id,
        "message": "เริ่มตัด Point Cloud เบื้องหลังแล้ว"
    }

@app.get("/api/slice-status/{project_id}")
async def get_slice_status(project_id: str):
    status_info = slice_job_statuses.get(project_id)
    if not status_info:
        raise HTTPException(status_code=404, detail="No slice task found.")
    return {"project_id": project_id, **status_info}