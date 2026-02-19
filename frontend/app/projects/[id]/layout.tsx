import ProjectSidebar from "@/components/projects/ProjectSidebar";
import Sidebar from "@/components/SideBar";

export default function ProjectLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: { id: string };
}) {
    return (
        <div className="flex min-h-screen bg-neutral-900">
            <ProjectSidebar />
            <main className="flex-1 overflow-y-auto h-screen">
                {children}
            </main>
        </div>
    )
}