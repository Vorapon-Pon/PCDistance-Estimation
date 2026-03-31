'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Boxes, Compass, Flag, Settings, LogOut, UserCircle, House, ChevronLeft, ChevronRight, Coins, Lock } from 'lucide-react'; // เพิ่ม Coins

type UserProfile = {
    display_name: string;
    email: string;
    avatar_url?: string | null;
    credits?: number; 
    plan_tier?: string;
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
                .select('display_name, email, avatar_url, credits, plan_tier')
                .eq('id', user.id)
                .single();
                
                setUser({
                    email: user.email || '',
                    display_name: profileData?.display_name || 'Unknown User',
                    avatar_url: profileData?.avatar_url || null,
                    credits: profileData?.credits || 0, 
                    plan_tier: profileData?.plan_tier || 'free',
                });
            }
            setLoading(false);
        };
        getUserData();
    }, [supabase]);

    useEffect(() => {
    const isInProject = pathname.startsWith('/projects/') && pathname !== '/projects';
    const isInSettings = pathname.startsWith('/settings/') && pathname !== '/settings';
    const isInExplore = pathname.startsWith('/explore/') && pathname !== '/explore';

        if (isInProject || isInSettings || isInExplore) {
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

                {user?.plan_tier === 'free' || user?.plan_tier === 'viewer'  ? (
                    <div className={`flex items-center gap-2 px-4 py-3 text-neutral-400 cursor-not-allowed 
                        ${collapsed ? "justify-center px-2" : ""}`}
                        title={collapsed ? "Projects (Locked)" : ""}
                    >
                        <Lock size={20} />
                        {!collapsed && <span className="whitespace-nowrap">Projects</span>}
                    </div>
                ) : (
                    <Link href="/projects" className={`${getLinkClasses('/projects')} 
                        ${collapsed ? "justify-center px-2" : ""}`}
                        title={collapsed ? "Projects" : ""}
                    >
                    <Boxes size={20} />
                        {!collapsed && <span className="whitespace-nowrap">Projects</span>}
                    </Link>
                )}
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

            {/* Credits Section */}
            {!loading && user && (
                <div className={`mx-4 mt-2 flex items-center bg-[#2A2A2A] rounded-lg border border-[#3F3F3F] transition-all duration-300 ${
                    collapsed ? 'flex-col p-2 gap-1 justify-center mx-2' : 'p-3 gap-3'
                }`}
                title={collapsed ? `${user.credits || 0} Credits` : ""}
                >
                    <Coins size={collapsed ? 18 : 20} className="text-[#B8AB9C] shrink-0" />
                    {!collapsed ? (
                        <div className="flex flex-col overflow-hidden">
                            <span className="text-xs text-neutral-400 font-medium whitespace-nowrap">Available Credits</span>
                            <span className="text-sm text-white font-bold">{user.credits?.toLocaleString() || 0}</span>
                        </div>
                    ) : (
                        <span className="text-[10px] text-white font-bold">{user.credits || 0}</span>
                    )}
                </div>
            )}

            {/* User Profile */}
            <div className={`border-t border-[#3F3F3F] mt-4 transition-all duration-300 ${collapsed ? 'p-2' : 'p-4'}`}>
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