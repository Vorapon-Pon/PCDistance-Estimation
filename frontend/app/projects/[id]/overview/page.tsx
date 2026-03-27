"use client"; 

import React, { useEffect, useState } from "react";
import { Layers, Image as ImageIcon, Box, FileText, CheckCircle2, Loader2, Globe, Lock, AlertTriangle } from "lucide-react";
import { useParams } from 'next/navigation';
import { createClient } from "@/utils/client";
import DescriptionEditor from "@/components/projects/DescriptionEditor"; 
import { toast } from "sonner"

export default function ProjectOverviewPage() {
  const params = useParams();
  const projectId = params.id as string;
  const supabase = createClient();

  const [isLoading, setIsLoading] = useState(true);
  const [project, setProject] = useState<any>(null);
  const [stats, setStats] = useState({
    totalImages: 0,
    totalObjects: 0,
    totalPointClouds: 0,
    detectionClassesCount: 0
  });
  const [classDistribution, setClassDistribution] = useState<any[]>([]);
  const [dataTypes, setDataTypes] = useState({ jpg: 0, png: 0, las: 0, csv: 0 });
  const [potreeFile, setPotreeFile] = useState<any>(null);

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isUpdatingVisibility, setIsUpdatingVisibility] = useState(false);

  useEffect(() => {
    if (projectId) {
      fetchProject();
    }
  }, [projectId]);

  const fetchProject = async () => {
    try {
      setIsLoading(true);

      const { data: projectData } = await supabase
        .from("projects")
        .select("*, profiles:user_id(email)")
        .eq("id", projectId)
        .single();

      if (!projectData) {
        setProject(null);
        setIsLoading(false);
        return;
      }
      setProject(projectData);
    
      const { count: totalImages } = await supabase
        .from("project_images")
        .select("*", { count: "exact", head: true })
        .eq("project_id", projectId);

      const { count: totalObjects } = await supabase
        .from("detected_objects")
        .select("*", { count: "exact", head: true })
        .eq("project_id", projectId);

      const { count: totalPointClouds } = await supabase
        .from("project_point_clouds")
        .select("*", { count: "exact", head: true })
        .eq("project_id", projectId);

      const { data: projectClassesData } = await supabase
        .from("project_classes")
        .select("name, color")
        .eq("project_id", projectId);

      const classColorMap: Record<string, string> = {};
      projectClassesData?.forEach(cls => {
        if (cls.name && cls.color) {
          classColorMap[cls.name] = cls.color;
        }
      });

      const { data: objectsData } = await supabase
        .from("detected_objects")
        .select("class_name")
        .eq("project_id", projectId);

      const classCounts: Record<string, number> = {};
      objectsData?.forEach(obj => {
        const name = obj.class_name || "Unknown";
        classCounts[name] = (classCounts[name] || 0) + 1;
      });

      // สีสำรองกรณีที่ Database ไม่ได้กำหนดสีไว้ 
      const fallbackColors = ["#2dd4bf", "#facc15", "#a855f7", "#ef4444", "#22c55e", "#60a5fa"];
      
      const distribution = Object.entries(classCounts)
        .sort((a, b) => b[1] - a[1]) // เรียงจากมากไปน้อย
        .map(([name, count], index) => {
          // ใช้สีจาก DB ถ้ามี ถ้าไม่มีให้ใช้สีสำรองตาม index
          const color = classColorMap[name] || fallbackColors[index % fallbackColors.length];
          
          return {
            name,
            count: count.toLocaleString(),
            percent: totalObjects ? ((count / totalObjects) * 100).toFixed(1) : "0",
            color: color, 
          };
        });

      setClassDistribution(distribution);
      const detectionClassesCount = Object.keys(classCounts).length;

      setStats({
        totalImages: totalImages || 0,
        totalObjects: totalObjects || 0,
        totalPointClouds: totalPointClouds || 0,
        detectionClassesCount
      });

      const { data: images } = await supabase.from("project_images").select("format").eq("project_id", projectId);
      const { data: pointClouds } = await supabase.from("project_point_clouds").select("format").eq("project_id", projectId);
      const { data: csvFiles } = await supabase.from("camera_position_files").select("filename").eq("project_id", projectId);

      let jpgCount = 0, pngCount = 0;
      images?.forEach(img => {
        const fmt = img.format?.toLowerCase();
        if (fmt === "image/jpg" || fmt === "image/jpeg") jpgCount++;
        else if (fmt === "image/png") pngCount++;
      });
      const lasCount = pointClouds?.filter(pc => pc.format?.toLowerCase() === "las" || pc.format?.toLowerCase() === ".las").length || 0;
      const csvCount = csvFiles?.length || 0;

      setDataTypes({ jpg: jpgCount, png: pngCount, las: lasCount, csv: csvCount });

      const { data: potreeData } = await supabase
        .from("project_point_clouds")
        .select("storage_path, processing_status, progress")
        .eq("project_id", projectId)
        .limit(1)
        .single();
        
      setPotreeFile(potreeData);

    } catch (error) {
      console.error("Error fetching project data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const confirmToggleVisibility = async () => {
    if (!project || isUpdatingVisibility) return;
    
    setIsUpdatingVisibility(true);
    const newVisibility = !project.is_public;

    try {
      const { error } = await supabase
        .from("projects")
        .update({ is_public: newVisibility })
        .eq("id", project.id);

      if (error) throw error;

      setProject({ ...project, is_public: newVisibility });
      setShowConfirmModal(false); 
    } catch (error) {
      console.error("Error updating project visibility:", error);
    } finally {
      setIsUpdatingVisibility(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-900 flex items-center justify-center text-emerald-500">
        <Loader2 className="animate-spin" size={48} />
      </div>
    );
  }

  if (!project) {
    return <div className="min-h-screen bg-neutral-900 p-6 text-white flex items-center justify-center text-xl">Project not found</div>;
  }

  return (
    <div className="min-h-screen bg-neutral-900 text-neutral-200 p-6 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header Section */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-2xl text-white font-semibold">
            <Layers className="text-white" size={28} />
            {project.project_name || "Untitled Project"}
          </div>
          
          <button
            onClick={() => setShowConfirmModal(true)} 
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-full border transition-all duration-200 ${
              project.is_public 
                ? "bg-teal-900/30 text-emerald-400 border-emerald-800/50 hover:bg-emerald-900/50" 
                : "bg-neutral-800 text-neutral-300 border-neutral-600 hover:bg-neutral-700"
            }`}
          >
            {project.is_public ? <Globe size={14} /> : <Lock size={14} />}
            {project.is_public ? "Public" : "Private"}
          </button>
        </div>

        {/* Client Component: Description Editor */}
        <DescriptionEditor projectId={project.id} initialDescription={project.description} />

        {/* 4 Stat Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={<ImageIcon size={20} className="text-[#B8AB9C]" />} title="Total Images" value={stats.totalImages.toLocaleString()} />
          <StatCard icon={<Box size={20} className="text-[#B8AB9C]" />} title="Total Objects" value={stats.totalObjects.toLocaleString()} />
          <StatCard icon={<Layers size={20} className="text-[#B8AB9C]" />} title="Point Clouds" value={stats.totalPointClouds.toLocaleString()} />
          <StatCard icon={<FileText size={20} className="text-[#B8AB9C]" />} title="Detection Classes" value={stats.detectionClassesCount.toString()} />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Class Distribution */}
          <div className="bg-[#1e1e1e] border border-[#2e2e2e] rounded-xl p-5">
            <h3 className="text-neutral-400 text-sm font-medium mb-6">Class Distribution</h3>
            <div className="space-y-5">
              {classDistribution.length > 0 ? classDistribution.map((item) => (
                <div key={item.name}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="font-medium text-white">{item.name}</span>
                    <span className="text-neutral-400">{item.count} ({item.percent}%)</span>
                  </div>
                  <div className="w-full bg-[#2a2a2a] rounded-full h-1.5 overflow-hidden">
                    <div 
                      className="h-full rounded-full" 
                      style={{ 
                        width: `${item.percent}%`, 
                        backgroundColor: item.color 
                      }} 
                    />
                  </div>
                </div>
              )) : (
                <div className="text-neutral-500 text-sm text-center py-4">No objects detected yet.</div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            {/* Data Types */}
            <div className="bg-[#1e1e1e] border border-[#2e2e2e] rounded-xl p-5">
              <h3 className="text-neutral-400 text-sm font-medium mb-4">Data Types</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <DataTypeCard ext=".jpg" count={dataTypes.jpg} label="Images" />
                <DataTypeCard ext=".png" count={dataTypes.png} label="Images" />
                <DataTypeCard ext=".las" count={dataTypes.las} label="LAS Point Clouds" />
                <DataTypeCard ext=".csv" count={dataTypes.csv} label="Camera Positions" />
              </div>
            </div>

            {/* Potree Conversion */}
            <div className="bg-[#1e1e1e] border border-[#2e2e2e] rounded-xl p-5">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-neutral-400 text-sm font-medium">Potree Conversion</h3>
                <span className="text-xs bg-[#2a2a2a] px-2 py-1 rounded text-neutral-400">Project Main Cloud</span>
              </div>
              
              {potreeFile ? (
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-center text-sm">
                    <div className="flex items-center gap-2">
                      {potreeFile.processing_status?.toLowerCase() === "processing" ? (
                        <Loader2 size={16} className="text-emerald-500 animate-spin" />
                      ) : potreeFile.processing_status?.toLowerCase() === "completed" ? (
                        <CheckCircle2 size={16} className="text-emerald-500" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border-2 border-neutral-500" />
                      )}
                      <span className="text-white truncate max-w-[200px]">
                        {potreeFile.storage_path?.split('/').pop() || "point_cloud.las"}
                      </span>
                    </div>
                    <span className="text-neutral-400 capitalize">{potreeFile.processing_status || "Queued"}</span>
                  </div>
                  {potreeFile.processing_status?.toLowerCase() === "processing" && (
                     <div className="w-full bg-[#2a2a2a] rounded-full h-1 mt-1 overflow-hidden">
                       <div 
                         className="h-full bg-emerald-500 rounded-full transition-all duration-500" 
                         style={{ width: `${potreeFile.progress || 0}%` }}
                       />
                     </div>
                  )}
                </div>
              ) : (
                <div className="text-neutral-500 text-sm text-center py-2">No point cloud data.</div>
              )}
            </div>
          </div>
        </div>

        {/* Project Info Footer */}
        <div className="bg-[#1e1e1e] border border-[#2e2e2e] rounded-xl p-5">
          <h3 className="text-neutral-400 text-sm font-medium mb-4">Project Info</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <InfoItem label="Created" value={formatDate(project.created_at)} />
            <InfoItem label="Last Modified" value={formatDate(project.last_updated)} />
            <InfoItem label="Owner" value={(project.profiles as any)?.email || "Unknown"} />
            <InfoItem label="Status" value={project.status || "-"} />
          </div>
        </div>

      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1e1e1e] border border-[#2e2e2e] rounded-xl p-6 max-w-md w-full mx-4 shadow-xl transform transition-all">
            <div className="flex items-start gap-4 mb-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                !project.is_public ? "bg-amber-500/10 text-amber-400" : "bg-amber-500/10 text-amber-400"
              }`}>
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-1">
                  {project.is_public ? "Make Project Private?" : "Make Project Public?"}
                </h3>
                <p className="text-amber-400 text-sm leading-relaxed">
                  {project.is_public 
                    ? "This project will be hidden from the public. Only you will be able to access it."
                    : "Are you sure you want to make this project public? Anyone with the link will be able to view its contents."}
                </p>
              </div>
            </div>
            
            <div className="flex justify-end gap-3 mt-6">
              <button 
                onClick={() => setShowConfirmModal(false)}
                disabled={isUpdatingVisibility}
                className="px-4 py-2 text-sm font-medium text-neutral-300 hover:bg-[#2a2a2a] rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button 
                onClick={confirmToggleVisibility}
                disabled={isUpdatingVisibility}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50 ${
                  !project.is_public 
                    ? "bg-emerald-600 hover:bg-emerald-500" 
                    : "bg-neutral-600 hover:bg-neutral-500"
                }`}
              >
                {isUpdatingVisibility && <Loader2 size={16} className="animate-spin" />}
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, title, value }: { icon: React.ReactNode, title: string, value: string }) {
  return (
    <div className="bg-[#1e1e1e] border border-[#2e2e2e] rounded-xl p-5 flex flex-col gap-3">
      <div className="w-10 h-10 rounded-lg bg-[#2a2a2a] flex items-center justify-center border border-[#333]">
        {icon}
      </div>
      <div>
        <div className="text-2xl font-bold text-white mb-1">{value}</div>
        <div className="text-sm text-neutral-400">{title}</div>
      </div>
    </div>
  );
}

function DataTypeCard({ ext, count, label }: { ext: string, count: number, label: string }) {
  return (
    <div className="bg-[#262626] rounded-lg p-4 flex items-center gap-4 border border-[#333]">
      <div className="px-2 py-1 bg-[#1a1a1a] rounded text-xs font-mono text-neutral-400 border border-[#333]">
        {ext}
      </div>
      <div>
        <div className="text-white font-bold">{count.toLocaleString()}</div>
        <div className="text-xs text-neutral-400">{label}</div>
      </div>
    </div>
  );
}

function InfoItem({ label, value }: { label: string, value: string }) {
  return (
    <div>
      <div className="text-sm text-neutral-500 mb-1">{label}</div>
      <div className="text-sm text-white font-medium truncate">{value}</div>
    </div>
  );
}