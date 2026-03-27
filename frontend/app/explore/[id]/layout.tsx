import ExploreSidebar from "@/components/explore/ExploreSideBar";

export default function ExploreProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
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