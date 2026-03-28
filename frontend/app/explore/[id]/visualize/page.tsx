'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/utils/client';
import { BarChart3, Maximize2, Copy, ChevronLeft, ChevronRight, ImageIcon, Compass, RotateCw, Crosshair } from 'lucide-react';
import { toast } from 'sonner';
import Script from 'next/script';
import { useSlicingStore } from '@/store/useSlicingStore'; 

export default function VisualizePage() {
  const params = useParams();
  const projectId = params.id as string;
  const supabase = createClient();
  const router = useRouter();

  const { startSlicing } = useSlicingStore();

  const [showRadiusModal, setShowRadiusModal] = useState(false);
  const [sliceRadius, setSliceRadius] = useState<number>(50);

  const panoramaRef = useRef<HTMLDivElement>(null);
  const [viewer, setViewer] = useState<any>(null);
  const [imageList, setImageList] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const [isLoading, setIsLoading] = useState(true);
  const [projectData, setProjectData] = useState<any>(null);
  const [potreeUrl, setPotreeUrl] = useState<string>('');
  
  const [viewMode, setViewMode] = useState<'split' | '3d' | '360'>('split');

  const [activeData, setActiveData] = useState({
    id: '',
    filename: '',
    coords: { x: 0, y: 0, z: 0, heading: 0, pitch: 0, roll: 0},
    imageUrl: '/api/placeholder/800/400'
  });

  const BUCKET_NAME = 'project_files';

  useEffect(() => {
    async function fetchVisualizeData() {
      setIsLoading(true);
      try {
        const { data: project, error: projectError } = await supabase
          .from('projects')
          .select('*')
          .eq('id', projectId)
          .single();
        if (projectError) throw projectError;
        setProjectData(project);
        
        const { data: pointCloud } = await supabase
          .from('project_point_clouds')
          .select('potree_url, storage_path')
          .eq('project_id', projectId)
          .single();
          
        if (pointCloud?.potree_url) {
          setPotreeUrl(pointCloud.potree_url);
        } else {
          const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
          setPotreeUrl(`${baseUrl}/storage/v1/object/public/${BUCKET_NAME}/${projectId}/potree/metadata.json`);
        }

        const { data: camPosData } = await supabase
          .from('camera_position')
          .select(`x, y, z, heading, pitch, roll, image_filename, image_id, project_images!inner(storage_path)`)
          .eq('project_id', projectId)
          .order('image_filename', { ascending: true }); 

        if (camPosData && camPosData.length > 0) {
          const formattedImages = camPosData.map(camPos => {
            const storagePath = Array.isArray(camPos.project_images) 
              ? camPos.project_images[0]?.storage_path 
              : (camPos.project_images as any)?.storage_path;

            const { data: publicUrlData } = supabase.storage
              .from(BUCKET_NAME)
              .getPublicUrl(storagePath || '');

            return {
              id: camPos.image_id,
              filename: camPos.image_filename,
              coords: { 
                x: camPos.x || 0, 
                y: camPos.y || 0, 
                z: camPos.z || 0,
                heading: camPos.heading || 0,
                pitch: camPos.pitch || 0,
                roll: camPos.roll || 0,
              },
              imageUrl: storagePath ? publicUrlData.publicUrl : '/api/placeholder/800/400'
            };
          });

          setImageList(formattedImages);
          setActiveData(formattedImages[0]); 
          setCurrentIndex(0);
        }

      } catch (error) {
        console.error("Error fetching visualize data:", error);
      } finally {
        setIsLoading(false);
      }
    }

    if (projectId) {
      fetchVisualizeData(); 
    }
  }, [projectId, supabase]);

  const initPannellum = () => {
    if ((window as any).pannellum && panoramaRef.current && activeData.imageUrl) {
      if (viewer) viewer.destroy();

      const newViewer = (window as any).pannellum.viewer(panoramaRef.current, {
        type: "equirectangular",
        panorama: activeData.imageUrl,
        autoLoad: true,
        compass: true,
        northOffset: activeData.coords.heading || 0, 
        crossOrigin: "anonymous"
      });
      setViewer(newViewer);
    }
  };

  useEffect(() => {
    if (activeData.imageUrl) initPannellum();
  }, [activeData.imageUrl]);

  const iframeSrc = `/potree/viewer.html?cloudUrl=${encodeURIComponent(potreeUrl)}`;

  useEffect(() => {
    const iframe = document.getElementById('potree-iframe') as HTMLIFrameElement;
    if (iframe && iframe.contentWindow && activeData?.coords) {
      iframe.contentWindow.postMessage({
        type: 'UPDATE_CAMERA',
        coords: activeData.coords
      }, '*');
    }
  }, [activeData]); 

  const handleNextImage = () => {
    if (imageList.length === 0) return;
    const nextIndex = (currentIndex + 1) % imageList.length; 
    setCurrentIndex(nextIndex);
    setActiveData(imageList[nextIndex]);
  };

  const handlePrevImage = () => {
    if (imageList.length === 0) return;
    const prevIndex = (currentIndex - 1 + imageList.length) % imageList.length; 
    setCurrentIndex(prevIndex);
    setActiveData(imageList[prevIndex]);
  };

  const handleSelectImage = (index: number) => {
    setCurrentIndex(index);
    setActiveData(imageList[index]);
  };

  const handleCopyJson = () => {
    const jsonStr = JSON.stringify({ image: activeData.filename, coords: activeData.coords }, null, 2);
    navigator.clipboard.writeText(jsonStr);
    toast.success('Copied to clipboard!');
  };

  const handleStartCalibration = () => {
    setShowRadiusModal(false);
    const currentImage = imageList[currentIndex];
    if (!currentImage || !projectData) {
      toast.error("ไม่พบข้อมูลรูปภาพหรือโปรเจกต์");
      return;
    }

    startSlicing(projectData.id, currentImage.id, sliceRadius);
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-neutral-900 text-white">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-neutral-600 border-t-white rounded-full animate-spin mb-4"></div>
          <p>Loading 3D Workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col p-6 min-h-screen bg-neutral-900 text-neutral-200 overflow-hidden">
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.css" />
      <Script 
        src="https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.js" 
        strategy="afterInteractive"
        onLoad={initPannellum} 
      />

      {/* Header */}
      <div className="pb-4 border-b border-neutral-800 bg-neutral-900 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="text-white" size={28} />
            <h1 className="text-xl text-semibold">Visualize: {projectData?.project_name || 'Unknown Project'}</h1>
          </div>
        </div>
      </div>

      <div className="flex bg-[#141414] p-1 rounded-lg border border-neutral-800">
        <button 
          onClick={() => setViewMode('3d')} 
          className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${viewMode === '3d' ? 'bg-neutral-700 text-white shadow' : 'text-neutral-500 hover:text-neutral-300'}`}
        >
          3D Only
        </button>
        <button 
          onClick={() => setViewMode('split')} 
          className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${viewMode === 'split' ? 'bg-neutral-700 text-white shadow' : 'text-neutral-500 hover:text-neutral-300'}`}
        >
          Split View
        </button>
        <button 
          onClick={() => setViewMode('360')} 
          className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${viewMode === '360' ? 'bg-neutral-700 text-white shadow' : 'text-neutral-500 hover:text-neutral-300'}`}
        >
          360 Only
        </button>
      </div>

      {/* Main Content: Split View */}
      <div className="flex flex-col md:flex-row h-[70vh] border-b border-neutral-800 min-h-0">
        
        {/* LEFT: Point Cloud View */}
        <div 
          id="point-cloud-container" 
          className={`relative border-neutral-800 group bg-black min-w-0 ${viewMode === '360' ? 'hidden' : 'flex-1'} ${viewMode === 'split' ? 'border-r' : ''}`}
        >
          <div className="absolute top-4 left-4 z-10 bg-black/60 px-3 py-1 rounded text-xs font-mono border border-neutral-700">
            3D Point Cloud View
          </div>
          
          <button 
            onClick={() => {
              const container = document.getElementById('point-cloud-container');
              if (container) {
                if (document.fullscreenElement) {
                  document.exitFullscreen();
                } else {
                  container.requestFullscreen();
                }
              }
            }}
            className="absolute bottom-4 right-4 z-10 bg-black/60 p-2 rounded hover:bg-black/80 text-white transition-all border border-neutral-700 flex items-center justify-center opacity-50 hover:opacity-100"
            title="Toggle Fullscreen"
          >
            <Maximize2 size={18} />
          </button>

          <div className="w-full h-full bg-black">
             {potreeUrl ? (
               <iframe 
                 id="potree-iframe"
                 src={iframeSrc} 
                 className="w-full h-full border-0"
                 title="Potree 3D Viewer"
                 allowFullScreen
               />
             ) : (
               <div className="flex items-center justify-center h-full text-neutral-500">
                 No Point Cloud Data Available
               </div>
             )}
          </div>
        </div>

        {/* RIGHT: Panorama View */}
        <div className={`relative bg-[#0A0A0A] flex flex-col min-w-0 ${viewMode === '3d' ? 'hidden' : 'flex-1'}`}>
          <div className="p-4 flex items-center justify-between border-b border-neutral-800/50 bg-neutral-900/30 flex-shrink-0">
            <span className="text-xs font-mono text-neutral-400 truncate">
              {activeData.filename} ({currentIndex + 1} / {imageList.length})
            </span>
          </div>

          <div className="flex-1 flex flex-col p-4 gap-4 min-h-0">
             <div className="w-full flex-1 bg-neutral-900 rounded shadow-xl overflow-hidden relative min-h-0">
              <div ref={panoramaRef} className="w-full h-full" />
                <div className="absolute inset-0 flex items-center justify-between px-4 pointer-events-none">
                  <button onClick={handlePrevImage} className="p-2 bg-black/40 rounded-full hover:bg-black/80 pointer-events-auto transition-all"><ChevronLeft size={24}/></button>
                  <button onClick={handleNextImage} className="p-2 bg-black/40 rounded-full hover:bg-black/80 pointer-events-auto transition-all"><ChevronRight size={24}/></button>
                </div>
             </div>

             {imageList.length > 1 && (
               <div className="w-full h-20 flex-shrink-0">
                 <div className="flex gap-2 overflow-x-auto h-full pb-2 custom-scrollbar items-center">
                   {imageList.map((img, idx) => (
                     <div 
                       key={img.id} 
                       onClick={() => handleSelectImage(idx)}
                       className={`relative flex-shrink-0 w-24 h-16 rounded overflow-hidden cursor-pointer border-2 transition-all ${idx === currentIndex ? 'border-blue-500 opacity-100' : 'border-neutral-700 opacity-50 hover:opacity-100'}`}
                     >
                       <img src={img.imageUrl} alt={img.filename} className="w-full h-full object-cover" />
                       <div className="absolute bottom-1 right-1 bg-black/60 rounded px-1">
                         <ImageIcon size={10} className="text-white"/>
                       </div>
                     </div>
                   ))}
                 </div>
               </div>
             )}
          </div>
        </div>
      </div>

      {/* Bottom Panel */}
      <div className="p-6 bg-neutral-950 border-t border-neutral-800 grid grid-cols-1 md:grid-cols-2 gap-8 flex-shrink-0">
        <div className="flex flex-col gap-6">
          <div>
            <h3 className="text-neutral-400 text-[13px] font-medium mb-3 flex items-center gap-2">
              <Compass size={14}/> Coordinates
            </h3>
            <div className="flex gap-2">
              {['X', 'Y', 'Z'].map((coord) => (
                <div key={coord} className="bg-neutral-900 px-3 py-2 rounded-md border border-neutral-800/50 min-w-[90px]">
                  <p className="text-[11px] text-neutral-500 mb-1">{coord}</p>
                  <p className="text-[13px] font-mono text-white tracking-wide">
                    {coord === 'X' ? activeData.coords.x.toFixed(3) : 
                     coord === 'Y' ? activeData.coords.y.toFixed(3) : 
                     activeData.coords.z.toFixed(3)}
                  </p>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-neutral-400 text-[13px] font-medium mb-3 flex items-center gap-2">
              <RotateCw size={14}/> Orientation
            </h3>
            <div className="flex flex-col gap-2 max-w-[200px]">
              <div className="flex justify-between items-center">
                <span className="text-[13px] text-neutral-400">Heading:</span>
                <span className="text-[13px] font-mono text-white tracking-wide">{activeData.coords.heading.toFixed(3)}°</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[13px] text-neutral-400">Roll:</span>
                <span className="text-[13px] font-mono text-white tracking-wide">{activeData.coords.roll.toFixed(3)}°</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[13px] text-neutral-400">Pitch:</span>
                <span className="text-[13px] font-mono text-white tracking-wide">{activeData.coords.pitch.toFixed(3)}°</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex flex-col justify-start">
           <div className="flex items-center justify-between text-xs text-neutral-400 mb-2">
             <span>Data Export</span>
             <button onClick={handleCopyJson} className="flex items-center gap-1 hover:text-white transition-colors"><Copy size={14}/> Copy JSON</button>
           </div>
           <div className="bg-black p-3 rounded border border-neutral-800 h-24 font-mono text-[10px] text-neutral-500 overflow-y-auto custom-scrollbar">
             {JSON.stringify({ 
               image: activeData.filename, 
               coords: { 
                 x: Number(activeData.coords.x.toFixed(3)), 
                 y: Number(activeData.coords.y.toFixed(3)), 
                 z: Number(activeData.coords.z.toFixed(3)), 
                 heading: Number(activeData.coords.heading.toFixed(3)),
                 roll: Number(activeData.coords.roll.toFixed(3)),
                 pitch: Number(activeData.coords.pitch.toFixed(3))
               }
             }, null, 2)}
           </div>
        </div>
      </div>
    </div>
  );
}