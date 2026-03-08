'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Target, RotateCcw, Save, EyeOff, Eye, Info, Package, Image as ImageIcon, MapPin, Loader2 } from 'lucide-react';
import * as THREE from 'three';
import { PLYLoader } from 'three/addons/loaders/PLYLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { useParams, useSearchParams } from 'next/navigation';
import { createClient } from '@/utils/client';
import { toast } from 'sonner';

interface SceneData {
  referenceImage: string;
  panoramaUrl: string;
  plyUrl: string;
  pointsCount: string;
  radius: string;
  cameraPos: string;
  original: { heading: number; pitch: number; roll: number };
}

export default function CalibrationPage() {
  const supabase = createClient();
  const params = useParams();
  const searchParams = useSearchParams();

  const projectId = params.id as string
  
  const [imageId, setImageId] = useState<string | null>(searchParams.get('image_id'));  

  const [offset, setOffset] = useState({
    headingOffset: 0.00,
    pitchOffset: 0.00,
    rollOffset: 0.00,
    fovOffset: 0.00,
    opacity: 80,
  });
  const [hidePoints, setHidePoints] = useState(false);

  const [sceneData, setSceneData] = useState<SceneData | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // --- Refs Three.js ---
  const containerRef = useRef<HTMLDivElement>(null);
  const pointsRef = useRef<THREE.Points | null>(null);
  const materialRef = useRef<THREE.PointsMaterial | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!projectId) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);

      try {
        let targetImageId = imageId;

        if (!targetImageId) {
          const { data: lastCalib } = await supabase
            .from('project_calibrations')
            .select('reference_image_id')
            .eq('project_id', projectId)
            .order('created_at', { ascending: false }) 
            .limit(1)
            .single();

          if (lastCalib?.reference_image_id) {
            targetImageId = lastCalib.reference_image_id;
          } else {
            const { data: firstImage } = await supabase
              .from('project_images')
              .select('id')
              .eq('project_id', projectId)
              .limit(1)
              .single();
            
            if (firstImage?.id) {
              targetImageId = firstImage.id;
            } else {
              throw new Error("ไม่พบรูปภาพในโปรเจกต์นี้เลย");
            }
          }
          setImageId(targetImageId); 
        }

        const { data: imageData, error: imageError } = await supabase
          .from('project_images') 
          .select('storage_path')
          .eq('id', targetImageId)
          .single();

        if (imageError) throw imageError;

        const { data: cameraData, error: cameraError } = await supabase
          .from('camera_position')
          .select('x, y, z, heading, pitch, roll, image_filename')
          .eq('image_id', targetImageId)
          .single();

        if (cameraError) console.warn("Camera position not found for this image.");

        const { data: calibData } = await supabase
          .from('project_calibrations')
          .select('*')
          .eq('project_id', projectId)
          .eq('reference_image_id', targetImageId)
          .single();

        let finalPlyUrl = calibData?.ply_file_url || '';
        let pointsCountStr = calibData?.num_points ? `${calibData.num_points.toLocaleString()} points` : 'N/A';
        const BUCKET_NAME = 'project_files';

        console.log(finalPlyUrl)
        console.log(pointsCountStr)

        if (!finalPlyUrl) {
          const { data: pcData } = await supabase
            .from('project_point_clouds')
            .select('storage_path, num_points')
            .eq('project_id', projectId)
            .single();
          
          if (pcData?.storage_path) {
            const { data: pcUrlData } = supabase.storage
              .from(BUCKET_NAME)
              .getPublicUrl(pcData.storage_path);
            finalPlyUrl = pcUrlData.publicUrl;
            pointsCountStr = pcData.num_points ? `${pcData.num_points.toLocaleString()} points` : 'N/A';
          }
        }

        const { data: imageUrlData } = supabase.storage
          .from(BUCKET_NAME)
          .getPublicUrl(imageData.storage_path);

        setSceneData({
          referenceImage: cameraData?.image_filename || imageData.storage_path.split('/').pop() || 'Unknown',
          panoramaUrl: imageUrlData.publicUrl,
          plyUrl: finalPlyUrl,
          pointsCount: pointsCountStr,
          radius: '50m',
          cameraPos: `(${cameraData?.x?.toFixed(1) || 0}, ${cameraData?.y?.toFixed(1) || 0}, ${cameraData?.z?.toFixed(1) || 0})`,
          original: { 
            heading: cameraData?.heading || 0, 
            pitch: cameraData?.pitch || 0, 
            roll: cameraData?.roll || 0 
          }
        });

        // 1.5 ถ้ามีค่า Calibration เดิม ให้เอามาอัปเดต Slider ด้วย
        if (calibData) {
          setOffset({
            headingOffset: calibData.heading_offset || 0,
            pitchOffset: calibData.pitch_offset || 0,
            rollOffset: calibData.roll_offset || 0,
            fovOffset: calibData.fov_offset || 0,
            opacity: 80
          });
        }

      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [projectId]); 

  // --- 2. Initialize Three.js ---
  useEffect(() => {
    if (!containerRef.current || !sceneData) return;

    if (
      rendererRef.current &&
      containerRef.current &&
      containerRef.current.contains(rendererRef.current.domElement)
    ) {
      containerRef.current.removeChild(rendererRef.current.domElement);
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, containerRef.current.clientWidth / containerRef.current.clientHeight, 0.1, 1000);
    camera.position.set(0, 0, 0.1);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableZoom = true;
    controls.enablePan = false;

    // สร้างพื้นหลังรูป Panorama
    const sphereGeo = new THREE.SphereGeometry(500, 60, 40);
    sphereGeo.scale(-1, 1, 1);
    const textureLoader = new THREE.TextureLoader();
    
    textureLoader.load(sceneData.panoramaUrl, (texture) => {
      const sphereMat = new THREE.MeshBasicMaterial({ map: texture });
      const sphere = new THREE.Mesh(sphereGeo, sphereMat);
      scene.add(sphere);
    });

    if (sceneData.plyUrl) {
      const plyLoader = new PLYLoader();
      //console.log("Starting to load PLY from:", sceneData.plyUrl);

      plyLoader.load(sceneData.plyUrl, (geometry) => {
        geometry.rotateX(-Math.PI / 2);

        const positions = geometry.attributes.position;
        const count = positions.count;
        const colors = new Float32Array(count * 3);
        const color = new THREE.Color();

        for (let i = 0; i < count; i++) {
          const x = positions.getX(i);
          const y = positions.getY(i);
          const z = positions.getZ(i);

          // คำนวณระยะห่างจากกล้อง (จุด 0,0,0)
          const distance = Math.sqrt(x * x + y * y + z * z);
          
          // กำหนด Range สี: ใกล้เป็นสีเหลือง/แดง ไกลเป็นสีน้ำเงิน (ปรับค่า 50 ตามขนาด Scene)
          const t = Math.min(distance / 50, 1); 
          color.setHSL(0.6 * (1 - t), 1, 0.5); // HSL: 0.6 คือสีน้ำเงิน, 0 คือสีแดง

          colors[i * 3] = color.r;
          colors[i * 3 + 1] = color.g;
          colors[i * 3 + 2] = color.b;
        }
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const material = new THREE.PointsMaterial({ 
          size: 0.05, 
          vertexColors: true, 
          transparent: true,
          opacity: offset.opacity / 100
        });
        
        const points = new THREE.Points(geometry, material);
        pointsRef.current = points;
        materialRef.current = material;
        scene.add(points);
      }, undefined, (err) => console.error("Error loading PLY", err));
    }

    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!containerRef.current) return;
      camera.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (containerRef.current && rendererRef.current) {
        containerRef.current.removeChild(rendererRef.current.domElement);
      }
      
      if (renderer) {
      renderer.dispose();
      renderer.forceContextLoss(); 

      if (pointsRef.current) pointsRef.current.geometry.dispose();
      if (materialRef.current) materialRef.current.dispose();
    }
    };
  }, [sceneData]); 

  const updateRotation = (points: THREE.Points) => {
  if (!points || !sceneData) return;

  const base = sceneData.original;
  const finalHeading = THREE.MathUtils.degToRad(offset.headingOffset - base.heading);
  const finalPitch = THREE.MathUtils.degToRad(offset.pitchOffset - base.pitch);
  const finalRoll = THREE.MathUtils.degToRad(offset.rollOffset - base.roll);

  console.log("yaw" + finalHeading)
  console.log("pit" + finalPitch)
  console.log("rol" + finalRoll)

  points.rotation.set(finalPitch, finalHeading, finalRoll, 'ZYX');
};
  // --- 3. Update Rotation & Opacity ---
  useEffect(() => {
    if (pointsRef.current) {
    updateRotation(pointsRef.current);
  }
    
    if (materialRef.current) {
      materialRef.current.opacity = hidePoints ? 0 : offset.opacity / 100;
    }
  }, [offset, hidePoints]); // เปลี่ยนจาก params เป็น offset

  // --- Handlers ---
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>, key: string) => {
    setOffset(prev => ({ ...prev, [key]: parseFloat(e.target.value) }));
  };

  const handleReset = () => {
    setOffset({ headingOffset: 0, pitchOffset: 0, rollOffset: 0, fovOffset: 0, opacity: 80 });
  };

  const handleSaveCalibration = async () => {
    if (!projectId || !imageId || !sceneData) return;
    
    setIsSaving(true);
    try {
      const { data: existingCalib } = await supabase
        .from('project_calibrations')
        .select('id')
        .eq('project_id', projectId)
        .eq('reference_image_id', imageId)
        .single();

      const payload = {
        project_id: projectId,
        reference_image_id: imageId,
        ply_file_url: sceneData.plyUrl,
        heading_offset: offset.headingOffset,
        pitch_offset: offset.pitchOffset,
        roll_offset: offset.rollOffset,
        fov_offset: offset.fovOffset,
      };

      if (existingCalib) {
        const { error } = await supabase
          .from('project_calibrations')
          .update(payload)
          .eq('id', existingCalib.id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('project_calibrations')
          .insert([payload]);
          
        if (error) throw error;
      }

      toast.success("Save Calibration Succesfully!");
    } catch (error) {
      console.error("Error saving calibration:", error);
      toast.error("Save Calibration Check the console");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col p-6 min-h-screen bg-neutral-900 text-neutral-200">
      <div className="pb-4 border-b border-neutral-800 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="rounded-lg text-white">
            <Target size={28} />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-white">Calibration</h1>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 mt-6 flex-1 min-h-0">
        {/* LEFT: Viewport */}
        <div className="flex-[2] flex flex-col min-w-0 bg-neutral-900 rounded-xl border border-neutral-800 overflow-hidden relative">
          <div className="flex justify-between items-center p-3 border-b border-neutral-800/50 bg-neutral-900 z-10">
            <span className="text-xs font-mono text-neutral-400">Point cloud + Panorama Overlay</span>
            <span className="text-xs text-neutral-500">Drag to rotate | Scroll to zoom</span>
          </div>
          
          {isLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center bg-black/50">
              <Loader2 className="animate-spin text-neutral-500 mb-4" size={32} />
              <p className="text-neutral-400 text-sm">Loading calibration data...</p>
            </div>
          ) : !sceneData ? (
             <div className="flex-1 flex items-center justify-center bg-black/50 text-red-400 text-sm">
               Error: Could not load calibration data. Please check if images exist.
             </div>
          ) : (
            <div ref={containerRef} className="flex-1 relative bg-black flex items-center justify-center overflow-hidden cursor-move" />
          )}
        </div>

        {/* RIGHT: Controls */}
        <div className="flex-1 max-w-sm flex flex-col gap-6 min-w-0">
          <div className="bg-neutral-950/50 p-5 rounded-xl border border-neutral-800">
            <div className="flex justify-between items-center mb-6">
              <h2 className="font-semibold text-white">Calibration Parameters</h2>
              <button 
                onClick={() => setHidePoints(!hidePoints)} 
                className="flex items-center gap-2 text-xs text-neutral-400 hover:text-white transition-colors"
                disabled={isLoading}
              >
                {hidePoints ? <Eye size={14} /> : <EyeOff size={14} />}
                {hidePoints ? 'Show Points' : 'Hide Points'}
              </button>
            </div>

            <div className="space-y-5">
              {[
                { label: 'Heading Offset', key: 'headingOffset', min: -360, max: 360, step: 0.1, unit: '°' },
                { label: 'Pitch Offset', key: 'pitchOffset', min: -90, max: 90, step: 0.1, unit: '°' },
                { label: 'Roll Offset', key: 'rollOffset', min: -90, max: 90, step: 0.1, unit: '°' },
                { label: 'FOV Offset', key: 'fovOffset', min: -180, max: 180, step: 0.1, unit: '°' },
                { label: 'Point Opacity', key: 'opacity', min: 0, max: 100, step: 1, unit: '%' }
              ].map((item) => (
                <div key={item.key}>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-xs text-neutral-400">{item.label}</label>
                    
                    {/* ช่อง Input ตัวเลขที่พิมพ์ได้ */}
                    <div className="flex items-center bg-neutral-900 rounded-md border border-neutral-800 focus-within:border-[#B8AB9C] transition-colors">
                      <input 
                        type="number"
                        min={item.min}
                        max={item.max}
                        step={item.step}
                        value={offset[item.key as keyof typeof offset]}
                        onChange={(e) => handleSliderChange(e, item.key)}
                        disabled={isLoading}
                        className="w-16 bg-transparent text-right py-0.5 px-1 text-xs font-mono text-[#B8AB9C] outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <span className="text-[10px] text-neutral-500 pr-2 pl-1 select-none">{item.unit}</span>
                    </div>
                  </div>

                  {/* สไลด์เดอร์แบบเดิม */}
                  <input 
                    type="range" 
                    min={item.min} 
                    max={item.max} 
                    step={item.step}
                    value={offset[item.key as keyof typeof offset]}
                    onChange={(e) => handleSliderChange(e, item.key)}
                    disabled={isLoading}
                    className="w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-[#B8AB9C] disabled:opacity-50"
                  />
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3 mt-8">
              <button 
                onClick={handleReset} 
                disabled={isLoading} 
                className="flex items-center justify-center gap-2 py-2 rounded-lg border border-neutral-700 text-sm hover:bg-neutral-800 transition-colors disabled:opacity-50">
                <RotateCcw size={16} /> Reset
              </button>
              <button 
                onClick={handleSaveCalibration} 
                disabled={isLoading} 
                className="flex items-center justify-center gap-2 py-2 rounded-lg bg-[#B8AB9C]/50 hover:bg-[#B8AB9C] text-white text-sm transition-colors shadow-lg shadow-neutral-900/20 disabled:opacity-50">
                {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {isSaving ? 'Saving...' : 'Save Calibration'}
              </button>
            </div>
          </div>
          
          {/* ข้อมูล Scene Information ผูกกับ State */}
          <div className="bg-neutral-950/50 p-5 rounded-xl border border-neutral-800 flex-1">
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <Info size={16} className="text-neutral-500" />
              Scene Information
            </h3>
            
            <div className="grid grid-cols-2 gap-y-6 gap-x-4">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Reference Image</p>
                <div className="flex items-center gap-2 text-xs text-neutral-300 font-mono">
                  <ImageIcon size={12} className="text-neutral-500" />
                  {isLoading ? '...' : sceneData?.referenceImage}
                </div>
              </div>
              
              <div>
                <p className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Point Cloud Slice</p>
                <div className="flex items-center gap-2 text-xs text-neutral-300 font-mono">
                  <Package size={12} className="text-neutral-500" />
                  {isLoading ? '...' : sceneData?.pointsCount}
                </div>
              </div>

              <div>
                <p className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Slice Radius</p>
                <div className="flex items-center gap-2 text-xs text-[#B8AB9C] font-mono">
                  <Target size={12} />
                  {isLoading ? '...' : sceneData?.radius}
                </div>
              </div>

              <div>
                <p className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Camera Position</p>
                <div className="flex items-center gap-2 text-xs text-neutral-300 font-mono">
                  <MapPin size={12} className="text-neutral-500" />
                  {isLoading ? '...' : sceneData?.cameraPos}
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-neutral-800">
              <p className="text-[10px] uppercase tracking-wider text-neutral-500 mb-2">Original Orientation</p>
              <div className="grid grid-cols-3 gap-2 bg-[#1A1A1A] rounded-lg p-2">
                <div>
                  <p className="text-[10px] text-neutral-500 mb-1">Heading</p>
                  <p className="text-xs text-neutral-300 font-mono">{isLoading ? '...' : `${sceneData?.original.heading}°`}</p>
                </div>
                <div>
                  <p className="text-[10px] text-neutral-500 mb-1">Pitch</p>
                  <p className="text-xs text-neutral-300 font-mono">{isLoading ? '...' : `${sceneData?.original.pitch}°`}</p>
                </div>
                <div>
                  <p className="text-[10px] text-neutral-500 mb-1">Roll</p>
                  <p className="text-xs text-neutral-300 font-mono">{isLoading ? '...' : `${sceneData?.original.roll}°`}</p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}