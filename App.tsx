import React, { useState, useEffect, useMemo, useCallback } from 'react';
import BookingForm from './components/BookingForm';
import RunSheetTable from './components/RunSheetTable';
import StatsCard from './components/StatsCard';
import MapModal from './components/MapModal';
import { DeliveryBooking, RunSheetStats, BookingStatus, Customer, PICKUP_PRESETS } from './types';
import { History as HistoryIcon, Users, Trash2, Edit3, Save, X, MapPin, Map as MapIcon, ChevronDown, ChevronUp, FileSpreadsheet, CheckCircle2, Filter, FilterX, Loader2, Mail, Share2, Cloud, CloudOff, RefreshCw, Copy, Check, Archive, Database, ShieldCheck, Info, Truck, LogIn, Key, HelpCircle, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';

const CLOUD_API_BASE = 'https://jsonblob.com/api/jsonBlob';
const SYNC_POLL_INTERVAL = 10000;

const App: React.FC = () => {
  const [bookings, setBookings] = useState<DeliveryBooking[]>([]);
  const [savedCustomers, setSavedCustomers] = useState<Customer[]>(() => {
    const saved = localStorage.getItem('swiftRun_customers');
    return saved ? JSON.parse(saved) : [];
  });
  const [localArchive, setLocalArchive] = useState<DeliveryBooking[]>(() => {
    const saved = localStorage.getItem('swiftRun_permanent_archive');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [syncId, setSyncId] = useState<string | null>(localStorage.getItem('swiftRun_syncId'));
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [joinKeyInput, setJoinKeyInput] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [editingBooking, setEditingBooking] = useState<DeliveryBooking | null>(null);
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  
  const [isContactsExpanded, setIsContactsExpanded] = useState(true);
  const [isArchiveExpanded, setIsArchiveExpanded] = useState(false);
  
  const [highlightedBookingId, setHighlightedBookingId] = useState<string | null>(null);
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);
  const [mapTargetBookings, setMapTargetBookings] = useState<DeliveryBooking[]>([]);
  const [mapTitle, setMapTitle] = useState("Delivery Route Map");

  const pushToCloud = useCallback(async (data: DeliveryBooking[], targetId: string) => {
    try {
      setIsSyncing(true);
      const response = await fetch(`${CLOUD_API_BASE}/${targetId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Cloud push failed');
      setSyncError(null);
    } catch (err) {
      setSyncError('Push failed. Sync key may have expired.');
    } finally {
      setIsSyncing(false);
    }
  }, []);

  const fetchFromCloud = useCallback(async (targetId: string) => {
    try {
      const response = await fetch(`${CLOUD_API_BASE}/${targetId}`);
      if (!response.ok) throw new Error('Cloud fetch failed');
      return await response.json() as DeliveryBooking[];
    } catch (err) {
      setSyncError('Fetch failed. Check connection.');
      return null;
    }
  }, []);

  const createCloudStore = async (initialData: DeliveryBooking[]) => {
    try {
      setIsSyncing(true);
      const response = await fetch(CLOUD_API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(initialData),
      });
      const location = response.headers.get('Location');
      if (location) {
        const id = location.split('/').pop() || '';
        setSyncId(id);
        localStorage.setItem('swiftRun_syncId', id);
        return id;
      }
    } catch (err) {
      setSyncError('Failed to start sync.');
    } finally {
      setIsSyncing(false);
    }
    return null;
  };

  useEffect(() => {
    const loadData = async () => {
      let initialBookings: DeliveryBooking[] = [];
      const saved = localStorage.getItem('swiftRun_bookings');
      if (saved) initialBookings = JSON.parse(saved);

      if (syncId) {
        const cloudData = await fetchFromCloud(syncId);
        if (cloudData) {
          if (cloudData.length === 0 && initialBookings.length > 0) {
            pushToCloud(initialBookings, syncId);
          } else {
            initialBookings = cloudData;
          }
        }
      } else {
        await createCloudStore(initialBookings);
      }

      setBookings(initialBookings);
      setIsLoading(false);
    };
    loadData();
  }, []);

  useEffect(() => {
    if (!syncId || isLoading) return;
    const interval = setInterval(async () => {
      const cloudData = await fetchFromCloud(syncId);
      if (cloudData && JSON.stringify(cloudData) !== JSON.stringify(bookings)) {
        setBookings(cloudData);
      }
    }, SYNC_POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [syncId, bookings, isLoading, fetchFromCloud]);

  const handleDataChange = (newBookings: DeliveryBooking[]) => {
    setBookings(newBookings);
    localStorage.setItem('swiftRun_bookings', JSON.stringify(newBookings));
    
    const deliveredItems = newBookings.filter(b => b.status === 'Delivered');
    if (deliveredItems.length > 0) {
      setLocalArchive(prev => {
        const archiveMap = new Map(prev.map(item => [item.id, item]));
        deliveredItems.forEach(item => archiveMap.set(item.id, item));
        const updatedArchive = Array.from(archiveMap.values());
        localStorage.setItem('swiftRun_permanent_archive', JSON.stringify(updatedArchive));
        return updatedArchive;
      });
    }

    if (syncId) pushToCloud(newBookings, syncId);
  };

  const addBooking = (newBooking: Omit<DeliveryBooking, 'id' | 'status'>) => {
    const booking: DeliveryBooking = {
      ...newBooking,
      id: Math.random().toString(36).substr(2, 9),
      status: 'Pending',
      sequence: bookings.length + 1,
      bookedAt: new Date().toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
    };
    handleDataChange([...bookings, booking]);
  };

  const updateBooking = (id: string, updatedFields: Partial<DeliveryBooking>) => {
    handleDataChange(bookings.map(b => b.id === id ? { ...b, ...updatedFields } : b));
  };

  const moveBooking = (draggedId: string, targetId: string) => {
    const copy = [...bookings].sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
    const draggedIdx = copy.findIndex(b => b.id === draggedId);
    const targetIdx = copy.findIndex(b => b.id === targetId);
    if (draggedIdx === -1 || targetIdx === -1) return;
    const [removed] = copy.splice(draggedIdx, 1);
    copy.splice(targetIdx, 0, removed);
    const final = copy.map((b, i) => ({ ...b, sequence: i + 1 }));
    handleDataChange(final);
  };

  const toggleStatus = (id: string) => {
    handleDataChange(bookings.map(b => {
      if (b.id === id) {
        let nextStatus: BookingStatus;
        let deliveredAt = b.deliveredAt;
        if (b.status === 'Pending') nextStatus = 'On Board';
        else if (b.status === 'On Board') {
          nextStatus = 'Delivered';
          deliveredAt = new Date().toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        } else {
          nextStatus = 'Pending';
          deliveredAt = undefined;
        }
        return { ...b, status: nextStatus, deliveredAt };
      }
      return b;
    }));
  };

  const printLabels = (booking: DeliveryBooking) => {
    const printContainer = document.getElementById('print-container');
    if (!printContainer) return;
    const matchedPickup = PICKUP_PRESETS.find(p => p.address === booking.pickupLocation);
    const pickupDisplay = matchedPickup ? matchedPickup.id : "Custom";
    let labelsHtml = '';
    for (let i = 1; i <= booking.cartons; i++) {
      labelsHtml += `
        <div class="label-page">
          <div class="label-border">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid black; padding-bottom: 8px; margin-bottom: 12px;">
              <div style="font-size: 26px; font-weight: 900; letter-spacing: -1.5px; color: #2563eb; line-height: 1;">TOTAL TOOLS</div>
              <div style="font-size: 32px; font-weight: 900; background: black; color: white; padding: 2px 8px; border-radius: 4px;">${pickupDisplay}</div>
            </div>
            
            <div style="margin-bottom: 12px;">
              <div style="font-size: 10px; text-transform: uppercase; font-weight: 900; color: #64748b;">SHIP TO:</div>
              <div style="font-size: 22px; font-weight: 900; margin-top: 2px; line-height: 1.1;">${booking.customerName}</div>
              <div style="font-size: 15px; font-weight: 700; margin-top: 5px; line-height: 1.2;">${booking.deliveryAddress}</div>
              <div style="font-size: 13px; margin-top: 6px; font-weight: 600;">Contact: ${booking.contact}</div>
            </div>

            <div style="flex-grow: 1; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; border-top: 1px dashed #cbd5e1; border-bottom: 1px dashed #cbd5e1; padding: 10px 0; margin-bottom: 12px;">
              <div>
                <div style="font-size: 9px; font-weight: bold; text-transform: uppercase; color: #64748b;">Sales Order</div>
                <div style="font-size: 16px; font-weight: 900;">${booking.salesOrder}</div>
              </div>
              <div>
                <div style="font-size: 9px; font-weight: bold; text-transform: uppercase; color: #64748b;">Purchase Order</div>
                <div style="font-size: 16px; font-weight: 900;">${booking.purchaseOrder || '---'}</div>
              </div>
            </div>

            <div style="background: #f1f5f9; padding: 10px; border-radius: 6px; flex-grow: 0;">
              <div style="font-size: 9px; font-weight: bold; text-transform: uppercase; color: #475569; margin-bottom: 2px;">Instructions:</div>
              <div style="font-size: 12px; font-weight: 700; line-height: 1.3;">${booking.deliveryInstructions || 'NO SPECIAL INSTRUCTIONS'}</div>
            </div>

            <div style="margin-top: auto; border-top: 3px solid black; padding-top: 10px; display: flex; justify-content: space-between; align-items: flex-end;">
               <div style="font-size: 10px; font-weight: bold;">DATE: ${new Date().toLocaleDateString()}</div>
               <div style="text-align: right;">
                 <div style="font-size: 11px; font-weight: bold; text-transform: uppercase; color: #64748b;">Carton</div>
                 <div style="font-size: 48px; font-weight: 900; line-height: 0.8;">${i}<span style="font-size: 20px; font-weight: 400; color: #94a3b8;">/</span>${booking.cartons}</div>
               </div>
            </div>
          </div>
        </div>
      `;
    }
    printContainer.innerHTML = labelsHtml;
    window.print();
  };

  const stats: RunSheetStats = {
    totalDeliveries: bookings.length,
    deliveredCount: bookings.filter(b => b.status === 'Delivered').length,
    totalCartons: bookings.reduce((acc, b) => acc + b.cartons, 0),
  };

  const activeBookings = useMemo(() => bookings.filter(b => b.status !== 'Delivered').sort((a,b) => (a.sequence||0)-(b.sequence||0)), [bookings]);
  const historyBookings = useMemo(() => bookings.filter(b => b.status === 'Delivered'), [bookings]);

  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]"><Loader2 className="w-12 h-12 text-blue-600 animate-spin" /></div>;

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      {/* FIXED LEFT SIDEBAR */}
      <aside className="w-80 h-screen sticky top-0 bg-white border-r border-slate-200 overflow-hidden flex flex-col shadow-2xl z-30">
        <div className="p-8 border-b border-slate-100 bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center gap-4 text-white">
          <div className="p-2.5 bg-white/20 backdrop-blur-md rounded-2xl shadow-inner">
            <Truck className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight leading-tight">SwiftRun</h1>
            <p className="text-[10px] font-bold text-blue-100 uppercase tracking-widest">Logistic Manager</p>
          </div>
        </div>

        {/* Scrollable Middle Section */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8 bg-slate-50/30">
          {/* Saved Contacts Section */}
          <div className="space-y-4">
            <button onClick={()=>setIsContactsExpanded(!isContactsExpanded)} className="w-full flex items-center justify-between group p-3 rounded-2xl bg-white shadow-sm border border-slate-100 hover:border-blue-200 transition-all">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 rounded-xl text-blue-600">
                  <Users className="w-4 h-4" />
                </div>
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Saved Contacts</h3>
              </div>
              <ChevronDown className={`w-4 h-4 text-slate-300 transition-transform ${isContactsExpanded ? 'rotate-180' : ''}`} />
            </button>
            {isContactsExpanded && (
              <div className="space-y-2 px-1">
                {savedCustomers.length === 0 ? (
                  <p className="text-[10px] text-slate-400 italic text-center py-2">No saved contacts yet.</p>
                ) : (
                  savedCustomers.map(c => (
                    <div key={c.id} className="p-3 bg-white rounded-xl border border-slate-100 group relative hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start">
                        <p className="text-xs font-bold text-black truncate pr-4">{c.name}</p>
                        <button onClick={()=>{ setSavedCustomers(prev=>prev.filter(x=>x.id!==c.id)); localStorage.setItem('swiftRun_customers', JSON.stringify(savedCustomers.filter(x=>x.id!==c.id))); }} className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-slate-300 hover:text-rose-500"><Trash2 className="w-3 h-3" /></button>
                      </div>
                      <p className="text-[9px] text-slate-400 truncate">{c.address}</p>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Records Section */}
          <div className="space-y-4">
            <button onClick={()=>setIsArchiveExpanded(!isArchiveExpanded)} className="w-full flex items-center justify-between group p-3 rounded-2xl bg-white shadow-sm border border-slate-100 hover:border-indigo-200 transition-all">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
                  <Database className="w-4 h-4" />
                </div>
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Vault Archive</h3>
              </div>
              <ChevronDown className={`w-4 h-4 text-slate-300 transition-transform ${isArchiveExpanded ? 'rotate-180' : ''}`} />
            </button>
            {isArchiveExpanded && (
              <div className="space-y-2 px-1">
                <p className="text-[10px] text-slate-400 italic mb-2 text-center">{localArchive.length} local records found</p>
                {/* FIX: Properly append worksheet to workbook as book_append_sheet returns void and modifies in-place */}
                <button 
                  onClick={() => {
                    const wb = XLSX.utils.book_new();
                    const ws = XLSX.utils.json_to_sheet(localArchive);
                    XLSX.utils.book_append_sheet(wb, ws, "Archive");
                    XLSX.writeFile(wb, "RunSheet_Archive.xlsx");
                  }} 
                  className="w-full py-3 bg-gradient-to-r from-indigo-500 to-blue-600 text-white text-[10px] font-black rounded-xl shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 active:scale-95 transition-all"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" /> Export All History
                </button>
              </div>
            )}
          </div>

          {/* Help / Error Explanation Section */}
          <div className="pt-2">
            <div className="p-5 bg-blue-50 rounded-[2rem] border border-blue-100 shadow-sm">
               <div className="flex items-center gap-2 mb-3 text-blue-700">
                 <HelpCircle className="w-4 h-4" />
                 <span className="text-[10px] font-black uppercase tracking-widest">System Status</span>
               </div>
               <p className="text-[10px] text-blue-800 leading-relaxed font-bold">
                 If sync glows <span className="underline text-rose-600">red</span>, your shared key has expired. Cloud data clears after 30 days of inactivity. Use the <span className="text-indigo-600">Vault</span> for permanent local backups.
               </p>
            </div>
          </div>
        </div>

        {/* BOTTOM SECTION: CLOUD SYNC KEY */}
        <div className="p-8 bg-white border-t border-slate-100 space-y-6">
          <div className="flex items-center gap-2">
            <Share2 className={`w-4 h-4 ${syncId ? 'text-blue-600' : 'text-slate-300'}`} />
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Live Room Key</h3>
          </div>
          
          {syncId ? (
            <div className="space-y-4">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 shadow-inner">
                <p className="text-[9px] font-bold text-slate-400 uppercase mb-2">Room Identifier</p>
                <div className="flex items-center justify-between">
                  <code className="text-xs font-black text-black tracking-widest truncate mr-2">{syncId}</code>
                  <button onClick={() => { navigator.clipboard.writeText(syncId); setCopyFeedback(true); setTimeout(()=>setCopyFeedback(false),2000); }} className="p-2 bg-white border border-slate-200 rounded-lg text-slate-400 hover:text-blue-600 transition-all shadow-sm">
                    {copyFeedback ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <button onClick={()=> { if(confirm('Disconnect Shared Room? Local data remains.')) { setSyncId(null); localStorage.removeItem('swiftRun_syncId'); }}} className="w-full text-center text-[10px] font-bold text-slate-400 hover:text-rose-600 transition-colors">Terminate Live Session</button>
            </div>
          ) : (
            <form onSubmit={(e)=>{ 
              e.preventDefault(); 
              if(joinKeyInput) {
                fetchFromCloud(joinKeyInput).then(d=>{ 
                  if(d){
                    setSyncId(joinKeyInput); 
                    setBookings(d); 
                    localStorage.setItem('swiftRun_syncId', joinKeyInput); 
                    setJoinKeyInput('');
                    setSyncError(null);
                  } else {
                    alert('Invalid Key or Connection Error');
                  }
                });
              }
            }} className="space-y-3">
              <div className="relative">
                <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  className="w-full bg-slate-50 pl-11 pr-4 py-3.5 rounded-2xl border border-slate-200 text-xs font-bold text-black outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-inner" 
                  placeholder="Enter Key..." 
                  value={joinKeyInput} 
                  onChange={(e)=>setJoinKeyInput(e.target.value)} 
                />
              </div>
              <button type="submit" className="w-full bg-blue-600 text-white text-xs font-black py-3.5 rounded-2xl hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-100">
                <LogIn className="w-4 h-4" /> Sync Shared Run
              </button>
            </form>
          )}

          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${syncError ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]' : isSyncing ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]'}`} />
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                {syncError ? 'System Offline' : isSyncing ? 'Syncing...' : 'Connected'}
              </span>
            </div>
            {syncError && <AlertCircle className="w-3 h-3 text-rose-500" />}
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto p-8 md:p-12 space-y-12">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
             <div>
               <h2 className="text-4xl font-black text-slate-900 tracking-tight leading-none mb-3">Daily Run Dashboard</h2>
               <div className="flex items-center gap-3">
                 <div className="px-4 py-1.5 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider shadow-lg shadow-blue-100">Active Tasking</div>
                 <p className="text-slate-400 font-bold text-sm">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
               </div>
             </div>
             <div className="flex items-center gap-3">
               <button onClick={()=>setIsMapModalOpen(true)} className="px-10 py-4 bg-white text-blue-600 border-2 border-blue-600 rounded-[2rem] font-black flex items-center gap-2 hover:bg-blue-50 transition-all active:scale-95 shadow-sm"><MapIcon className="w-5 h-5" /> Interactive View</button>
             </div>
          </div>

          {syncError && (
            <div className="p-5 bg-rose-50 border-2 border-rose-100 rounded-[2rem] flex items-center gap-4 text-rose-700 animate-in slide-in-from-top-4 duration-300">
              <div className="p-2 bg-white rounded-full">
                <AlertCircle className="w-6 h-6 shrink-0" />
              </div>
              <p className="text-xs font-bold leading-tight">{syncError}</p>
            </div>
          )}

          <StatsCard stats={stats} />
          
          <BookingForm 
            onAdd={addBooking} 
            onUpdate={updateBooking} 
            editingBooking={editingBooking} 
            onCancelEdit={()=>setEditingBooking(null)} 
            savedCustomers={savedCustomers} 
            onSaveCustomer={(c)=>{ 
              const upd = [...savedCustomers, {...c, id: Math.random().toString(36).substr(2,9)}]; 
              setSavedCustomers(upd); 
              localStorage.setItem('swiftRun_customers', JSON.stringify(upd)); 
            }} 
          />

          <div className="space-y-20 pt-10">
            <div className="space-y-8">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-4">
                  Current Schedule
                  <div className="w-12 h-1 bg-blue-600 rounded-full"></div>
                  <span className="text-slate-400 text-lg font-bold">{activeBookings.length} stops pending</span>
                </h3>
              </div>
              <RunSheetTable 
                bookings={activeBookings} 
                onToggleStatus={toggleStatus} 
                onDelete={(id)=>handleDataChange(bookings.filter(b=>b.id!==id))} 
                onEdit={setEditingBooking} 
                onPreviewMap={(b)=>{ setMapTargetBookings([b]); setIsMapModalOpen(true); }} 
                onPrintLabels={printLabels} 
                onReorder={moveBooking} 
              />
            </div>

            <div className="space-y-8 pb-20">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-black text-slate-300 tracking-tight">Delivery Archive</h3>
                <div className="flex items-center gap-3 px-5 py-2 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100 shadow-sm">
                  <ShieldCheck className="w-4 h-4" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Permanent Storage Active</span>
                </div>
              </div>
              <RunSheetTable 
                bookings={historyBookings} 
                onToggleStatus={toggleStatus} 
                onDelete={(id)=>handleDataChange(bookings.filter(b=>b.id!==id))} 
                onEdit={setEditingBooking} 
                onPreviewMap={(b)=>{ setMapTargetBookings([b]); setIsMapModalOpen(true); }} 
                onPrintLabels={printLabels} 
              />
            </div>
          </div>
        </div>
      </main>
      
      <MapModal isOpen={isMapModalOpen} onClose={()=>setIsMapModalOpen(false)} bookings={mapTargetBookings} title={mapTitle} highlightedId={highlightedBookingId} onHighlight={setHighlightedBookingId} />
    </div>
  );
};

export default App;