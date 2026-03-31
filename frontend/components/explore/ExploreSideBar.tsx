"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useParams } from 'next/navigation'; 
import { ArrowLeft, Eye, LayoutDashboard, Database, BarChart2, Image as ImageIcon, Download, ChevronLeft, ChevronRight, User } from "lucide-react";
import { createClient } from "@/utils/client";
import { cn } from "@/lib/utils";

interface ProjectData {
  name: string;
  author: string;
  imageCount: number;
  downloads: number;
}

export default function ExploreSidebar() {
  const pathname = usePathname();
  const params = useParams();
  const supabase = createClient();

  const projectId = params.id as string; 
  
  const [collapsed, setCollapsed] = useState(false);
  const [projectData, setProjectData] = useState<ProjectData>({
    name: 'Loading...',
    author: '...',
    imageCount: 0,
    downloads: 0
  });

  useEffect(() => {
    const fetchProjectData = async () => {
      if (!projectId) return;
      
      const { data, error } = await supabase
        .from('projects')
        .select(`
          project_name, 
          image_count, 
          profiles:user_id(display_name)
        `)
        .eq('id', projectId)
        .single();
      
        console.log(data)
      if (data && !error) {
        setProjectData({
          name: data.project_name || 'Untitled Project',
          author: (data.profiles as any)?.display_name || 'Anonymous',
          imageCount: data.image_count || 0,
          downloads:  0
        });
      } else {
        setProjectData(prev => ({ ...prev, name: 'Unknown Project' }));
      }
    };

    fetchProjectData();
  }, [projectId, supabase]);

  const formatCount = (num: number) => {
    return num >= 1000 ? `${(num / 1000).toFixed(1)}k` : num;
  };

  const getLinkClasses = (path: string) => {
    const isActive = pathname.includes(path); 
    const baseClass = `flex items-center gap-3 py-3 rounded-lg transition-all duration-300 ease-out ${
        collapsed ? 'justify-center px-2' : 'px-4'
    }`;
    
    const activeClass = "bg-[#282828] text-white shadow-md";
    const inactiveClass = "text-neutral-600 hover:bg-neutral-200 hover:text-black";
        
    return `${baseClass} ${isActive ? activeClass : inactiveClass}`;
  };

  const navItems = [
    { name: "Overview", href: `/explore/${projectId}/overview`, icon: LayoutDashboard },
    { name: "Dataset", href: `/explore/${projectId}/dataset`, icon: Database },
    { name: "Visualize", href: `/explore/${projectId}/visualize`, icon: Eye },
  ];

  return (
    <aside className={cn(
        "bg-[#F5F5F5] border-r border-gray-200 flex flex-col h-screen text-neutral-700 transition-all duration-300 flex-shrink-0",
        collapsed ? "w-20" : "w-64"
    )}>
      
      {/* Header Section */}
      <div className={cn("p-4 border-b border-gray-200 flex flex-col gap-4", collapsed && "items-center")}>
        <Link 
            href="/explore" 
            className="flex items-center gap-2 text-sm text-neutral-500 hover:text-black transition-colors"
        >
            <ArrowLeft size={16} />
            {!collapsed && <span>Back to Explore</span>}
        </Link>
        
        <div className="flex items-start justify-between gap-2 overflow-hidden">
            {!collapsed && (
              <div className="flex flex-col min-w-0">
                <h2 className="font-semibold text-lg text-black leading-tight mb-1 truncate">
                  {projectData.name}
                </h2>
                <div className="text-xs text-neutral-500 mb-3 truncate flex items-center gap-1">
                  <User size={12} />
                  by {projectData.author}
                </div>
                
                {/* Stats */}
                <div className="flex items-center gap-4 text-xs text-neutral-500 font-mono">
                  <span className="flex items-center gap-1.5" title="Total Images">
                    <ImageIcon size={14} /> 
                    {formatCount(projectData.imageCount)}
                  </span>
                  <span className="flex items-center gap-1.5" title="Total Downloads">
                    <Download size={14} /> 
                    {formatCount(projectData.downloads)}
                  </span>
                </div>
              </div>
            )}
            
            <button 
                onClick={() => setCollapsed(!collapsed)}
                className="p-1.5 rounded-lg hover:bg-neutral-200 text-neutral-500 shrink-0 mt-0.5"
            >
                {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 p-2 space-y-1 mt-2">
        {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={getLinkClasses(item.href)}
              title={collapsed ? item.name : ""}
            >
              <item.icon size={18} className="shrink-0" />
              {!collapsed && (
                <span className="whitespace-nowrap overflow-hidden text-sm font-medium">
                  {item.name}
                </span>
              )}
            </Link>
        ))}
      </nav>
      
    </aside>
  );
}