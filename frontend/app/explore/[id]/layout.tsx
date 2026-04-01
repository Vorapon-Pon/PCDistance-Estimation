import ExploreSidebar from "@/components/explore/ExploreSideBar";

export default async function ExploreProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    return (
        <div className="flex min-h-screen bg-neutral-900">
            <ExploreSidebar/>

            {/* Main content area */}
            <main className="flex-1 overflow-y-auto h-screen">
                <div className="">
                    {children}
                </div>
            </main>
        </div>
    )
}