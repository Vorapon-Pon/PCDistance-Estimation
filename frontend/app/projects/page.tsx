'use client';

import { useState } from 'react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, } from '@/components/ui/dropdown-menu';
import { Search, Plus, ChevronDown, MoreVertical, Globe, Image as ImageIcon, Layers, Clock, Calendar, ArrowDownAZ } from 'lucide-react';

const SORT_OPTIONS = [
  { label: 'Recent Date', icon: Clock },
  { label: 'Date Created', icon: Calendar },
  { label: 'Project Name', icon: ArrowDownAZ },
  { label: ' # of Images', icon: ImageIcon },
];

export default function ProjectsPage() {
  const [sortBy, setSortBy] = useState(SORT_OPTIONS[0]);

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
              className="w-full bg-neutral-800 text-sm text-gray-200 pl-10 pr-4 py-2.5 rounded-lg border border-transparent focus:border-gray-700 outline-none transition-all placeholder:text-neutral-600"
            />
          </div>

          {/* Sort Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className='flex items-center gap-2 bg-neutral-800 text-gray-400 text-sm px-4 py-2.5 rounded-lg hover:bg-neutral-700 transition-colors whitespace-nowrap outline-none focus:ring-2 focus:ring-gray-700"'>
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
                  <option.icon size={18} className="text-gray-400" />
                  <span className='text-sm'>{option.label}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* New Project Button */}
        <button className="flex items-center gap-2 bg-neutral-800 hover:bg-neutral-700 text-white text-sm px-5 py-2.5 rounded-lg transition-all border border-neutral-700/50">
          <Plus size={16} />
          <span>New Project</span>
        </button>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <ProjectCard 
          title="A1-4" 
          edited="7 days ago" 
          imageCount={1650} 
        />
        <ProjectCard 
          title="B7-3" 
          edited="2 days ago" 
          imageCount={1105} 
        />
        <ProjectCard 
          title="AI-Dev: Future hand free P..." 
          edited="Todays" 
          imageCount={2500} 
        />
        <ProjectCard 
          title="B17-11" 
          edited="2 month ago" 
          imageCount={1388} 
        />
      </div>
    </div>
  );
}

// --- Component: Project Card ---
interface ProjectCardProps {
  title: string;
  edited: string;
  imageCount: number;
}

function ProjectCard({ title, edited, imageCount }: ProjectCardProps) {
  return (
    <div className="bg-neutral-800 p-4 rounded-xl border border-transparent hover:border-neutral-700 transition-all group">
      {/* Card Header: Icon + Menu */}
      <div className="flex justify-between items-start mb-4">
        {/* Thumbnail Placeholder */}
        <div className="w-12 h-12 bg-neutral-700 rounded-lg flex items-center justify-center text-neutral-800">
          <ImageIcon size={20} />
        </div>
        
        {/* Menu Dots */}
        <button className="text-neutral-500 hover:text-white transition-colors">
          <MoreVertical size={18} />
        </button>
      </div>

      {/* Visibility Tag */}
      <div className="flex items-center gap-1.5 text-xs text-neutral-500 mb-2">
        <Globe size={12} />
        <span>Public</span>
      </div>

      {/* Content */}
      <h3 className="text-white font-medium text-lg mb-1 truncate" title={title}>
        {title}
      </h3>
      
      <p className="text-xs text-neutral-500 font-mono">
        Edit {edited} • {imageCount} Images
      </p>
    </div>
  );
}