'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/client';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, } from '@/components/ui/dropdown-menu';
import { Search, Plus, ChevronDown, MoreVertical, Globe, Image as ImageIcon, Layers, Clock, Calendar, ArrowDownAZ, Loader2, Lock } from 'lucide-react';
import NewProjectModal from '@/components/projects/NewProjectModal';
import Link from 'next/link';

const SORT_OPTIONS = [
  { label: 'Recent Date', icon: Clock },
  { label: 'Date Created', icon: Calendar },
  { label: 'Project Name', icon: ArrowDownAZ },
  { label: ' # of Images', icon: ImageIcon },
];

type Project = {
  id: string;
  project_name: string;
  image_count: number;
  created_at: string;
  last_updated?: string; 
  is_public?: boolean; 
  thumbnail_url?: string;
};

export default function ProjectsPage() {
  const supabase = createClient();

  const [sortBy, setSortBy] = useState(SORT_OPTIONS[0]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchProjects = async () => {
      setLoading(true);

      const { data: { user }, error: authError } = await supabase.auth.getUser();
      console.log("Current User:", user); 

      const { data, error } = await supabase.from('projects')
        .select(`*`)
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      console.log(data);

      if (!error && data) {
        setProjects(data as Project[]);
      } else if (error) {
        console.error("Error fetching projects:", error.message);
      }
      setLoading(false);
    };

    fetchProjects();
  }, []);

  const filteredProjects = projects.filter((p) => p.project_name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      switch (sortBy.label) {
        case 'Recent Date':
          return new Date(b.last_updated || b.created_at).getTime() - new Date(a.last_updated || a.created_at).getTime();
        case 'Date Created':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'Project Name':
          return a.project_name.localeCompare(b.project_name);
        case '# of Images':
          return (b.image_count || 0) - (a.image_count || 0);
        default:
          return 0;
      }
    });

  return (
    <div className="text-white p-6">
      
      {/* Header Title */}
      <div className="flex items-center gap-3 mb-8">
        <Layers className="w-8 h-8 text-white" />
        <h1 className="text-2xl font-semibold tracking-wide">Projects</h1>
      </div>

      {/* Toolbar: Search, Sort, New Project */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div className="flex items-center gap-4 w-full md:w-auto">
          {/* Search Bar */}
          <div className="relative group w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 w-4 h-4 group-focus-within:text-white transition-colors" />
            <input 
              type="text" 
              placeholder="Search..." 
              value={search}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-neutral-800 text-sm text-gray-200 pl-10 pr-4 py-2.5 rounded-lg border border-transparent focus:border-[#B8AB9C] outline-none transition-all placeholder:text-neutral-600"
            />
          </div>

          {/* Sort Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className='flex items-center gap-2 bg-neutral-800 text-neutral-400 text-sm px-4 py-2.5 rounded-lg hover:bg-neutral-700 transition-colors whitespace-nowrap outline-none focus:ring-2 focus:ring-[#B8AB9C] focus:border-[#B8AB9C]'>
                <span className='font:normal'>Sort:</span> <span className='text-gray-200 font-normal'>{sortBy.label}</span>
                <ChevronDown size={16} className='text-gray-400' />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='start' className='w-48 bg-neutral-800 border-neutral-700 text-gray-400'>
              {SORT_OPTIONS.map((option) => (
                <DropdownMenuItem
                  key={option.label}
                  onClick={() => setSortBy(option)}
                  className='flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-neutral-700 focus:bg-neutral-700 focus:text-white rounded-md transition-colors'
                >
                  <option.icon size={18} className="text-neutral-400" />
                  <span className='text-sm text-neutral-400'>{option.label}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* New Project Button */}
        <NewProjectModal />
      </div>

      {/* Projects Grid */}
      {loading ? (
        <div className="flex justify-center items-center h-40 text-neutral-500">
             <Loader2 className="animate-spin mr-2" /> Loading projects...
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="text-center py-20 text-neutral-500 bg-neutral-800/30 rounded-xl border border-dashed border-neutral-700">
            <p>No projects found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
          {filteredProjects.map((project) => (
            <ProjectCard
              key={project.id}
              id={project.id}
              title={project.project_name}
              edited={timeAgo(project.last_updated || project.created_at)}
              imageCount={project.image_count || 0}
              isPublic={project.is_public ?? true} 
              thumbnail={project.thumbnail_url || "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?auto=format&fit=crop&q=80"}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function timeAgo(dateString: string) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " years ago";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " months ago";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " days ago";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " hours ago";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " minutes ago";
    return "Just now";
}

// --- Component: Project Card ---
interface ProjectCardProps {
  id: string;
  title: string;
  edited: string;
  imageCount: number;
  isPublic: boolean;
  thumbnail: string | null;
}

function ProjectCard({ id, title, edited, imageCount, isPublic, thumbnail }: ProjectCardProps) {
  const projectLink = `/projects/${id}/upload`;
  
  return (
    <Link 
      key={id} 
      href={projectLink} 
      className="flex flex-row gap-4 items-center bg-neutral-800 w-full p-2.5 rounded-xl border border-neutral-800/60 hover:border-neutral-700 hover:bg-neutral-900 transition-all duration-300 group cursor-pointer shadow-sm hover:shadow-md">
      <div className="relative w-24 h-24 shrink-0 overflow-hidden rounded-lg bg-neutral-800/50 border border-neutral-800">
        {thumbnail ? (
          <img 
            src={thumbnail} 
            alt={title} 
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-neutral-600 transition-colors group-hover:text-neutral-400">
            <ImageIcon size={28} strokeWidth={1.5} />
          </div>
        )}
        <div className="absolute inset-0 ring-1 ring-inset ring-white/5 rounded-lg pointer-events-none" />
      </div>

      <div className='flex flex-col flex-1 min-w-0 py-1 pr-2'>

        <div className="flex items-start justify-between mb-1.5">
          {/* เปลี่ยน Icon และ Text ตาม isPublic */}
          <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded border text-[10px] font-medium uppercase tracking-wider ${
            isPublic 
              ? 'bg-neutral-800/80 border-neutral-700/50 text-neutral-400' 
              : 'bg-rose-950/30 border-rose-900/50 text-rose-400'
          }`}>
            {isPublic ? <Globe size={10} /> : <Lock size={10} />}
            <span>{isPublic ? 'Public' : 'Private'}</span>
          </div>
            
          {/* Menu Dots */}
          <button 
            onClick={(e) => {
              e.preventDefault(); 
            }}
            className="text-neutral-500 hover:text-white transition-colors p-1 -mt-1 -mr-1 rounded-md hover:bg-neutral-800"
          >
            <MoreVertical size={16} />
          </button>
        </div>

        <h3 className="text-white font-medium text-base mb-1.5 truncate group-hover:text-[#B8AB9C] transition-colors" title={title}>
          {title}
        </h3>
        
        <p className="text-[10px] text-neutral-500 font-mono mt-auto flex items-center gap-2">
          <span>{imageCount} Images</span>
          <span className="w-1 h-1 rounded-full bg-neutral-700"></span>
          <span>Edit {edited}</span>
        </p>
      </div>
    </Link>
  );
}