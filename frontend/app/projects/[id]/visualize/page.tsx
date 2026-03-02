'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/utils/client';
import { BarChart3, Search, Maximize2, ZoomIn, ZoomOut, Download, Copy, ChevronLeft, ChevronRight, Info } from 'lucide-react';
import { toast } from 'sonner';

export default function VisualizePage() {
  const params = useParams();
  const projectId = params.id as string;
  const supabase = createClient();

  const [isLoading, setIsLoading] = useState(true);
  const [projectData, setProjectData] = useState<any>(null);
  const [potreeUrl, setPotreeUrl] = useState<string>('');
  
  const [activeData, setActiveData] = useState({
    id: '',
    filename: '',
    coords: { x: 0, y: 0, z: 0 },
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
          setPotreeUrl(`${baseUrl}/storage/v1/object/public/${BUCKET_NAME}/converted/${projectId}/metadata.json`);
        }

        const { data: camPos, error: camPosError } = await supabase
          .from('camera_position')
          .select(`
            x, y, z, 
            image_filename,
            image_id,
            project_images!inner(storage_path)
          `)
          .eq('project_id', projectId)
          .limit(1)
          .single();

        if (camPos && !camPosError) {
          // ดึง Public URL ของรูปภาพจาก Storage
          // หมายเหตุ: project_images เป็น array หรือ object ขึ้นอยู่กับการ query ด้วย inner join ของ Supabase (ส่วนใหญ่ได้เป็น object ถ้าใช้ single)
          const storagePath = Array.isArray(camPos.project_images) 
            ? camPos.project_images[0]?.storage_path 
            : (camPos.project_images as any)?.storage_path;

          const { data: publicUrlData } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(storagePath || '');

          setActiveData({
            id: camPos.image_id,
            filename: camPos.image_filename,
            coords: { 
              x: camPos.x || 0, 
              y: camPos.y || 0, 
              z: camPos.z || 0 
            },
            imageUrl: storagePath ? publicUrlData.publicUrl : '/api/placeholder/800/400'
          });
        }

      } catch (error) {
        console.error("Error fetching visualize data:", error);
      } finally {
        setIsLoading(false);
        console.log(potreeUrl)
      }
    }

    if (projectId) {
      fetchVisualizeData(); 
    }
  }, [projectId, supabase]);

  const iframeSrc = `/potree/viewer.html?cloudUrl=${encodeURIComponent(potreeUrl)}`;

  const handleFullscreen = () => {
    const iframe = document.getElementById('potree-iframe');
    if (iframe) {
      if (iframe.requestFullscreen) {
        iframe.requestFullscreen();
      }
    }
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
    <div className="flex flex-col p-6 min-h-screen bg-neutral-900 text-neutral-200 overflow-y-auto">
      {/* Header */}
      <div className="pb-4 border-b border-neutral-800 bg-neutral-900">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="text-white" size={28} />
            {/* ดึงชื่อ project_name จาก Database มาแสดง */}
            <h1 className="text-xl font-semibold">Visualize: {projectData?.project_name || 'Unknown Project'}</h1>
          </div>
        </div>
      </div>

      {/* Main Content: Split View (Point Cloud | Panorama) */}
      <div className="flex flex-col md:flex-row min-h-[600px] h-[70vh] border-b border-neutral-800">
        
        {/* LEFT: Point Cloud View */}
        <div className="flex-1 relative border-r border-neutral-800 group bg-black">
          <div className="absolute top-4 left-4 z-10 bg-black/60 px-3 py-1 rounded text-xs font-mono border border-neutral-700">
            3D Point Cloud View
          </div>
          
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

          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-[#1A1A1A]/80 backdrop-blur-md p-2 rounded-full border border-neutral-700">
            <button className="p-2 hover:bg-neutral-700 rounded-full transition-colors"><ZoomIn size={18} /></button>
            <button className="p-2 hover:bg-neutral-700 rounded-full transition-colors"><ZoomOut size={18} /></button>
            <div className="w-[1px] h-4 bg-neutral-600 mx-1" />
            <button onClick={handleFullscreen} className="p-2 hover:bg-neutral-700 rounded-full transition-colors"><Maximize2 size={18} /></button>
          </div>
        </div>

        {/* RIGHT: Panorama / Original Image View */}
        <div className="flex-1 relative bg-[#0A0A0A] flex flex-col">
          <div className="p-4 flex items-center justify-between border-b border-neutral-800/50 bg-neutral-900/30">
            <span className="text-xs font-mono text-neutral-400">{activeData.filename} (Panorama)</span>
            <div className="flex items-center gap-3">
               <span className="text-[10px] text-neutral-500 italic">100% Zoom</span>
               <div className="flex gap-1">
                 <button className="p-1.5 hover:bg-neutral-700 rounded"><ZoomIn size={14} /></button>
                 <button className="p-1.5 hover:bg-neutral-700 rounded"><Maximize2 size={14} /></button>
               </div>
            </div>
          </div>

          <div className="flex-1 flex items-center justify-center p-4">
             <div className="w-full aspect-[2/1] bg-neutral-900 rounded shadow-2xl overflow-hidden relative">
                <img src={activeData.imageUrl} alt="Panorama" className="w-full h-full object-cover opacity-80" />
                <div className="absolute inset-0 flex items-center justify-between px-4">
                  <button className="p-2 bg-black/40 rounded-full hover:bg-black/60"><ChevronLeft size={24}/></button>
                  <button className="p-2 bg-black/40 rounded-full hover:bg-black/60"><ChevronRight size={24}/></button>
                </div>
             </div>
          </div>
        </div>
      </div>

      {/* Bottom Panel: Details Overlay */}
      <div className="p-6 bg-neutral-950 border-t border-neutral-800 grid grid-cols-2 gap-8">
        <div>
          <h3 className="text-white text-xs uppercase tracking-wider mb-4 flex items-center gap-2">
            <Info size={14}/> Image Details & Camera Position
          </h3>
          <div className="grid grid-cols-3 gap-3">
            {['X', 'Y', 'Z'].map((coord) => (
              <div key={coord} className="bg-[#262626] p-2 rounded border border-neutral-700">
                <p className="text-[10px] text-neutral-500 mb-1">{coord} Coordinate</p>
                <p className="text-sm font-mono text-white">
                  {/* แสดงทศนิยม 3 ตำแหน่งให้ดูสวยงาม */}
                  {coord === 'X' ? activeData.coords.x.toFixed(3) : coord === 'Y' ? activeData.coords.y.toFixed(3) : activeData.coords.z.toFixed(3)}
                </p>
              </div>
            ))}
          </div>
        </div>
        
        <div className="flex flex-col justify-end">
           <div className="flex items-center justify-between text-xs text-neutral-400 mb-2">
             <span>JSON Export</span>
             <div className="flex gap-4">
               <button onClick={handleCopyJson} className="flex items-center gap-1 hover:text-white transition-colors"><Copy size={14}/> Copy</button>
               <button className="flex items-center gap-1 hover:text-white transition-colors"><Download size={14}/> Download</button>
             </div>
           </div>
           <div className="bg-[#0F0F0F] p-2 rounded border border-neutral-800 h-16 font-mono text-[10px] text-neutral-500 overflow-hidden">
             {JSON.stringify({ image: activeData.filename, coords: { x: Number(activeData.coords.x.toFixed(3)), y: Number(activeData.coords.y.toFixed(3)), z: Number(activeData.coords.z.toFixed(3)) }})}
           </div>
        </div>
      </div>
    </div>
  );
}