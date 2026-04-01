import { House, Box, Clock, Zap, Link as LinkIcon, Image as ImageIcon, Eye, Heart } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card';
import { createClient } from '@/utils/server'

export default async function DashboardPage() {
    const supabase = await createClient()

    const { data: { user }} = await supabase.auth.getUser()

    if (!user) {
        return <div className="text-white p-8">Please log in to view dashboard.</div>
    }

    const [
        { data: projects, error: projectsError },
        { data: profile },
        { data: transactions },
        { data: favoriteLikes }
    ] = await Promise.all([
        supabase.from('projects')
            .select(`
                id, 
                user_id, 
                project_name, 
                status,
                is_public,
                created_at,
                last_updated,
                image_count
            `)
            .eq('user_id', user.id)
            .order('last_updated', { ascending: false }),
            
        supabase.from('profiles')
            .select('credits')
            .eq('id', user.id)
            .single(),

        supabase.from('credit_transactions')
            .select('amount')
            .eq('user_id', user.id)
            .lt('amount', 0), 

        supabase.from('project_likes')
            .select(`
                project_id,
                projects!inner (
                    id,
                    project_name,
                    profiles ( display_name )
                )
            `)
            .eq('user_id', user.id)
            .limit(5)
    ]);

    if (projectsError) return <div className="text-white p-8">Error loading projects data</div>

    const projectList = projects || [];

    const totalProjects = projectList.length;
    const publicProjects = projectList.filter(p => p.is_public).length;
    
    const todayStr = new Date().toISOString().split('T')[0];
    const todaysProjects = projectList.filter(p => p.created_at.startsWith(todayStr)).length;
    
    const successfulRuns = projectList.filter(p => p.status === 'completed' || p.status === 'success').length;

    const creditsUsed = transactions?.reduce((sum, t) => sum + Math.abs(t.amount), 0) || 0;

    const favorites = favoriteLikes?.map(like => {
        const projectData: any = Array.isArray(like.projects) ? like.projects[0] : like.projects;
        const profileData: any = Array.isArray(projectData?.profiles) ? projectData?.profiles[0] : projectData?.profiles;
        
        return {
            id: projectData?.id,
            title: projectData?.project_name || 'Untitled Project',
            user: profileData?.display_name || 'Unknown User',
            likes: "N/A", 
            views: "N/A"  
        }
    }) || [];

    const recentProjects = projectList.slice(0, 5); 

    return (
        <div className='text-white space-y-10'>

            {/* Header */}
            <div className='flex items-center gap-3 mb-8'>
                <div className='p-1'>
                    <House size={24}/>
                </div>
                <h1 className='text-2xl font-normal'>Dashboard</h1>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard 
                    title="Total Project" 
                    value={totalProjects.toString()} 
                    subText={`${publicProjects} Public projects`} 
                    icon={<Box className="text-white" size={36} />} 
                />
                <StatCard 
                    title="Today's Project" 
                    value={todaysProjects.toString()}
                    subText={`${todaysProjects} created today`}
                    icon={<Clock className="text-white" size={36} />} 
                />
                <StatCard 
                    title="Successful runs" 
                    value={successfulRuns.toString()}
                    subText="your finish running projects" 
                    icon={<Zap className="text-white" size={36} />} 
                />
                <StatCard 
                    title="Credits Usage" 
                    value={(creditsUsed.toFixed(2)).toString()}
                    subText={`${profile?.credits || 0} Credits Remaining`}
                    icon={<LinkIcon className="text-white" size={36} />} 
                />
            </div>

            {/* Favorites Projects */}
            <section>
                <h2 className="text-xl font-normal mb-6 flex items-center gap-2">
                <Heart size={20} /> Likes project
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
                    {favorites.length > 0 ? (
                        favorites.map((fav, idx) => (
                            <ProjectCard 
                                key={fav.id || idx} 
                                title={fav.title} 
                                user={fav.user} 
                                likes={fav.likes} 
                                views={fav.views} 
                            />
                        ))
                    ) : (
                        <div className="col-span-full text-zinc-500 text-sm">No favorite projects yet.</div>
                    )}
                </div>
            </section>

            {/* Recent Work Table */}
            <section>
                <h2 className="text-xl font-normal mb-6 flex items-center gap-2">
                <Clock size={20} className="text-white" /> Your Recent Work
                </h2>
                
                <Card className="bg-[#282828] border-[#383838] text-zinc-100 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-[#3F3F3F] text-zinc-400 border-b border-[#383838]">
                                <tr>
                                <th className="px-6 py-4 font-medium">Name</th>
                                <th className="px-6 py-4 font-medium">Edited</th>
                                <th className="px-6 py-4 font-medium">Project ID</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800">
                                {recentProjects.length > 0 ? (
                                    recentProjects.map((project) => (
                                        <TableRow 
                                            key={project.id}
                                            name={project.project_name || 'Untitled Project'} 
                                            // Format วันที่เป็นแบบ Localized
                                            date={new Date(project.last_updated || project.created_at).toLocaleDateString()} 
                                            // ตัดเอา UUID ส่วนแรกมาแสดงให้เหมือน PRJ-xxxx
                                            id={`PRJ-${project.id.split('-')[0].toUpperCase()}`} 
                                        />
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={3} className="px-6 py-4 text-center text-zinc-500">
                                            No recent projects found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </section>
        </div>
    );
}

function StatCard({ title, value, subText, icon}: { title:string, value:string, subText:string, icon:React.ReactNode }) {
    return (
        <Card className='flex flex-col gap-0 bg-[#282828] border-[#383838] text-white '>
            <CardHeader className='flex flex-row items-center justify-between space-y-0'>
                <CardTitle className='text-lg font-medium text-[#8B8B8B]'>
                    {title}
                </CardTitle>
                <div className='h-15 w-15 bg-[#3F3F3F] rounded-lg flex items-center justify-center border border-[#3F3F3F]'>
                    {icon}
                </div>
            </CardHeader>
            <CardContent className='flex flex-col pt-0'>
                <div className='text-3xl font-medium'>{value}</div>
                <p className='text-xs text-[#8B8B8B] mt-1'>{subText}</p> 
            </CardContent>
        </Card>
    );
}

function ProjectCard({ title, user, likes, views }: { title: string, user: string, likes: string, views: string }) {
  return (
    <Card className="bg-[#282828] border-[#383838] hover:bg-[#3F3F3F]/50 transition-colors cursor-pointer group p-3 flex flex-row items-center gap-4">
       <div className="w-14 h-14 bg-[#282828] rounded-lg flex items-center justify-center border-[#383838] shrink-0 group-hover:border-[#545454] transition-colors">
         <ImageIcon className="text-[#383838]  group-hover:text-[#545454]" size={24} />
       </div>
       <div className="flex flex-col justify-center min-w-0">
         <h3 className="text-white text-sm font-medium truncate">{title}</h3>
         <p className="text-[#8B8B8B] text-xs mb-1 truncate">by {user}</p>
         <div className="flex items-center gap-3 text-xs text-[#8B8B8B]">
            <span className="flex items-center gap-1">♥ {likes}</span>
            <span className="flex items-center gap-1"><Eye size={12} /> {views}</span>
         </div>
       </div>
    </Card>
  );
}

function TableRow({ name, date, id }: { name: string; date: string; id: string }) {
    return (
        <tr className="hover:bg-[#3F3F3F]/50 transition-colors group cursor-pointer">
            <td className="px-6 py-4 text-zinc-200 font-medium">{name}</td>
            <td className="px-6 py-4 text-zinc-500 font-mono text-xs">{date}</td>
            <td className="px-6 py-4 text-zinc-500 font-mono text-xs group-hover:text-zinc-300">{id}</td>
        </tr>
    );
}