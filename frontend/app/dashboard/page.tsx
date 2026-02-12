import { House, Box, Clock, Zap, Link as LinkIcon, Image as ImageIcon, Eye, Heart } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card';

export default function DashboardPage() {
    return (
        <div className='text-white space-y-10'>

            {/* Header */}
            <div className='flex items-center gap-3 mb-8'>
                <div className='p-1'>
                {/* Header Icon */}
                    <House size={24}/>
                </div>
                <h1 className='text-2xl font-normal'>Dashboard</h1>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Card 1 */}
                <StatCard 
                    title="Total Project" 
                    value="15" 
                    subText="Public projects" 
                    icon={<Box className="text-white" size={36} />} 
                />
                {/* Card 2 */}
                <StatCard 
                    title="Today's Project" 
                    value="4" 
                    subText="6 in this month" 
                    icon={<Clock className="text-white" size={36} />} 
                />
                {/* Card 3 */}
                <StatCard 
                    title="Successful runs" 
                    value="2" 
                    subText="your finish running project" 
                    icon={<Zap className="text-white" size={36} />} 
                />
                {/* Card 4 */}
                <StatCard 
                    title="Credits Usage" 
                    value="325" 
                    subText={"950" + "Total Credits Used" }
                    icon={<LinkIcon className="text-white" size={36} />} 
                />
            </div>

            {/* Favorites Projects */}
            <section>
                <h2 className="text-xl font-normal mb-6 flex items-center gap-2">
                <Heart size={20} /> Favorites
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
                <ProjectCard title="ProjectT1" user="User1" likes="2.4k" views="180" />
                <ProjectCard title="ProjectT2" user="User1" likes="1.5k" views="72" />
                <ProjectCard title="ProjectT200" user="UIIAIAUIU..." likes="800" views="300" />
                <ProjectCard title="ProjectT2" user="User1" likes="1.5k" views="72" />
                <ProjectCard title="ProjectT200" user="UIIAIAUIU..." likes="800" views="300" />
                </div>
            </section>

            {/* Recent Work Table */}
            <section>
                <h2 className="text-xl font-normal mb-6 flex items-center gap-2">
                <Clock size={20} className="text-white" /> Your Recent Work
                </h2>
                
                {/* Using Card to wrap the table */}
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
                                <TableRow name="AI-Dev: Future hand Free for Distance Estimation" date="10 / 1 / 2026" id="PRJ-8F2A-9KQ7" />
                                <TableRow name="A1-4" date="3 / 1 / 2026" id="PID-A7C3-FQ92" />
                                <TableRow name="B7-3" date="8 / 1 / 2026" id="PID-MA72-4FQ9" />
                                <TableRow name="B17-11" date="17 / 10 / 2025" id="PRJ-Q8F9-27AM" />
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
       <div className="w-14 h-14 bg-[#282828] rounded-lg flex items-center justify-center border border-[#383838] shrink-0 group-hover:border-[#545454] transition-colors">
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