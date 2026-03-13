'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Play, ChartColumn, CheckSquare, Search, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize, CheckCircle2, Image as ImageIcon, Loader2, Scan, Square, AlertCircle } from 'lucide-react';
import { createClient } from '@/utils/client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface ProjectImage {
  id: string;
  storage_path: string;
  filename: string;
  url: string;
  detection_status?: string;  // เพิ่มคอลัมน์นี้
  detection_message?: string; // เพิ่มคอลัมน์นี้
}

interface DetectedObject {
  id: string;
  class_name: string;
  confidence: number;
  distance_from_camera: number;
  bbox_xmin: number; 
  bbox_ymin: number;
  bbox_xmax: number;
  bbox_ymax: number;
}

export default function EstimationPage() {
  const supabase = createClient();
  const params = useParams();
  const projectId = params.id as string 

  const [images, setImages] = useState<ProjectImage[]>([]);
  const [selectedImage, setSelectedImage] = useState<ProjectImage | null>(null);
  const [detectedObjects, setDetectedObjects] = useState<DetectedObject[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isDetecting, setIsDetecting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('');

  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedImageIds, setSelectedImageIds] = useState<Set<string>>(new Set());
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  
  const [currentImageStatus, setCurrentImageStatus] = useState<string>('pending');

  useEffect(() => {
    const fetchImages = async () => {
      if (!projectId) return;
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('project_images')
          .select('id, storage_path, detection_status, detection_message')
          .eq('project_id', projectId)
          .order('upload_at', { ascending: true });

        if (error) throw error;

        if (data && data.length > 0) {
          const BUCKET_NAME = 'project_files';
          const formattedImages = data.map(img => {
            const { data: urlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(img.storage_path);
            return {
              id: img.id,
              storage_path: img.storage_path,
              filename: img.storage_path.split('/').pop() || 'Unknown',
              url: urlData.publicUrl,
              detection_status: img.detection_status || 'idle',
              detection_message: img.detection_message || ''
            };
          });
          setImages(formattedImages);
          setSelectedImage(formattedImages[0]);
        }
      } catch (error) {
        console.error("Error fetching images:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchImages();
  }, [projectId]);

  const fetchDetectedObjects = async (imageId: string) => {
    const { data, error } = await supabase
      .from('detected_objects')
      .select('*')
      .eq('image_id', imageId);
      
    if (!error && data) {
      setDetectedObjects(data as DetectedObject[]);
    }
  };

  useEffect(() => {
    if (selectedImage) {
      setCurrentImageStatus(selectedImage.detection_status || 'idle');
      setStatusMessage(selectedImage.detection_message || '');
      setIsDetecting(selectedImage.detection_status === 'processing');
      
      fetchDetectedObjects(selectedImage.id);
    }
  }, [selectedImage]);

  useEffect(() => {
    if (!selectedImage) return;

    // ดึงสถานะล่าสุดจาก DB ทันทีเผื่อมีการอัปเดตระหว่างเปลี่ยนรูป
    const fetchCurrentStatus = async () => {
      const { data } = await supabase
        .from('project_images')
        .select('detection_status, detection_message')
        .eq('id', selectedImage.id)
        .single();

      if (data) {
        setCurrentImageStatus(data.detection_status || 'idle');
        setStatusMessage(data.detection_message || '');
        setIsDetecting(data.detection_status === 'processing');
      }
    };
    fetchCurrentStatus();

    const channel = supabase
      .channel(`status-update-${selectedImage.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'project_images',
          filter: `id=eq.${selectedImage.id}`
        },
        (payload) => {
          const updatedImage = payload.new;

          setImages(prev =>
            prev.map(img =>
              img.id === updatedImage.id
                ? {
                    ...img,
                    detection_status: updatedImage.detection_status,
                    detection_message: updatedImage.detection_message
                  }
                : img
            )
          );

          setCurrentImageStatus(updatedImage.detection_status);
          setStatusMessage(updatedImage.detection_message || '');

          if (updatedImage.detection_status === 'completed') {
            setIsDetecting(false);
            setIsBatchProcessing(false);
            fetchDetectedObjects(updatedImage.id);
          }

          if (updatedImage.detection_status === 'failed') {
            setIsDetecting(false);
            setIsBatchProcessing(false);
            alert(`Detection Error: ${updatedImage.detection_message}`);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [projectId, selectedImage]);

  const handleRunDetection = async () => {
    const idsToProcess = isSelectionMode ? Array.from(selectedImageIds) : [selectedImage?.id];
    if (idsToProcess.length === 0 || !idsToProcess[0]) return;
    setIsBatchProcessing(true);

    if (!selectedImage) return;
    setIsDetecting(true);
    setCurrentImageStatus('processing');
    setStatusMessage('Sending request to AI...');
    setDetectedObjects([]); 
    
    try {
      const res = await fetch(`${API_URL}/api/run-detection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          image_id: idsToProcess,
          bucket_name: 'project_files'
        })
      });

      if (!res.ok) throw new Error('Failed to start detection');

      if (isSelectionMode) {
        setIsSelectionMode(false);
        setSelectedImageIds(new Set());
      }

    } catch (error) {
      console.error(error);
      alert("Error connecting to backend");
      setIsDetecting(false);
      setCurrentImageStatus('failed');
      setStatusMessage('Connection failed');
    }
  };

  const toggleSelectImage = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); 
    const newSet = new Set(selectedImageIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedImageIds(newSet);
  };

  const handleRunAll = () => {
    const unprocessedIds = images.filter(img => img.detection_status !== 'completed').map(img => img.id);
    if (unprocessedIds.length === 0) {
      alert("All images are already processed!");
      return;
    }
    
    setIsSelectionMode(true);
    setSelectedImageIds(new Set(unprocessedIds));
    setTimeout(() => document.getElementById('btn-run-detection')?.click(), 100);
  };

  const stats = {
    totalObjects: detectedObjects.length,
    avgConfidence: detectedObjects.length > 0 
      ? Math.round((detectedObjects.reduce((acc, obj) => acc + obj.confidence, 0) / detectedObjects.length) * 100) 
      : 0,
    uniqueClasses: new Set(detectedObjects.map(obj => obj.class_name)).size,
    closestObject: detectedObjects.length > 0 
      ? Math.min(...detectedObjects.map(obj => obj.distance_from_camera)).toFixed(1) 
      : '-'
  };

  const classBreakdown = detectedObjects.reduce((acc, obj) => {
    if (!acc[obj.class_name]) {
      acc[obj.class_name] = { count: 0, totalDist: 0, totalConf: 0 };
    }
    acc[obj.class_name].count += 1;
    acc[obj.class_name].totalDist += obj.distance_from_camera;
    acc[obj.class_name].totalConf += obj.confidence;
    return acc;
  }, {} as Record<string, { count: number, totalDist: number, totalConf: number }>);

  if (isLoading) {
    return <div className="min-h-screen bg-[#121212] flex items-center justify-center text-white"><Loader2 className="animate-spin" size={32} /></div>;
  }

  return (
    <div className="min-h-screen bg-neutral-900 text-neutral-300 p-6 space-y-6">
      
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg">
            <ChartColumn className="text-white" size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Estimation</h1>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={() => {
              setIsSelectionMode(!isSelectionMode);
              if (isSelectionMode) setSelectedImageIds(new Set());
            }}
            className={`px-4 py-2 border rounded-lg text-sm transition-colors ${isSelectionMode ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10' : 'border-zinc-700 hover:bg-zinc-800'}`}
          >
            {isSelectionMode ? 'Cancel Selection' : 'Select Images'}
          </button>
          
          <button 
            onClick={handleRunAll}
            className="flex items-center gap-2 px-4 py-2 border border-zinc-700 hover:bg-zinc-800 rounded-lg text-sm transition-colors"
          >
            <Play size={16} /> Run All
          </button>
          
          <button 
            id="btn-run-detection"
            onClick={handleRunDetection}
            disabled={isBatchProcessing || isDetecting || (isSelectionMode && selectedImageIds.size === 0)}
            className="flex items-center gap-2 px-4 py-2 bg-[#B8AB9C] hover:bg-[#B8AB9C]/70 text-neutral-900 font-semibold rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            {isBatchProcessing || isDetecting ? <Loader2 size={16} className="animate-spin" /> : <Scan size={16} />}
            {isSelectionMode ? `Run Selected (${selectedImageIds.size})` : (isDetecting ? 'Processing...' : 'Run Detection')}
          </button>
        </div>
      </div>

      {/* Image Browser */}
      <div className="bg-neutral-900/20 border border-zinc-800 rounded-xl p-4">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2 text-zinc-400 font-medium">
            <ImageIcon size={18} /> Image Browser <span className="text-zinc-600 text-sm font-normal">({images.indexOf(selectedImage!) + 1} / {images.length})</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-zinc-700">
          {images.map((img) => (
            <div 
              key={img.id}
              onClick={() => !isSelectionMode && setSelectedImage(img)}
              className={`relative flex-shrink-0 w-48 h-28 rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${(selectedImage?.id === img.id && !isSelectionMode) ? 'border-[#B8AB9C]' : 'border-transparent hover:border-neutral-600'}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt={img.filename} className={`w-full h-full object-cover ${isSelectionMode ? 'opacity-70' : ''}`} />
              
              {/* ส่วนที่ต้องเพิ่ม: Checkbox ให้กดเลือกได้ */}
              {isSelectionMode && (
                <div 
                  className="absolute inset-0 bg-black/20 flex items-center justify-center cursor-pointer" 
                  onClick={(e) => toggleSelectImage(img.id, e)}
                >
                  {selectedImageIds.has(img.id) ? <CheckSquare size={32} className="text-[#B8AB9C]" /> : <Square size={32} className="text-zinc-400" />}
                </div>
              )}

              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-2 text-xs text-white text-center">
                {img.filename.split('.')[0]}
              </div>
              
              {/* โชว์ Badge สถานะ เฉพาะตอนไม่ได้เปิดโหมดเลือก */}
              {!isSelectionMode && (
                <div className="absolute top-2 right-2">
                  {(img.detection_status === 'processing' || img.detection_status === 'queued') && (
                    <div className="bg-zinc-900/80 rounded-full p-1"><Loader2 size={14} className="text-[#B8AB9C] animate-spin" /></div>
                  )}
                  {img.detection_status === 'completed' && (
                    <div className="bg-emerald-500 rounded-full p-0.5"><CheckCircle2 size={12} className="text-black" /></div>
                  )}
                  {img.detection_status === 'failed' && (
                    <div className="bg-red-500 rounded-full p-0.5"><AlertCircle size={12} className="text-white" /></div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      {currentImageStatus === 'idle' || currentImageStatus === 'failed' ? (
        
        // State 1: No Estimation Yet
        <div className="bg-[#1e1e1e] border border-zinc-800 rounded-xl flex flex-col items-center justify-center p-20 min-h-[400px]">
          <Scan size={48} className="text-zinc-600 mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">
            {currentImageStatus === 'failed' ? 'Detection Failed' : 'No estimation yet'}
          </h2>
          <p className="text-zinc-400 mb-6 text-center max-w-sm">
            {currentImageStatus === 'failed' 
              ? `Error: ${statusMessage}. Please try running detection again.` 
              : 'Select an image and click "Run Detection" to send it to the backend for object detection and distance estimation.'}
          </p>
          <button 
            onClick={handleRunDetection}
            className="flex items-center gap-2 px-6 py-3 bg-[#B8AB9C] hover:bg-[#B8AB9C]/70 text-zinc-900 font-semibold rounded-lg transition-colors shadow-lg shadow-[#B8AB9C]/20"
          >
            <Scan size={18} />
            Run Detection on {selectedImage?.filename.split('.')[0]}
          </button>
        </div>

      ) : currentImageStatus === 'processing' ? (
        
        // State 2: Processing
        <div className="bg-[#1e1e1e] border border-zinc-800 rounded-xl flex flex-col items-center justify-center p-20 min-h-[400px]">
          <Loader2 size={48} className="text-emerald-500 mb-4 animate-spin" />
          <h2 className="text-xl font-bold text-white mb-2">Analyzing Image...</h2>
          <p className="text-[#B8AB9C] mb-6 text-center font-mono text-sm bg-[#B8AB9C]/20 px-4 py-2 rounded-full border border-[#B8AB9C]/50">
            {statusMessage || 'Processing...'}
          </p>
        </div>

      ) : (

        // State 3: Estimation Results (Completed)
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            
            {/* Image Viewer */}
            <div className="bg-[#1e1e1e] border border-zinc-800 rounded-xl p-4">
              <div className="flex justify-between items-center mb-4 text-sm text-zinc-400">
                <div className="flex items-center gap-2 text-emerald-400">
                  <CheckCircle2 size={16} /> 
                  {statusMessage || `Detection completed — ${detectedObjects.length} objects found`}
                </div>
              </div>
              
              <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={selectedImage?.url} alt="Result" className="w-full h-full object-cover" />
                
                {detectedObjects.map((obj) => (
                  <div 
                    key={obj.id} 
                    className="absolute border-2 border-emerald-500 bg-emerald-500/10 pointer-events-none"
                    style={{
                      left: `${obj.bbox_xmin * 100}%`,
                      top: `${obj.bbox_ymin * 100}%`,
                      width: `${(obj.bbox_xmax - obj.bbox_xmin) * 100}%`,
                      height: `${(obj.bbox_ymax - obj.bbox_ymin) * 100}%`
                    }}
                  >
                    <div className="absolute -top-6 left-[-2px] bg-emerald-500 text-zinc-900 text-[10px] font-bold px-1.5 py-0.5 rounded-t whitespace-nowrap">
                      {obj.class_name}: {obj.distance_from_camera ? `${obj.distance_from_camera.toFixed(2)}m` : 'N/A'}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Detected Objects Table */}
            <div className="bg-[#1e1e1e] border border-zinc-800 rounded-xl p-4">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2 font-semibold text-white">
                  <Scan size={18} className="text-white" /> Detected Objects
                </div>
                <div className="text-sm text-zinc-500">{detectedObjects.length} found</div>
              </div>
              
              <div className="overflow-x-auto">
                {detectedObjects.length > 0 ? (
                  <table className="w-full text-sm text-left">
                    <thead className="text-zinc-500 border-b border-zinc-800">
                      <tr>
                        <th className="pb-3 font-medium">#</th>
                        <th className="pb-3 font-medium">Object</th>
                        <th className="pb-3 font-medium">Distance</th>
                        <th className="pb-3 font-medium">Confidence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detectedObjects.map((obj, idx) => (
                        <tr key={obj.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                          <td className="py-3 text-zinc-500">{idx + 1}</td>
                          <td className="py-3 text-white capitalize flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500"></div> {obj.class_name}
                          </td>
                          <td className="py-3 text-emerald-400 font-mono">⇋ {obj.distance_from_camera.toFixed(2)}m</td>
                          <td className="py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-24 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500" style={{ width: `${obj.confidence * 100}%` }}></div>
                              </div>
                              <span className="text-zinc-400 text-xs">{Math.round(obj.confidence * 100)}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="text-center py-8 text-neutral-500 flex flex-col items-center gap-2">
                    <AlertCircle size={24} className="text-neutral-600" />
                    <p>No objects were detected in this image.</p>
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Right Column: Stats Sidebar */}
          <div className="space-y-6">
            <div className="bg-[#1e1e1e] border border-zinc-800 rounded-xl p-4">
              <h3 className="font-semibold text-white mb-4">Detection Summary</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-zinc-900/50 border border-zinc-800 p-3 rounded-lg text-center">
                  <div className="text-2xl font-bold text-white mb-1">{stats.totalObjects}</div>
                  <div className="text-xs text-zinc-500">Objects Found</div>
                </div>
                <div className="bg-zinc-900/50 border border-zinc-800 p-3 rounded-lg text-center">
                  <div className="text-2xl font-bold text-white mb-1">{stats.avgConfidence}%</div>
                  <div className="text-xs text-zinc-500">Avg Confidence</div>
                </div>
                <div className="bg-zinc-900/50 border border-zinc-800 p-3 rounded-lg text-center">
                  <div className="text-2xl font-bold text-white mb-1">{stats.uniqueClasses}</div>
                  <div className="text-xs text-zinc-500">Unique Classes</div>
                </div>
                <div className="bg-zinc-900/50 border border-zinc-800 p-3 rounded-lg text-center">
                  <div className="text-2xl font-bold text-white mb-1">{stats.closestObject}m</div>
                  <div className="text-xs text-zinc-500">Closest Object</div>
                </div>
              </div>
            </div>

            {detectedObjects.length > 0 && (
              <div className="bg-[#1e1e1e] border border-zinc-800 rounded-xl p-4">
                <h3 className="font-semibold text-white mb-4">Class Breakdown</h3>
                <div className="space-y-4">
                  {Object.entries(classBreakdown).map(([className, data]) => (
                    <div key={className} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 capitalize text-white">
                        <div className="w-2 h-2 rounded-full bg-emerald-500"></div> {className}
                        <span className="text-xs bg-neutral-800 px-1.5 py-0.5 rounded text-neutral-400">{data.count}</span>
                      </div>
                      <div className="flex items-center gap-4 text-neutral-500 text-xs">
                        <span>avg {(data.totalDist / data.count).toFixed(1)}m</span>
                        <span>{Math.round((data.totalConf / data.count) * 100)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}