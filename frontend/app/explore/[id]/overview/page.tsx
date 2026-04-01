'use client';

import React, { useState, useEffect } from "react";
import { Heart, Share2, Download, Image as ImageIcon, Box, Eye, Calendar, User, Loader2 } from "lucide-react";
import { createClient } from "@/utils/client"; // เปลี่ยนมาใช้ client
import { useParams, useRouter } from "next/navigation"; // ใช้ useParams สำหรับ Client Component

// Helper function สำหรับแปลง Byte
function formatBytes(bytes: number, decimals = 2) {
  if (!+bytes) return '0 Bytes'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}

export default function ExploreProjectOverviewPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const supabase = createClient();

  const [project, setProject] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const [annotationCount, setAnnotationCount] = useState(0);
  const [storageUsed, setStorageUsed] = useState("0 Bytes");
  const [classDistribution, setClassDistribution] = useState<any[]>([]);
  
  const [likes, setLikes] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [isLikeLoading, setIsLikeLoading] = useState(false);

  useEffect(() => {
    if (!projectId) return;

    async function fetchProjectData() {
      setIsLoading(true);
      setError(null);

      try {
        const { data: { user } } = await supabase.auth.getUser();

        const { data: projectData, error: projectError } = await supabase
          .from("projects")
          .select("*, profiles:user_id(display_name)")
          .eq("id", projectId)
          .single();

        if (projectError || !projectData) throw projectError || new Error("Project not found");
        setProject(projectData);

        const { count: likesCount } = await supabase
          .from("project_likes")
          .select("*", { count: "exact", head: true })
          .eq("project_id", projectId);
        setLikes(likesCount || 0);

        if (user) {
          const { data: userLike } = await supabase
            .from("project_likes")
            .select("id")
            .eq("project_id", projectId)
            .eq("user_id", user.id)
            .single();
          if (userLike) setIsLiked(true);
        }

        const { count: annotations } = await supabase
          .from("detected_objects")
          .select("*", { count: "exact", head: true })
          .eq("project_id", projectId);
        setAnnotationCount(annotations || 0);

        const { data: images } = await supabase.from("project_images").select("size_bytes").eq("project_id", projectId);
        const { data: pointClouds } = await supabase.from("project_point_clouds").select("size_bytes").eq("project_id", projectId);
        
        let totalBytes = 0;
        images?.forEach(img => totalBytes += (Number(img.size_bytes) || 0));
        pointClouds?.forEach(pc => totalBytes += (Number(pc.size_bytes) || 0));
        setStorageUsed(formatBytes(totalBytes));

        const { data: objectsData } = await supabase.from("detected_objects").select("class_name").eq("project_id", projectId);
        const { data: projectClasses } = await supabase.from("project_classes").select("name, color").eq("project_id", projectId);

        const classColorMap: Record<string, string> = {};
        projectClasses?.forEach(c => { classColorMap[c.name] = c.color; });

        const classCounts: Record<string, number> = {};
        objectsData?.forEach(obj => {
          const name = obj.class_name || "Unknown";
          classCounts[name] = (classCounts[name] || 0) + 1;
        });

        const defaultColors = ["#2dd4bf", "#facc15", "#a855f7", "#ef4444", "#22c55e", "#3b82f6"];
        const totalObjects = objectsData?.length || 0;
        
        const distribution = Object.entries(classCounts)
          .sort((a, b) => b[1] - a[1])
          .map(([name, count], index) => ({
            name,
            count: count.toLocaleString(),
            percent: totalObjects ? ((count / totalObjects) * 100).toFixed(1) : "0",
            color: classColorMap[name] || defaultColors[index % defaultColors.length],
          }));
        setClassDistribution(distribution);

      } catch (err: any) {
        setError(err.message || "Something went wrong");
      } finally {
        setIsLoading(false);
      }
    }

    fetchProjectData();
  }, [projectId, supabase]);

  const handleLike = async () => {
    if (isLikeLoading) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert("Please login to like this project.");
      router.push("/login");
      return;
    }

    setIsLikeLoading(true);
    setIsLiked(!isLiked);
    setLikes((prev) => isLiked ? prev - 1 : prev + 1);

    if (isLiked) {
      const { error } = await supabase.from('project_likes').delete().eq('project_id', projectId).eq('user_id', user.id);
      if (error) { setIsLiked(true); setLikes((prev) => prev + 1); }
    } else {
      const { error } = await supabase.from('project_likes').insert({ project_id: projectId, user_id: user.id });
      if (error) { setIsLiked(false); setLikes((prev) => prev - 1); }
    }
    setIsLikeLoading(false);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // --- UI หน้า Loading / Error ---
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-neutral-500">
          <Loader2 className="w-8 h-8 animate-spin mb-4" />
          <p>Loading Data...</p>
        </div>
    );
  }

  if (error || !project) {
    return (
      <div className="p-8 text-white">
        <h2 className="text-2xl text-red-400 font-bold mb-2">Project not found</h2>
        <p className="text-neutral-400 mb-4">Project ID: {projectId}</p>
        <div className="p-4 bg-red-950/30 border border-red-900 rounded-lg text-red-200 font-mono text-sm">
          {error}
        </div>
      </div>
    );
  }

  // --- UI หลัก ---
  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6 text-neutral-200">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold text-white">{project.project_name || "Untitled Project"}</h1>
            <span className="px-2.5 py-1 text-xs font-medium bg-[#2a2a2a] text-neutral-300 rounded border border-[#3f3f3f]">
              {project.status || "Public"}
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm text-neutral-400">
            <span className="flex items-center gap-1.5">
              <User size={14} /> {(project.profiles as any)?.display_name || "Anonymous"}
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar size={14} /> Updated {formatDate(project.last_updated)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* ปุ่ม Like ที่ผูกฟังก์ชันแล้ว */}
          <button 
            onClick={handleLike}
            disabled={isLikeLoading}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border rounded-lg transition-colors ${
              isLiked 
                ? "text-red-400 border-red-900/50 bg-red-950/20 hover:bg-red-950/40" 
                : "text-white border-[#3f3f3f] hover:bg-[#2a2a2a]"
            }`}
          >
            <Heart size={16} className={isLiked ? "fill-current" : ""} /> 
            {likes} {likes <= 1 ? "Like" : "Likes"}
          </button>

          <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white border border-[#3f3f3f] rounded-lg hover:bg-[#2a2a2a] transition-colors">
            <Share2 size={16} /> Share
          </button>
        </div>
      </div>

      <div className="bg-[#1e1e1e] border border-[#2e2e2e] rounded-xl p-5 text-neutral-300 text-sm leading-relaxed whitespace-pre-wrap">
        {project.description || "No description provided for this project."}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<ImageIcon size={20} className="text-[#B8AB9C]" />} title="Images" value={(Number(project.image_count) || 0).toLocaleString()} />
        <StatCard icon={<Box size={20} className="text-[#B8AB9C]" />} title="Annotations" value={annotationCount.toLocaleString()} />
        <StatCard icon={<Download size={20} className="text-[#B8AB9C]" />} title="Downloads" value="0" />
        <StatCard icon={<Eye size={20} className="text-[#B8AB9C]" />} title="Views" value="0" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-[#1e1e1e] border border-[#2e2e2e] rounded-xl p-6">
          <h3 className="text-neutral-400 text-sm font-medium mb-6">Classes ({classDistribution.length})</h3>
          <div className="space-y-5">
            {classDistribution.length > 0 ? classDistribution.map((item) => (
              <div key={item.name}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="font-medium text-white">{item.name}</span>
                  <span className="text-neutral-400">{item.count}</span>
                </div>
                <div className="w-full bg-[#2a2a2a] rounded-full h-1.5 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${item.percent}%`, backgroundColor: item.color }} />
                </div>
              </div>
            )) : (
              <div className="text-neutral-500 text-sm text-center py-4">No objects detected yet.</div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-[#1e1e1e] border border-[#2e2e2e] rounded-xl p-6">
            <h3 className="text-neutral-400 text-sm font-medium mb-5">Project Info</h3>
            <div className="grid grid-cols-2 gap-y-6 gap-x-4">
              <InfoItem label="Created" value={formatDate(project.created_at)} />
              <InfoItem label="Last Updated" value={formatDate(project.last_updated)} />
              <InfoItem label="License" value="Custom" />
              <InfoItem label="Storage" value={storageUsed} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Sub-components
function StatCard({ icon, title, value }: { icon: React.ReactNode, title: string, value: string }) {
  return (
    <div className="bg-[#1e1e1e] border border-[#2e2e2e] rounded-xl p-5 flex flex-col gap-3">
      <div className="w-10 h-10 rounded-lg bg-[#2a2a2a] flex items-center justify-center border border-[#3f3f3f]">
        {icon}
      </div>
      <div>
        <div className="text-2xl font-bold text-white mb-1">{value}</div>
        <div className="text-sm text-neutral-400">{title}</div>
      </div>
    </div>
  );
}

function InfoItem({ label, value }: { label: string, value: string }) {
  return (
    <div>
      <div className="text-xs text-neutral-500 mb-1.5">{label}</div>
      <div className="text-sm text-white font-medium">{value}</div>
    </div>
  );
}