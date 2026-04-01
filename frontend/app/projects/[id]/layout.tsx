import ProjectSidebar from "@/components/projects/ProjectSidebar";
import Sidebar from "@/components/SideBar";

export default async function ProjectLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    return (
        <div className="flex min-h-screen bg-neutral-900">
            <ProjectSidebar />
            <main className="flex-1 overflow-y-auto h-screen">
                {children}
            </main>
        </div>
    )
}