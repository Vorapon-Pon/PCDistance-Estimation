import type { Metadata } from 'next';
import Sidebar from '@/components/SideBar';

export const metadata: Metadata = {
  title: 'Projects | PC.DE',
  description: 'Manage your point cloud estimation projects',
};

export default function ProjectsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-[#121212]">
        {/* The Sidebar is fixed on the left */}
        <Sidebar />
    
        {/* Main content area */}
        <main className="flex-1 overflow-y-auto h-screen">
            <div className="p-6">
                {children}
            </div>
        </main>
    </div>
  );
}