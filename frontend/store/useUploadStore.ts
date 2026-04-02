import { create } from 'zustand';
import { createClient } from '@/utils/client';
import { toast } from 'sonner';
import * as tus from 'tus-js-client';

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
      const { data: sessionData } = await supabase.auth.getSession();
      
      if (!authData.user) throw new Error("User not authenticated.");
      const currentUser = authData.user;
      const session = sessionData.session;

      const { data: batchData, error: batchError } = await supabase
        .from('batches')
        .insert({ project_id: projectId, name: batchName, user_id: currentUser.id })
        .select().single();

      if (batchError) throw batchError;

      let successImageCount = 0;
      let hasCameraOrImageUpdates = false;
      let firstThumbnailUrl: string | null = null;

      const imageRecordsToInsert: any[] = [];

      const CONCURRENCY_LIMIT = 4; 
      const activeUploads = new Set<Promise<void>>();

      const fileProgress = new Array(files.length).fill(0);
      const updateGlobalProgress = () => {
        const totalSum = fileProgress.reduce((acc, curr) => acc + curr, 0);
        set({ uploadProgress: Math.round(totalSum / files.length) });
      };

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileIndex = i; 
        const timestamp = Date.now();
        const ext = file.name.split('.').pop()?.toLowerCase();
        
        const isPointCloud = ['las', 'laz', 'ply', 'bin', 'pcd', 'npy'].includes(ext || '');
        const isCameraPos = ['txt', 'csv'].includes(ext || '');
        const isImage = ['jpg', 'jpeg', 'png'].includes(ext || '');

        set({ currentFileIndex: fileIndex + 1, statusText: `Processing files...` });

        const uploadTask = (async () => {
          if (isCameraPos) {
            const filePath = `${projectId}/camera_positions/${timestamp}_${file.name}`;
            const { error: uploadError } = await supabase.storage.from('project_files').upload(filePath, file);
            if (uploadError) return; 

            const text = await file.text();
            const lines = text.split('\n').filter(line => line.trim() !== '' && line.includes(','));
            const recordsToInsert = lines.slice(1).map(line => {
              const col = line.split(',');
              const unixTime = parseFloat(col[2]);
              return {
                project_id: projectId,
                frame_index: parseInt(col[0]),
                image_filename: col[1],
                timestamp: !isNaN(unixTime) ? new Date(unixTime * 1000).toISOString() : new Date().toISOString(),
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
              if (insertError) console.error(`Insert error: ${insertError.message}`);
            }
        
            await supabase.from('camera_position_files').insert({
              project_id: projectId,
              user_id: currentUser.id,
              filename: file.name,
              row_count: recordsToInsert.length, 
            });
            hasCameraOrImageUpdates = true;
            
            fileProgress[fileIndex] = 100;
            updateGlobalProgress();

          } else if (isImage) {
            const folder = 'images';
            const filePath = `${projectId}/${folder}/${timestamp}_${file.name}`;
            const thumbnailPath = filePath.replace(/(\.[\w\d_-]+)$/i, '_thumb$1');
            const uploadOriginalPromise = supabase.storage.from('project_files').upload(filePath, file);
            const processAndUploadThumbPromise = processImage(file).then(async ({ thumbnail, width, height }) => {
              await supabase.storage.from('project_files').upload(thumbnailPath, thumbnail);
              return { width, height };
            });

            const [, thumbData] = await Promise.all([
              uploadOriginalPromise,
              processAndUploadThumbPromise
            ]);

            if (!firstThumbnailUrl) {
              const { data: urlData } = supabase.storage.from('project_files').getPublicUrl(thumbnailPath);
              firstThumbnailUrl = urlData.publicUrl;
            }

            imageRecordsToInsert.push({
              project_id: projectId,
              batch_id: batchData.id,
              storage_path: filePath,
              thumbnail_path: thumbnailPath,
              width: thumbData.width,
              height: thumbData.height,
              format: file.type || 'image/jpeg',
              size_bytes: file.size,
              user_id: currentUser.id
            });
            
            successImageCount++;
            hasCameraOrImageUpdates = true;

            fileProgress[fileIndex] = 100;
            updateGlobalProgress();

          } else if (isPointCloud) {
            const folder = 'raw';
            const filePath = `${projectId}/${folder}/${timestamp}_${file.name}`;

            const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

            if (typeof window !== 'undefined') {
              const originalXhrOpen = window.XMLHttpRequest.prototype.open;
              window.XMLHttpRequest.prototype.open = function(this: XMLHttpRequest, method: string, url: string | URL, ...rest: any[]) {
                if (typeof url === 'string' && url.includes('trycloudflare.com')) {
                  url = url.replace('http://', 'https://').replace(':54321', '');
                }
                return (originalXhrOpen as any).apply(this, [method, url, ...rest]);
              };
            }

            await new Promise((resolve, reject) => {
              const upload = new tus.Upload(file, {
                endpoint: `${supabaseUrl}/storage/v1/upload/resumable`,
                retryDelays: [0, 3000, 5000, 10000, 20000],
                headers: {
                  authorization: `Bearer ${session?.access_token}`,
                  'x-upsert': 'true',
                },
                uploadDataDuringCreation: true,
                removeFingerprintOnSuccess: true,
                storeFingerprintForResuming: false, 
                fingerprint: (file) => Promise.resolve(`upload-${projectId}-${file.name}-${file.size}`),
                metadata: {
                  bucketName: 'project_files',
                  objectName: filePath,
                  contentType: 'application/octet-stream',
                },
                chunkSize: 50 * 1024 * 1024,
                onProgress: (bytesSent, bytesTotal) => {
                  const percent = (bytesSent / bytesTotal) * 100;
                  fileProgress[fileIndex] = percent;
                  updateGlobalProgress();
                },
                onSuccess: () => resolve(true),
                onError: (error) => {
                  console.error("TUS Upload Error:", error);
                  reject(error);
                },
              });

              upload.start();
            });

            await supabase.from('project_point_clouds').insert({
              project_id: projectId,
              batch_id: batchData.id,
              storage_path: filePath,
              format: ext,
              size_bytes: file.size,
              processing_status: 'pending',
              user_id: currentUser.id
            });
            
            const backendUrl = process.env.NEXT_PUBLIC_API_URL;
            fetch(`${backendUrl}/api/convert-pointcloud`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ project_id: projectId, bucket_name: "project_files", file_path: filePath })
            }).catch(console.error);

          } else {
            const filePath = `${projectId}/other/${timestamp}_${file.name}`;
            await supabase.storage.from('project_files').upload(filePath, file);
            fileProgress[fileIndex] = 100;
            updateGlobalProgress();
          }
        })();

        activeUploads.add(uploadTask);

        uploadTask.finally(() => activeUploads.delete(uploadTask));

        if (activeUploads.size >= CONCURRENCY_LIMIT) {
          await Promise.race(activeUploads);
        }
      }

      if (activeUploads.size > 0) {
        set({ statusText: 'Finalizing uploads...' });
        await Promise.all(activeUploads);
      }

      if (imageRecordsToInsert.length > 0) {
        set({ statusText: 'Saving data...' });
        const chunkSize = 100; 
        for (let j = 0; j < imageRecordsToInsert.length; j += chunkSize) {
          const chunk = imageRecordsToInsert.slice(j, j + chunkSize);
          const { error: insertError } = await supabase.from('project_images').insert(chunk);
          if (insertError) console.error("Bulk Insert Image Error:", insertError);
        }
      }

      if (successImageCount > 0) {
        await supabase.from('batches').update({ image_count: successImageCount }).eq('id', batchData.id);
      }
      
      if (hasCameraOrImageUpdates) {
        await supabase.rpc('link_camera_to_images', { p_project_id: projectId });
      }

      toast.success(`Upload completed successfully!`);

      const { data: currentProject } = await supabase.from('projects').select('thumbnail_url').eq('id', projectId).single();
      const projectUpdatePayload: any = { status: 'active' };
      
      if (firstThumbnailUrl && !currentProject?.thumbnail_url) {
        projectUpdatePayload.thumbnail_url = firstThumbnailUrl;
      }

      await supabase.from('projects').update(projectUpdatePayload).eq('id', projectId);

    } catch (error: any) {
      toast.error(error.message);
    } finally {
      set({ statusText: 'Completed', uploadProgress: 100 });
      setTimeout(() => {
        set({ uploadProgress: 0, currentFileIndex: 0, isUploading: false }); 
      }, 3000);
    }
  }
}));