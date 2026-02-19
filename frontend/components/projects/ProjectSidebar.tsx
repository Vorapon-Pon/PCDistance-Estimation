'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation'; 
import { createClient } from '@/utils/client';
import { ArrowLeft, UploadCloud, Database, List, Eye, Target, LayoutDashboard, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from "@/lib/utils";

export default function ProjectSidebar( ) {
  const pathname = usePathname();
  const params = useParams();
  const supabase = createClient();
  
  const projectId = params.id as string; 
  
  const [collapsed, setCollapsed] = useState(false);
  const [projectName, setProjectName] = useState<string>('Loading...');
  const baseUrl = `/projects/${projectId}`;

  useEffect(() => {
    const fetchProjectData = async () => {
      if (!projectId) return;
      
      const { data, error } = await supabase
        .from('projects')
        .select('project_name')
        .eq('id', projectId)
        .single();
      
      console.log(data)
      if (data && !error) {
        setProjectName(data.project_name);
      } else {
        setProjectName('Unknown Project');
      }
    };

    fetchProjectData();
  }, [projectId, supabase]);

  const getLinkClasses = (path: string) => {
    // เช็คว่า path ปัจจุบันตรงกับเมนูไหม
    const isActive = pathname === path;
    const baseClass = `flex items-center gap-3 py-3 rounded-lg transition-all duration-300 ease-out ${
        collapsed ? 'justify-center px-2' : 'px-4'
    }`;
    
    const activeClass = "bg-[#282828] text-white shadow-md";
    const inactiveClass = "text-neutral-600 hover:bg-neutral-200 hover:text-black";
        
    return `${baseClass} ${isActive ? activeClass : inactiveClass}`;
  };

  // ปรับลำดับให้ Upload ขึ้นก่อนตามต้องการ
  const menuItems = [
    { name: 'Upload Data', href: `${baseUrl}/upload`, icon: UploadCloud },
    { name: 'Dataset', href: `${baseUrl}/dataset`, icon: Database },
    { name: 'Classlist', href: `${baseUrl}/classlist`, icon: List },
    { name: 'Visualize', href: `${baseUrl}/visualize`, icon: Eye },
    { name: 'Calibration', href: `${baseUrl}/calibration`, icon: Target },
    { name: 'Overview', href: `${baseUrl}/overview`, icon: LayoutDashboard },
  ];

  return (
    <aside className={cn(
        "bg-[#F5F5F5] border-r border-gray-200 flex flex-col h-screen text-neutral-700 transition-all duration-300",
        collapsed ? "w-20" : "w-64"
    )}>
      
      <div className={cn("p-4 border-b border-gray-200 flex flex-col gap-4", collapsed && "items-center")}>
        <Link 
            href="/projects" 
            className="flex items-center gap-2 text-sm text-neutral-500 hover:text-black"
        >
            <ArrowLeft size={16} />
            {!collapsed && <span>Back to Projects</span>}
        </Link>
        
        <div className="flex items-center justify-between gap-2 overflow-hidden">
            {!collapsed && (
              <h2 className="font-semibold text-lg text-black truncate">
                {projectName}
              </h2>
            )}
            <button 
                onClick={() => setCollapsed(!collapsed)}
                className="p-1.5 rounded-lg hover:bg-neutral-200 text-neutral-500 shrink-0"
            >
                {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>
        </div>
      </div>

      <nav className="flex-1 p-2 space-y-1 mt-2">
        {menuItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={getLinkClasses(item.href)}
              title={collapsed ? item.name : ""}
            >
              <item.icon size={18} className="shrink-0" />
              {!collapsed && <span className="whitespace-nowrap overflow-hidden text-sm font-medium">{item.name}</span>}
            </Link>
        ))}
      </nav>
    </aside>
  );
}