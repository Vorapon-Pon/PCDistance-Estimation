'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createProject } from '@/app/projects/actions';
import { Plus, X, Globe, GlobeLock, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export default function NewProjectModal() {
    const router = useRouter();

    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [visibility, setVisibility] = useState('public');

    async function handleSubmit(formData: FormData) {
        setIsLoading(true);

        formData.append('visibility', visibility);

        const result = await createProject(formData);

        if(result?.error) {
            toast.error(`Error: ${result.error}`);
            setIsLoading(false);
        } else {
            toast.success('Project created successfully!');
            setIsLoading(false);
            setIsOpen(false);
            router.refresh();
            setTimeout(() => { window.location.reload(); }, 1000); 
        }
    }
    
    return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {/* Opens the modal Button */}
      <DialogTrigger asChild>   
        <button className="flex items-center gap-2 bg-neutral-800 hover:bg-neutral-700 text-white text-sm px-5 py-2.5 rounded-lg transition-all border border-neutral-600">
          <Plus size={16} />
          <span>New Project</span>
        </button>
      </DialogTrigger>

      {/* 2. The Modal Overlay Content */}
      <DialogContent className="bg-neutral-800 border-neutral-600 text-white sm:max-w-[500px] p-0 overflow-hidden shadow-2xl">
        
        {/* Header */}
        <form action={handleSubmit}>
            <DialogHeader className="px-6 pt-6 pb-2">
                <div className="flex items-center justify-between">
                    <DialogTitle className="text-xl font-semibold">Create New Project</DialogTitle>
                </div>
                <DialogDescription className="text-neutral-400 text-sm mt-1.5 leading-relaxed">
                    Set up a new project for point cloud distance estimation and object detection.
                </DialogDescription>
            </DialogHeader>

            {/* Form Content */}
            <div className="px-6 py-4 space-y-5">
            
            {/* Project Name */}
            <div className="space-y-2">
                <Label htmlFor="name" className="text-gray-200 font-medium text-sm">Project Name</Label>
                <Input 
                id="name"
                name="projectName"
                required
                placeholder="e.g. Highway-A1-Section4" 
                className="bg-neutral-900 border-neutral-700 text-white placeholder:text-neutral-600 focus-visible:ring-1 focus-visible:ring-[#B8AB9C] focus-visible:border-[#B8AB9C] transition-all"
                />
            </div>

            {/* Description */}
            <div className="space-y-2">
                <Label htmlFor="desc" className="text-gray-200 font-medium text-sm">Description</Label>
                <Textarea 
                id="desc" 
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

            {/* Detection Classes (Input Group) */}
            <div className="space-y-2">
                <Label htmlFor="classes" className="text-gray-200 font-medium text-sm">Detection Classes</Label>
                <div className="flex gap-2">
                <Input 
                    id="classes" 
                    placeholder="e.g. Car, Pedestrian, Sign..." 
                    className="bg-neutral-900 border-neutral-700 text-white placeholder:text-neutral-600 focus-visible:ring-1 focus-visible:ring-[#B8AB9C] focus-visible:border-[#B8AB9C]"
                />
                <Button size="icon" className="bg-neutral-800 hover:bg-neutral-700 text-gray-300 border border-neutral-700 shrink-0">
                    <Plus size={18} />
                </Button>
                </div>
                <p className="text-xs text-gray-500">
                Press Enter or click + to add a class. These define what objects the detector will identify.
                </p>
            </div>

            </div>

            {/* Footer Actions */}
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
                onClick={() => setIsLoading(true)}
                className="bg-[#6d655c] hover:bg-[#B8AB9C] text-white font-medium px-6"
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