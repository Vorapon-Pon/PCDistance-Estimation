import { create } from 'zustand';
import { createClient } from '@/utils/client';
import { toast } from 'sonner';

interface UploadState {
  isUploading: boolean;
  uploadProgress: number;
  currentFileIndex: number;
  totalFiles: number;
  statusText: string;
  isMinimized: boolean;
  toggleMinimize: () => void;
  startUpload: (projectId: string, batchName: string, files: File[]) => Promise<void>;
}

const processImage = (file: File): Promise<{ thumbnail: Blob, width: number, height: number }> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const maxWidth = 300;
        const scaleFactor = maxWidth / img.width;
        const thumbWidth = img.width > maxWidth ? maxWidth : img.width;
        const thumbHeight = img.width > maxWidth ? img.height * scaleFactor : img.height;

        canvas.width = thumbWidth;
        canvas.height = thumbHeight;
        ctx?.drawImage(img, 0, 0, thumbWidth, thumbHeight);

        canvas.toBlob((blob) => {
          if (blob) {
            resolve({ thumbnail: blob, width: img.width, height: img.height });
          } else {
            reject(new Error('Could not create thumbnail blob'));
          }
        }, 'image/jpeg', 0.8);
      };
      img.onerror = (error) => reject(error);
      img.src = URL.createObjectURL(file);
    });
  };

export const useUploadStore = create<UploadState>((set, get) => ({
  isUploading: false,
  uploadProgress: 0,
  currentFileIndex: 0,
  totalFiles: 0,
  statusText: '',
  isMinimized: false,
  
  toggleMinimize: () => set((state) => ({ isMinimized: !state.isMinimized })),

  startUpload: async (projectId, batchName, files) => {
    if (get().isUploading) return;
    
    set({ 
      isUploading: true, 
      totalFiles: files.length, 
      currentFileIndex: 0, 
      uploadProgress: 0,
      statusText: 'Initializing...',
      isMinimized: false
    });

    const supabase = createClient();

    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) throw new Error("User not authenticated.");
      const currentUser = authData.user;

      const { data: batchData, error: batchError } = await supabase
        .from('batches')
        .insert({ project_id: projectId, name: batchName, user_id: currentUser.id })
        .select().single();

      if (batchError) throw batchError;

      let successImageCount = 0;
      let hasCameraOrImageUpdates = false;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        set({ currentFileIndex: i + 1, statusText: `Uploading ${file.name}...` });
        
        const timestamp = Date.now();
        const ext = file.name.split('.').pop()?.toLowerCase();
        const isPointCloud = ['las', 'bin', 'pcd', 'npy'].includes(ext || '');
        const isCameraPos = ['txt', 'csv'].includes(ext || '');
        const isImage = ['jpg', 'jpeg', 'png'].includes(ext || '');

        if (isCameraPos) {
            const filePath = `${projectId}/camera_positions/${timestamp}_${file.name}`;
            const { error: uploadError } = await supabase.storage.from('project_files').upload(filePath, file);
            if (uploadError) continue;

            const text = await file.text();
            const lines = text.split('\n').filter(line => line.trim() !== '' && line.includes(','));
            const recordsToInsert = lines.slice(1).map(line => {
                const col = line.split(',');
                const unixTime = parseFloat(col[2]);
                const rowTimestamp = !isNaN(unixTime) ? new Date(unixTime * 1000).toISOString() : new Date().toISOString();
                return {
                project_id: projectId,
                frame_index: parseInt(col[0]),
                image_filename: col[1],
                timestamp: new Date(unixTime * 1000).toISOString(),
                x: parseFloat(col[3]),
                y: parseFloat(col[4]),
                z: parseFloat(col[5]),
                heading: parseFloat(col[6]),
                roll: parseFloat(col[7]),
                pitch: parseFloat(col[8]),
                camera: col[9],
                quality: parseInt(col[10]),
                line: parseInt(col[11]),
                color: parseInt(col[12]), 
                accuracy_xyz: parseFloat(col[13])
                }
            });
              
            const chunkSize = 500;
            for (let j = 0; j < recordsToInsert.length; j += chunkSize) {
              const chunk = recordsToInsert.slice(j, j + chunkSize);
              const { error: insertError } = await supabase.from('camera_position').insert(chunk);
              if (insertError) throw new Error(`Insert error: ${insertError.message}`);
            }
        
            await supabase.from('camera_position_files').insert({
            project_id: projectId,
            user_id: currentUser.id,
            filename: file.name,
            row_count: recordsToInsert.length, 
            });
            hasCameraOrImageUpdates = true;
        } else {
           const folder = isPointCloud ? 'raw' : 'images';
           const filePath = `${projectId}/${folder}/${timestamp}_${file.name}`;
           await supabase.storage.from('project_files').upload(filePath, file);

           if (isImage) {
                const { thumbnail, width, height } = await processImage(file);
                const thumbnailPath = filePath.replace(/(\.[\w\d_-]+)$/i, '_thumb$1');
                await supabase.storage.from('project_files').upload(thumbnailPath, thumbnail);
                
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
                hasCameraOrImageUpdates = true;
           } else if (isPointCloud) {
                await supabase.from('project_point_clouds').insert({
                project_id: projectId,
                batch_id: batchData.id,
                storage_path: filePath,
                format: ext,
                size_bytes: file.size,
                processing_status: 'pending',
                user_id: currentUser.id
                });
              // FastAPI
              fetch("http://127.0.0.1:8000/api/convert-pointcloud", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ project_id: projectId, bucket_name: "project_files", file_path: filePath })
              }).catch(console.error);
           }
        }
        
        set({ uploadProgress: Math.round(((i + 1) / files.length) * 100) });
      }

      if (successImageCount > 0) {
        await supabase.from('batches').update({ image_count: successImageCount }).eq('id', batchData.id);
      }
      if (hasCameraOrImageUpdates) {
        await supabase.rpc('link_camera_to_images', { p_project_id: projectId });
      }

      toast.success(`Upload completed successfully!`);
      
      await supabase.from('projects').update({ status: 'active' }).eq('id', projectId);

    } catch (error: any) {
      toast.error(error.message);
    } finally {
      set({ statusText: 'Completed', isUploading: false });
      setTimeout(() => {
        set({ uploadProgress: 0, currentFileIndex: 0 }); // รีเซ็ตหลังอัปโหลดเสร็จ 3 วินาที
      }, 3000);
    }
  }
}));