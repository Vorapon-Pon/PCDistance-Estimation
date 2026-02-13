'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Boxes, Compass, Flag, Settings, LogOut, UserCircle, House } from 'lucide-react';
import { get } from 'http';

export default function Sidebar() {
    const pathname = usePathname();
    // Function to determine if a link is active for styling sidebar
    const getLinkClasses = (path: string) => {
        const isActive = pathname === path || (path !== '/dashboard' && pathname.startsWith(path));
        const baseClass = "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 ease-out";
        const activeClass = "bg-[#525252] text-white";
        const inactiveClass = "hover:bg-[#3F3F3F] hover:text-white hover:translate-x-1";
        return `${baseClass} ${isActive ? activeClass : inactiveClass}`;
    };

    return (
        <aside className="w-64 bg-[#282828] text-gray-400 flex flex-col h-screen border-r border-neutral-800">
            {/* Logo Section */}
            <div className="p-6 flex item-center gap-2">
                <div className="font-bold text-xl text-white tracking-wider flex items-center gap-1">
                    <span className="text-[#B8AB9C] line-through">VW</span> PC.DE
                </div>
            </div>

            {/* Main Navigation */}
            <nav className='flex-1 px-4 space-y-2 mt-4'>
                <Link 
                  href="/dashboard" 
                  className={getLinkClasses('/dashboard')}
                >
                    <House size={20} />
                    <span>Dashboard</span>
                </Link>

                <Link 
                  href="/projects" 
                  className={getLinkClasses('/projects')}
                >
                  <Boxes size={20} />
                  <span>Projects</span>
                </Link>

                <Link 
                  href="/explore" 
                  className={getLinkClasses('/explore')}
                >
                  <Compass size={20} />
                  <span>Explore</span>
                </Link>
            </nav>

            {/* Bottom Navigation */}
            <div className='px-4 py-2 space-y-2'>
                <Link
                  href='/settings'
                  className={getLinkClasses('/settings')}
                >
                  <Settings size={20} />
                  <span>Settings</span>
                </Link>
            </div>

            {/* User Profile */}
            <div className='p-4 border-t border-[#3F3F3F] mt-2'>
                <div className='flex items-center gap-3 px-2'>
                    <Link
                      href='/profile'
                      className='w-10 h-10 bg-[#3F3F3F] rounded-full flex items-center justify-center hover:bg-[#525252] text-white transition-colors'>
                        <UserCircle size={24} />
                    </Link>
                    <div className='flex-1 overflow-hidden'>
                        <p className='text-sm font-medium text-white truncate'>UserName</p>
                        <p className='text-xs text-gray-500 truncate'>useremail@gmail.com</p>
                    </div>
                    <LogOut size={18} className='cursor-pointer hover:text-white'/>
                </div>
            </div>
        </aside>
    );
}