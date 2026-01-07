
import React from 'react';
import { Truck, Calendar, Cloud, RefreshCw, AlertCircle } from 'lucide-react';

interface HeaderProps {
  syncStatus?: 'synced' | 'syncing' | 'error';
}

const Header: React.FC<HeaderProps> = ({ syncStatus = 'synced' }) => {
  const today = new Date().toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  return (
    <header className="bg-gradient-to-r from-rose-600 to-red-700 text-white shadow-lg p-6 rounded-b-3xl mb-8">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
            <Truck className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">SwiftRun</h1>
            <div className="flex items-center gap-2">
              <p className="text-rose-100 text-sm font-medium">Daily Run Sheet Manager</p>
              <div className="w-px h-3 bg-white/20" />
              <div className="flex items-center gap-1.5">
                {syncStatus === 'syncing' && <RefreshCw className="w-3 h-3 text-white/70 animate-spin" />}
                {syncStatus === 'synced' && <Cloud className="w-3 h-3 text-emerald-300" />}
                {syncStatus === 'error' && <AlertCircle className="w-3 h-3 text-amber-300" />}
                <span className={`text-[10px] font-black uppercase tracking-widest ${
                  syncStatus === 'synced' ? 'text-emerald-300' : 
                  syncStatus === 'syncing' ? 'text-white/70' : 'text-amber-300'
                }`}>
                  {syncStatus}
                </span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full border border-white/20">
          <Calendar className="w-4 h-4 text-rose-200" />
          <span className="text-sm font-semibold">{today}</span>
        </div>
      </div>
    </header>
  );
};

export default Header;
