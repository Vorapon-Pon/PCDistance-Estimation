'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Play, ChartColumn, CheckSquare, Search, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize, CheckCircle2, Image as ImageIcon, Loader2, Scan, Square, AlertCircle, SlidersHorizontal, Download, FileJson, PackageOpen } from 'lucide-react';
import { createClient } from '@/utils/client';
import { processEstimateCredits } from './actions';
import CreditConfirmModal from '@/components/projects/CreditConfirmModal';
import { useDetectionStore } from '@/store/useDetectionStore';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface ProjectImage {
  id: string;
  storage_path: string;
  filename: string;
  url: string;
  detection_status?: string;  
  detection_message?: string; 
}

interface DetectedObject {
  id: string;
  image_id?: string;
  class_name: string;
  confidence: number;
  distance_from_camera: number;
  bbox_xmin: number; 
  bbox_ymin: number;
  bbox_xmax: number;
  bbox_ymax: number;
}

interface ProjectClass {
  name: string;
  color: string;
  is_active: boolean;
}

// COCO-style Export Types
interface CocoCategory {
  id: number;
  name: string;
  supercategory: string;
}

interface CocoAnnotation {
  id: number;
  image_id: number;
  category_id: number;
  bbox: [number, number, number, number]; // [x, y, width, height] in pixels
  bbox_normalized: [number, number, number, number]; // [xmin, ymin, xmax, ymax] normalized 0-1
  area: number;
  confidence: number;
  distance_from_camera: number | null;
  iscrowd: 0;
}

interface CocoImage {
  id: number;
  file_name: string;
  storage_path: string;
  url: string;
  detection_status: string;
}

interface CocoExport {
  info: {
    description: string;
    project_id: string;
    export_date: string;
    format: string;
    version: string;
    total_images: number;
    total_annotations: number;
  };
  categories: CocoCategory[];
  images: CocoImage[];
  annotations: CocoAnnotation[];
}

export default function EstimationPage() {
  const supabase = createClient();
  const params = useParams();
  const projectId = params.id as string; 

  const [images, setImages] = useState<ProjectImage[]>([]);
  const [selectedImage, setSelectedImage] = useState<ProjectImage | null>(null);
  const [detectedObjects, setDetectedObjects] = useState<DetectedObject[]>([]);

  const [availableClasses, setAvailableClasses] = useState<ProjectClass[]>([]);
  const [classColors, setClassColors] = useState<Record<string, string>>({});

  const [minConfidence, setMinConfidence] = useState<number>(50);
  const [activeClassFilters, setActiveClassFilters] = useState<Set<string>>(new Set());
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedImageIds, setSelectedImageIds] = useState<Set<string>>(new Set());

  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isPaying, setIsPaying] = useState(false); 
  const [idsToProcess, setIdsToProcess] = useState<string[]>([]);
  const [currentCredits, setCurrentCredits] = useState<number>(0);

  // Export states
  const [isExportingProject, setIsExportingProject] = useState(false);

  const startDetection = useDetectionStore(state => state.startDetection);
  const jobs = useDetectionStore(state => state.jobs);
  
  const CREDITS_PER_IMAGE = 1;

  const currentJob = selectedImage ? jobs[selectedImage.id] : null;
  const currentImageStatus = currentJob?.status || selectedImage?.detection_status || 'idle';
  const statusMessage = currentJob?.message || selectedImage?.detection_message || '';
  const isDetecting = currentImageStatus === 'processing' || currentImageStatus === 'pending';
  const isBatchProcessing = Object.values(jobs).some(job => job.status === 'processing' || job.status === 'pending');

  useEffect(() => {
    const fetchImagesAndColors = async () => {
      if (!projectId) return;
      setIsLoading(true);
      try {
        const { data: classData } = await supabase
          .from('project_classes')
          .select('name, color, is_active')
          .eq('project_id', projectId);

        if (classData) {
          const colorMap: Record<string, string> = {};
          const classesList: ProjectClass[] = [];
          const initialActiveFilters = new Set<string>();

          classData.forEach(cls => { 
            colorMap[cls.name] = cls.color; 
            classesList.push(cls as ProjectClass);
            if (cls.is_active) {
              initialActiveFilters.add(cls.name);
            }
          });
          
          setClassColors(colorMap);
          setAvailableClasses(classesList);
          setActiveClassFilters(initialActiveFilters);
        }

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
        console.error("Error fetching data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchImagesAndColors();
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
    const fetchUserCredits = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase
        .from('profiles') 
        .select('credits')
        .eq('id', user.id)
        .single();
      if (!error && data) {
        setCurrentCredits(data.credits);
      }
    };
    fetchUserCredits();
  }, []);

  useEffect(() => {
    if (selectedImage) {
      if (selectedImage.detection_status === 'completed') {
        fetchDetectedObjects(selectedImage.id);
      } else {
        setDetectedObjects([]);
      }
    }
  }, [selectedImage]);

  useEffect(() => {
    if (!projectId) return;

    const channel = supabase
      .channel(`project-updates-${projectId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'project_images',
          filter: `project_id=eq.${projectId}`
        },
        (payload) => {
          const updatedImage = payload.new;

          setImages(prev =>
            prev.map(img =>
              img.id === updatedImage.id
                ? { ...img, detection_status: updatedImage.detection_status, detection_message: updatedImage.detection_message }
                : img
            )
          );

          if (selectedImage && updatedImage.id === selectedImage.id) {
            setSelectedImage(prev => prev ? { ...prev, detection_status: updatedImage.detection_status, detection_message: updatedImage.detection_message } : null);

            if (updatedImage.detection_status === 'completed') {
              fetchDetectedObjects(updatedImage.id);
            } else if (updatedImage.detection_status === 'failed') {
              alert(`Detection Error: ${updatedImage.detection_message}`);
            }
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [projectId, selectedImage]);

  const handlePrepareDetection = () => {
    const ids = isSelectionMode ? Array.from(selectedImageIds) : [selectedImage?.id];
    const validIds = ids.filter(Boolean) as string[];
    
    if (validIds.length === 0) {
      alert("Please select at least one image.");
      return;
    }

    setIdsToProcess(validIds);
    setIsConfirmModalOpen(true); 
  };

  const handleConfirmDetection = async () => {
    setIsPaying(true);
    const totalCost = idsToProcess.length * CREDITS_PER_IMAGE;
    const creditResult = await processEstimateCredits(
      totalCost, 
      `Distance estimation for ${idsToProcess.length} image(s)`
    );
    setIsPaying(false);

    if (!creditResult.success) {
      alert(creditResult.error);
      setIsConfirmModalOpen(false); 
      return;
    }

    setIsConfirmModalOpen(false); 
    if (isSelectionMode) {
      setIsSelectionMode(false);
      setSelectedImageIds(new Set());
    }

    startDetection(idsToProcess);
    setDetectedObjects([]); 

    fetch(`${API_URL}/api/run-detection`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_id: projectId,
        image_id: idsToProcess,
        bucket_name: 'project_files'
      })
    }).catch(error => {
      console.error("Error connecting to backend", error);
    });
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

  const toggleClassFilter = (className: string) => {
    const newFilters = new Set(activeClassFilters);
    if (newFilters.has(className)) {
      newFilters.delete(className);
    } else {
      newFilters.add(className);
    }
    setActiveClassFilters(newFilters);
  };

  const filteredObjects = detectedObjects.filter(obj => {
    const meetConfidence = obj.confidence >= (minConfidence / 100);
    const isClassActive = activeClassFilters.has(obj.class_name);
    return meetConfidence && isClassActive;
  });

  const stats = {
    totalObjects: filteredObjects.length,
    avgConfidence: filteredObjects.length > 0 
      ? Math.round((filteredObjects.reduce((acc, obj) => acc + obj.confidence, 0) / filteredObjects.length) * 100) 
      : 0,
    uniqueClasses: new Set(filteredObjects.map(obj => obj.class_name)).size,
    closestObject: filteredObjects.length > 0 
      ? Math.min(...filteredObjects.map(obj => obj.distance_from_camera)).toFixed(1) 
      : '-'
  };

  const classBreakdown = filteredObjects.reduce((acc, obj) => {
    if (!acc[obj.class_name]) {
      acc[obj.class_name] = { count: 0, totalDist: 0, totalConf: 0 };
    }
    acc[obj.class_name].count += 1;
    acc[obj.class_name].totalDist += obj.distance_from_camera;
    acc[obj.class_name].totalConf += obj.confidence;
    return acc;
  }, {} as Record<string, { count: number, totalDist: number, totalConf: number }>);

  const getClassColor = (className: string) => {
    return classColors[className] || '#10b981';
  };

  const buildCategories = (classNames: string[]): CocoCategory[] => {
    const unique = Array.from(new Set(classNames));
    return unique.map((name, idx) => ({
      id: idx + 1,
      name,
      supercategory: 'object',
    }));
  };

  const downloadJSON = (data: object, filename: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCurrentImage = () => {
    if (!selectedImage || detectedObjects.length === 0) return;

    const allClassNames = detectedObjects.map(o => o.class_name);
    const categories = buildCategories(allClassNames);
    const catMap = Object.fromEntries(categories.map(c => [c.name, c.id]));

    const cocoImage: CocoImage = {
      id: 1,
      file_name: selectedImage.filename,
      storage_path: selectedImage.storage_path,
      url: selectedImage.url,
      detection_status: selectedImage.detection_status || 'completed',
    };

    const annotations: CocoAnnotation[] = detectedObjects.map((obj, idx) => {
      const w = obj.bbox_xmax - obj.bbox_xmin;
      const h = obj.bbox_ymax - obj.bbox_ymin;
      return {
        id: idx + 1,
        image_id: 1,
        category_id: catMap[obj.class_name],
        bbox: [obj.bbox_xmin, obj.bbox_ymin, w, h],
        bbox_normalized: [obj.bbox_xmin, obj.bbox_ymin, obj.bbox_xmax, obj.bbox_ymax],
        area: w * h,
        confidence: obj.confidence,
        distance_from_camera: obj.distance_from_camera ?? null,
        iscrowd: 0,
      };
    });

    const exportData: CocoExport = {
      info: {
        description: 'Object Detection Export (Single Image)',
        project_id: projectId,
        export_date: new Date().toISOString(),
        format: 'COCO-style with distance metadata',
        version: '1.0',
        total_images: 1,
        total_annotations: annotations.length,
      },
      categories,
      images: [cocoImage],
      annotations,
    };

    const safeName = selectedImage.filename.replace(/\.[^/.]+$/, '');
    downloadJSON(exportData, `detection_${safeName}.json`);
  };

  const handleExportProject = async () => {
    setIsExportingProject(true);
    try {
      // 1. Fetch all completed images
      const { data: allImages, error: imgErr } = await supabase
        .from('project_images')
        .select('id, storage_path, detection_status, detection_message')
        .eq('project_id', projectId)
        .eq('detection_status', 'completed')
        .order('upload_at', { ascending: true });

      if (imgErr) throw imgErr;
      if (!allImages || allImages.length === 0) {
        alert('No completed detections found in this project.');
        return;
      }

      // 2. Fetch all detected objects for this project
      const { data: allObjects, error: objErr } = await supabase
        .from('detected_objects')
        .select('*')
        .eq('project_id', projectId);

      if (objErr) throw objErr;

      const BUCKET_NAME = 'project_files';

      // 3. Build COCO images list
      const cocoImages: CocoImage[] = allImages.map((img, idx) => {
        const { data: urlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(img.storage_path);
        return {
          id: idx + 1,
          file_name: img.storage_path.split('/').pop() || `image_${idx + 1}`,
          storage_path: img.storage_path,
          url: urlData.publicUrl,
          detection_status: img.detection_status,
        };
      });

      // Map original image UUID → coco numeric id
      const imageIdMap = Object.fromEntries(allImages.map((img, idx) => [img.id, idx + 1]));

      // 4. Build categories from all class names
      const allClassNames = (allObjects || []).map((o: DetectedObject) => o.class_name);
      const categories = buildCategories(allClassNames);
      const catMap = Object.fromEntries(categories.map(c => [c.name, c.id]));

      // 5. Build annotations
      const annotations: CocoAnnotation[] = (allObjects || [])
        .filter((obj: DetectedObject) => imageIdMap[obj.image_id as unknown as string] !== undefined)
        .map((obj: DetectedObject & { image_id: string }, idx) => {
          const w = obj.bbox_xmax - obj.bbox_xmin;
          const h = obj.bbox_ymax - obj.bbox_ymin;
          return {
            id: idx + 1,
            image_id: imageIdMap[obj.image_id],
            category_id: catMap[obj.class_name],
            bbox: [obj.bbox_xmin, obj.bbox_ymin, w, h] as [number, number, number, number],
            bbox_normalized: [obj.bbox_xmin, obj.bbox_ymin, obj.bbox_xmax, obj.bbox_ymax] as [number, number, number, number],
            area: w * h,
            confidence: obj.confidence,
            distance_from_camera: obj.distance_from_camera ?? null,
            iscrowd: 0,
          };
        });

      const exportData: CocoExport = {
        info: {
          description: 'Object Detection Export (Full Project)',
          project_id: projectId,
          export_date: new Date().toISOString(),
          format: 'COCO-style with distance metadata',
          version: '1.0',
          total_images: cocoImages.length,
          total_annotations: annotations.length,
        },
        categories,
        images: cocoImages,
        annotations,
      };

      downloadJSON(exportData, `project_${projectId}_detection_export.json`);
    } catch (err) {
      console.error('Export error:', err);
      alert('Failed to export project data. Please try again.');
    } finally {
      setIsExportingProject(false);
    }
  };

  if (isLoading) {
    return <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-white"><Loader2 className="animate-spin" size={32} /></div>;
  }

  const completedCount = images.filter(img => img.detection_status === 'completed').length;

  return (
    <div className="min-h-screen bg-neutral-900 text-neutral-300 p-4 space-y-6">
      
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg">
            <ChartColumn className="text-white" size={28} />
          </div>
          <div>
            <h1 className="text-xl text-semibold text-white">Estimation</h1>
          </div>
        </div>
        
        <div className="flex items-center gap-3 flex-wrap">

          {/* ── Export Buttons Group ── */}
          <div className="flex items-center gap-2 border border-zinc-700 rounded-lg p-1">
            {/* Export Current Image */}
            <button
              onClick={handleExportCurrentImage}
              disabled={!selectedImage || detectedObjects.length === 0 || currentImageStatus !== 'completed'}
              title="Export detections for the current image as JSON"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-zinc-300 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <FileJson size={14} className="text-emerald-400" />
              Export Image
            </button>

            <div className="w-px h-5 bg-zinc-700" />

            {/* Export Entire Project */}
            <button
              onClick={handleExportProject}
              disabled={isExportingProject || completedCount === 0}
              title={`Export all ${completedCount} completed detections in this project`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-zinc-300 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {isExportingProject
                ? <Loader2 size={14} className="animate-spin text-emerald-400" />
                : <PackageOpen size={14} className="text-emerald-400" />
              }
              {isExportingProject ? 'Exporting...' : `Export Project (${completedCount})`}
            </button>
          </div>

          {/* ── Detection Buttons ── */}
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
            onClick={handlePrepareDetection}
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
          {images.map((img) => {
            const jobStatus = jobs[img.id]?.status || img.detection_status;
            
            return (
              <div 
                key={img.id}
                onClick={() => !isSelectionMode && setSelectedImage(img)}
                className={`relative flex-shrink-0 w-48 h-28 rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${(selectedImage?.id === img.id && !isSelectionMode) ? 'border-[#B8AB9C]' : 'border-transparent hover:border-neutral-600'}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt={img.filename} className={`w-full h-full object-cover ${isSelectionMode ? 'opacity-70' : ''}`} />
                
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
                
                {!isSelectionMode && (
                  <div className="absolute top-2 right-2 shadow-sm">
                    {(jobStatus === 'processing' || jobStatus === 'pending') && (
                      <div className="bg-zinc-900/80 rounded-full p-1"><Loader2 size={14} className="text-[#B8AB9C] animate-spin" /></div>
                    )}
                    {jobStatus === 'completed' && (
                      <div className="bg-emerald-500 rounded-full p-0.5"><CheckCircle2 size={12} className="text-black" /></div>
                    )}
                    {jobStatus === 'failed' && (
                      <div className="bg-red-500 rounded-full p-0.5"><AlertCircle size={12} className="text-white" /></div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Content Area */}
      {currentImageStatus === 'idle' || currentImageStatus === 'failed' ? (
        
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
            onClick={handlePrepareDetection}
            className="flex items-center gap-2 px-6 py-3 bg-[#B8AB9C] hover:bg-[#B8AB9C]/70 text-zinc-900 font-semibold rounded-lg transition-colors shadow-lg shadow-[#B8AB9C]/20"
          >
            <Scan size={18} />
            Run Detection on {selectedImage?.filename.split('.')[0]}
          </button>
        </div>

      ) : (currentImageStatus === 'processing' || currentImageStatus === 'pending') ? (
        
        <div className="bg-[#1e1e1e] border border-zinc-800 rounded-xl flex flex-col items-center justify-center p-20 min-h-[400px]">
          <Loader2 size={48} className="text-[#B8AB9C] mb-4 animate-spin" />
          <h2 className="text-xl font-bold text-white mb-2">Analyzing Image...</h2>
          <p className="text-[#B8AB9C] mb-6 text-center font-mono text-sm bg-[#B8AB9C]/20 px-4 py-2 rounded-full border border-[#B8AB9C]/50">
            {statusMessage || 'Processing in background...'}
          </p>
          <p className="text-zinc-500 text-xs text-center">You can navigate to other pages. We will notify you when it's done.</p>
        </div>

      ) : (

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            
            {/* Image Viewer */}
            <div className="bg-[#1e1e1e] border border-zinc-800 rounded-xl p-4">
              <div className="flex justify-between items-center mb-4 text-sm text-zinc-400">
                <div className="flex items-center gap-2 text-emerald-400">
                  <CheckCircle2 size={16} /> 
                  {statusMessage || `Detection completed`}
                </div>

                {/* Export Current Image Button (inline in viewer header) */}
                <button
                  onClick={handleExportCurrentImage}
                  disabled={detectedObjects.length === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <Download size={13} />
                  Export JSON
                </button>
              </div>
              
              <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={selectedImage?.url} alt="Result" className="w-full h-full object-cover" />
                
                {filteredObjects.map((obj) => {
                  const objColor = getClassColor(obj.class_name);
                  
                  return (
                    <div 
                      key={obj.id} 
                      className="absolute pointer-events-none transition-all"
                      style={{
                        left: `${obj.bbox_xmin * 100}%`,
                        top: `${obj.bbox_ymin * 100}%`,
                        width: `${(obj.bbox_xmax - obj.bbox_xmin) * 100}%`,
                        height: `${(obj.bbox_ymax - obj.bbox_ymin) * 100}%`,
                        border: `2px solid ${objColor}`,        
                        backgroundColor: `${objColor}33`        
                      }}
                    >
                      <div 
                        className="absolute -top-6 left-[-2px] text-zinc-900 text-[10px] font-bold px-1.5 py-0.5 rounded-t whitespace-nowrap"
                        style={{ backgroundColor: objColor }}   
                      >
                        {obj.class_name} ({Math.round(obj.confidence * 100)}%): {obj.distance_from_camera ? `${obj.distance_from_camera.toFixed(2)}m` : 'N/A'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Detected Objects Table */}
            <div className="bg-[#1e1e1e] border border-zinc-800 rounded-xl p-4">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2 font-semibold text-white">
                  <Scan size={18} className="text-white" /> Detected Objects
                </div>
                <div className="text-sm text-zinc-500">{filteredObjects.length} found</div>
              </div>
              
              <div className="overflow-x-auto">
                {filteredObjects.length > 0 ? (
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
                      {filteredObjects.map((obj, idx) => {
                        const objColor = getClassColor(obj.class_name);
                        return (
                          <tr key={obj.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                            <td className="py-3 text-zinc-500">{idx + 1}</td>
                            <td className="py-3 text-white capitalize flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: objColor }}></div> 
                              {obj.class_name}
                            </td>
                            <td className="py-3 font-mono" style={{ color: objColor }}>
                              ⇋ {obj.distance_from_camera.toFixed(2)}m
                            </td>
                            <td className="py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-24 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                                  <div className="h-full" style={{ width: `${obj.confidence * 100}%`, backgroundColor: objColor }}></div>
                                </div>
                                <span className="text-zinc-400 text-xs">{Math.round(obj.confidence * 100)}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <div className="text-center py-8 text-neutral-500 flex flex-col items-center gap-2">
                    <AlertCircle size={24} className="text-neutral-600" />
                    <p>No objects match your current filters.</p>
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Right Column: Stats Sidebar & Filters */}
          <div className="space-y-6">
            {detectedObjects.length > 0 && (
              <div className="bg-[#1e1e1e] border border-zinc-800 rounded-xl p-4">
                <div className="flex items-center gap-2 font-semibold text-white mb-6">
                  <SlidersHorizontal size={18} /> Filters
                </div>
                
                {/* Confidence Slider */}
                <div className="mb-6">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-zinc-400">Min Confidence</span>
                    <span className="text-white font-mono">{minConfidence}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={minConfidence}
                    onChange={(e) => setMinConfidence(Number(e.target.value))}
                    className="w-full accent-emerald-500 bg-zinc-800 h-1.5 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                {/* Class Toggles */}
                <div>
                  <div className="text-sm text-zinc-400 mb-3">Detected Classes</div>
                  <div className="flex flex-wrap gap-2">
                    {availableClasses.map(cls => (
                      <button
                        key={cls.name}
                        onClick={() => toggleClassFilter(cls.name)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors flex items-center gap-2`}
                        style={{
                          borderColor: cls.color,
                          backgroundColor: activeClassFilters.has(cls.name) ? `${cls.color}33` : 'transparent', 
                          color: activeClassFilters.has(cls.name) ? cls.color : '#a1a1aa'
                        }}
                      >
                        {activeClassFilters.has(cls.name) && (
                          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cls.color }}></div>
                        )}
                        {cls.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="bg-[#1e1e1e] border border-zinc-800 rounded-xl p-4">
              <h3 className="font-semibold text-white mb-4">Detection Summary</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-zinc-900/50 border border-zinc-800 p-3 rounded-lg text-center">
                  <div className="text-2xl font-bold text-white mb-1">{stats.totalObjects}</div>
                  <div className="text-xs text-zinc-500">Objects Shown</div>
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

            {filteredObjects.length > 0 && (
              <div className="bg-[#1e1e1e] border border-zinc-800 rounded-xl p-4">
                <h3 className="font-semibold text-white mb-4">Class Breakdown</h3>
                <div className="space-y-4">
                  {Object.entries(classBreakdown).map(([className, data]) => {
                    const clsColor = getClassColor(className);
                    return (
                      <div key={className} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 capitalize text-white">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: clsColor }}></div> 
                          {className}
                          <span className="text-xs bg-neutral-800 px-1.5 py-0.5 rounded text-neutral-400">{data.count}</span>
                        </div>
                        <div className="flex items-center gap-4 text-neutral-500 text-xs">
                          <span>avg {(data.totalDist / data.count).toFixed(1)}m</span>
                          <span>{Math.round((data.totalConf / data.count) * 100)}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Export Info Card */}
            <div className="bg-[#1e1e1e] border border-zinc-700 rounded-xl p-4">
              <div className="flex items-center gap-2 font-semibold text-white mb-3">
                <FileJson size={16} className="text-emerald-400" />
                Export Object Detections
              </div>
              <p className="text-xs text-zinc-500 mb-4 leading-relaxed">
                Export detection results in COCO-style JSON format, compatible with YOLO, Detectron2, MMDetection, and other frameworks.
              </p>
              <div className="space-y-2">
                <button
                  onClick={handleExportCurrentImage}
                  disabled={detectedObjects.length === 0 || currentImageStatus !== 'completed'}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <FileJson size={13} className="text-emerald-400" />
                  Current Image ({detectedObjects.length} objects)
                </button>
                <button
                  onClick={handleExportProject}
                  disabled={isExportingProject || completedCount === 0}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-600/40 text-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {isExportingProject
                    ? <Loader2 size={13} className="animate-spin" />
                    : <PackageOpen size={13} />
                  }
                  {isExportingProject ? 'Exporting...' : `Full Project (${completedCount} images)`}
                </button>
              </div>

              {/* JSON Structure Preview */}
              <div className="mt-4 bg-zinc-900 rounded-lg p-3 text-[10px] font-mono text-zinc-500 leading-relaxed overflow-hidden">
                <span className="text-zinc-400">{'{'}</span><br />
                &nbsp;&nbsp;<span className="text-emerald-400">"info"</span>: {'{ project_id, export_date, ... }'}<br />
                &nbsp;&nbsp;<span className="text-emerald-400">"categories"</span>: [{'{ id, name }'}]<br />
                &nbsp;&nbsp;<span className="text-emerald-400">"images"</span>: [{'{ id, file_name, url }'}]<br />
                &nbsp;&nbsp;<span className="text-emerald-400">"annotations"</span>: [{'{'}
                <br />
                &nbsp;&nbsp;&nbsp;&nbsp;<span className="text-zinc-400">bbox, confidence,</span><br />
                &nbsp;&nbsp;&nbsp;&nbsp;<span className="text-zinc-400">distance_from_camera</span><br />
                &nbsp;&nbsp;{'}'}]<br />
                <span className="text-zinc-400">{'}'}</span>
              </div>
            </div>

          </div>

        </div>
      )}
      <CreditConfirmModal 
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={handleConfirmDetection}
        title="Confirm Estimation"
        isLoading={isPaying}
        totalCost={idsToProcess.length * CREDITS_PER_IMAGE}
        remainCredit={currentCredits - (idsToProcess.length * CREDITS_PER_IMAGE)}
        details={[
          { label: 'Images to process', value: `${idsToProcess.length} image(s)` },
          { label: 'Cost per image', value: `${CREDITS_PER_IMAGE} credits` },
          { label: 'Current credits', value: `${currentCredits}` },
        ]}
      />
    </div>
  );
}