import { House, Box, Clock, Zap, Link as LinkIcon, Image as ImageIcon, Eye } from 'lucide-react';

export default function DashboardPage() {
    return (
        <div className='text-white space-y-10'>

            {/* Header */}
            <div className='flex items-center gap-3 mb-8'>
                <div className='p-1'>
                {/* Header Icon */}
                    <House className="w-6 h-6"/>
                </div>
                <h1 className='text-2xl font-normal'>Dashboard</h1>
            </div>
        </div>
    );
}