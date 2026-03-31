'use client';

import { useState, useRef, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/utils/client';
import { useUploadStore } from '@/store/useUploadStore';
import { processUploadCredits } from './actions';
import { Upload, Image as ImageIcon, Box, FileText, Loader2, X, Trash2, Plus } from 'lucide-react';
import CreditConfirmModal from '@/components/projects/CreditConfirmModal'; 
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

type PointCloud = {
  id: string;
  format: string;
  size_bytes: number;
  created_at: string;
  processing_status: string;
};

export default function UploadPage() {
  const params = useParams();
  const projectId = params.id as string;
  const supabase = createClient();

  const [batchName, setBatchName] = useState('');
  const [batches, setBatches] = useState<Batch[]>([]);
  const [cameraPositions, setCameraPositions] = useState<CameraPos[]>([]);
  const [pointClouds, setPointClouds] = useState<PointCloud[]>([]);

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [currentCredits, setCurrentCredits] = useState<number>(0);
  const [isPaying, setIsPaying] = useState(false);

  const { 
    isUploading, 
    uploadProgress, 
    currentFileIndex, 
    startUpload: startGlobalUpload 
  } = useUploadStore();
  
  useEffect(() => {
    if (projectId) {
      fetchHistory();
    }
  }, [projectId]);

  async function fetchHistory() {
    const { data: batchData } = await supabase
      .from('batches')
      .select('id, name, created_at, image_count')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    if (batchData) setBatches(batchData);

    const { data: camData } = await supabase
      .from('camera_position_files')
      .select('id, filename, row_count, created_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    if (camData) setCameraPositions(camData);

    const { data: pcData } = await supabase
      .from('project_point_clouds')
      .select('id, format, size_bytes, created_at, processing_status')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    if (pcData) setPointClouds(pcData);

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('credits')
        .eq('id', user.id)
        .single();
      if (profile) setCurrentCredits(profile.credits);
    }
  }

  const filterAndSetFiles = (newFiles: File[]) => {
    const validFiles = newFiles.filter(f => f.name.match(/\.(jpg|jpeg|png|las|bin|pcd|npy|txt|csv)$/i));
    
    setSelectedFiles(prev => {
      const combined = [...prev, ...validFiles];
      return combined.filter((file, index, self) => 
        index === self.findIndex((t) => t.name === file.name && t.size === file.size)
      );
    });
  };

  // --- Drag & Drop support Folder > 100 File in Browser ---
  const getFilesFromDataTransferItems = async (items: DataTransferItemList): Promise<File[]> => {
    const files: File[] = [];
    const readEntry = async (entry: any) => {
      if (entry.isFile) {
        const file = await new Promise<File>((resolve) => entry.file(resolve));
        files.push(file);
      } else if (entry.isDirectory) {
        const reader = entry.createReader();
        let allEntries: any[] = [];
        
        // Loop อ่านโฟลเดอร์ไปเรื่อยๆ จนกว่าไฟล์จะหมด (รอบละ 100 ไฟล์)
        const readBatch = async () => {
          const entries = await new Promise<any[]>((resolve) => {
            reader.readEntries((entries: any[]) => resolve(entries));
          });
          if (entries.length > 0) {
            allEntries = allEntries.concat(entries);
            await readBatch(); 
          }
        };
        await readBatch();
        
        for (const child of allEntries) {
          await readEntry(child);
        }
      }
    };

    for (let i = 0; i < items.length; i++) {
      const item = items[i].webkitGetAsEntry();
      if (item) await readEntry(item);
    }
    return files;
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    
    if (isUploading) return;

    const files = await getFilesFromDataTransferItems(e.dataTransfer.items);
    filterAndSetFiles(files);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      filterAndSetFiles(Array.from(event.target.files));
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (indexToRemove: number) => {
    setSelectedFiles(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  // --- Start Upload (โยนเข้า Store) ---
  const startUpload = () => {
    if (selectedFiles.length === 0) return;
    if (!batchName.trim()) { toast.error('Please enter a Batch Name!'); return; }
    
    startGlobalUpload(projectId, batchName, selectedFiles);
    
    setBatchName('');
    setSelectedFiles([]);
  };

  const calculateCosts = () => {
    let imageCount = 0;
    let pointCloudCount = 0;
    let cameraCount = 0;
    
    selectedFiles.forEach(file => {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (['jpg', 'jpeg', 'png'].includes(ext || '')) imageCount++;
      if (['las', 'bin', 'pcd', 'npy'].includes(ext || '')) pointCloudCount++;
      else if (['txt', 'csv'].includes(ext || '')) cameraCount++;
    });

    const imageCost = imageCount * 1; 
    const pointCloudCost = pointCloudCount * 10; 
    const cameraCost = cameraCount * 1;

    const totalCost = imageCost + pointCloudCost + cameraCost;
    

    return { imageCount, pointCloudCount, cameraCount, totalCost };
  };

  const { imageCount, pointCloudCount, cameraCount, totalCost } = calculateCosts();

  const handleStartUploadClick = () => {
    if (selectedFiles.length === 0) return;
    if (!batchName.trim()) { 
      toast.error('Please enter a Batch Name!'); 
      return; 
    }
    
    if (totalCost > currentCredits) {
      toast.error('Not enough credits. Please top up.');
      return;
    }

    setIsConfirmModalOpen(true);
  };

  const handleConfirmUpload = async () => {
    setIsPaying(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not found");

      let transactionType = '';
        if ((imageCount > 0 && pointCloudCount > 0) || (imageCount > 0 && cameraCount > 0) || (pointCloudCount > 0 && cameraCount > 0)) {
          transactionType = 'UPLOAD_MIXED';
        } else if (imageCount > 0) {
          transactionType = 'UPLOAD_IMAGE';
        } else if(pointCloudCount > 0) {
          transactionType = 'UPLOAD_POINTCLOUD';
        }else {
          transactionType = 'UPLOAD_CAMERA_POSITION';
        }

        const description = `Uploaded ${imageCount} images, ${pointCloudCount} point clouds and to batch: ${batchName}`;

      if (totalCost > 0) {
        const { error: creditError } = await supabase.rpc('deduct_user_credits', {
          p_user_id: user.id,
          p_amount: totalCost,
          p_transaction_type: transactionType,
          p_description: description
        });

        if (creditError) throw new Error(creditError.message);
      }

      setIsConfirmModalOpen(false);
      startGlobalUpload(projectId, batchName, selectedFiles);
      
      setBatchName('');
      setSelectedFiles([]);

      setCurrentCredits(prev => prev - totalCost); 

    } catch (error: any) {
      toast.error(error.message.includes('Not enough credits') ? 'Not enough credits.' : 'Payment failed.');
    } finally {
      setIsPaying(false);
    }
  };

  return (
    <div className="p-6 text-neutral-200 min-h-screen bg-neutral-900">
      {/* 1. Header Section */}
      <div className="mb-6">
        <h1 className="text-xl text-semibold flex pb-4 border-b border-neutral-800 items-center gap-3 mb-6">
          <Upload className="text-neutral-200" size={28} />
          Upload Data
        </h1>

        <div className="flex items-center gap-4">
          <label className="text-sm font-medium whitespace-nowrap">Batch Name:</label>
          <input 
            type="text" 
            value={batchName || ""}
            onChange={(e) => setBatchName(e.target.value)}
            disabled={isUploading}
            placeholder="Example Text" 
            className="bg-neutral-800 border border-neutral-700 rounded-md px-4 py-2 w-full max-w-md outline-none text-sm focus:border-[#B8AB9C] transition-all disabled:opacity-50"
          />
        </div>
      </div>

      {/* 2. Dynamic Dropzone Section */}
      <div className="mb-12">
        <div 
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl transition-all duration-300 overflow-hidden
            ${isUploading ? 'bg-neutral-900 border-[#B8AB9C] opacity-70 cursor-default p-12' : 
              isDragOver ? 'bg-[#B8AB9C]/5 border-[#B8AB9C] p-12' : 
              selectedFiles.length > 0 ? 'bg-[#1A1A1A] border-neutral-800 p-6 shadow-lg' : 
              'bg-neutral-900 border-neutral-700 hover:border-[#B8AB9C] cursor-pointer p-12'}`}
        >
          <input 
            type="file" 
            multiple 
            ref={fileInputRef} 
            className="hidden" 
            onChange={handleFileSelect}
            accept=".jpg,.jpeg,.png,.las,.bin,.pcd,.npy,.txt,.csv"
          />

          {isUploading ? (
            <div className="w-full max-w-md mx-auto flex flex-col items-center">
              <div className="bg-[#B8AB9C]/20 p-4 rounded-full mb-4">
                <Loader2 className="animate-spin text-[#B8AB9C]" size={32} />
              </div>
              <h3 className="text-neutral-200 font-medium mb-1">Processing and Uploading Files...</h3>
              <p className="text-neutral-400 text-sm mb-6">
                Processing file {currentFileIndex}
              </p>
              <div className="w-full bg-neutral-800 rounded-full h-2.5 mb-2 overflow-hidden">
                <div 
                  className="bg-[#B8AB9C] h-2.5 rounded-full transition-all duration-300 ease-out" 
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
              <p className="text-[#B8AB9C] text-sm font-medium">{uploadProgress}%</p>
              <p className="text-neutral-500 text-xs mt-4">You can navigate to other pages. The upload will continue in the background.</p>
            </div>
          ) : selectedFiles.length > 0 ? (
            /* Staging Area Mode */
            <div className="w-full">
              <div className="flex justify-between items-center mb-5 border-b border-neutral-800 pb-4">
                <div className="flex items-center gap-3">
                  <h3 className="font-medium text-xl">Selected Files</h3>
                  <span className="bg-[#B8AB9C] text-black px-2 py-0.5 rounded-full text-sm font-bold">{selectedFiles.length}</span>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="text-sm bg-neutral-800 hover:bg-neutral-700 text-neutral-200 px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
                  >
                    <Plus size={16} /> Add More
                  </button>
                  <button 
                    onClick={() => setSelectedFiles([])}
                    className="text-sm text-red-400 hover:bg-red-500/10 px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
                  >
                    <Trash2 size={16} /> Clear All
                  </button>
                </div>
              </div>

              <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2 custom-scrollbar mb-6">
                {selectedFiles.map((f, i) => (
                  <div key={i} className="flex justify-between items-center bg-neutral-800/40 p-3 rounded-lg text-sm border border-neutral-800/50 hover:bg-neutral-800 transition-colors">
                    <div className="flex items-center gap-3 truncate max-w-[85%]">
                      {f.name.match(/\.(jpg|jpeg|png)$/i) ? <ImageIcon size={18} className="text-blue-400" /> :
                       f.name.match(/\.(las|bin|pcd|npy)$/i) ? <Box size={18} className="text-green-400" /> :
                       <FileText size={18} className="text-orange-400" />}
                      <span className="truncate text-neutral-300 font-medium">{f.name}</span>
                      <span className="text-neutral-500 text-xs">{(f.size / 1024 / 1024).toFixed(2)} MB</span>
                    </div>
                    <button onClick={() => removeFile(i)} className="text-neutral-500 hover:text-red-400 transition-colors p-1">
                      <X size={20} />
                    </button>
                  </div>
                ))}
              </div>

              <button 
                onClick={handleStartUploadClick}
                disabled={isUploading}
                className="w-full bg-[#B8AB9C] text-black font-semibold py-3 rounded-lg hover:bg-[#d0c2b2] transition-colors text-lg flex items-center justify-center gap-2 shadow-lg shadow-[#B8AB9C]/10"
              >
                <Upload size={20} /> 
                Start Upload {totalCost > 0 && `(${totalCost} Credits)`}
              </button>
            </div>
          ) : (
            /* Empty State Mode */
            <div onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center justify-center w-full h-full min-h-[300px]">
              <div className="bg-neutral-800 p-5 rounded-full mb-6 hover:bg-[#B8AB9C]/10 transition-colors shadow-lg">
                <Upload className="text-[#B8AB9C]" size={32} />
              </div>
              <h3 className="text-xl font-medium text-neutral-200 mb-3">Upload Project Files</h3>
              <p className="text-neutral-400 mb-8 text-md">Drag and drop file(s) or folder(s) here, or click to browse</p>
              
              <div className="flex flex-wrap justify-center gap-12 text-sm text-neutral-400 bg-neutral-900/50 p-6 rounded-2xl w-full max-w-2xl">
                <div className="flex flex-col items-center gap-2">
                  <div className="bg-blue-500/10 p-3 rounded-xl"><ImageIcon size={24} className="text-blue-400" /></div>
                  <p className="font-semibold text-neutral-300">Images</p>
                  <p className="text-xs">.jpg, .png</p>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <div className="bg-green-500/10 p-3 rounded-xl"><Box size={24} className="text-green-400" /></div>
                  <p className="font-semibold text-neutral-300">Point Clouds</p>
                  <p className="text-xs">.las</p>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <div className="bg-orange-500/10 p-3 rounded-xl"><FileText size={24} className="text-orange-400" /></div>
                  <p className="font-semibold text-neutral-300">Camera Position</p>
                  <p className="text-xs">.txt, .csv</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. History Section (3 Columns) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {/* Image Batch History */}
        <div>
          <h2 className="text-lg font-medium mb-4 flex items-center gap-2 border-b border-neutral-800 pb-2">
            <ImageIcon size={18} className="text-blue-400" /> Image Batches
          </h2>
          <div className="space-y-3">
            {batches.length === 0 ? (
              <p className="text-sm text-neutral-500 p-4 bg-[#1A1A1A] rounded-xl text-center">No batches uploaded yet.</p>
            ) : (
              batches.map((batch) => (
                <div key={batch.id} className="flex items-center gap-4 bg-[#1A1A1A] border border-neutral-800 p-4 rounded-xl hover:bg-[#222] transition-colors">
                  <div className="w-10 h-10 bg-[#2D2D2D] rounded-lg flex items-center justify-center text-neutral-400">
                    <ImageIcon size={20} />
                  </div>
                  <div>
                    <p className="font-medium text-neutral-200 text-sm">{batch.name}</p>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      {new Date(batch.created_at).toLocaleDateString()} • {batch.image_count} imgs
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Camera Position History */}
        <div>
          <h2 className="text-lg font-medium mb-4 flex items-center gap-2 border-b border-neutral-800 pb-2">
            <FileText size={18} className="text-orange-400" /> Camera Positions
          </h2>
          <div className="space-y-3">
            {cameraPositions.length === 0 ? (
              <p className="text-sm text-neutral-500 p-4 bg-[#1A1A1A] rounded-xl text-center">No camera positions yet.</p>
            ) : (
              cameraPositions.map((pos) => (
                <div key={pos.id} className="flex items-center gap-4 bg-[#1A1A1A] border border-neutral-800 p-4 rounded-xl hover:bg-[#222] transition-colors">
                  <div className="w-10 h-10 bg-[#2D2D2D] rounded-lg flex items-center justify-center text-neutral-400">
                    <FileText size={20} />
                  </div>
                  <div className="overflow-hidden">
                    <p className="font-medium text-neutral-200 text-sm truncate">{pos.filename}</p>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      {new Date(pos.created_at).toLocaleDateString()} • {pos.row_count} rows
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Point Cloud History */}
        <div>
          <h2 className="text-lg font-medium mb-4 flex items-center gap-2 border-b border-neutral-800 pb-2">
            <Box size={18} className="text-green-400" /> Point Clouds
          </h2>
          <div className="space-y-3">
            {pointClouds.length === 0 ? (
              <p className="text-sm text-neutral-500 p-4 bg-[#1A1A1A] rounded-xl text-center">No point clouds yet.</p>
            ) : (
              pointClouds.map((pc) => (
                <div key={pc.id} className="flex items-center gap-4 bg-[#1A1A1A] border border-neutral-800 p-4 rounded-xl hover:bg-[#222] transition-colors">
                  <div className="w-10 h-10 bg-[#2D2D2D] rounded-lg flex items-center justify-center text-neutral-400">
                    <Box size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-neutral-200 text-sm uppercase">.{pc.format}</p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        pc.processing_status === 'completed' ? 'bg-green-500/10 text-green-400' : 
                        pc.processing_status === 'failed' ? 'bg-red-500/10 text-red-400' : 
                        'bg-yellow-500/10 text-yellow-400'
                      }`}>
                        {pc.processing_status}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      {new Date(pc.created_at).toLocaleDateString()} • {(pc.size_bytes / (1024 * 1024)).toFixed(2)} MB
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <CreditConfirmModal 
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={handleConfirmUpload}
        title="Confirm Upload"
        isLoading={isPaying}
        totalCost={totalCost}
        remainCredit={currentCredits - totalCost}
        details={[
          { label: 'Batch Name', value: batchName },
          { label: 'Images to upload', value: `${imageCount} file(s)` },
          { label: 'Point Clouds to upload', value: `${pointCloudCount} file(s)` },
          { label: 'Camera Details (.txt)', value: `${cameraCount} file(s)` },
        ]}
      />
    </div>
  );
}