'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/utils/client';
import { 
  Search, ChevronDown, Edit2, Database, Loader2, 
  Image as ImageIcon, ArrowUpAZ, ArrowDownAZ, ArrowDown01, ArrowUp01, 
  Box, TableProperties, Trash2, CheckSquare, Square
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import Image from 'next/image';

// --- Types ---
type ProjectImage = {
  id: string;
  storage_path: string;
  thumbnail_path: string;
  format: string;
  size_bytes: number;
  upload_at: string;
  url?: string;
  filename?: string;
};

type CameraPosition = {
  id: string;
  image_filename: string;
  x: number;
  y: number;
  z: number;
  heading: number;
  pitch: number;
  roll: number;
};

type PointCloud = {
  id: string;
  storage_path: string;
  format: string;
  size_bytes: number;
  created_at: string;
  potree_url?: string;
  processing_status?: string;
};

const SORT_OPTIONS = [
  { label: 'Recent Date', icon: ArrowDown01 },
  { label: 'Oldest Date', icon: ArrowUp01 },
  { label: 'File Name (A-Z)', icon: ArrowDownAZ },
  { label: 'File Name (Z-A)', icon: ArrowUpAZ },
];

export default function DatasetPage() {
  const params = useParams();
  const projectId = params.id as string;
  const supabase = createClient();

  // --- States ---
  const [activeTab, setActiveTab] = useState<'images' | 'camera' | 'pointcloud'>('images');
  
  // Images States
  const [images, setImages] = useState<ProjectImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState(SORT_OPTIONS[0]);
  
  // Camera States
  const [cameraPositions, setCameraPositions] = useState<CameraPosition[]>([]);
  const [loadingCamera, setLoadingCamera] = useState(false);

  // Point Cloud States
  const [pointClouds, setPointClouds] = useState<PointCloud[]>([]);
  const [loadingPointClouds, setLoadingPointClouds] = useState(false);
  
  // Selection States
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);

  // --- Effects ---
  useEffect(() => {
    if (projectId) fetchImages();
  }, [projectId]);

  useEffect(() => {
    if (projectId && activeTab === 'camera' && cameraPositions.length === 0) {
      fetchCameraPositions();
    }
  }, [projectId, activeTab]);

  useEffect(() => {
    if (projectId && activeTab === 'pointcloud' && pointClouds.length === 0) {
      fetchPointClouds();
    }
  }, [projectId, activeTab]);

  // --- Utility ---
  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getRelativeTime = (dateString: string) => {
    const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
    const daysDifference = Math.round((new Date(dateString).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    return rtf.format(daysDifference, 'day');
  };

  // --- Data Fetching ---
  const fetchImages = async () => {
    setLoading(true);
    let allImages: any[] = [];
    let from = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('project_images')
        .select('*')
        .eq('project_id', projectId)
        .order('upload_at', { ascending: false })
        .range(from, from + pageSize - 1);

      if (error) {
        console.error('Error fetching images:', error);
        setLoading(false);
        return;
      }

      if (data && data.length > 0) {
        allImages = [...allImages, ...data];
        if (data.length < pageSize) {
          hasMore = false; 
        } else {
          from += pageSize; 
        }
      } else {
        hasMore = false;
      }
    }

    console.log("Total images fetched:", allImages.length);

    const formattedImages = allImages.map((img: any) => {
      const pathForUrl = img.thumbnail_path || img.storage_path;
      const { data: publicUrlData } = supabase.storage
        .from('project_files')
        .getPublicUrl(pathForUrl);

      const rawName = img.storage_path.split('/').pop() || '';
      const cleanFilename = rawName.replace(/^\d+_/, ''); 

      return {
        ...img,
        url: publicUrlData.publicUrl,
        filename: cleanFilename
      };
    });

    setImages(formattedImages);
    setLoading(false);
  };

  const fetchCameraPositions = async () => {
    setLoadingCamera(true);
    let allPositions: any[] = [];
    let from = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('camera_position')
        .select('*')
        .eq('project_id', projectId)
        .order('image_filename', { ascending: true })
        .range(from, from + pageSize - 1);

      if (error) {
        console.error('Error fetching camera positions:', error);
        setLoadingCamera(false);
        return;
      }

      if (data && data.length > 0) {
        allPositions = [...allPositions, ...data];
        if (data.length < pageSize) {
          hasMore = false;
        } else {
          from += pageSize;
        }
      } else {
        hasMore = false;
      }
    }

    setCameraPositions(allPositions);
    setLoadingCamera(false);
  };

  const fetchPointClouds = async () => {
    setLoadingPointClouds(true);
    const { data, error } = await supabase
      .from('project_point_clouds')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching point clouds:', error);
    } else {
      setPointClouds(data || []);
    }
    setLoadingPointClouds(false);
  };

  // --- Handlers ---
  const toggleSelectMode = () => {
    setIsSelectMode(!isSelectMode);
    if (isSelectMode) setSelectedImages([]); 
  };

  const handleSelectImage = (id: string) => {
    if (!isSelectMode) return;
    setSelectedImages(prev => 
      prev.includes(id) ? prev.filter(imgId => imgId !== id) : [...prev, id]
    );
  };

  const handleDeleteSelected = async () => {
    if (selectedImages.length === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedImages.length} selected images?`)) return;

    const filesToDelete = images
      .filter(img => selectedImages.includes(img.id))
      .flatMap(img => {
        const paths = [img.storage_path];
        if (img.thumbnail_path) {
          paths.push(img.thumbnail_path);
        }
        return paths;
      });

    if (filesToDelete.length > 0) {
      const { error: storageError } = await supabase.storage
        .from('project_files')
        .remove(filesToDelete);

      if (storageError) console.error('Error deleting files from storage:', storageError);
    }

    const { error: dbError } = await supabase
      .from('project_images')
      .delete()
      .in('id', selectedImages);

    if (dbError) {
      console.error('Error deleting images from database:', dbError);
      alert('Failed to delete image records.');
      return;
    }

    setImages(images.filter(img => !selectedImages.includes(img.id)));
    setSelectedImages([]);
    setIsSelectMode(false);
  };

  // --- Filtering & Sorting (Images) ---
  const filteredImages = images
    .filter((img) => img.filename?.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      switch (sortBy.label) {
        case 'Recent Date': return new Date(b.upload_at).getTime() - new Date(a.upload_at).getTime();
        case 'Oldest Date': return new Date(a.upload_at).getTime() - new Date(b.upload_at).getTime();
        case 'File Name (A-Z)': return (a.filename || '').localeCompare(b.filename || '');
        case 'File Name (Z-A)': return (b.filename || '').localeCompare(a.filename || '');
        default: return 0;
      }
    });

  return (
    <div className="text-white p-6 w-full">
      {/* Header */}
      <div className="flex items-center border-b pb-4 border-neutral-800 gap-3 mb-6">
        <Database className="text-white" size={28}/>
        <h1 className="text-xl font-semibold tracking-wide">Dataset</h1>
      </div>

      {/* Toolbar: Tabs, Search, Sort, Action Button */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 mb-6 border-b border-neutral-800 pb-4">
        
        {/* Left Side: Tabs */}
        <div className="flex items-center gap-2 bg-neutral-900/50 p-1 rounded-lg border border-neutral-800 overflow-x-auto w-full xl:w-auto">
          <button 
            onClick={() => { setActiveTab('images'); setIsSelectMode(false); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'images' ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-white hover:bg-neutral-800/50'}`}
          >
            <ImageIcon size={16} /> Raw Images
          </button>
          <button 
            onClick={() => { setActiveTab('camera'); setIsSelectMode(false); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'camera' ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-white hover:bg-neutral-800/50'}`}
          >
            <TableProperties size={16} /> Camera Positions
          </button>
          <button 
            onClick={() => { setActiveTab('pointcloud'); setIsSelectMode(false); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'pointcloud' ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-white hover:bg-neutral-800/50'}`}
          >
            <Box size={16} /> Point Clouds
          </button>
        </div>
        
        {/* Right Side: Toolbar ของฝั่ง Images */}
        {activeTab === 'images' && (
          <div className="flex flex-wrap items-center gap-4 w-full xl:w-auto">
            {/* Search Bar Group */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-neutral-400 whitespace-nowrap">Search:</span>
              <div className="relative group w-full md:w-48 lg:w-56">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 w-4 h-4" />
                <input 
                  type="text" 
                  placeholder="Search filename..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-neutral-800 text-sm text-gray-200 pl-9 pr-4 py-2 rounded-lg border border-transparent focus:border-neutral-500 outline-none transition-all placeholder:text-neutral-600"
                />
              </div>
            </div>

            {/* Sort Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 bg-neutral-800 text-neutral-300 text-sm px-4 py-2 rounded-lg hover:bg-neutral-700 transition-colors outline-none h-10">
                  <span className="text-neutral-500">Sort:</span> {sortBy.label}
                  <ChevronDown size={14} className="text-neutral-400 ml-1" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 bg-neutral-800 border-neutral-700">
                {SORT_OPTIONS.map((option) => (
                  <DropdownMenuItem
                    key={option.label}
                    onClick={() => setSortBy(option)}
                    className="text-sm text-gray-300 cursor-pointer hover:bg-neutral-700 hover:text-white focus:bg-neutral-700 focus:text-white"
                  >
                  <option.icon size={16} className="text-neutral-400 mr-2" />
                    {option.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Selection Action Group */}
            <div className="flex items-center gap-2 border-l border-neutral-700 pl-4 h-10">
              {selectedImages.length > 0 && (
                <button 
                  onClick={handleDeleteSelected}
                  className="flex items-center gap-2 text-sm bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white px-3 py-2 rounded-lg transition-colors whitespace-nowrap"
                >
                  <Trash2 size={16} />
                  Delete ({selectedImages.length})
                </button>
              )}

              <button 
                onClick={toggleSelectMode}
                className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg transition-colors whitespace-nowrap ${isSelectMode ? 'bg-blue-600 text-white' : 'text-gray-200 hover:text-white hover:bg-neutral-800'}`}
              >
                {isSelectMode ? (
                  <>
                    <Edit2 size={14} />
                    Cancel Selection
                  </>
                ) : (
                  <>
                    <Edit2 size={14} />
                    Select Image
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* --- Content Area --- */}
      
      {/* 1. Images Tab */}
      {activeTab === 'images' && (
        <>
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 text-neutral-500">
              <Loader2 className="w-8 h-8 animate-spin mb-4" />
              <p>Loading dataset...</p>
            </div>
          ) : filteredImages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 border border-dashed border-neutral-700 rounded-xl bg-neutral-800/30 text-neutral-500">
              <ImageIcon className="w-10 h-10 mb-2 opacity-50" />
              <p>No images found.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredImages.map((img) => {
                const isSelected = selectedImages.includes(img.id);
                return (
                  <div 
                    key={img.id} 
                    className={`flex flex-col gap-2 group transition-all ${isSelectMode ? 'cursor-pointer' : ''}`}
                    onClick={() => handleSelectImage(img.id)}
                  >
                    <div className={`relative w-full aspect-[2/1] rounded-lg overflow-hidden bg-neutral-800 border-2 transition-colors ${isSelected ? 'border-blue-500' : 'border-transparent group-hover:border-[#B8AB9C]'}`}>
                      {isSelectMode && (
                        <div className="absolute top-2 left-2 z-10 drop-shadow-md">
                          {isSelected ? (
                            <CheckSquare className="text-blue-500 bg-white rounded-sm w-5 h-5" />
                          ) : (
                            <Square className="text-white/70 hover:text-white w-5 h-5" />
                          )}
                        </div>
                      )}
                      <Image
                        src={img.url || '/placeholder.jpg'}
                        alt={img.filename || 'Project image'}
                        fill
                        sizes="(max-width: 768px) 50vw, (max-width: 1280px) 33vw, 25vw"
                        className={`object-cover transition-all ${isSelected ? 'opacity-80 scale-[0.98]' : ''}`}
                        unoptimized={true}
                      />
                    </div>
                    <p className="text-center text-sm text-neutral-300 truncate px-2 font-mono" title={img.filename}>
                      {img.filename}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* 2. Camera Positions Tab */}
      {activeTab === 'camera' && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
          {loadingCamera ? (
            <div className="flex flex-col items-center justify-center h-64 text-neutral-500">
              <Loader2 className="w-8 h-8 animate-spin mb-4" />
              <p>Loading camera data...</p>
            </div>
          ) : cameraPositions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-neutral-500 bg-neutral-800/20">
              <TableProperties className="w-8 h-8 mb-2 opacity-50" />
              <p>No camera positions found for this project.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-neutral-300">
                <thead className="bg-neutral-800 text-neutral-400 border-b border-neutral-700">
                  <tr>
                    <th className="px-6 py-4 font-medium whitespace-nowrap">Filename</th>
                    <th className="px-6 py-4 font-medium">X</th>
                    <th className="px-6 py-4 font-medium">Y</th>
                    <th className="px-6 py-4 font-medium">Z</th>
                    <th className="px-6 py-4 font-medium">Heading</th>
                    <th className="px-6 py-4 font-medium">Pitch</th>
                    <th className="px-6 py-4 font-medium">Roll</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800">
                  {cameraPositions.map((pos) => (
                    <tr key={pos.id} className="hover:bg-neutral-800/50 transition-colors group">
                      <td className="px-6 py-4 font-mono text-xs text-neutral-200">{pos.image_filename || '-'}</td>
                      <td className="px-6 py-4 font-mono text-xs text-neutral-400 group-hover:text-neutral-300">{pos.x?.toFixed(4) ?? '-'}</td>
                      <td className="px-6 py-4 font-mono text-xs text-neutral-400 group-hover:text-neutral-300">{pos.y?.toFixed(4) ?? '-'}</td>
                      <td className="px-6 py-4 font-mono text-xs text-neutral-400 group-hover:text-neutral-300">{pos.z?.toFixed(4) ?? '-'}</td>
                      <td className="px-6 py-4 font-mono text-xs text-neutral-400 group-hover:text-neutral-300">{pos.heading?.toFixed(4) ?? '-'}</td>
                      <td className="px-6 py-4 font-mono text-xs text-neutral-400 group-hover:text-neutral-300">{pos.pitch?.toFixed(4) ?? '-'}</td>
                      <td className="px-6 py-4 font-mono text-xs text-neutral-400 group-hover:text-neutral-300">{pos.roll?.toFixed(4) ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 3. Point Clouds Tab (.las) */}
      {activeTab === 'pointcloud' && (
        <div className="w-full">
          {loadingPointClouds ? (
            <div className="flex flex-col items-center justify-center h-64 text-neutral-500 bg-neutral-900 border border-neutral-800 rounded-xl">
              <Loader2 className="w-8 h-8 animate-spin mb-4" />
              <p>Loading point cloud data...</p>
            </div>
          ) : pointClouds.length === 0 ? (
             <div className="flex flex-col items-center justify-center h-64 text-neutral-500 bg-neutral-800/20 border border-dashed border-neutral-700 rounded-xl">
               <Box className="w-10 h-10 mb-2 opacity-50" />
               <p>No point cloud data found for this project.</p>
             </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {pointClouds.map((pc) => {
                const filename = pc.storage_path.split('/').pop() || 'Unknown File';
                const fileSize = formatBytes(pc.size_bytes);
                const timeAgo = getRelativeTime(pc.created_at);

                return (
                  <div key={pc.id} className="flex flex-col bg-neutral-900 border border-neutral-800 p-4 rounded-xl hover:border-neutral-600 transition-colors">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-4 w-full">
                        <div className="w-12 h-12 bg-neutral-800 rounded-lg flex items-center justify-center text-neutral-400 shrink-0">
                          <Box size={24} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-200 truncate" title={filename}>{filename}</p>
                          <p className="text-xs text-neutral-500 truncate">{fileSize} • {timeAgo}</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex gap-2 w-full pt-2 border-t border-neutral-800">
                      <button className="flex-1 text-xs bg-neutral-800 hover:bg-neutral-700 py-2 rounded-md text-white transition-colors">
                        Download
                      </button>
                      <button 
                        className={`flex-1 text-xs py-2 rounded-md text-white transition-colors ${pc.processing_status === 'success' || pc.potree_url ? 'bg-blue-600 hover:bg-blue-500' : 'bg-neutral-700 text-neutral-400 cursor-not-allowed'}`}
                        disabled={pc.processing_status !== 'success' && !pc.potree_url}
                      >
                        {pc.processing_status === 'processing' ? 'Processing...' : 'View 3D'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

    </div>
  );
}