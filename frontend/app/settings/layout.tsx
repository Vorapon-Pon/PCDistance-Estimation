import SettingSidebar from '@/components/SettingSidebar'; 
import Sidebar from '@/components/SideBar';

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-neutral-900"> 
      <Sidebar />
      <SettingSidebar />
      
      <main className="flex-1 overflow-y-auto p-12 h-screen">
          {children}
        </main>
    </div>
  );
}