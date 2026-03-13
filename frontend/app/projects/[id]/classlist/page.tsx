'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Plus, Search, GripVertical, List, Trash2, Tag, AlertCircle } from 'lucide-react';
import { createClient } from '@/utils/client';

interface ProjectClass {
  id: string;
  name: string;
  color: string;
  is_active: boolean;
  annotation_count?: number; 
}

export default function ClassesPage() {
  const supabase = createClient();
  const params = useParams();
  const projectId = params.id as string; 

  const [classes, setClasses] = useState<ProjectClass[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const [showAddModal, setShowAddModal] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newClassColor, setNewClassColor] = useState('#3b82f6'); 
  const [showSpaceWarning, setShowSpaceWarning] = useState(false);

  const fetchClasses = async () => {
    setIsLoading(true);

    try {
      // Step 1: ดึงคลาสทั้งหมดที่ตั้งค่าไว้ในโปรเจกต์นี้
      const { data: classesData, error: classesError } = await supabase
        .from('project_classes')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });

      if (classesError) throw classesError;

      // Step 2: ดึงรายการ object ที่ตรวจจับได้ทั้งหมดในโปรเจกต์นี้
      // ดึงมาแค่ class_name เพื่อประหยัด Bandwidth 
      const { data: detectionsData, error: detectionsError } = await supabase
        .from('detected_objects')
        .select('class_name')
        .eq('project_id', projectId);

      if (detectionsError) throw detectionsError;

      const countMap: Record<string, number> = {};
      if (detectionsData) {
        detectionsData.forEach((obj) => {

          countMap[obj.class_name] = (countMap[obj.class_name] || 0) + 1;
        });
      }

      if (classesData) {
        const classesWithRealCounts = classesData.map(c => ({
          ...c,
          annotation_count: countMap[c.name] || 0 
        }));
        
        setClasses(classesWithRealCounts);
      }
    } catch (err) {
      console.error("Error fetching class data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchClasses();
  }, [projectId]);

  const handleClassNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Check if the user typed a space
    if (value.includes(' ')) {
      setShowSpaceWarning(true);
      // Hide the warning after 3 seconds
      setTimeout(() => setShowSpaceWarning(false), 3000);
    }
    // Auto-replace spaces with hyphens
    setNewClassName(value.replace(/\s+/g, '-'));
  };

  const handleAddClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim()) return;

    const { data, error } = await supabase
      .from('project_classes')
      .insert([
        { project_id: projectId, name: newClassName, color: newClassColor }
      ])
      .select()
      .single();

    if (data) {
      setClasses([...classes, { ...data, annotation_count: 0 }]);
      setShowAddModal(false);
      setNewClassName('');
      setNewClassColor('#3b82f6');
      setShowSpaceWarning(false);
    }
  };

  const toggleActive = async (id: string, currentStatus: boolean) => {
    const newStatus = !currentStatus;
    setClasses(classes.map(c => c.id === id ? { ...c, is_active: newStatus } : c));
    
    await supabase
      .from('project_classes')
      .update({ is_active: newStatus })
      .eq('id', id);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการลบคลาสนี้?')) return;
    
    setClasses(classes.filter(c => c.id !== id));
    await supabase.from('project_classes').delete().eq('id', id);
  };

  const filteredClasses = classes.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalClasses = classes.length;
  const activeClasses = classes.filter(c => c.is_active).length;
  const totalAnnotations = classes.reduce((sum, c) => sum + (c.annotation_count || 0), 0);

  return (
    <div className="bg-neutral-900 p-6 text-white  font-sans">
      <div className="mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex justify-between border-b border-neutral-800 pb-4 mb-6 items-center">
          <div>
            <div className="flex items-center gap-3">
                <List className="text-white" size={28} />
              <div>
                <h1 className="text-xl text-semibold">Classes & Tags</h1>
              </div>
            </div>
          </div>
          <button 
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-[#B8AB9C] hover:bg-[#B8AB9C]/70 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            <Plus size={20} /> Add Class
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-[#1A1A1A] border border-neutral-800 p-6 rounded-xl text-center">
            <div className="text-3xl font-bold">{totalClasses}</div>
            <div className="text-neutral-400 text-sm mt-1">Total Classes</div>
          </div>
          <div className="bg-[#1A1A1A] border border-neutral-800 p-6 rounded-xl text-center">
            <div className="text-3xl font-bold text-emerald-500">{activeClasses}</div>
            <div className="text-neutral-400 text-sm mt-1">Active Classes</div>
          </div>
          <div className="bg-[#1A1A1A] border border-neutral-800 p-6 rounded-xl text-center">
            <div className="text-3xl font-bold">{totalAnnotations}</div>
            <div className="text-neutral-400 text-sm mt-1">Total Annotations</div>
          </div>
        </div>

        {/* Search & List Section */}
        <div className="bg-[#1A1A1A] border border-neutral-800 rounded-xl overflow-hidden">
          
          {/* Search Bar */}
          <div className="p-4 border-b border-neutral-800 flex items-center gap-3">
            <Search className="text-neutral-500" size={20} />
            <input 
              type="text" 
              placeholder="Search classes..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border-none outline-none w-full text-white placeholder-neutral-500"
            />
          </div>

          {/* List Header */}
          <div className="p-4 font-semibold text-white">Detection Classes</div>

          {/* List Items */}
          <div className="divide-y divide-neutral-800">
            {isLoading ? (
              <div className="p-8 text-center text-neutral-500">Loading...</div>
            ) : filteredClasses.length === 0 ? (
              <div className="p-8 text-center text-neutral-500">No classes found.</div>
            ) : (
              filteredClasses.map((cls) => (
                <div key={cls.id} className="flex items-center p-4 hover:bg-[#222222] transition-colors group">
                  <div className="flex items-center gap-4 flex-1">
                    <GripVertical className="text-neutral-600 cursor-grab" size={20} />
                    {/* Color Box */}
                    <div 
                      className="w-10 h-10 rounded-lg shadow-inner" 
                      style={{ backgroundColor: cls.color }}
                    />
                    <div>
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-lg">{cls.name}</span>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                            cls.annotation_count && cls.annotation_count > 0 
                            ? 'bg-emerald-500/20 text-emerald-400' 
                            : 'bg-neutral-800 text-neutral-400'
                        }`}>
                            {cls.annotation_count} annotations
                        </span>
                        </div>
                      <div className="text-neutral-500 text-sm font-mono mt-1">{cls.color}</div>
                    </div>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex items-center gap-4">
                    <span 
                      className="border text-xs px-3 py-1 rounded text-neutral-400 opacity-50 cursor-default"
                      style={{ borderColor: cls.color, color: cls.color }}
                    >
                      bbox
                    </span>
                    <button 
                      onClick={() => toggleActive(cls.id, cls.is_active)}
                      className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                        cls.is_active 
                          ? 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20' 
                          : 'bg-neutral-800 text-neutral-500 hover:bg-neutral-700'
                      }`}
                    >
                      {cls.is_active ? 'Active' : 'Inactive'}
                    </button>
                    <button 
                      onClick={() => handleDelete(cls.id)}
                      className="text-neutral-500 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Add Class Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-neutral-900/60 flex items-center justify-center z-50">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 w-[400px]">
            <h2 className="text-xl font-semibold mb-4">Add New Class</h2>
            <form onSubmit={handleAddClass} className="space-y-4">
              <div>
                <label className="block text-sm text-neutral-400 mb-1">Class Name</label>
                <input 
                  type="text" 
                  value={newClassName}
                  onChange={handleClassNameChange}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-3 text-white focus:border-[#B8AB9C] outline-none"
                  placeholder="e.g. car, light-pole"
                  required
                />
                {/* Inline warning for spaces */}
                {showSpaceWarning && (
                  <p className="flex items-center gap-1 text-xs text-amber-500 mt-2">
                    <AlertCircle size={14} /> Spaces are automatically converted to hyphens.
                  </p>
                )}
              </div>
              
              <div>
                <label className="block text-sm text-neutral-400 mb-1">Color</label>
                <div className="flex items-center gap-3">
                  <input 
                    type="color" 
                    value={newClassColor}
                    onChange={(e) => setNewClassColor(e.target.value)}
                    className="w-12 h-12 rounded bg-transparent border-0 cursor-pointer p-0 shrink-0"
                  />
                  <input 
                    type="text" 
                    value={newClassColor}
                    onChange={(e) => setNewClassColor(e.target.value)}
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-lg p-3 text-white font-mono focus:border-[#B8AB9C] outline-none"
                    placeholder="#3b82f6"
                    maxLength={7}
                  />
                </div>
              </div>
              
              <div className="flex gap-3 mt-6">
                <button 
                  type="button" 
                  onClick={() => {
                    setShowAddModal(false);
                    setShowSpaceWarning(false);
                  }}
                  className="flex-1 bg-neutral-800 hover:bg-neutral-700 py-2 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="flex-1 bg-[#B8AB9C] hover:bg-[#B8AB9C]/70 text-white py-2 rounded-lg transition-colors"
                >
                  Save Class
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}