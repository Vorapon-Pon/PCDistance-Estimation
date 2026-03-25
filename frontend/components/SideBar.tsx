'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Boxes, Compass, Flag, Settings, LogOut, UserCircle, House, ChevronLeft, ChevronRight } from 'lucide-react';

type UserProfile = {
    display_name: string;
    email: string;
    avatar_url?: string | null;
};

export default function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const supabase = createClient();

    const [collapsed, setCollapsed] = useState(false);
    const [user, setUser] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const getUserData = async () => {
            const { data: { user }} = await supabase.auth.getUser();

            if (user) {
                const { data: profileData } = await supabase.from('profiles')
                .select('display_name, email, avatar_url')
                .eq('id', user.id)
                .single();
                
                setUser({
                    email: user.email || '',
                    display_name: profileData?.display_name || 'Unknown User',
                    avatar_url: profileData?.avatar_url || null,
                });
            }
            setLoading(false);
        };
        getUserData();
    }, [supabase]);

    useEffect(() => {
    const isInProject = pathname.startsWith('/projects/') && pathname !== '/projects';
    const isInSettings = pathname.startsWith('/settings/') && pathname !== '/settings';

        if (isInProject || isInSettings ) {
            setCollapsed(true);
        } else {
            setCollapsed(false); 
        }
    }, [pathname]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/');
        router.refresh();
    };
    // Function to determine if a link is active for styling sidebar
    const getLinkClasses = (path: string) => {
        const isActive = pathname === path || (path !== '/dashboard' && pathname.startsWith(path));
        const baseClass = `flex items-center gap-3 py-3 rounded-lg transition-all duration-300 ease-out ${
            collapsed ? 'justify-center px-2' : 'px-4'
        }`;
        const activeClass = "bg-[#525252] text-white";
        const inactiveClass = "hover:bg-[#3F3F3F] hover:text-white hover:translate-x-1";
        
        return `${baseClass} ${isActive ? activeClass : inactiveClass}`;
    };

    return (
        <aside className={`bg-neutral-900 text-neutral-400 flex flex-col h-screen border-r border-neutral-800 transition-all duration-300 relative ${
                collapsed ? 'w-20' : 'w-64'
            }`}>
            {/* Logo Section */}
            <div className="p-6 flex item-center gap-2">
                {!collapsed && (
                    <div className="font-bold text-xl text-white tracking-wider flex items-center gap-1 overflow-hidden whitespace-nowrap">
                        <span className="text-[#B8AB9C] line-through">VW</span> PC.DE
                    </div>
                )}
                <button 
                    onClick={() => setCollapsed(!collapsed)}
                    className="p-2 items-center rounded-lg hover:bg-[#3F3F3F] text-neutral-400 transition-colors"
                >
                    {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
                </button>
            </div>

            {/* Main Navigation */}
            <nav className='flex-1 px-2 space-y-2 mt-4'>
                <Link href="/dashboard" className={getLinkClasses('/dashboard')} title={collapsed ? "Dashboard" : ""}>
                    <House size={20} />
                    {/* ซ่อน Text เมื่อย่อ */}
                    {!collapsed && <span className='whitespace-nowrap'>Dashboard</span>}
                </Link>

                <Link href="/projects" className={getLinkClasses('/projects')} title={collapsed ? "Projects" : ""}>
                    <Boxes size={20} />
                    {!collapsed && <span className='whitespace-nowrap'>Projects</span>}
                </Link>

                <Link href="/explore" className={getLinkClasses('/explore')} title={collapsed ? "Explore" : ""}>
                    <Compass size={20} />
                    {!collapsed && <span className='whitespace-nowrap'>Explore</span>}
                </Link>
            </nav>

            {/* Bottom Navigation */}
            <div className='px-4 py-2 space-y-2'>
                <Link href='/settings/plans' className={getLinkClasses('/settings')} title={collapsed ? "Settings" : ""}>
                    <Settings size={20} />
                    {!collapsed && <span className='whitespace-nowrap'>Settings</span>}
                </Link>
            </div>

            {/* User Profile */}
            <div className={`border-t border-[#3F3F3F] mt-2 transition-all duration-300 ${collapsed ? 'p-2' : 'p-4'}`}>
                {loading ? (
                    <div className={`flex items-center gap-3 animate-pulse ${collapsed ? 'justify-center' : 'px-2'}`}>
                        <div className="w-10 h-10 bg-[#3F3F3F] rounded-full shrink-0"></div>
                        {!collapsed && (
                            <div className="flex-1 space-y-2 overflow-hidden">
                                <div className="h-3 bg-[#3F3F3F] rounded w-20"></div>
                                <div className="h-2 bg-[#3F3F3F] rounded w-28"></div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className={`flex items-center gap-3 ${collapsed ? 'flex-col justify-center' : 'px-2'}`}>
                        {/* Avatar */}
                        <Link
                            href='/profile'
                            className='w-10 h-10 bg-[#3F3F3F] rounded-full flex items-center justify-center hover:bg-[#525252] text-white transition-colors overflow-hidden shrink-0'
                            title={collapsed ? "Profile" : ""}
                        >
                            {user?.avatar_url ? (
                                <img src={user.avatar_url} alt="profile" className="w-full h-full object-cover" />
                            ) : (
                                <UserCircle size={24} />
                            )}
                        </Link>

                        {/* User Info - ซ่อนเมื่อย่อ */}
                        {!collapsed && (
                            <div className='flex-1 overflow-hidden transition-opacity duration-300'>
                                <p className='text-sm font-medium text-white truncate'>
                                    {user?.display_name || 'Unknown User'}
                                </p>
                                <p className='text-xs text-gray-500 truncate' title={user?.email || ''}>
                                    {user?.email}
                                </p>
                            </div>
                        )}

                        {/* Logout Button */}
                        <button
                            onClick={handleLogout}
                            className={`text-gray-400 hover:text-red-400 transition-colors p-1 ${collapsed ? 'mt-2' : ''}`}
                            title='Sign out'
                        >
                            <LogOut size={18} />
                        </button>
                    </div>
                )}
            </div>
        </aside>
    );
}