'use client';

import { useEffect } from 'react';
import { createClient } from '@/utils/client';
import { useDetectionStore } from '@/store/useDetectionStore';

export default function GlobalDetectionListener() {
  const supabase = createClient();
  const updateJobStatus = useDetectionStore(state => state.updateJobStatus);

  useEffect(() => {
    const channel = supabase
      .channel('global-detection-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'project_images',
        },
        (payload) => {
          const { id, detection_status, detection_message } = payload.new;
          if (detection_status) {
            updateJobStatus(id, detection_status, detection_message || '');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return null; 
}