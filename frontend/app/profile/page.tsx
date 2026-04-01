'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/client';
import { useRouter } from 'next/navigation';
import { User, Mail, FileText, Upload, Save, Loader2, CreditCard, UserCircle, Coins } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Profile = {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string;
  bio: string;
  credits: number;
  plan_tier: string;
};

export default function ProfilePage() {
  const supabase = createClient();
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user logged in');

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      setProfile(data);
      setDisplayName(data.display_name || '');
      setBio(data.bio || '');
      setAvatarUrl(data.avatar_url || '');
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const uploadAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      
      if (!event.target.files || event.target.files.length === 0) {
        throw new Error('You must select an image to upload.');
      }

      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const filePath = `${profile?.id}-${Math.random()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      setAvatarUrl(publicUrl);
    } catch (error) {
      console.error('Error uploading avatar:', error);
      alert('Error uploading avatar!');
    } finally {
      setUploading(false);
    }
  };

  const updateProfile = async () => {
    try {
      setSaving(true);
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: displayName,
          bio: bio,
          avatar_url: avatarUrl,
        })
        .eq('id', profile?.id);

      if (error) throw error;
      
      alert('Profile updated successfully!');
      window.location.reload(); 
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Error updating profile!');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-neutral-400">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className='bg-neutral-900'>
        <div className="bg-neutral-900 text-white p-6 max-w-4xl mx-auto w-full space-y-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8 border-b border-[#383838] pb-4">
            <User size={28} className="text-[#B8AB9C]" />
            <h1 className="text-2xl font-normal tracking-wide">My Profile</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Left Column: Avatar & Quick Info */}
            <div className="md:col-span-1 space-y-6">
            <Card className="bg-[#282828] border-[#383838] text-white">
                <CardContent className="flex flex-col items-center p-6 space-y-4">
                {/* Avatar Image */}
                <div className="relative w-32 h-32 rounded-full overflow-hidden bg-[#3F3F3F] border-4 border-[#383838] flex items-center justify-center">
                    {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                    <UserCircle size={64} className="text-neutral-500" />
                    )}
                    {uploading && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <Loader2 className="w-6 h-6 animate-spin text-white" />
                    </div>
                    )}
                </div>

                {/* Upload Button */}
                <div className="w-full relative">
                    <input
                    type="file"
                    id="avatar-upload"
                    accept="image/*"
                    onChange={uploadAvatar}
                    disabled={uploading}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                    />
                    <button 
                    type="button"
                    disabled={uploading}
                    className="w-full flex items-center justify-center gap-2 bg-[#3F3F3F] hover:bg-[#525252] text-sm py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
                    >
                    <Upload size={16} />
                    {uploading ? 'Uploading...' : 'Change Avatar'}
                    </button>
                </div>
                </CardContent>
            </Card>

            {/* Account Stats */}
            <Card className="bg-[#282828] border-[#383838] text-white">
                <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-neutral-400">
                    <CreditCard size={16} />
                    <span className="text-sm">Plan Tier</span>
                    </div>
                    <span className="text-sm font-medium capitalize bg-[#3F3F3F] px-2 py-1 rounded">
                    {profile?.plan_tier}
                    </span>
                </div>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-neutral-400">
                    <Coins size={16} />
                    <span className="text-sm">Credits</span>
                    </div>
                    <span className="text-sm font-medium">
                    {profile?.credits?.toLocaleString()}
                    </span>
                </div>
                </CardContent>
            </Card>
            </div>

            {/* Right Column: Edit Form */}
            <div className="md:col-span-2">
            <Card className="bg-[#282828] border-[#383838] text-white">
                <CardHeader className="border-b border-[#383838]">
                <CardTitle className="text-lg font-medium">Personal Information</CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                
                {/* Email (Read only) */}
                <div className="space-y-2">
                    <label className="text-sm text-neutral-400 flex items-center gap-2">
                    <Mail size={16} /> Email Address
                    </label>
                    <input 
                    type="email" 
                    value={profile?.email || ''} 
                    disabled
                    className="w-full bg-[#1E1E1E] text-neutral-500 border border-[#383838] rounded-lg px-4 py-2 cursor-not-allowed outline-none"
                    />
                </div>

                {/* Display Name */}
                <div className="space-y-2">
                    <label className="text-sm text-neutral-400 flex items-center gap-2">
                    <User size={16} /> Display Name
                    </label>
                    <input 
                    type="text" 
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Enter your display name"
                    className="w-full bg-[#1E1E1E] focus:bg-[#2A2A2A] text-white border border-[#383838] focus:border-[#525252] rounded-lg px-4 py-2 outline-none transition-colors"
                    />
                </div>

                {/* Bio */}
                <div className="space-y-2">
                    <label className="text-sm text-neutral-400 flex items-center gap-2">
                    <FileText size={16} /> Bio
                    </label>
                    <textarea 
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Tell us a little about yourself..."
                    rows={4}
                    className="w-full bg-[#1E1E1E] focus:bg-[#2A2A2A] text-white border border-[#383838] focus:border-[#525252] rounded-lg px-4 py-2 outline-none transition-colors resize-none"
                    />
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end pt-4">
                    <button
                    onClick={updateProfile}
                    disabled={saving}
                    className="flex items-center gap-2 bg-[#B8AB9C] hover:bg-[#B8AB9C]/70 text-neutral-800 px-6 py-2 rounded-lg transition-colors disabled:opacity-50 font-medium"
                    >
                    {saving ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                        <Save size={18} />
                    )}
                    {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>

                </CardContent>
            </Card>
            </div>
        </div>
        </div>
    </div>
  );
}