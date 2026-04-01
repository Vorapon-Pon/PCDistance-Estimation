import Sidebar from "@/components/SideBar";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;

}) {
    return (
        <div className="flex min-h-screen bg-neutral-900">
            {/* The Sidebar is fixed on the left */}
            <Sidebar />

            {/* Main content area */}
            <main className="flex-1 overflow-y-auto h-screen">
                <div className="p-6">
                    {children}
                </div>
            </main>
        </div>
    )
}