
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Header from './components/Header';
import BookingForm from './components/BookingForm';
import RunSheetTable from './components/RunSheetTable';
import StatsCard from './components/StatsCard';
import MapModal from './components/MapModal';
import { DeliveryBooking, RunSheetStats, BookingStatus, Customer, PICKUP_PRESETS } from './types';
import { History as HistoryIcon, Users, Trash2, Edit3, Save, X, MapPin, Map as MapIcon, ChevronDown, ChevronUp, FileSpreadsheet, CheckCircle2, Filter, FilterX, Loader2, Mail, Share2, Cloud, CloudOff, RefreshCw, Copy, Check, Archive, Database, ShieldCheck } from 'lucide-react';
import * as XLSX from 'xlsx';

// Cloud Sync Constants
const CLOUD_API_BASE = 'https://jsonblob.com/api/jsonBlob';
const SYNC_POLL_INTERVAL = 10000; // 10 seconds

const App: React.FC = () => {
  const [bookings, setBookings] = useState<DeliveryBooking[]>([]);
  const [savedCustomers, setSavedCustomers] = useState<Customer[]>(() => {
    const saved = localStorage.getItem('swiftRun_customers');
    return saved ? JSON.parse(saved) : [];
  });

  // Local-only permanent archive for record keeping
  const [localArchive, setLocalArchive] = useState<DeliveryBooking[]>(() => {
    const saved = localStorage.getItem('swiftRun_permanent_archive');
    return saved ? JSON.parse(saved) : [];
  });
  
  // Cloud Sync State
  const [syncId, setSyncId] = useState<string | null>(localStorage.getItem('swiftRun_syncId'));
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [joinKeyInput, setJoinKeyInput] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [editingBooking, setEditingBooking] = useState<DeliveryBooking | null>(null);
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [customerEditForm, setCustomerEditForm] = useState<Omit<Customer, 'id'>>({ name: '', address: '', contact: '' });
  const [isContactsExpanded, setIsContactsExpanded] = useState(false);
  const [isArchiveExpanded, setIsArchiveExpanded] = useState(false);
  
  const [pickupFilter, setPickupFilter] = useState<'All' | 'SG' | 'WB' | 'RF' | 'Other'>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | BookingStatus>('All');
  
  const [highlightedBookingId, setHighlightedBookingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);
  const [mapTargetBookings, setMapTargetBookings] = useState<DeliveryBooking[]>([]);
  const [mapTitle, setMapTitle] = useState("Delivery Route Map");

  // --- CLOUD SYNC LOGIC ---

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
      console.error(err);
      setSyncError('Push failed');
    } finally {
      setIsSyncing(false);
    }
  }, []);

  const fetchFromCloud = useCallback(async (targetId: string) => {
    try {
      const response = await fetch(`${CLOUD_API_BASE}/${targetId}`);
      if (!response.ok) throw new Error('Cloud fetch failed');
      const data = await response.json();
      return data as DeliveryBooking[];
    } catch (err) {
      console.error(err);
      setSyncError('Sync connection lost');
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
      setSyncError('Failed to initialize cloud storage');
    } finally {
      setIsSyncing(false);
    }
    return null;
  };

  // Initial Data Load
  useEffect(() => {
    const loadData = async () => {
      let initialBookings: DeliveryBooking[] = [];
      
      const saved = localStorage.getItem('swiftRun_bookings');
      if (saved) {
        try {
          initialBookings = JSON.parse(saved);
        } catch (e) { console.error(e); }
      }

      if (syncId) {
        const cloudData = await fetchFromCloud(syncId);
        if (cloudData) {
          // Safety: If cloud is empty but local has data, prevent accidental wipe
          if (cloudData.length === 0 && initialBookings.length > 0) {
            console.warn("Cloud blob is empty. Keeping local data as source of truth.");
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

  // Polling for updates
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

  // Handle local changes, push, and ARCHIVE
  const handleDataChange = (newBookings: DeliveryBooking[]) => {
    setBookings(newBookings);
    localStorage.setItem('swiftRun_bookings', JSON.stringify(newBookings));
    
    // Safety Archiving: Any booking that is "Delivered" is cloned to a local-only key
    // This ensures long-term record keeping even if the cloud key expires.
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

    if (syncId) {
      pushToCloud(newBookings, syncId);
    }
  };

  const joinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinKeyInput.trim()) return;
    
    setIsLoading(true);
    const cloudData = await fetchFromCloud(joinKeyInput);
    if (cloudData) {
      setSyncId(joinKeyInput);
      localStorage.setItem('swiftRun_syncId', joinKeyInput);
      setBookings(cloudData);
      setJoinKeyInput('');
      setSyncError(null);
    } else {
      alert("Invalid Sync Key or Network Error.");
    }
    setIsLoading(false);
  };

  const disconnectSync = () => {
    if (confirm("Disconnect cloud sync? Your local data will be preserved, but you will stop receiving updates from others.")) {
      setSyncId(null);
      localStorage.removeItem('swiftRun_syncId');
    }
  };

  const copyKey = () => {
    if (!syncId) return;
    navigator.clipboard.writeText(syncId);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  const clearLocalArchive = () => {
    if (confirm("Are you sure you want to permanently delete your device's local record history? This cannot be undone.")) {
      setLocalArchive([]);
      localStorage.removeItem('swiftRun_permanent_archive');
    }
  };

  // --- STATS & ACTIONS ---

  const stats: RunSheetStats = {
    totalDeliveries: bookings.length,
    deliveredCount: bookings.filter(b => b.status === 'Delivered').length,
    totalCartons: bookings.reduce((acc, b) => acc + b.cartons, 0),
  };

  const addBooking = (newBooking: Omit<DeliveryBooking, 'id' | 'status'>) => {
    const maxSeq = bookings.length > 0 ? Math.max(...bookings.map(b => b.sequence || 0)) : 0;
    const booking: DeliveryBooking = {
      ...newBooking,
      id: Math.random().toString(36).substr(2, 9),
      status: 'Pending',
      sequence: maxSeq + 1,
      bookedAt: new Date().toLocaleString([], { 
        month: 'short', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit' 
      }),
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
    const next = bookings.map(b => {
      if (b.id === id) {
        let nextStatus: BookingStatus;
        let deliveredAt = b.deliveredAt;
        if (b.status === 'Pending') {
          nextStatus = 'On Board';
        } else if (b.status === 'On Board') {
          nextStatus = 'Delivered';
          deliveredAt = new Date().toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        } else {
          nextStatus = 'Pending';
          deliveredAt = undefined;
        }
        return { ...b, status: nextStatus, deliveredAt };
      }
      return b;
    });
    handleDataChange(next);
  };

  const bulkMarkDelivered = () => {
    if (selectedIds.length === 0) return;
    const now = new Date().toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const next: DeliveryBooking[] = bookings.map(b => {
      if (selectedIds.includes(b.id)) {
        return { ...b, status: 'Delivered' as BookingStatus, deliveredAt: now };
      }
      return b;
    });
    handleDataChange(next);
    setSelectedIds([]);
  };

  const deleteBooking = (id: string) => {
    handleDataChange(bookings.filter(b => b.id !== id));
    if (editingBooking?.id === id) setEditingBooking(null);
    setSelectedIds(prev => prev.filter(selectedId => selectedId !== id));
  };

  const saveCustomer = (customerData: Omit<Customer, 'id'>) => {
    if (!editingCustomerId && savedCustomers.find(c => c.name.toLowerCase() === customerData.name.toLowerCase())) return;
    const newCustomer: Customer = { ...customerData, id: Math.random().toString(36).substr(2, 9) };
    const updated = [...savedCustomers, newCustomer];
    setSavedCustomers(updated);
    localStorage.setItem('swiftRun_customers', JSON.stringify(updated));
  };

  const startEditCustomer = (customer: Customer) => {
    setEditingCustomerId(customer.id);
    setCustomerEditForm({ name: customer.name, address: customer.address, contact: customer.contact });
  };

  const handleUpdateCustomer = () => {
    if (!editingCustomerId) return;
    const updated = savedCustomers.map(c => c.id === editingCustomerId ? { ...c, ...customerEditForm } : c);
    setSavedCustomers(updated);
    localStorage.setItem('swiftRun_customers', JSON.stringify(updated));
    setEditingCustomerId(null);
  };

  const deleteCustomer = (id: string) => {
    if (confirm('Delete this contact?')) {
      const updated = savedCustomers.filter(c => c.id !== id);
      setSavedCustomers(updated);
      localStorage.setItem('swiftRun_customers', JSON.stringify(updated));
    }
  };

  const openSingleMapPreview = (booking: DeliveryBooking) => {
    setMapTargetBookings([booking]);
    setMapTitle(`Map: ${booking.customerName}`);
    setHighlightedBookingId(booking.id);
    setIsMapModalOpen(true);
  };

  const openGlobalMapPreview = () => {
    const active = bookings.filter(b => b.status !== 'Delivered');
    if (active.length === 0) return;
    setMapTargetBookings(active);
    setMapTitle("Daily Run Map View");
    setIsMapModalOpen(true);
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
              <div style="font-size: 28px; font-weight: 900; letter-spacing: -1px; color: #e11d48;">TOTAL TOOLS</div>
              <div style="font-size: 32px; font-weight: 900;">${pickupDisplay}</div>
            </div>
            
            <div style="margin-bottom: 12px;">
              <div style="font-size: 10px; text-transform: uppercase; font-weight: 900; letter-spacing: 1px; color: #64748b;">Ship To:</div>
              <div style="font-size: 24px; font-weight: 900; margin-top: 2px;">${booking.customerName}</div>
              <div style="font-size: 16px; font-weight: 700; margin-top: 5px; line-height: 1.2;">${booking.deliveryAddress}</div>
              <div style="font-size: 14px; margin-top: 8px; font-weight: 600;">Contact: ${booking.contact}</div>
            </div>

            <div style="flex-grow: 1; display: grid; grid-template-columns: 1fr 1fr; gap: 15px; border-top: 1px dashed #cbd5e1; padding-top: 12px; margin-bottom: 12px;">
              <div>
                <div style="font-size: 10px; font-weight: bold; text-transform: uppercase; color: #64748b;">Sales Order</div>
                <div style="font-size: 18px; font-weight: 900;">${booking.salesOrder}</div>
              </div>
              <div>
                <div style="font-size: 10px; font-weight: bold; text-transform: uppercase; color: #64748b;">Purchase Order</div>
                <div style="font-size: 18px; font-weight: 900;">${booking.purchaseOrder || '---'}</div>
              </div>
            </div>

            <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 10px; border-radius: 8px; margin-bottom: 15px;">
              <div style="font-size: 10px; font-weight: bold; text-transform: uppercase; color: #64748b; margin-bottom: 4px;">Delivery Instructions:</div>
              <div style="font-size: 13px; font-weight: 600; line-height: 1.3;">${booking.deliveryInstructions || 'No specific instructions provided.'}</div>
            </div>

            <div style="margin-top: auto; border-top: 3px solid black; padding-top: 10px; display: flex; justify-content: space-between; align-items: flex-end;">
               <div style="font-size: 11px; font-weight: bold;">BOOKED: ${booking.bookedAt || 'N/A'}</div>
               <div style="text-align: right;">
                 <div style="font-size: 12px; font-weight: bold; text-transform: uppercase; color: #64748b;">Carton</div>
                 <div style="font-size: 42px; font-weight: 900; line-height: 1;">${i} of ${booking.cartons}</div>
               </div>
            </div>
          </div>
        </div>
      `;
    }
    printContainer.innerHTML = labelsHtml;
    window.print();
  };

  const getBookingCategory = (booking: DeliveryBooking): 'SG' | 'WB' | 'RF' | 'Other' => {
    const matched = PICKUP_PRESETS.find(p => p.address === booking.pickupLocation);
    return matched ? matched.id as 'SG' | 'WB' | 'RF' : 'Other';
  };

  const applyFilters = (bookingList: DeliveryBooking[]) => {
    return bookingList.filter(b => {
      const pickupMatch = pickupFilter === 'All' || getBookingCategory(b) === pickupFilter;
      const statusMatch = statusFilter === 'All' || b.status === statusFilter;
      return pickupMatch && statusMatch;
    }).sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
  };

  const activeBookings = useMemo(() => applyFilters(bookings.filter(b => b.status !== 'Delivered')), [bookings, pickupFilter, statusFilter]);
  const historyBookings = useMemo(() => applyFilters(bookings.filter(b => b.status === 'Delivered')), [bookings, pickupFilter, statusFilter]);

  const exportToExcel = (dataToExport: DeliveryBooking[]) => {
    if (dataToExport.length === 0) {
      alert("No data available to export.");
      return;
    }
    const worksheet = XLSX.utils.json_to_sheet(dataToExport.map(b => ({
      'Seq': b.sequence,
      'Status': b.status,
      'Customer Name': b.customerName,
      'Sales Order': b.salesOrder,
      'Purchase Order': b.purchaseOrder,
      'Instructions': b.deliveryInstructions,
      'Pickup Location': b.pickupLocation,
      'Delivery Address': b.deliveryAddress,
      'Contact Info': b.contact,
      'Cartons': b.cartons,
      'Booked At': b.bookedAt || 'N/A',
      'Delivered At': b.deliveredAt || 'N/A'
    })));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Delivery Record");
    XLSX.writeFile(workbook, `SwiftRun_Record_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleEmailRun = () => {
    const dataToSend = activeBookings.length > 0 ? activeBookings : historyBookings;
    if (dataToSend.length === 0) return alert("No deliveries found to email.");
    const dateStr = new Date().toLocaleDateString();
    const subject = `Total Tools Run Sheet - ${dateStr}`;
    let body = `TOTAL TOOLS - DAILY DELIVERY RUN SHEET: ${dateStr}\n========================================\n\n`;
    dataToSend.forEach((b, idx) => {
      body += `[${b.sequence || idx + 1}] ${b.customerName.toUpperCase()}\nStatus: ${b.status}\nAddress: ${b.deliveryAddress}\nContact: ${b.contact}\nCartons: ${b.cartons}\nSO: ${b.salesOrder} / PO: ${b.purchaseOrder || 'N/A'}\nInstructions: ${b.deliveryInstructions || 'N/A'}\n----------------------------------------\n`;
    });
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const toggleSelection = (id: string) => setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  const toggleSelectAll = (ids: string[]) => setSelectedIds(selectedIds.length === ids.length ? [] : ids);
  const clearFilters = () => { setPickupFilter('All'); setStatusFilter('All'); };
  const isFilterActive = pickupFilter !== 'All' || statusFilter !== 'All';

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="flex flex-col items-center gap-6 animate-in fade-in duration-500">
          <div className="p-5 bg-rose-50 rounded-[2.5rem] shadow-xl">
             <Loader2 className="w-12 h-12 text-rose-600 animate-spin" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-black text-slate-800 tracking-tight mb-2">SwiftRun</h1>
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest animate-pulse">Initializing Dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20 animate-in fade-in duration-500">
      <Header syncStatus={syncError ? 'error' : isSyncing ? 'syncing' : 'synced'} />
      
      <main className="max-w-7xl mx-auto px-4 md:px-6">
        <StatsCard stats={stats} />
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-12">
            <BookingForm 
              onAdd={addBooking} onUpdate={updateBooking} editingBooking={editingBooking}
              onCancelEdit={() => setEditingBooking(null)} savedCustomers={savedCustomers} onSaveCustomer={saveCustomer}
            />

            <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex flex-col md:flex-row items-center gap-6 w-full md:w-auto">
                <div className="flex items-center gap-2 text-slate-400"><Filter className="w-4 h-4" /><span className="text-xs font-bold uppercase tracking-widest">Filters</span></div>
                <div className="flex flex-col gap-1 w-full md:w-auto">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-tighter ml-1">Pickup Location</label>
                  <div className="flex items-center bg-slate-100 p-1 rounded-xl gap-1">
                    {(['All', 'SG', 'WB', 'RF', 'Other'] as const).map((tab) => (
                      <button key={tab} onClick={() => setPickupFilter(tab)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${pickupFilter === tab ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{tab}</button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-1 w-full md:w-auto">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-tighter ml-1">Delivery Status</label>
                  <div className="flex items-center bg-slate-100 p-1 rounded-xl gap-1">
                    {(['All', 'Pending', 'On Board', 'Delivered'] as const).map((status) => (
                      <button key={status} onClick={() => setStatusFilter(status)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${statusFilter === status ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{status}</button>
                    ))}
                  </div>
                </div>
              </div>
              {isFilterActive && (
                <button onClick={clearFilters} className="flex items-center gap-2 px-4 py-2 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-bold transition-all"><FilterX className="w-4 h-4" />Reset Filters</button>
              )}
            </div>
            
            <div className="flex flex-col gap-4 relative">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">Daily Run Sheet</h2>
                <div className="flex items-center gap-3">
                  <button onClick={openGlobalMapPreview} disabled={activeBookings.length === 0} className="flex items-center gap-1.5 text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-4 py-2 rounded-xl transition-all disabled:opacity-50"><MapIcon className="w-4 h-4" />View Run on Map</button>
                  <button onClick={() => confirm('Clear all data?') && handleDataChange([])} className="text-xs text-slate-400 hover:text-rose-500 font-medium">Clear All</button>
                </div>
              </div>
              
              {selectedIds.length > 0 && (
                <div className="sticky top-4 z-20 w-full flex justify-center animate-in slide-in-from-top-4 duration-300">
                  <div className="bg-slate-800 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-6">
                    <span className="text-sm font-bold">{selectedIds.length} selected</span>
                    <button onClick={bulkMarkDelivered} className="flex items-center gap-2 text-emerald-400 hover:text-emerald-300 text-sm font-black uppercase"><CheckCircle2 className="w-4 h-4" />Mark Delivered</button>
                    <button onClick={() => setSelectedIds([])} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
                  </div>
                </div>
              )}

              <RunSheetTable bookings={activeBookings} onToggleStatus={toggleStatus} onDelete={deleteBooking} onEdit={setEditingBooking} onPreviewMap={openSingleMapPreview} onPrintLabels={printLabels} onReorder={moveBooking} highlightedId={highlightedBookingId} selectedIds={selectedIds} onToggleSelect={toggleSelection} onToggleSelectAll={toggleSelectAll} emptyMessage={isFilterActive ? "No matching deliveries." : "No active deliveries."} />
            </div>

            {(statusFilter === 'All' || statusFilter === 'Delivered') && (
              <div className="flex flex-col gap-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2"><HistoryIcon className="w-6 h-6 text-slate-400" /><h2 className="text-2xl font-bold text-slate-800">Delivery History</h2></div>
                  <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100"><ShieldCheck className="w-3.5 h-3.5" /><span className="text-[10px] font-black uppercase tracking-widest">Locally Backed Up</span></div>
                </div>
                <RunSheetTable bookings={historyBookings} onToggleStatus={toggleStatus} onDelete={deleteBooking} onEdit={setEditingBooking} onPreviewMap={openSingleMapPreview} onPrintLabels={printLabels} highlightedId={highlightedBookingId} emptyMessage="No history for today." />
              </div>
            )}
          </div>

          <div className="space-y-8">
            {/* Cloud Sync Card */}
            <div className="bg-white rounded-3xl p-6 shadow-xl border border-slate-100">
              <div className="flex items-center gap-2 mb-4"><div className={`p-2 rounded-xl ${syncId ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'}`}><Share2 className="w-5 h-5" /></div><h3 className="text-lg font-bold text-slate-800">Cloud Sync</h3></div>
              {syncId ? (
                <div className="space-y-4">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Active Run Sheet Key</p>
                    <div className="flex items-center justify-between"><code className="text-sm font-bold text-slate-700">{syncId}</code><button onClick={copyKey} className="p-2 text-slate-400 hover:text-emerald-600">{copyFeedback ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}</button></div>
                  </div>
                  <button onClick={disconnectSync} className="text-[11px] font-bold text-rose-600 hover:underline flex items-center gap-1"><X className="w-3 h-3" /> Disconnect shared run</button>
                </div>
              ) : (
                <form onSubmit={joinRoom} className="space-y-3"><input className="w-full bg-slate-50 px-4 py-3 rounded-xl border border-slate-200 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500" placeholder="Enter Sync Key" value={joinKeyInput} onChange={(e) => setJoinKeyInput(e.target.value)} /><button type="submit" className="w-full bg-slate-800 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2"><Share2 className="w-4 h-4" /> Join Shared Run</button></form>
              )}
            </div>

            {/* Permanent Local Archive Card */}
            <div className="bg-white rounded-3xl p-6 shadow-xl border border-slate-100 transition-all duration-300">
              <button onClick={() => setIsArchiveExpanded(!isArchiveExpanded)} className="w-full flex items-center justify-between">
                <div className="flex items-center gap-2"><div className={`p-2 rounded-xl ${isArchiveExpanded ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-500'}`}><Database className="w-5 h-5" /></div><h3 className="text-lg font-bold text-slate-800">Permanent Records</h3></div>
                {isArchiveExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
              </button>
              {isArchiveExpanded && (
                <div className="mt-6 space-y-4 animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-center justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                    <span>{localArchive.length} Total Records</span>
                    <button onClick={clearLocalArchive} className="text-rose-500 hover:underline">Wipe Device Memory</button>
                  </div>
                  <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                    {localArchive.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">No historical records saved on this device yet.</p>
                    ) : (
                      localArchive.slice(-10).reverse().map(b => (
                        <div key={b.id + '_arch'} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                          <div>
                            <p className="text-xs font-bold text-slate-700">{b.customerName}</p>
                            <p className="text-[9px] text-slate-400">{b.deliveredAt || 'Archived'}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <button onClick={() => openSingleMapPreview(b)} className="p-1 text-slate-400 hover:text-indigo-600"><MapPin className="w-3 h-3" /></button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <button 
                    onClick={() => exportToExcel(localArchive)}
                    className="w-full py-2.5 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-xl border border-indigo-100 hover:bg-indigo-100 flex items-center justify-center gap-2"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" /> Export All History (Excel)
                  </button>
                </div>
              )}
            </div>

            {/* Contacts Card */}
            <div className="bg-white rounded-3xl p-6 shadow-xl border border-slate-100 transition-all duration-300 overflow-hidden">
              <button onClick={() => setIsContactsExpanded(!isContactsExpanded)} className="w-full flex items-center justify-between"><div className="flex items-center gap-2"><div className={`p-2 rounded-xl transition-colors ${isContactsExpanded ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-500'}`}><Users className="w-5 h-5" /></div><h3 className="text-lg font-bold text-slate-800">Saved Contacts</h3></div>{isContactsExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}</button>
              {isContactsExpanded && (
                <div className="mt-6 space-y-3 animate-in fade-in slide-in-from-top-2">
                  <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-2 pb-2">
                    {savedCustomers.map(customer => (
                      <div key={customer.id} className={`p-4 rounded-2xl border transition-all ${editingCustomerId === customer.id ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-100 group relative'}`}>
                        {editingCustomerId === customer.id ? (
                          <div className="space-y-3"><input className="w-full bg-white px-3 py-1.5 rounded-lg border border-rose-200 text-sm font-bold" value={customerEditForm.name} onChange={(e) => setCustomerEditForm({...customerEditForm, name: e.target.value})} /><div className="flex gap-2"><button onClick={handleUpdateCustomer} className="flex-1 bg-rose-600 text-white text-[10px] font-bold py-2 rounded-lg">Save</button><button onClick={() => setEditingCustomerId(null)} className="px-3 py-2 text-slate-400"><X className="w-3 h-3" /></button></div></div>
                        ) : (
                          <div className="flex justify-between items-start"><p className="text-sm font-bold text-slate-700">{customer.name}</p><div className="flex items-center gap-1 opacity-0 group-hover:opacity-100"><button onClick={() => startEditCustomer(customer)} className="p-1 text-slate-400 hover:text-amber-500"><Edit3 className="w-3 h-3" /></button><button onClick={() => deleteCustomer(customer.id)} className="p-1 text-slate-400 hover:text-rose-500"><Trash2 className="w-3 h-3" /></button></div></div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white rounded-3xl p-6 shadow-xl border border-slate-100">
              <h3 className="text-lg font-bold text-slate-800 mb-4">Quick Actions</h3>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => exportToExcel(bookings)} className="flex flex-col items-center justify-center p-4 bg-slate-50 hover:bg-rose-50 rounded-2xl transition-all border border-slate-100 group"><FileSpreadsheet className="w-6 h-6 text-rose-600 mb-1 group-hover:scale-110" /><span className="text-xs font-bold text-slate-600">Export Today</span></button>
                <button onClick={handleEmailRun} className="flex flex-col items-center justify-center p-4 bg-slate-50 hover:bg-emerald-50 rounded-2xl transition-all border border-slate-100 group"><Mail className="w-6 h-6 text-emerald-600 mb-1 group-hover:scale-110" /><span className="text-xs font-bold text-slate-600">Email Run</span></button>
              </div>
            </div>
          </div>
        </div>
      </main>
      
      <MapModal isOpen={isMapModalOpen} onClose={() => setIsMapModalOpen(false)} bookings={mapTargetBookings} title={mapTitle} highlightedId={highlightedBookingId} onHighlight={setHighlightedBookingId} />
    </div>
  );
};

export default App;
