'use client';

import { useState, useRef, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/utils/client';
import { Upload, Image as ImageIcon, Box, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

type Batch = {
  id: string;
  name: string;
  created_at: string;
  image_count: number; 
};

type CameraPos = {
  id: string;
  filename: string | null;
  row_count: number;
  created_at: string;
};

export default function UploadPage() {
  const params = useParams();
  const projectId = params.id as string;
  const supabase = createClient();

  const [batchName, setBatchName] = useState('');
  const [batches, setBatches] = useState<Batch[]>([]);
  const [cameraPositions, setCameraPositions] = useState<CameraPos[]>([]);

  const [uploadProgress, setUploadProgress] = useState(0);
  const [camUploadProgress, setCamUploadProgress] = useState(0);
  const [currentFile, setCurrentFile] = useState(0);
  const [totalFiles, setTotalFiles] = useState(0);
  
  const [isUploadingMain, setIsUploadingMain] = useState(false);
  const [isUploadingCam, setIsUploadingCam] = useState(false);

  // ----- Refs สำหรับซ่อน Input File -----
  const mainFileInputRef = useRef<HTMLInputElement>(null);
  const camFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (projectId) {
      fetchHistory();
    }
  }, [projectId]);

  async function fetchHistory() {
    const { data: batchData, error: batchError } = await supabase
      .from('batches')
      .select('id, name, created_at, image_count')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (!batchError && batchData) {
      const formattedBatches = batchData.map((b: any) => ({
        id: b.id,
        name: b.name,
        created_at: b.created_at,
        image_count: b.image_count || 0,
      }));
      setBatches(formattedBatches);
    }

    const { data: camData } = await supabase
      .from('camera_position_files')
      .select('id, filename, row_count, created_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (camData) setCameraPositions(camData);
  }

  const handleMainUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    if (!batchName.trim()) {
      toast.error('Please enter a Batch Name first!');
      return;
    }
    setIsUploadingMain(true);
    setTotalFiles(files.length);
    setUploadProgress(0);
    setCurrentFile(0);

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) {
        throw new Error("User not authenticated. Please log in.");
      }
      const currentUser = authData.user;

      const { data: batchData, error: batchError } = await supabase
        .from('batches')
        .insert({ 
          project_id: projectId, 
          name: batchName,
          user_id: currentUser.id
        })
        .select()
        .single();

      if (batchError) throw new Error(`Batch creation failed: ${batchError.message}`);

      let successCount = 0;
      let successImageCount = 0;
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const timestamp = Date.now();
        const filePath = `${projectId}/batches/${batchData.id}/${Date.now()}_${file.name}`;

        // อัปโหลดขึ้น Storage 'project_files'
        const { error: uploadError } = await supabase.storage
          .from('project_files')
          .upload(filePath, file);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          continue; 
        }

        if (file.type.includes('image') || file.name.match(/\.(jpg|jpeg|png)$/i)) {
          const { thumbnail, width, height } = await processImage(file);
          const thumbnailPath = filePath.replace(/(\.[\w\d_-]+)$/i, '_thumb$1');

          const { error: thumbUploadError } = await supabase.storage
              .from('project_files')
              .upload(thumbnailPath, thumbnail);
          if (thumbUploadError) console.warn("Thumbnail upload failed:", thumbUploadError);
          
          await supabase.from('project_images').insert({
            project_id: projectId,
            batch_id: batchData.id,
            storage_path: filePath,
            thumbnail_path: thumbnailPath,
            width: width,
            height: height,
            format: file.type || 'image/jpeg',
            size_bytes: file.size,
            user_id: currentUser.id
          });
          
          successImageCount++;
        } else if (file.name.match(/\.(las|bin|pcd|npy)$/i)) {
          await supabase.from('project_point_clouds').insert({
            project_id: projectId,
            batch_id: batchData.id,
            storage_path: filePath,
            format: file.name.split('.').pop(),
            size_bytes: file.size,
            processing_status: 'pending',
            user_id: currentUser.id
          });
          try {
            await fetch("http://127.0.0.1:8000/api/convert-pointcloud", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                project_id: projectId,
                bucket_name: "project_files",
                file_path: filePath  
              })
            });

            console.log("Sent to FastAPI for processing");

          } catch (apiError) {
            console.error("FastAPI call failed:", apiError);
          }
        }
        successCount++;
        setUploadProgress(Math.round(((i + 1) / files.length) * 100));
      }

      if (successImageCount > 0) {
        await supabase
          .from('batches')
          .update({ image_count: successCount })
          .eq('id', batchData.id);
      }

      const { error: rpcError } = await supabase.rpc('link_camera_to_images', { 
        p_project_id: projectId 
      });

      if (rpcError) console.error("Failed to link images to camera positions:", rpcError);

      toast.success(`Successfully uploaded ${successCount} files!`);
      setBatchName(''); 
      fetchHistory(); 

    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsUploadingMain(false);
      setTimeout(() => {
      setUploadProgress(0);
      setCurrentFile(0);
      setTotalFiles(0);
    }, 1000);
      if (mainFileInputRef.current) mainFileInputRef.current.value = ''; // Reset input
    }
  };

  const handleCamPosUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploadingCam(true);
    setCamUploadProgress(10);
    try {
      const filePath = `${projectId}/camera_position/${Date.now()}_${file.name}`;
      setCamUploadProgress(40);
  
      const { error: uploadError } = await supabase.storage
        .from('project_files')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim() !== '');

      setCamUploadProgress(60);
      const recordsToInsert = lines.slice(1).map(line => {
        const col = line.split(',');

        const unixTime = parseFloat(col[2]);
        const timestamp = new Date(unixTime * 1000).toISOString();

        return {
          project_id: projectId,
          frame_index: parseInt(col[0]),
          image_filename: col[1],
          timestamp: timestamp,
          x: parseFloat(col[3]),
          y: parseFloat(col[4]),
          z: parseFloat(col[5]),
          heading: parseFloat(col[6]),
          roll: parseFloat(col[7]),
          pitch: parseFloat(col[8]),
          camera: col[9],
          quality: parseInt(col[10]),
          line: parseInt(col[11]),
          // color: col[12] from data is not int4
          raw_extra: `color:${col[12]}`, // store in here instead
          accuracy_xyz: parseFloat(col[13])
        }
      })

      setCamUploadProgress(80);
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) {
        throw new Error("User not authenticated. Please log in.");
      }
      const currentUser = authData.user;

      const { error: dbError } = await supabase.from('camera_position').insert(recordsToInsert);

      if (dbError) throw dbError;

      const { error: fileLogError } = await supabase.from('camera_position_files').insert({
        project_id: projectId,
        user_id: currentUser.id, 
        filename: file.name,
        row_count: recordsToInsert.length, 
      });

      if (fileLogError) throw fileLogError;

      const { error: rpcError } = await supabase.rpc('link_camera_to_images', { 
        p_project_id: projectId 
      });
      if (rpcError) console.error("Failed to link camera positions to images:", rpcError);

      setCamUploadProgress(100);
      toast.success('Camera position uploaded successfully!');
      fetchHistory(); 
      console.log()

    } catch (error: any) {
      toast.error(`Upload failed: ${error.message}`);
    } finally {
      setTimeout(() => {
        setIsUploadingCam(false);
        setCamUploadProgress(0);
      }, 800);
      if (camFileInputRef.current) camFileInputRef.current.value = '';
    }
  };

  // for creating Thumbnail
  const processImage = (file: File): Promise<{ thumbnail: Blob, width: number, height: number }> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // กำหนดขนาดสูงสุดของ Thumbnail (เช่น กว้างไม่เกิน 300px)
        const maxWidth = 300;
        const scaleFactor = maxWidth / img.width;
        // ถ้าฉบับจริงเล็กกว่า 300px ก็ใช้ขนาดเดิม
        const thumbWidth = img.width > maxWidth ? maxWidth : img.width;
        const thumbHeight = img.width > maxWidth ? img.height * scaleFactor : img.height;

        canvas.width = thumbWidth;
        canvas.height = thumbHeight;

        // วาดรูปลงบน Canvas เพื่อย่อขนาด
        ctx?.drawImage(img, 0, 0, thumbWidth, thumbHeight);

        // แปลง Canvas กลับเป็นไฟล์รูปภาพ (Blob)
        canvas.toBlob((blob) => {
          if (blob) {
            resolve({
              thumbnail: blob,
              width: img.width,   // ส่งความกว้างต้นฉบับกลับไป
              height: img.height  // ส่งความสูงต้นฉบับกลับไป
            });
          } else {
            reject(new Error('Could not create thumbnail blob'));
          }
        }, 'image/jpeg', 0.8); // กำหนดคุณภาพ JPEG ที่ 80%
      };
      img.onerror = (error) => reject(error);
      // สร้าง URL ชั่วคราวเพื่อโหลดรูปภาพ
      img.src = URL.createObjectURL(file);
    });
  };

  return (
    <div className="p-6 text-neutral-200 min-h-screen bg-neutral-900">
      {/* 1. Header Section */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold flex pb-4 border-b border-neutral-800 items-center gap-3 mb-6">
          <Upload className="text-neutral-200" size={28} />
          Upload data
        </h1>

        <div className="flex items-center gap-4">
          <label className="text-lg font-medium whitespace-nowrap">Batch Name:</label>
          <input 
            type="text" 
            value={batchName || ""}
            onChange={(e) => setBatchName(e.target.value)}
            placeholder="Example Text" 
            className="bg-neutral-800 border border-neutral-700 rounded-md px-4 py-2 w-full max-w-md outline-none focus:border-[#B8AB9C] transition-all"
          />
        </div>
      </div>

      {/* 2. Upload Area Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
        
        {/* Main Upload: Images & Point Cloud */}
        <div 
          onClick={() => !isUploadingMain && mainFileInputRef.current?.click()}
          className={`lg:col-span-2 border-2 border-dashed rounded-xl bg-neutral-900 p-10 flex flex-col items-center justify-center text-center group transition-colors cursor-pointer
            ${isUploadingMain ? 'border-[#B8AB9C] opacity-70' : 'border-neutral-700 hover:border-[#B8AB9C]'}`}
        >
          {/* ซ่อน Input จริงเอาไว้ */}
          <input 
            type="file" 
            multiple 
            ref={mainFileInputRef} 
            className="hidden" 
            onChange={handleMainUpload}
            accept=".jpg,.jpeg,.png,.las,.bin,.pcd,.npy"
          />

          {isUploadingMain ? (
    // ---- UI สถานะกำลังอัปโหลด (Progress Bar) ----
    <div className="w-full max-w-md flex flex-col items-center">
      <div className="bg-[#B8AB9C]/20 p-4 rounded-full mb-4">
        <Loader2 className="animate-spin text-[#B8AB9C]" size={32} />
      </div>
      <h3 className="text-neutral-200 font-medium mb-1">Uploading Files...</h3>
      <p className="text-neutral-400 text-sm mb-6">
        Processing file {currentFile} of {totalFiles}
      </p>
      
      {/* Progress Bar Track */}
      <div className="w-full bg-neutral-800 rounded-full h-2.5 mb-2 overflow-hidden">
        {/* Progress Bar Fill */}
        <div 
          className="bg-[#B8AB9C] h-2.5 rounded-full transition-all duration-300 ease-out" 
          style={{ width: `${uploadProgress}%` }}
        ></div>
      </div>
      <p className="text-[#B8AB9C] text-sm font-medium">{uploadProgress}%</p>
    </div>
  ) : (
    // ---- UI ปกติ (รอรับไฟล์) ----
    <>
      <div className="bg-neutral-800 p-4 rounded-full mb-4 group-hover:bg-[#B8AB9C]/10 transition-colors">
        <Upload className="text-neutral-400 group-hover:text-[#B8AB9C]" size={32} />
      </div>
      <p className="text-neutral-300 mb-4">Drag and drop file(s) to upload, or:</p>
      <button className="bg-neutral-200 text-black font-medium px-6 py-2 rounded-lg flex items-center gap-2 hover:bg-white transition-colors">
        <FileText size={18} />
        Select File(s)
      </button>
      
      <div className="mt-8 flex gap-8 text-xs text-neutral-500">
        <div className="flex items-center gap-2">
          <ImageIcon size={16} />
          <div className="text-left">
            <p className="font-semibold text-neutral-300">Images</p>
            <p>.jpg, .png</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Box size={16} />
          <div className="text-left">
            <p className="font-semibold text-neutral-300">Point Clouds</p>
            <p>.las, .bin, .pcd, .npy</p>
          </div>
        </div>
      </div>
    </>
  )}
</div>

        {/* Secondary Upload: Calibration File */}
        <div 
          onClick={() => !isUploadingCam && camFileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl bg-neutral-900 p-10 flex flex-col items-center justify-center text-center group transition-colors 
            ${isUploadingCam ? 'border-[#B8AB9C] cursor-default' : 'border-neutral-700 hover:border-[#B8AB9C] cursor-pointer'}`}
        >
           <input 
            type="file" 
            ref={camFileInputRef} 
            className="hidden" 
            onChange={handleCamPosUpload}
            accept=".txt,.csv"
          />
          
          {isUploadingCam ? (
            <div className="w-full max-w-[200px] flex flex-col items-center">
              <div className="bg-[#B8AB9C]/20 p-4 rounded-full mb-4">
                <Loader2 className="animate-spin text-[#B8AB9C]" size={32} />
              </div>
              <h3 className="text-neutral-200 font-medium mb-4">Uploading File...</h3>
              
              <div className="w-full bg-neutral-800 rounded-full h-2.5 mb-2 overflow-hidden">
                <div 
                  className="bg-[#B8AB9C] h-2.5 rounded-full transition-all duration-300 ease-out" 
                  style={{ width: `${camUploadProgress}%` }}
                ></div>
              </div>
              <p className="text-[#B8AB9C] text-sm font-medium">{camUploadProgress}%</p>
            </div>
          ) : (
            // ---- UI ปกติ ----
            <>
              <div className="bg-neutral-800 p-4 rounded-full mb-4 group-hover:bg-[#B8AB9C]/10 transition-colors">
                <Upload className="text-neutral-400 group-hover:text-[#B8AB9C]" size={32} />
              </div>
              <h3 className="font-medium text-neutral-200 mb-2">Upload a Camera Position File</h3>
              <p className="text-xs text-neutral-500 mb-6">Drag and drop TXT or CSV files</p>
              <button 
                className="bg-neutral-800 border border-neutral-600 text-neutral-200 px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-[#3D3D3D] transition-colors text-sm"
              >
                <FileText size={16} /> 
                Select File
              </button>
            </>
          )}
        </div>
      </div>

      {/* 3. History Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Batch Image History */}
        <div>
          <h2 className="text-xl font-medium mb-4">Batch History</h2>
          <div className="space-y-3">
            {batches.length === 0 ? (
              <p className="text-sm text-neutral-500">No batches uploaded yet.</p>
            ) : (
              batches.map((batch) => (
                <div key={batch.id} className="flex items-center gap-4 bg-[#1A1A1A] border border-neutral-800 p-4 rounded-xl hover:bg-[#222] transition-colors">
                  <div className="w-12 h-12 bg-[#2D2D2D] rounded-lg flex items-center justify-center text-neutral-500">
                    <ImageIcon size={24} />
                  </div>
                  <div>
                    <p className="font-medium text-neutral-200">{batch.name}</p>
                    <p className="text-xs text-neutral-500">
                      Uploaded on {new Date(batch.created_at).toLocaleDateString()} • Images: {batch.image_count}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Camera Position History */}
        <div>
          <h2 className="text-xl font-medium mb-4">Camera position</h2>
          <div className="space-y-3">
            {cameraPositions.length === 0 ? (
              <p className="text-sm text-neutral-500">No camera positions uploaded yet.</p>
            ) : (
              cameraPositions.map((pos) => (
                <div key={pos.id} className="flex items-center gap-4 bg-[#1A1A1A] border border-neutral-800 p-4 rounded-xl hover:bg-[#222] transition-colors">
                  <div className="w-12 h-12 bg-[#2D2D2D] rounded-lg flex items-center justify-center text-neutral-500">
                    <FileText size={24} />
                  </div>
                  <div>
                    <p className="font-medium text-neutral-200 truncate max-w-[250px]">{pos.filename}</p>
                    <p className="text-xs text-neutral-500">
                      Uploaded on {new Date(pos.created_at).toLocaleDateString()} • row: {pos.row_count}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}