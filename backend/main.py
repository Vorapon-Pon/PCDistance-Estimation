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
import time
import cv2
from ultralytics import YOLO
from rotation_matrix import get_rotation_matrix
from projection import get_projected_points
from supabase import create_client, Client
from supabase.client import ClientOptions
from typing import List

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

supabase: Client = create_client(
    supabase_url=settings.SUPABASE_URL,
    supabase_key=settings.SUPABASE_KEY,
    options=ClientOptions(postgrest_client_timeout=1800) # Timeout 30 min
)

MODEL_PATH = './model/best.pt'
if os.path.exists(MODEL_PATH):
    yolo_model = YOLO(MODEL_PATH)
else:
    print(f"Warning: YOLO model not found at {MODEL_PATH}")
    
detection_job_statuses = {}

class DetectionRequest(BaseModel):
    project_id: str
    image_id: List[str]
    bucket_name: str = "project_files"

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
        update_status("processing", "Downloading .las file...", 10)
        
        file_url = f"{SUPABASE_URL}/storage/v1/object/public/{bucket_name}/{file_path}"
        with requests.get(file_url, stream=True, timeout=60) as r:
            r.raise_for_status()
            with open(input_path, 'wb') as f:
                for chunk in r.iter_content(chunk_size=1024 * 1024):
                    if chunk:
                        f.write(chunk)

        # ดึง Metadata จากไฟล์ที่โหลดมา
        update_status("processing", "Extracting metadata...", 20)
        with laspy.open(input_path) as las_file:
            num_points = int(las_file.header.point_count)
            
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
        base_upload_path = f"{project_id}/potree"
        
        all_files = []
        for root, _, files in os.walk(output_dir):
            for file in files:
                all_files.append(os.path.join(root, file))
        
        total_files = len(all_files)
        print(f"Total files to upload: {total_files}")

        for i, local_file_path in enumerate(all_files, 1):
            relative_path = os.path.relpath(local_file_path, output_dir)
            supabase_path = f"{base_upload_path}/{relative_path}".replace("\\", "/")
            
            upload_url = f"{SUPABASE_URL}/storage/v1/object/{bucket_name}/{supabase_path}"
            
            headers = {
                "Authorization": f"Bearer {SUPABASE_KEY}",
                "apikey": SUPABASE_KEY,
                # จำลอง file_options={"upsert": "true"}
                "x-upsert": "true" 
            }
            
            max_retries = 3
            for attempt in range(max_retries):
                try:
                    with open(local_file_path, "rb") as f:
                        response = requests.post(
                                upload_url, 
                                headers=headers, 
                                data=f, 
                                timeout=None 
                            )
                        response.raise_for_status()
                    break # อัปโหลดสำเร็จ ให้ออกจากลูป retry
                except Exception as upload_err:
                    if attempt == max_retries - 1:
                        raise Exception(f"Failed to upload {relative_path} after 3 attempts: {upload_err}")
                    print(f"Upload timeout/error for {relative_path}. Retrying ({attempt+1}/{max_retries})...")
                    time.sleep(2)
            
            # อัปเดต % ทุกๆ การอัปโหลด 50 ไฟล์ (ไม่ให้อัปเดตถี่เกินไป DB จะพัง)
            if i % 50 == 0 or i == total_files:
                upload_progress = 70 + int((i / total_files) * 20) # วิ่งจาก 70% -> 90%
                update_status("uploading", f"Uploading... {i}/{total_files} files", upload_progress)
                print(f"Uploaded {i}/{total_files}")

        # ==========================================
        # 4. Final Database Update
        # ==========================================
        update_status("completed", "Finalizing database...", 90)
        
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
        update_status("failed", str(e), 0)
        print(f"Error occurred: {e}")
        if os.path.exists(output_dir): shutil.rmtree(output_dir)
        if os.path.exists(input_path): os.remove(input_path)

def process_slice_pointcloud(request: SliceRequest):
    project_id = request.project_id
    slice_job_statuses[project_id] = {"status": "pending", "message": "Initializing slicing process..."}
    
    file_name = request.file_path.split("/")[-1]
    input_path = os.path.join(TEMP_DIR, f"slice_input_{file_name}")
    output_ply_path = os.path.join(TEMP_DIR, f"slice_{project_id}.ply")
    
    os.makedirs(TEMP_DIR, exist_ok=True)
    
    try:
        slice_job_statuses[project_id] = {"status": "processing", "message": "Downloading original file..."}
        file_url = f"{SUPABASE_URL}/storage/v1/object/public/{request.bucket_name}/{request.file_path}"
        with requests.get(file_url, stream=True) as r:
            r.raise_for_status()
            with open(input_path, 'wb') as f:
                for chunk in r.iter_content(chunk_size=8192): 
                    f.write(chunk)

        slice_job_statuses[project_id] = {"status": "processing", "message": "Slicing points within radius..."}
        
        las = laspy.read(input_path)
        points = np.vstack((las.x, las.y, las.z)).transpose()
        
        center = np.array([request.center_x, request.center_y, request.center_z])
        #center = (points.max(axis=0) + points.min(axis=0)) / 2.0
        print(f"--- DEBUG Slicing ---")
        print(f"LAS Min Bounds: {points.min(axis=0)}")
        print(f"LAS Max Bounds: {points.max(axis=0)}")
        print(f"Camera Center: {center}")
        print(f"---------------------")
        
        distances = np.linalg.norm(points - center, axis=1)
        
        mask = distances <= request.radius
        sliced_points = points[mask]
        
        sliced_points_centered = sliced_points - center
        
        if len(sliced_points) == 0:
             raise ValueError(f"ไม่พบจุด Point Cloud ในรัศมี {request.radius} เมตร! โปรดตรวจสอบว่าพิกัดกล้องตรงกับระบบพิกัดของไฟล์ .las หรือไม่")
        
        try:
            colors = np.vstack((las.red, las.green, las.blue)).transpose() / 65535.0
            sliced_colors = colors[mask]
        except AttributeError:
            sliced_colors = np.ones_like(sliced_points) * 0.5 
            
        pcd = o3d.geometry.PointCloud()
        pcd.points = o3d.utility.Vector3dVector(sliced_points_centered)
        pcd.colors = o3d.utility.Vector3dVector(sliced_colors)
        
        downpcd = pcd.voxel_down_sample(voxel_size=0.1) 
        
        success = o3d.io.write_point_cloud(output_ply_path, downpcd)
        if not success:
             raise RuntimeError("Open3D ไม่สามารถบันทึกไฟล์ .ply ได้ (อาจเกิดจากพาธไฟล์ไม่ถูกต้อง)")
         
        o3d.io.write_point_cloud(output_ply_path, downpcd)
        
        slice_job_statuses[project_id] = {"status": "processing", "message": "Uploading slice to Supabase..."}
        supabase_path = f"{project_id}/calibration/slice_{int(request.radius)}m.ply"
        
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
        slice_job_statuses[project_id] = {"status": "failed", "message": f"Error: {str(e)}"}
        print(f"Slice Error: {e}")

def process_detection(request: DetectionRequest):

    project_id = request.project_id

    def update_status(image_id: str, status: str, message: str, objects_count: int = 0):
        detection_job_statuses[image_id] = {
            "status": status,
            "message": message,
            "objects_count": objects_count
        }
        try:
            supabase.table("project_images").update({
                "detection_status": status,
                "detection_message": message
            }).eq("id", image_id).execute()
        except Exception as db_err:
            print(f"Failed to update status in DB: {db_err}")

    try:
        # ==========================================
        # 1. โหลด Point Cloud แค่ครั้งเดียว
        # ==========================================

        print("Fetching Point Cloud info...")

        pc_res = supabase.table("project_point_clouds") \
            .select("storage_path") \
            .eq("project_id", project_id) \
            .single() \
            .execute()

        if not pc_res.data:
            raise ValueError("Point Cloud (.las) not found for this project")

        las_storage_path = pc_res.data["storage_path"]

        las_temp_path = os.path.join(TEMP_DIR, f"temp_{project_id}.las")

        print("Downloading full Point Cloud (.las)...")

        las_url = f"{SUPABASE_URL}/storage/v1/object/public/{request.bucket_name}/{las_storage_path}"

        with requests.get(las_url, stream=True) as r:
            r.raise_for_status()
            with open(las_temp_path, 'wb') as f:
                for chunk in r.iter_content(chunk_size=8192):
                    f.write(chunk)

        print("Reading .las file...")

        las = laspy.read(las_temp_path)
        points = np.vstack((las.x, las.y, las.z)).transpose()

        print(f".las points loaded: {len(points)}")

        # ==========================================
        # 2. loop images
        # ==========================================

        for image_id in request.image_id:

            update_status(image_id, "processing", "Fetching data from database...")

            try:

                img_res = supabase.table("project_images") \
                    .select("storage_path") \
                    .eq("id", image_id) \
                    .single() \
                    .execute()

                cam_res = supabase.table("camera_position") \
                    .select("*") \
                    .eq("image_id", image_id) \
                    .single() \
                    .execute()

                calib_res = supabase.table("project_calibrations") \
                    .select("*") \
                    .eq("project_id", project_id) \
                    .single() \
                    .execute()

                if not img_res.data or not cam_res.data:
                    raise ValueError("Image or Camera Data not found")

                img_storage_path = img_res.data["storage_path"]
                cam_data = cam_res.data
                calib_data = calib_res.data if calib_res.data else {}

                # ==========================================
                # 3. Download Image
                # ==========================================

                update_status(image_id, "processing", "Downloading image...")
                print(f"Downloading image {image_id}")

                img_url = f"{SUPABASE_URL}/storage/v1/object/public/{request.bucket_name}/{img_storage_path}"

                resp = requests.get(img_url)
                resp.raise_for_status()

                img_array = np.frombuffer(resp.content, np.uint8)
                img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)

                H, W = img.shape[:2]

                # ==========================================
                # 4. Object Detection
                # ==========================================

                update_status(image_id, "processing", "Running Object Detection...")

                target_classes = [0, 1, 2, 3, 4, 5, 6]

                results = yolo_model(img, conf=0.3, classes=target_classes)

                boxes = results[0].boxes

                # ==========================================
                # 5. Filter Point Cloud near camera
                # ==========================================

                update_status(image_id, "processing", "Processing Point Cloud data...")

                cam_x, cam_y, cam_z = cam_data["x"], cam_data["y"], cam_data["z"]
                cam_pos = np.array([cam_x, cam_y, cam_z])

                distances_to_cam = np.linalg.norm(points - cam_pos, axis=1)

                mask_radius = distances_to_cam <= 50.0

                local_points = points[mask_radius]

                if len(local_points) == 0:
                    raise ValueError("ไม่พบจุด LiDAR ในรัศมี 50 เมตรจากรูปภาพนี้")

                local_points[:, 0] -= cam_x
                local_points[:, 1] -= cam_y
                local_points[:, 2] -= cam_z

                # ==========================================
                # 6. Apply Calibration
                # ==========================================

                current_yaw = cam_data["heading"] + calib_data.get("heading_offset", 0)
                current_pitch = cam_data["pitch"] + calib_data.get("pitch_offset", 0)
                current_roll = cam_data["roll"] + calib_data.get("roll_offset", 0)

                update_status(image_id, "processing", "Projecting Points & Estimating Distance...")

                u_valid, v_valid, d_valid = get_projected_points(
                    local_points,
                    current_yaw,
                    current_pitch,
                    current_roll,
                    W,
                    H
                )

                # ==========================================
                # 7. Estimate Distance per detection
                # ==========================================

                detected_list = []

                for box in boxes:

                    x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()

                    cls_id = int(box.cls[0])
                    conf = float(box.conf[0])

                    class_name = yolo_model.names[cls_id]

                    inside_mask = (
                        (u_valid >= x1) &
                        (u_valid <= x2) &
                        (v_valid >= y1) &
                        (v_valid <= y2)
                    )

                    distance = None

                    if np.sum(inside_mask) > 0:
                        points_inside = d_valid[inside_mask]
                        distance = float(np.percentile(points_inside, 5))

                    detected_list.append({
                        "project_id": project_id,
                        "image_id": image_id,
                        "class_name": class_name,
                        "confidence": conf,
                        "mapped_3d_x": cam_x,
                        "mapped_3d_y": cam_y,
                        "mapped_3d_z": cam_z,
                        "bbox_xmin": float(x1 / W),
                        "bbox_ymin": float(y1 / H),
                        "bbox_xmax": float(x2 / W),
                        "bbox_ymax": float(y2 / H),
                        "distance_from_camera": distance
                    })

                # ==========================================
                # 8. Save Results
                # ==========================================

                if detected_list:

                    update_status(image_id, "processing", "Saving results to Database...")

                    supabase.table("detected_objects") \
                        .delete() \
                        .eq("image_id", image_id) \
                        .execute()

                    supabase.table("detected_objects") \
                        .upsert(detected_list) \
                        .execute()

                update_status(
                    image_id,
                    "completed",
                    f"Detection complete! Found {len(detected_list)} objects.",
                    len(detected_list)
                )

                print(f"Detection complete for {image_id}! Found {len(detected_list)} objects.")

            except Exception as e:
                import traceback
                print(f"Detection Error ({image_id}): {e}")
                traceback.print_exc()

                update_status(image_id, "failed", str(e))

        # ==========================================
        # cleanup
        # ==========================================

        if os.path.exists(las_temp_path):
            os.remove(las_temp_path)

    except Exception as e:
        print(f"Fatal detection error: {e}")

@app.post("/api/run-detection")
async def start_detection(request: DetectionRequest, background_tasks: BackgroundTasks):
    if not request.image_id:
        raise HTTPException(status_code=400, detail="No images selected")

    for image_id in request.image_id:
        supabase.table('project_images').update({
            'detection_status': 'pending',
            'detection_message': 'Waiting in queue...'
        }).eq('id', image_id).execute()

    background_tasks.add_task(process_detection, request)
    
    return {"message": f"Queued {len(request.image_id)} images for processing."}

@app.get("/api/detection-status/{image_id}")
async def get_detection_status(image_id: str):
    status_info = detection_job_statuses.get(image_id)
    if not status_info:
        return {"status": "not_started"}
    return status_info

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