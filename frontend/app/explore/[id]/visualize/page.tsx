'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/utils/client';
import { 
  BarChart3, Maximize2, Copy, ChevronLeft, ChevronRight, 
  ImageIcon, Compass, RotateCw, Download, Lock, Loader2, ChevronDown 
} from 'lucide-react';
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
  
  const [userTier, setUserTier] = useState<string>('free');
  const [rawLasPath, setRawLasPath] = useState<string>('');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  
  const [viewMode, setViewMode] = useState<'split' | '3d' | '360'>('split');

  const [activeData, setActiveData] = useState({
    id: '',
    filename: '',
    coords: { x: 0, y: 0, z: 0, heading: 0, pitch: 0, roll: 0},
    imageUrl: '/api/placeholder/800/400'
  });

  const [detectedObjects, setDetectedObjects] = useState<any[]>([]);
  const [classColors, setClassColors] = useState<Record<string, string>>({});
  const [minConfidence, setMinConfidence] = useState<number>(50);

  const BUCKET_NAME = 'project_files';

  useEffect(() => {
    async function fetchVisualizeData() {
      setIsLoading(true);
      try {
        // 1. Fetch User Profile for Plan Tier
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('plan_tier')
            .eq('id', user.id)
            .single();
          if (profile) {
            setUserTier(profile.plan_tier);
          }
        }

        // 2. Fetch Project Data
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
          
        if (pointCloud) {
          if (pointCloud.storage_path) {
            setRawLasPath(pointCloud.storage_path);
          }

          if (pointCloud.potree_url) {
            setPotreeUrl(pointCloud.potree_url);
          } else {
            const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
            setPotreeUrl(`${baseUrl}/storage/v1/object/public/${BUCKET_NAME}/${projectId}/potree/metadata.json`);
          }
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

  useEffect(() => {
    const fetchObjectsAndColors = async () => {
      if (!activeData.id || !projectId) return;

      const { data: classData } = await supabase
        .from('project_classes')
        .select('name, color')
        .eq('project_id', projectId);
      
      if (classData) {
        const colorMap: Record<string, string> = {};
        classData.forEach(cls => { colorMap[cls.name] = cls.color; });
        setClassColors(colorMap);
      }

      if (userTier !== 'free') {
        const { data: objData } = await supabase
          .from('detected_objects')
          .select('*')
          .eq('image_id', activeData.id);
          
        if (objData) {
          setDetectedObjects(objData);
        }
      } else {
        setDetectedObjects([]); 
      }
    };

    fetchObjectsAndColors();
  }, [activeData.id, projectId, supabase, userTier]);

  const customHotspot = (hotSpotDiv: HTMLDivElement, args: any) => {
    const { obj, color, spanYaw, spanPitch } = args;
    
    hotSpotDiv.style.width = '0px';
    hotSpotDiv.style.height = '0px';

    // เก็บข้อมูลองศาไว้ให้ Event Zoom ดึงไปคำนวณไซส์
    hotSpotDiv.setAttribute('data-span-yaw', spanYaw.toString());
    hotSpotDiv.setAttribute('data-span-pitch', spanPitch.toString());
    
    // ย้ายการทำกรอบไปไว้ที่ div ตัวใน และใช้ transform: translate(-50%, -50%) เพื่อรักษากึ่งกลาง
    hotSpotDiv.innerHTML = `
      <div class="custom-bbox-box" style="
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        border: 2px solid ${color}; 
        background-color: ${color}33; 
        pointer-events: none;
        box-sizing: border-box;
      ">
        <div style="
          position: absolute;
          top: -24px;
          left: -2px;
          background-color: ${color}; 
          color: white; 
          font-size: 10px;
          font-weight: bold;
          padding: 2px 4px;
          border-radius: 4px 4px 0 0;
          white-space: nowrap;
        ">
          ${obj.class_name} (${Math.round(obj.confidence * 100)}%)
          ${obj.distance_from_camera ? `⇋ ${obj.distance_from_camera.toFixed(2)}m` : ''}
        </div>
      </div>
    `;
  };

  const initPannellum = () => {
    if ((window as any).pannellum && panoramaRef.current && activeData.imageUrl) {
      if (viewer) viewer.destroy();

      const filteredObjects = detectedObjects.filter(obj => obj.confidence >= (minConfidence / 100));

      const dynamicHotSpots = userTier !== 'free' ? filteredObjects.map(obj => {
        const centerX = (obj.bbox_xmin + obj.bbox_xmax) / 2;
        const centerY = (obj.bbox_ymin + obj.bbox_ymax) / 2;
        
        const yaw = (centerX - 0.5) * 360;
        const pitch = (0.5 - centerY) * 180;
        
        const spanYaw = (obj.bbox_xmax - obj.bbox_xmin) * 360;
        const spanPitch = (obj.bbox_ymax - obj.bbox_ymin) * 180;

        const color = classColors[obj.class_name] || '#10b981';

        return {
          pitch: pitch,
          yaw: yaw,
          cssClass: 'custom-bbox-anchor', // ป้องกัน Pannellum ใส่สไตล์ไอคอนเริ่มต้น
          createTooltipFunc: customHotspot,
          createTooltipArgs: { obj, color, spanYaw, spanPitch }
        };
      }): [];

      const newViewer = (window as any).pannellum.viewer(panoramaRef.current, {
        type: "equirectangular",
        panorama: activeData.imageUrl,
        autoLoad: true,
        compass: true,
        northOffset: activeData.coords.heading || 0, 
        crossOrigin: "anonymous",
        hotSpots: dynamicHotSpots
      });
      
      const resizeHotspots = () => {
        const anchors = document.querySelectorAll('.custom-bbox-anchor');
        if (anchors.length === 0) return;
        
        const container = newViewer.getContainer();
        if(!container) return;

        const hfov = newViewer.getHfov();
        const width = container.clientWidth;
        const ppd = width / hfov; // คำนวณ 1 องศาเท่ากับกี่ Pixel
        
        anchors.forEach(anchor => {
          const anchorElem = anchor as HTMLElement;
          const spanYaw = parseFloat(anchorElem.getAttribute('data-span-yaw') || '0');
          const spanPitch = parseFloat(anchorElem.getAttribute('data-span-pitch') || '0');
          
          const innerBox = anchorElem.querySelector('.custom-bbox-box') as HTMLElement;
          if (innerBox) {
            innerBox.style.width = `${spanYaw * ppd}px`;
            innerBox.style.height = `${spanPitch * ppd}px`;
          }
        });
      };

      newViewer.on('zoomchange', resizeHotspots);
      setTimeout(resizeHotspots, 100);

      setViewer(newViewer);
    }
  };

  useEffect(() => {
    if (activeData.imageUrl) initPannellum();
  }, [activeData.imageUrl, detectedObjects, classColors, minConfidence, userTier]);

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

  const handleExport = async (type: 'las' | 'potree') => {
    setShowExportMenu(false);

    if (userTier === 'free') {
      toast.error('การ Export สงวนไว้สำหรับผู้ใช้ระดับ Viewer ขึ้นไป กรุณาอัปเกรดแผนของคุณ');
      return;
    }

    try {
      if (type === 'las') {
        if (!rawLasPath) {
          toast.error('ไม่พบไฟล์ .las ต้นฉบับในระบบ');
          return;
        }

        toast.info('กำลังเริ่มดาวน์โหลดไฟล์ .las...');
        setIsExporting(true);
        
        const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(rawLasPath, {
          download: true, 
        });

        if (data && data.publicUrl) {
          const a = document.createElement('a');
          a.href = data.publicUrl;
          a.download = rawLasPath.split('/').pop() || `${projectData?.project_name}_pointcloud.las`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        } else {
          toast.error('ไม่สามารถสร้างลิงก์ดาวน์โหลดได้');
        }
        setIsExporting(false);

      } else if (type === 'potree') {
        toast.info('กำลังเตรียมบีบอัดข้อมูล Potree ที่ Backend...');
        setIsExporting(true);
        
        const fastApiUrl = process.env.NEXT_PUBLIC_FASTAPI_URL || 'http://localhost:8000';
        
        const res = await fetch(`${fastApiUrl}/api/export-potree`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ project_id: projectId, bucket_name: BUCKET_NAME })
        });
        
        if (!res.ok) throw new Error('ไม่สามารถเชื่อมต่อกับ Backend ได้');

        const intervalId = setInterval(async () => {
          try {
            const statusRes = await fetch(`${fastApiUrl}/api/export-potree-status/${projectId}`);
            const statusData = await statusRes.json();

            if (statusData.status === 'completed') {
              clearInterval(intervalId);
              setIsExporting(false);
              toast.success('บีบอัดข้อมูลสำเร็จ! กำลังเริ่มดาวน์โหลด...', { id: 'potree-export-toast' });
              
              const a = document.createElement('a');
              a.href = statusData.download_url;
              a.download = `potree_${projectId}.zip`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              
            } else if (statusData.status === 'error') {
              clearInterval(intervalId);
              setIsExporting(false);
              toast.error(`เกิดข้อผิดพลาดในการ Zip ไฟล์: ${statusData.message}`, { id: 'potree-export-toast' });
            } else {
              toast.loading(`Backend: ${statusData.message}`, { id: 'potree-export-toast' });
            }
          } catch (pollErr) {
             clearInterval(intervalId);
             setIsExporting(false);
             toast.error('ขาดการเชื่อมต่อระหว่างตรวจสอบสถานะการ Export');
          }
        }, 3000); // เช็คทุกๆ 3 วินาที
      }

    } catch (error: any) {
      console.error("Export Error:", error);
      toast.error(`เกิดข้อผิดพลาดในการ Export: ${error.message}`);
      setIsExporting(false);
    }
  };

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
      <div className="pb-4 border-b border-neutral-800 bg-neutral-900 flex-shrink-0 relative z-20">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="text-white" size={28} />
            <h1 className="text-xl font-semibold">Visualize: {projectData?.project_name || 'Unknown Project'}</h1>
          </div>

          {/* Export Menu */}
          <div className="relative">
            <div className="flex items-center gap-3">
              {userTier === 'free' && (
            <span className="text-xs text-orange-400 font-medium">
              *Upgrade plan to export
            </span>
            )}
            <button 
                onClick={() => setShowExportMenu(!showExportMenu)}
                disabled={userTier === 'free' || isExporting}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  userTier === 'free'
                    ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                    : 'bg-[#B8AB9C] hover:bg-[#B8AB9C]/80 text-white'
                }`}
              >
                {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {isExporting ? 'Exporting...' : 'Export Data'}
                <ChevronDown size={16} />
              
            </button>

            {/* Dropdown Options */}
            {showExportMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-neutral-800 border border-neutral-700 rounded-md shadow-lg overflow-hidden z-50">
                <button 
                  onClick={() => handleExport('las')}
                  className="w-full text-left px-4 py-3 text-sm hover:bg-neutral-700 flex items-center justify-between transition-colors"
                >
                  <span>Raw .LAS File</span>
                  {userTier === 'free' && <Lock size={14} className="text-neutral-500" />}
                </button>
                <div className="h-px bg-neutral-700"></div>
                <button 
                  onClick={() => handleExport('potree')}
                  className="w-full text-left px-4 py-3 text-sm hover:bg-neutral-700 flex items-center justify-between transition-colors"
                >
                  <span>Potree Format</span>
                  {userTier === 'free' && <Lock size={14} className="text-neutral-500" />}
                </button>
              </div>
            )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex bg-[#141414] p-1 rounded-lg border border-neutral-800 my-4 max-w-fit">
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

      {/* Main Content: Split View (โค้ดเดิม) */}
      <div className="flex flex-col md:flex-row h-[65vh] border border-neutral-800 min-h-0 rounded-lg overflow-hidden z-10">
        
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
      <div className="p-6 bg-neutral-950 border border-neutral-800 rounded-lg mt-4 grid grid-cols-1 md:grid-cols-2 gap-8 flex-shrink-0">
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
             <span>Data Payload (JSON)</span>
             <button onClick={handleCopyJson} className="flex items-center gap-1 hover:text-white transition-colors"><Copy size={14}/> Copy JSON</button>
           </div>
           <div className="bg-black p-3 rounded border border-neutral-800 h-32 font-mono text-[10px] text-neutral-500 overflow-y-auto custom-scrollbar">
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