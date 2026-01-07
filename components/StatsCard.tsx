
import React from 'react';
import { TrendingUp, Package, CheckCircle2, ClipboardList } from 'lucide-react';
import { RunSheetStats } from '../types';

interface StatsCardProps {
  stats: RunSheetStats;
}

const StatsCard: React.FC<StatsCardProps> = ({ stats }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      <div className="bg-white p-8 rounded-[2rem] shadow-lg border border-slate-100 flex items-center gap-6 group hover:scale-[1.02] transition-all">
        <div className="p-5 bg-blue-50 rounded-[1.5rem] group-hover:bg-blue-600 group-hover:text-white transition-all">
          <ClipboardList className="w-8 h-8 text-blue-600 group-hover:text-white transition-colors" />
        </div>
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Bookings</p>
          <p className="text-3xl font-black text-black tracking-tight">{stats.totalDeliveries}</p>
        </div>
      </div>

      <div className="bg-white p-8 rounded-[2rem] shadow-lg border border-slate-100 flex items-center gap-6 group hover:scale-[1.02] transition-all">
        <div className="p-5 bg-emerald-50 rounded-[1.5rem] group-hover:bg-emerald-600 group-hover:text-white transition-all">
          <CheckCircle2 className="w-8 h-8 text-emerald-600 group-hover:text-white transition-colors" />
        </div>
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Completed</p>
          <p className="text-3xl font-black text-black tracking-tight">{stats.deliveredCount}</p>
        </div>
      </div>

      <div className="bg-white p-8 rounded-[2rem] shadow-lg border border-slate-100 flex items-center gap-6 group hover:scale-[1.02] transition-all">
        <div className="p-5 bg-blue-100/50 rounded-[1.5rem] group-hover:bg-blue-600 group-hover:text-white transition-all">
          <Package className="w-8 h-8 text-blue-600 group-hover:text-white transition-colors" />
        </div>
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Units</p>
          <p className="text-3xl font-black text-black tracking-tight">{stats.totalCartons}</p>
        </div>
      </div>
    </div>
  );
};

export default StatsCard;
