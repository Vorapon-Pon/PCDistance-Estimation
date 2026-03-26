import { create } from 'zustand';

interface DetectionJob {
  status: string;
  message: string;
}

interface DetectionState {
  jobs: Record<string, DetectionJob>;
  isProcessing: boolean;
  startDetection: (imageIds: string[]) => void;
  updateJobStatus: (imageId: string, status: string, message: string) => void;
  removeJob: (imageId: string) => void;
}

export const useDetectionStore = create<DetectionState>((set) => ({
  jobs: {},
  isProcessing: false,
  startDetection: (imageIds) => set((state) => {
    const newJobs = { ...state.jobs };
    imageIds.forEach(id => {
      newJobs[id] = { status: 'pending', message: 'Waiting in queue...' };
    });
    return { jobs: newJobs, isProcessing: true };
  }),
  updateJobStatus: (imageId, status, message) => set((state) => {
    const updatedJobs = { ...state.jobs, [imageId]: { status, message } };
    // ตรวจสอบว่ายังมีงานที่ทำไม่เสร็จเหลืออยู่ไหม
    const stillProcessing = Object.values(updatedJobs).some(
      job => job.status === 'pending' || job.status === 'processing'
    );
    return { jobs: updatedJobs, isProcessing: stillProcessing };
  }),
  removeJob: (imageId) => set((state) => {
    const newJobs = { ...state.jobs };
    delete newJobs[imageId];
    return { jobs: newJobs };
  }),
}));