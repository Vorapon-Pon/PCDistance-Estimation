"use client";

import React, { useState } from "react";
import { Pencil } from "lucide-react";
import { createClient } from "@/utils/client";

interface DescriptionEditorProps {
  projectId: string;
  initialDescription: string;
}

export default function DescriptionEditor({ projectId, initialDescription }: DescriptionEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [description, setDescription] = useState(initialDescription || "");
  const [tempDescription, setTempDescription] = useState(description);
  const [isSaving, setIsSaving] = useState(false);
  const supabase = createClient();

  const handleSave = async () => {
    setIsSaving(true);
    const { error } = await supabase
      .from('projects')
      .update({ description: tempDescription })
      .eq('id', projectId);

    if (!error) {
      setDescription(tempDescription);
      setIsEditing(false);
    } else {
      console.error("Failed to update description", error);
      // แนะนำให้ใส่ Toast แจ้งเตือน Error ตรงนี้
    }
    setIsSaving(false);
  };

  const handleCancel = () => {
    setTempDescription(description);
    setIsEditing(false);
  };

  return (
    <div className="bg-[#1e1e1e] border border-[#2e2e2e] rounded-xl p-5 relative group">
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-gray-400 text-sm font-medium">Description</h3>
        {!isEditing && (
          <button 
            onClick={() => setIsEditing(true)}
            className="text-gray-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Pencil size={16} />
          </button>
        )}
      </div>
      
      {isEditing ? (
        <div className="space-y-3">
          <textarea
            value={tempDescription}
            onChange={(e) => setTempDescription(e.target.value)}
            className="w-full bg-[#121212] border border-[#3e3e3e] rounded-lg p-3 text-white focus:outline-none focus:border-teal-500 min-h-[100px]"
          />
          <div className="flex gap-2 justify-end">
            <button 
              onClick={handleCancel}
              disabled={isSaving}
              className="px-4 py-2 text-sm text-gray-400 hover:bg-[#2a2a2a] rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button 
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 text-sm bg-teal-600 hover:bg-teal-500 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      ) : (
        <p className="text-gray-300 leading-relaxed">
          {description || "No description provided."}
        </p>
      )}
    </div>
  );
}