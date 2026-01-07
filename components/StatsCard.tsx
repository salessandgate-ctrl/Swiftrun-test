
import React from 'react';
import { TrendingUp, Package, CheckCircle2, ClipboardList } from 'lucide-react';
import { RunSheetStats } from '../types';

interface StatsCardProps {
  stats: RunSheetStats;
}

const StatsCard: React.FC<StatsCardProps> = ({ stats }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <div className="bg-white p-6 rounded-3xl shadow-md border border-slate-100 flex items-center gap-4">
        <div className="p-4 bg-rose-50 rounded-2xl">
          <ClipboardList className="w-6 h-6 text-rose-600" />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500">Total Bookings</p>
          <p className="text-2xl font-bold text-slate-800">{stats.totalDeliveries}</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-3xl shadow-md border border-slate-100 flex items-center gap-4">
        <div className="p-4 bg-emerald-50 rounded-2xl">
          <CheckCircle2 className="w-6 h-6 text-emerald-600" />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500">Completed</p>
          <p className="text-2xl font-bold text-slate-800">{stats.deliveredCount}</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-3xl shadow-md border border-slate-100 flex items-center gap-4">
        <div className="p-4 bg-rose-100/50 rounded-2xl">
          <Package className="w-6 h-6 text-rose-600" />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500">Total Cartons</p>
          <p className="text-2xl font-bold text-slate-800">{stats.totalCartons}</p>
        </div>
      </div>
    </div>
  );
};

export default StatsCard;
