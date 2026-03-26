'use client';

import { useState, useEffect } from "react";
import { 
  Search, Compass, Image as ImageIcon, Download, Eye, ScanSearch, Layers, 
  Tag, Crosshair, Brain, Grid3X3, TrendingUp, Sprout, Factory, 
  Gamepad2, Car, Cpu, Heart, Shield, Camera, Zap, Loader2
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/client"; 

interface PublicProject {
  id: string;
  name: string;
  author: string;
  imageCount: number;
  downloads: number;
  views: number;
  thumbnail: string;
  type: string;
  classes: number;
}

const categories = [
  { icon: Sprout, label: "Agriculture", color: "hsl(142 70% 45%)", bg: "hsl(142 70% 45% / 0.15)" },
  { icon: Factory, label: "Manufacturing", color: "hsl(220 70% 60%)", bg: "hsl(220 70% 50% / 0.15)" },
  { icon: Car, label: "Self Driving", color: "hsl(260 60% 65%)", bg: "hsl(260 60% 55% / 0.15)" },
  { icon: Gamepad2, label: "Gaming", color: "hsl(174 60% 55%)", bg: "hsl(174 60% 55% / 0.15)" },
  { icon: Heart, label: "Healthcare", color: "hsl(340 70% 65%)", bg: "hsl(340 70% 60% / 0.15)" },
  { icon: Cpu, label: "Robotics", color: "hsl(30 80% 55%)", bg: "hsl(30 80% 55% / 0.15)" }
];

export default function ExplorePage() {
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const router = useRouter();
  const supabase = createClient();

  const [projects, setProjects] = useState<PublicProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchProjects() {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('projects')
          .select(`
            *,
            profiles ( display_name ),
            project_classes ( id )
          `) 
          .eq('is_public', true) 
          .order('created_at', { ascending: false });

        if (error) throw error;

        if (data) {
          const formattedProjects: PublicProject[] = data.map((p: any) => ({
            id: p.id,
            name: p.project_name || 'Untitled Project', 
            author: p.profiles?.display_name || 'Anonymous', 
            imageCount: p.image_count || 0,
            downloads: p.downloads || 0,
            views: p.views || 0,
            type: p.project_type || 'Object Detection',
            thumbnail: p.thumbnail_url || "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?auto=format&fit=crop&q=80",
            classes: p.project_classes ? p.project_classes.length : 0
          }));
          
          setProjects(formattedProjects);
        }
      } catch (error) {
        console.error("Error fetching projects:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchProjects();
  }, [supabase]);

  // ปรับสี Icon ใน Card ให้เหมาะกับตีมมืด
  const getProjectColor = (index: number) => {
    const colors = [
      "#3b82f6", // blue-500
      "#10b981", // emerald-500
      "#f59e0b", // amber-500
      "#8b5cf6", // violet-500
      "#ec4899", // pink-500
    ];
    return colors[index % colors.length];
  };

  const formatCount = (num: number) => {
    return num >= 1000 ? `${(num / 1000).toFixed(1)}k` : num;
  };

  const filteredProjects = projects.filter(project => {
    const matchesSearch = project.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          project.author.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch; 
  });

  return (
    <div className="min-h-screen bg-neutral-900 text-neutral-100 animate-fade-in pb-12">
      {/* Header Section */}
      <div className="relative border-b border-neutral-800 bg-neutral-900 overflow-hidden">
        <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:32px]" />
        <div className="absolute inset-y-0 left-0 w-full bg-gradient-to-r from-neutral-900/90 to-transparent" />
        
        <div className="container relative mx-auto px-6 py-12 md:py-16 flex flex-col items-center text-center">
          <Badge variant="outline" className="mb-6 px-3 py-1 border-neutral-700 bg-neutral-800/50 text-[#B8AB9C]">
            <Zap className="w-3.5 h-3.5 mr-2" />
            Discover Public Datasets
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 text-white">
            Explore Open Projects
          </h1>
          <p className="text-neutral-400 text-lg max-w-2xl mb-8">
            Access thousands of high-quality, pre-labeled datasets for your machine learning models.
          </p>

          <div className="w-full max-w-2xl relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500" />
            <Input 
              type="text"
              placeholder="Search projects, tags, or authors..."
              className="w-full pl-12 pr-4 py-6 text-base rounded-2xl bg-neutral-800/80 backdrop-blur-sm border-neutral-700 text-white shadow-sm focus-visible:ring-[#B8AB9C] placeholder:text-neutral-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Button className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl px-6 bg-white text-neutral-900 hover:bg-neutral-200 transition-colors">
              Search
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 mt-8">
        {/* Categories */}
        <div className="flex items-center gap-3 overflow-x-auto pb-4 scrollbar-none mask-fade-edges">
          <Button
            className={`rounded-full px-6 border ${activeCategory === "All" ? 'bg-white text-neutral-900 border-white hover:bg-neutral-200' : 'bg-neutral-800 text-neutral-300 border-neutral-700 hover:bg-neutral-700 hover:text-white'}`}
            onClick={() => setActiveCategory("All")}
          >
            <Compass className="w-4 h-4 mr-2" />
            All Projects
          </Button>
          {categories.map((cat) => {
            const Icon = cat.icon;
            const isActive = activeCategory === cat.label;
            return (
              <Button
                key={cat.label}
                className={`rounded-full px-5 transition-all duration-300 border`}
                style={{
                  backgroundColor: isActive ? cat.color : "transparent",
                  borderColor: isActive ? cat.color : "#404040", // neutral-700 equivalent
                  color: isActive ? "#fff" : cat.color,
                }}
                onClick={() => setActiveCategory(cat.label)}
              >
                <Icon className="w-4 h-4 mr-2" />
                {cat.label}
              </Button>
            );
          })}
        </div>

        {/* Trending / Projects Section */}
        <div className="mt-12">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#B8AB9C]" />
              <h2 className="text-xl font-semibold text-white">
                {searchQuery ? 'Search Results' : 'Recent Projects'}
              </h2>
            </div>
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-neutral-500">
              <Loader2 className="w-10 h-10 animate-spin mb-4 text-[#B8AB9C]" />
              <p>Loading projects...</p>
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-neutral-500">
              <Search className="w-10 h-10 mb-4 opacity-20" />
              <p>No projects found matching your criteria.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {filteredProjects.map((project, i) => (
                <div 
                  key={project.id}
                  className="group bg-neutral-800/40 rounded-2xl border border-neutral-800 overflow-hidden hover:border-neutral-600 hover:bg-neutral-800 transition-all duration-300 cursor-pointer"
                  onClick={() => router.push(`/projects/${project.id}`)}
                >
                  <div className="relative aspect-video overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-t from-neutral-900/90 via-transparent to-transparent z-10" />
                    <img 
                      src={project.thumbnail} 
                      alt={project.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute bottom-3 left-3 z-20 flex items-center gap-2">
                      <Badge variant="secondary" className="bg-neutral-800/90 text-neutral-300 border border-neutral-700/50">
                        <Tag className="w-3 h-3 mr-1" />
                        {project.classes} classes
                      </Badge>
                    </div>
                  </div>

                  <div className="p-5 flex gap-4">
                    <div className="mt-1">
                      <Badge 
                        className="w-8 h-8 rounded-lg flex items-center justify-center p-0 py-0 border-none"
                        style={{ backgroundColor: `${getProjectColor(i)}20`, color: getProjectColor(i) }}
                      >
                        <ScanSearch className="w-4 h-4" />
                      </Badge>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-white truncate group-hover:text-[#B8AB9C] transition-colors">
                        {project.name}
                      </h3>
                      <p className="text-xs text-neutral-400 mt-0.5">by {project.author}</p>
                      <div className="flex items-center gap-3 mt-3 text-xs text-neutral-500 font-mono">
                        <span className="flex items-center gap-1">
                          <ImageIcon className="w-3 h-3" />
                          {formatCount(project.imageCount)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Download className="w-3 h-3" />
                          {formatCount(project.downloads)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Eye className="w-3 h-3" />
                          {formatCount(project.views)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}