import { create } from 'zustand';
import { createClient } from '@/utils/client';
import { toast } from 'sonner';

interface SlicingState {
  isSlicing: boolean;
  statusMessage: string;
  isMinimized: boolean;
  isCompleted: boolean;
  projectId: string | null;
  toggleMinimize: () => void;
  reset: () => void;
  startSlicing: (projectId: string, imageId: string, radius: number) => Promise<void>;
}

export const useSlicingStore = create<SlicingState>((set, get) => ({
  isSlicing: false,
  statusMessage: '',
  isMinimized: false,
  isCompleted: false,
  projectId: null,
  
  toggleMinimize: () => set((state) => ({ isMinimized: !state.isMinimized })),
  
  reset: () => set({ 
    isSlicing: false, 
    isCompleted: false, 
    statusMessage: '', 
    projectId: null 
  }),

  startSlicing: async (projectId, imageId, radius) => {
    if (get().isSlicing) {
      toast.warning('Slicing is already in progress.');
      return;
    }
    
    set({ 
      isSlicing: true, 
      statusMessage: 'Preparing data for slicing...', 
      isCompleted: false,
      projectId: projectId,
      isMinimized: false
    });

    const supabase = createClient();
    const BUCKET_NAME = 'project_files';

    try {
      // Check User
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error("ไม่พบข้อมูลผู้ใช้งาน กรุณาล็อกอินใหม่");
      }

      // Point Cloud Path
      const { data: pointCloud, error: pcError } = await supabase
        .from('project_point_clouds')
        .select('storage_path')
        .eq('project_id', projectId)
        .single();
        
      if (pcError || !pointCloud) {
        throw new Error("ไม่พบข้อมูล Point Cloud ของโปรเจกต์นี้");
      }

      // Camera Position
      const { data: camPos, error: camError } = await supabase
        .from('camera_position')
        .select('x, y, z')
        .eq('image_id', imageId)
        .single();

      if (camError || !camPos) {
        throw new Error("ไม่พบพิกัด X,Y,Z ของรูปภาพนี้ โปรดตรวจสอบการอัปโหลดไฟล์ Camera Position");
      }

      set({ statusMessage: 'Sending Data to Slicing API...' });

      const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

      const startRes = await fetch(`${backendUrl}/api/slice-pointcloud`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          bucket_name: BUCKET_NAME, 
          file_path: pointCloud.storage_path,
          image_id: imageId,
          user_id: user.id,
          center_x: camPos.x,
          center_y: camPos.y, 
          center_z: camPos.z,
          radius: radius 
        })
      });

      if (!startRes.ok) {
        const errorDetail = await startRes.text(); 
        throw new Error(`Error ${startRes.status}: ${errorDetail}`);
      }

      // 5. เริ่ม Polling เช็คสถานะทุกๆ 3 วินาที
      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await fetch(`${backendUrl}/api/slice-status/${projectId}`);
          if (!statusRes.ok) return;

          const statusData = await statusRes.json();
          set({ statusMessage: statusData.message });

          if (statusData.status === 'completed') {
            clearInterval(pollInterval);
            set({ isSlicing: false, isCompleted: true, statusMessage: 'สำเร็จ! ข้อมูล Calibration พร้อมใช้งาน' });
            toast.success('Calibration data is ready!');
            
          } else if (statusData.status === 'error') {
            clearInterval(pollInterval);
            set({ isSlicing: false, statusMessage: 'เกิดข้อผิดพลาดจากเซิร์ฟเวอร์' });
            toast.error(`เกิดข้อผิดพลาด: ${statusData.message}`);
          }
        } catch (pollErr) {
          console.error("Polling Error:", pollErr);
        }
      }, 3000);

    } catch (error: any) {
      console.error("Start Slicing Error:", error);
      set({ isSlicing: false, statusMessage: 'Failed to start slicing process' });
      toast.error(error.message || "ไม่สามารถเชื่อมต่อกับระบบได้");
    }
  }
}));