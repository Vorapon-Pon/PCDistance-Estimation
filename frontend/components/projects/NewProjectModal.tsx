'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createProject } from '@/app/projects/actions';
import { Plus, Globe, GlobeLock, Loader2, CheckSquare, Square } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { createClient } from '@/utils/client';
import { profile } from 'console';

const PREDEFINED_CLASSES = [
  { name: "person", defaultColor: "#ef4444" },       // Red
  { name: "car", defaultColor: "#3b82f6" },          // Blue
  { name: "motorcycle", defaultColor: "#10b981" },   // Emerald
  { name: "bus", defaultColor: "#f59e0b" },          // Amber
  { name: "electricpole", defaultColor: "#8b5cf6" }, // Violet
  { name: "lightpole", defaultColor: "#ec4899" },    // Pink
  { name: "sign", defaultColor: "#14b8a6" },         // Teal
  { name: "trafficsign", defaultColor: "#f97316" }   // Orange
];

export default function NewProjectModal() {
    const supabase = createClient();
    const router = useRouter();

    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [visibility, setVisibility] = useState('public');

    const [userTier, setUserTier] = useState<string>('free');

    useEffect(() => {
        const fetchUserTier = async () => {
            const { data: { user }} = await supabase.auth.getUser();

            if(user) {
                const { data: profileData } = await supabase.from('profiles')
                .select('plan_tier')
                .eq('id', user.id)
                .single();

                setUserTier(profileData?.plan_tier || 'free');
            }
        }
        fetchUserTier();
    }, [])

    const [classSettings, setClassSettings] = useState<Record<string, { selected: boolean, color: string }>>(() => {
        const initial: Record<string, { selected: boolean, color: string }> = {};
        PREDEFINED_CLASSES.forEach(cls => {
            initial[cls.name] = { selected: false, color: cls.defaultColor };
        });
        return initial;
    });

    const toggleClass = (className: string) => {
        setClassSettings(prev => ({
            ...prev,
            [className]: { ...prev[className], selected: !prev[className].selected }
        }));
    };

    const handleColorChange = (className: string, newColor: string) => {
        setClassSettings(prev => ({
            ...prev,
            [className]: { ...prev[className], color: newColor }
        }));
    };

    async function handleSubmit(formData: FormData) {
        setIsLoading(true);

        formData.append('visibility', visibility);
        
        const selectedClassesToSave = PREDEFINED_CLASSES
            .filter(cls => classSettings[cls.name].selected)
            .map(cls => ({ 
                name: cls.name, 
                color: classSettings[cls.name].color 
            }));
            
        formData.append('classesData', JSON.stringify(selectedClassesToSave));

        const result = await createProject(formData);

        if(result?.error) {
            toast.error(`Error: ${result.error}`);
            setIsLoading(false);
        } else {
            toast.success('Project created successfully!');
            setIsLoading(false);
            setIsOpen(false);
            router.refresh();
            const initial: Record<string, { selected: boolean, color: string }> = {};
            PREDEFINED_CLASSES.forEach(cls => initial[cls.name] = { selected: false, color: cls.defaultColor });
            setClassSettings(initial);
        }

        window.location.reload(); 
    }
    
    const canCreateProject = userTier !== 'free' && userTier !== 'viewer';

    return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild> 

        {canCreateProject ? (
            <button className="flex items-center gap-2 bg-neutral-800 hover:bg-neutral-700 text-white text-sm px-5 py-2.5 rounded-lg transition-all border border-neutral-600">
            <Plus size={16} />
            <span>New Project</span>
            </button>
        ) : (
            <button 
            className="flex items-center gap-2 bg-neutral-800  text-neutral-400 text-sm px-5 py-2.5 rounded-lg transition-all border border-neutral-600"
            disabled
            title="Available for Pro users only"
            >
                <Plus size={16} />
                <span>New Project</span>
            </button>
        )}  
        
      </DialogTrigger>

      <DialogContent className="bg-neutral-800 border-neutral-600 text-white sm:max-w-[500px] p-0 overflow-hidden shadow-2xl">
        <form action={handleSubmit}>
            <DialogHeader className="px-6 pt-6 pb-2">
                <div className="flex items-center justify-between">
                    <DialogTitle className="text-xl font-semibold">Create New Project</DialogTitle>
                </div>
                <DialogDescription className="text-neutral-400 text-sm mt-1.5 leading-relaxed">
                    Set up a new project for point cloud distance estimation and object detection.
                </DialogDescription>
            </DialogHeader>

            <div className="px-6 py-4 space-y-5">
            
            {/* Project Name */}
            <div className="space-y-2">
                <Label htmlFor="projectName" className="text-gray-200 font-medium text-sm">Project Name</Label>
                <Input 
                  id="projectName"
                  name="projectName"
                  required
                  placeholder="e.g. Highway-A1-Section4" 
                  className="bg-neutral-900 border-neutral-700 text-white placeholder:text-neutral-600 focus-visible:ring-1 focus-visible:ring-[#B8AB9C] focus-visible:border-[#B8AB9C] transition-all"
                />
            </div>

            {/* Description */}
            <div className="space-y-2">
                <Label htmlFor="description" className="text-gray-200 font-medium text-sm">Description</Label>
                <Textarea 
                  id="description" 
                  name="description"
                  placeholder="Describe the project scope, location, or purpose..." 
                  className="bg-neutral-900 border-neutral-700 text-white placeholder:text-neutral-600 min-h-[80px] focus-visible:ring-1 focus-visible:ring-[#B8AB9C] focus-visible:border-[#B8AB9C] resize-none"
                />
            </div>

            {/* Visibility Dropdown */}
            <div className="space-y-2">
                <Label className="text-gray-200 font-medium text-sm">Visibility</Label>
                <Select value={visibility} onValueChange={setVisibility}>
                    <SelectTrigger className="bg-neutral-900 border-neutral-700 text-white focus:ring-1 focus:ring-[#B8AB9C] focus:border-[#B8AB9C]">
                        <SelectValue placeholder="Select visibility" />
                    </SelectTrigger>
                    <SelectContent className="bg-neutral-800 border-neutral-700 text-white">
                        <SelectItem value="public">
                            <div className="flex items-center gap-2"><Globe size={16} /> Public</div>
                        </SelectItem>
                        <SelectItem value="private">
                            <div className="flex items-center gap-2"><GlobeLock size={16} /> Private</div>
                        </SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* 💡 Predefined Classes Selection */}
            <div className="space-y-3">
                <Label className="text-gray-200 font-medium text-sm">Detection Classes (Select & Customize Colors)</Label>
                
                <div className="grid grid-cols-2 gap-2 max-h-[160px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-neutral-600 scrollbar-track-transparent">
                    {PREDEFINED_CLASSES.map((cls) => {
                        const isSelected = classSettings[cls.name].selected;
                        
                        return (
                        <div 
                            key={cls.name}
                            className={`flex items-center justify-between p-2 border rounded-lg transition-colors ${isSelected ? 'bg-neutral-900/80 border-[#B8AB9C]' : 'bg-neutral-900 border-neutral-700 hover:border-neutral-500'}`}
                        >
                            <div 
                                className="flex items-center gap-2 cursor-pointer flex-1 overflow-hidden" 
                                onClick={() => toggleClass(cls.name)}
                            >
                                {isSelected ? (
                                    <CheckSquare size={18} className="text-[#B8AB9C] shrink-0" />
                                ) : (
                                    <Square size={18} className="text-neutral-500 shrink-0" />
                                )}
                                <span className={`text-sm capitalize truncate ${isSelected ? 'text-white' : 'text-neutral-400'}`}>
                                    {cls.name}
                                </span>
                            </div>
                            
                            {/* แสดงกล่องเลือกสีเสมอ หรือจะให้แสดงเฉพาะตอนโดนติ๊กก็ได้ (ในที่นี้แสดงตลอดแต่หรี่แสงลงถ้าไม่ได้เลือก) */}
                            <input 
                                type="color" 
                                value={classSettings[cls.name].color}
                                onChange={(e) => handleColorChange(cls.name, e.target.value)}
                                disabled={!isSelected}
                                className={`w-6 h-6 p-0 border-0 rounded cursor-pointer shrink-0 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-30 cursor-not-allowed'}`}
                                title={`Color for ${cls.name}`}
                            />
                        </div>
                    )})}
                </div>
            </div>

            </div>

            <div className="bg-neutral-900 px-6 py-4 flex justify-end gap-3 border-t border-neutral-700">
            <Button 
                variant="ghost" 
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-gray-300 hover:text-white hover:bg-[#2a2a30]"
            >
                Cancel
            </Button>
            <Button 
                type="submit"
                className="bg-[#6d655c] hover:bg-[#B8AB9C] text-white font-medium px-6"
                disabled={isLoading}
            >    
                {isLoading ? (
                    <>
                    <Loader2 size={16} className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                    </>
                ) : (
                    'Create Project'
                )}
            </Button>
            </div>
            </form>
      </DialogContent>
    </Dialog>
  );
}