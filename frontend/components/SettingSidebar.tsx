'use client'

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CreditCard, BarChart2 } from 'lucide-react';

export default function SettingSidebar() {
  const pathname = usePathname();

  const getLinkClasses = (path: string) => {
    const isActive = pathname === path || pathname.startsWith(path);
    const baseClass = "flex items-center gap-3 py-3 px-4 rounded-lg transition-all duration-300 ease-out";
    const activeClass = "bg-[#525252] text-white";
    const inactiveClass = "text-neutral-400 hover:bg-[#3F3F3F] hover:text-white hover:translate-x-1";
    
    return `${baseClass} ${isActive ? activeClass : inactiveClass}`;
  };

  const menuItems = [
    { name: 'Plan & Billing', href: '/settings/plans', icon: CreditCard },
    { name: 'Usage', href: '/settings/usage', icon: BarChart2 },
  ];

  return (
    <aside className="w-64 min-h-screen bg-neutral-900 text-neutral-400 py-6 px-2 border-r border-neutral-800 transition-all duration-300">
      <h2 className="text-xs font-bold text-neutral-500 tracking-wider mb-4 px-4">
        SETTINGS
      </h2>
      <nav className="space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={getLinkClasses(item.href)}
            >
              <Icon size={20} />
              <span className="text-sm font-medium">{item.name}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}