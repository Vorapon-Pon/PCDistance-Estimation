'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/utils/client';
import { Search, ChevronDown, Database, Loader2, Image as ImageIcon, Images, ArrowUpAZ, ArrowDownAZ, ArrowDown01, ArrowUp01, Download } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import CreditConfirmModal from '@/components/projects/CreditConfirmModal'; 
import Image from 'next/image';
import { processUploadCredits } from '../actions'; 
import { toast } from 'sonner';

type ProjectImage = {
  id: string;
  storage_path: string;
  format: string;
  size_bytes: number;
  upload_at: string;
  url?: string;
  filename?: string;
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

  const [images, setImages] = useState<ProjectImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState(SORT_OPTIONS[0]);

  const [userTier, setUserTier] = useState<string>('free');
  const [userCredits, setUserCredits] = useState<number>(0);
  const [isExporting, setIsExporting] = useState(false);
  
  const [cameraFileCount, setCameraFileCount] = useState<number>(0);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    checkUserData();
    if (projectId) {
      fetchImages();
      fetchCameraPositionCount();
    }
  }, [projectId]);

  const checkUserData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('plan_tier, credits')
        .eq('id', user.id)
        .single();
        
      if (!error && profile) {
        setUserTier(profile.plan_tier);
        setUserCredits(profile.credits || 0);
      }
    }
  };

  const fetchCameraPositionCount = async () => {
    const { count, error } = await supabase
      .from('camera_position_files')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId);
      
    if (!error && count !== null) {
      setCameraFileCount(count);
    }
  };

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

  const totalCost = (images.length * 0.1) + (cameraFileCount * 2);

  const handleExportClick = () => {
    if (userTier === 'free') {
      alert("Please upgrade to Viewer/Uploader tier to export datasets.");
      return;
    }
    if (images.length === 0) {
      alert("No images available to export.");
      return;
    }
    setIsModalOpen(true);
  };

  const executeExportAndDeductCredit = async () => {
    if (userCredits < totalCost) {
      toast.error('You do not have enough credits.');
      return;
    }

    setIsExporting(true);

    try {
      const creditResult = await processUploadCredits(
        totalCost, 
        'EXPORT_DATA', 
        `Exported Dataset: ${images.length} images, ${cameraFileCount} cam files`
      );

      if (!creditResult.success) {
        toast.error(creditResult.error);
        setIsExporting(false);
        setIsModalOpen(false);
        return;
      }

      setUserCredits(prev => prev - totalCost);
      setIsModalOpen(false);
      toast.success('Credits deducted. Preparing download...');

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'}/api/export-dataset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId })
      });

      if (!response.ok) throw new Error("Export failed");

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `dataset_${projectId}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      a.remove();
      
      toast.success('Download started!');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export dataset. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

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
    <div className="text-white p-6 w-full relative">
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-4 border-neutral-800 mb-6">
        <div className="flex items-center gap-3">
          <Database className="text-white" size={28}/>
          <h1 className="text-xl font-semibold tracking-wide">Dataset</h1>
        </div>
        
        {/* Export All Button */}
        <div className="flex items-center gap-3">
          {userTier === 'free' && (
            <span className="text-xs text-orange-400 font-medium">
              *Upgrade plan to export
            </span>
          )}
          <button 
            onClick={handleExportClick} 
            disabled={userTier === 'free' || images.length === 0 || isExporting}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              userTier === 'free' || images.length === 0
                ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                : 'bg-[#B8AB9C] hover:bg-[#B8AB9C]/80 text-black'
            }`}
          >
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {isExporting ? 'Preparing Export...' : 'Export All Dataset'}
          </button>
        </div>
      </div>

      {/* Toolbar: Title, Search, Sort */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        
        <h2 className="flex flex-row gap-2 text-lg text-gray-200 font-medium"><Images/>Images ({filteredImages.length})</h2>
        
        <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
          {/* Search Bar */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <span className="text-sm text-neutral-400 whitespace-nowrap">Search Image:</span>
            <div className="relative group w-full md:w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 w-4 h-4" />
              <input 
                type="text" 
                placeholder="Search..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-neutral-800 text-sm text-gray-200 pl-9 pr-4 py-2 rounded-lg border border-transparent focus:border-neutral-500 outline-none transition-all placeholder:text-neutral-600"
              />
            </div>
          </div>

          {/* Sort Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 bg-neutral-800 text-neutral-300 text-sm px-4 py-2 rounded-lg hover:bg-neutral-700 transition-colors outline-none">
                <span className="text-neutral-500">Sort:</span> {sortBy.label}
                <ChevronDown size={14} className="text-neutral-400 ml-1" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40 bg-neutral-800 border-neutral-700">
              {SORT_OPTIONS.map((option) => (
                <DropdownMenuItem
                  key={option.label}
                  onClick={() => setSortBy(option)}
                  className="text-sm text-gray-300 cursor-pointer hover:bg-neutral-700 hover:text-white focus:bg-neutral-700 focus:text-white"
                >
                <option.icon size={18} className="text-neutral-400" />
                  {option.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Image Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center h-64 text-neutral-500">
          <Loader2 className="w-8 h-8 animate-spin mb-4" />
          <p>Loading dataset...</p>
        </div>
      ) : filteredImages.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 border border-dashed border-neutral-700 rounded-xl bg-neutral-800/30 text-neutral-500">
          <ImageIcon className="w-10 h-10 mb-2 opacity-50" />
          <p>No images found in this project.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredImages.map((img) => (
            <div key={img.id} className="flex flex-col gap-2 group cursor-pointer">
              {/* Image Container (Aspect Ratio 2:1 for Panoramic) */}
              <div className="relative w-full aspect-[2/1] rounded-lg overflow-hidden bg-neutral-800 border border-transparent group-hover:border-[#B8AB9C] transition-colors">
                <Image
                  src={img.url || '/placeholder.jpg'}
                  alt={img.filename || 'Project image'}
                  fill
                  sizes="(max-width: 768px) 50vw, (max-width: 1280px) 33vw, 25vw"
                  className="object-cover"
                  unoptimized={true}
                />
              </div>
              {/* Filename */}
              <p className="text-center text-sm text-neutral-300 truncate px-2 font-mono" title={img.filename}>
                {img.filename}
              </p>
            </div>
          ))}
        </div>
      )}
      
      {/* ใช้งาน Credit Confirm Modal */}
      <CreditConfirmModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={executeExportAndDeductCredit}
        title="Confirm Dataset Export"
        description="The calculated credits will be deducted from your account to export this dataset. This action cannot be undone."
        totalCost={totalCost}
        remainCredit={userCredits - totalCost}
        isLoading={isExporting}
        confirmText="Confirm & Export"
        details={[
          { label: 'Images to Export', value: `${images.length} images (0.1 cr/image)` },
          { label: 'Camera Data', value: `${cameraFileCount} files (2 cr/file)` },
          { label: 'Current Credits', value: userCredits.toFixed(2) }
        ]}
      />
    </div>
  );
}