'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/client';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, } from '@/components/ui/dropdown-menu';
import { Search, Plus, ChevronDown, MoreVertical, Globe, Image as ImageIcon, Layers, Clock, Calendar, ArrowDownAZ, Loader2 } from 'lucide-react';
import NewProjectModal from '@/components/NewProjectModal';

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
  updated_at?: string;
  visibility?: string;
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
      console.log("Auth Error:", authError);

      const { data, error } = await supabase.from('projects')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      console.log("Projects Data:", data);
      console.log("Fetch Error:", error);
      if (!error && data) {
        setProjects(data);
      } 
      setLoading(false);
    };

    fetchProjects();
  }, []);

  const filteredProjects = projects.filter((p) => p.project_name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      switch (sortBy.label) {
        case 'Recent Date':
          return new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime();
        case 'Date Created':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'Project Name':
          return a.project_name.localeCompare(b.project_name);
        case '# of Images':
          return b.image_count - a.image_count;
        default:
          return 0;
      }
    });

  return (
    <div className="text-white">
      
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredProjects.map((project) => (
            <ProjectCard
              key={project.id}
              title={project.project_name}
              edited={timeAgo(project.updated_at || project.created_at)}
              imageCount={project.image_count || 0}
              visibility={project.visibility || 'Public'}
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
  title: string;
  edited: string;
  imageCount: number;
  visibility: string;
}

function ProjectCard({ title, edited, imageCount, visibility }: ProjectCardProps) {
  return (
    <div className="flex flex-row justify-between items-center bg-neutral-800 w-full p-1 py-2  rounded-xl border border-transparent hover:border-neutral-700 transition-all group">
      {/* Card Header: Icon + Menu */}
      <div className="flex justify-between items-start px-1">
        {/* Thumbnail Placeholder */}
        <div className="w-12 h-12 bg-neutral-700 rounded-lg flex items-center justify-center text-neutral-800">
          <ImageIcon size={20} />
        </div>
      </div>

      <div className='flex flex-col px-2' >
        {/* Visibility Tag */}
        <div className="flex items-center justify-between gap-1.5 text-xs text-neutral-500 mb-2">
          <div className="flex items-center gap-1">
            <Globe size={12} />
            <span>{visibility}</span>
          </div>
            
          {/* Menu Dots */}
          <button className="text-neutral-500 hover:text-white transition-colors">
            <MoreVertical size={18} />
          </button>
        </div>

      {/* Content */}
      <h3 className="text-white font-medium text-lg mb-1 truncate" title={title}>
        {title}
      </h3>
      
      <p className="text-xs text-neutral-500 font-mono">
        Edit {edited} • {imageCount} Images
      </p>
      </div>
    </div>
  );
}