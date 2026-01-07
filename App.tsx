
import React, { useState, useEffect, useMemo } from 'react';
import Header from './components/Header';
import BookingForm from './components/BookingForm';
import RunSheetTable from './components/RunSheetTable';
import StatsCard from './components/StatsCard';
import MapModal from './components/MapModal';
import { DeliveryBooking, RunSheetStats, BookingStatus, Customer, PICKUP_PRESETS } from './types';
import { History as HistoryIcon, Users, Trash2, Edit3, Save, X, MapPin, Map as MapIcon, ChevronDown, ChevronUp, FileSpreadsheet, CheckCircle2, Filter, FilterX, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';

const App: React.FC = () => {
  const [bookings, setBookings] = useState<DeliveryBooking[]>([]);
  const [savedCustomers, setSavedCustomers] = useState<Customer[]>(() => {
    const saved = localStorage.getItem('swiftRun_customers');
    return saved ? JSON.parse(saved) : [];
  });
  const [isLoading, setIsLoading] = useState(true);
  const [editingBooking, setEditingBooking] = useState<DeliveryBooking | null>(null);
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [customerEditForm, setCustomerEditForm] = useState<Omit<Customer, 'id'>>({ name: '', address: '', contact: '' });
  const [isContactsExpanded, setIsContactsExpanded] = useState(false);
  
  // Filtering States
  const [pickupFilter, setPickupFilter] = useState<'All' | 'SG' | 'WB' | 'RF' | 'Other'>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | BookingStatus>('All');
  
  const [highlightedBookingId, setHighlightedBookingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // Map Modal State
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);
  const [mapTargetBookings, setMapTargetBookings] = useState<DeliveryBooking[]>([]);
  const [mapTitle, setMapTitle] = useState("Delivery Route Map");

  // Initial load from localStorage
  useEffect(() => {
    const savedBookings = localStorage.getItem('swiftRun_bookings');
    if (savedBookings) {
      try {
        const parsed = JSON.parse(savedBookings);
        // Ensure all have sequences
        const sanitized = parsed.map((b: any, i: number) => ({
          ...b,
          sequence: b.sequence ?? i + 1
        }));
        setBookings(sanitized);
      } catch (e) {
        console.error("Failed to parse bookings from storage", e);
      }
    }
    const timer = setTimeout(() => setIsLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

  // Sync to localStorage
  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem('swiftRun_bookings', JSON.stringify(bookings));
    }
  }, [bookings, isLoading]);

  useEffect(() => {
    localStorage.setItem('swiftRun_customers', JSON.stringify(savedCustomers));
  }, [savedCustomers]);

  useEffect(() => {
    if (!isMapModalOpen && highlightedBookingId) {
      const timer = setTimeout(() => setHighlightedBookingId(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [isMapModalOpen, highlightedBookingId]);

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
      sequence: newBooking.sequence || maxSeq + 1,
      bookedAt: new Date().toLocaleString([], { 
        month: 'short', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit' 
      }),
    };
    setBookings(prev => [...prev, booking]);
  };

  const updateBooking = (id: string, updatedFields: Partial<DeliveryBooking>) => {
    setBookings(prev => prev.map(b => b.id === id ? { ...b, ...updatedFields } : b));
  };

  const moveBooking = (draggedId: string, targetId: string) => {
    setBookings(prev => {
      const copy = [...prev].sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
      const draggedIdx = copy.findIndex(b => b.id === draggedId);
      const targetIdx = copy.findIndex(b => b.id === targetId);
      
      if (draggedIdx === -1 || targetIdx === -1) return prev;
      
      const [removed] = copy.splice(draggedIdx, 1);
      copy.splice(targetIdx, 0, removed);
      
      // Re-assign sequences based on new array order
      return copy.map((b, i) => ({ ...b, sequence: i + 1 }));
    });
  };

  const toggleStatus = (id: string) => {
    setBookings(prev => prev.map(b => {
      if (b.id === id) {
        let nextStatus: BookingStatus;
        let deliveredAt = b.deliveredAt;

        if (b.status === 'Pending') {
          nextStatus = 'On Board';
        } else if (b.status === 'On Board') {
          nextStatus = 'Delivered';
          deliveredAt = new Date().toLocaleString([], { 
            month: 'short', 
            day: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit' 
          });
        } else {
          nextStatus = 'Pending';
          deliveredAt = undefined;
        }

        return { 
          ...b, 
          status: nextStatus,
          deliveredAt
        };
      }
      return b;
    }));
  };

  const bulkMarkDelivered = () => {
    if (selectedIds.length === 0) return;
    const now = new Date().toLocaleString([], { 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    });

    setBookings(prev => prev.map(b => {
      if (selectedIds.includes(b.id)) {
        return { ...b, status: 'Delivered', deliveredAt: now };
      }
      return b;
    }));
    setSelectedIds([]);
  };

  const deleteBooking = (id: string) => {
    setBookings(prev => prev.filter(b => b.id !== id));
    if (editingBooking?.id === id) setEditingBooking(null);
    setSelectedIds(prev => prev.filter(selectedId => selectedId !== id));
  };

  const saveCustomer = (customerData: Omit<Customer, 'id'>) => {
    if (!editingCustomerId && savedCustomers.find(c => c.name.toLowerCase() === customerData.name.toLowerCase())) return;
    const newCustomer: Customer = {
      ...customerData,
      id: Math.random().toString(36).substr(2, 9),
    };
    setSavedCustomers(prev => [...prev, newCustomer]);
  };

  const startEditCustomer = (customer: Customer) => {
    setEditingCustomerId(customer.id);
    setCustomerEditForm({
      name: customer.name,
      address: customer.address,
      contact: customer.contact
    });
  };

  const cancelEditCustomer = () => {
    setEditingCustomerId(null);
  };

  const handleUpdateCustomer = () => {
    if (!editingCustomerId) return;
    setSavedCustomers(prev => prev.map(c => 
      c.id === editingCustomerId ? { ...c, ...customerEditForm } : c
    ));
    setEditingCustomerId(null);
  };

  const deleteCustomer = (id: string) => {
    if (confirm('Delete this contact?')) {
      setSavedCustomers(prev => prev.filter(c => c.id !== id));
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
            <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid black; padding-bottom: 5px; margin-bottom: 10px;">
              <div style="font-size: 32px; font-weight: 900;">${pickupDisplay}</div>
              <div style="font-size: 14px; text-align: right; font-weight: bold;">
                SWIFTRUN<br/>
                ${new Date().toLocaleDateString()}
              </div>
            </div>
            
            <div style="margin-bottom: 15px;">
              <div style="font-size: 10px; text-transform: uppercase; font-weight: 900; letter-spacing: 1px;">Ship To:</div>
              <div style="font-size: 20px; font-weight: 900; margin-top: 2px;">${booking.customerName}</div>
              <div style="font-size: 16px; font-weight: 600; margin-top: 5px; line-height: 1.2;">${booking.deliveryAddress}</div>
              <div style="font-size: 14px; margin-top: 8px;">Attn: ${booking.contact}</div>
            </div>

            <div style="flex-grow: 1; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; border-top: 1px solid #ddd; padding-top: 10px;">
              <div>
                <div style="font-size: 10px; font-weight: bold; text-transform: uppercase;">Sales Order</div>
                <div style="font-size: 16px; font-weight: 900;">${booking.salesOrder}</div>
              </div>
              <div>
                <div style="font-size: 10px; font-weight: bold; text-transform: uppercase;">Purchase Order</div>
                <div style="font-size: 16px; font-weight: 900;">${booking.purchaseOrder || 'N/A'}</div>
              </div>
            </div>

            <div style="margin-top: auto; border-top: 2px solid black; padding-top: 10px; display: flex; justify-content: space-between; align-items: flex-end;">
               <div style="font-size: 10px; font-weight: bold;">BOOKED: ${booking.bookedAt || 'N/A'}</div>
               <div style="text-align: right;">
                 <div style="font-size: 12px; font-weight: bold; text-transform: uppercase;">Carton</div>
                 <div style="font-size: 36px; font-weight: 900; line-height: 1;">${i} of ${booking.cartons}</div>
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

  const activeBookings = useMemo(() => {
    const active = bookings.filter(b => b.status !== 'Delivered');
    return applyFilters(active);
  }, [bookings, pickupFilter, statusFilter]);

  const historyBookings = useMemo(() => {
    const completed = bookings
      .filter(b => b.status === 'Delivered')
      .sort((a, b) => {
        const dateA = a.deliveredAt ? new Date(a.deliveredAt).getTime() : 0;
        const dateB = b.deliveredAt ? new Date(b.deliveredAt).getTime() : 0;
        return dateB - dateA;
      });
    return applyFilters(completed);
  }, [bookings, pickupFilter, statusFilter]);

  const exportToExcel = () => {
    const dataToExport = historyBookings.length > 0 ? historyBookings : bookings;
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
      'Pickup Location': b.pickupLocation,
      'Delivery Address': b.deliveryAddress,
      'Contact Info': b.contact,
      'Cartons': b.cartons,
      'Booked At': b.bookedAt || 'N/A',
      'Delivered At': b.deliveredAt || 'N/A'
    })));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Delivery History");
    XLSX.writeFile(workbook, `SwiftRun_History_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = (ids: string[]) => {
    if (selectedIds.length === ids.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(ids);
    }
  };

  const clearFilters = () => {
    setPickupFilter('All');
    setStatusFilter('All');
  };

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
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 md:px-6">
        <StatsCard stats={stats} />
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-12">
            <BookingForm 
              onAdd={addBooking} 
              onUpdate={updateBooking}
              editingBooking={editingBooking}
              onCancelEdit={() => setEditingBooking(null)}
              savedCustomers={savedCustomers}
              onSaveCustomer={saveCustomer}
            />

            <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex flex-col md:flex-row items-center gap-6 w-full md:w-auto">
                <div className="flex items-center gap-2 text-slate-400">
                  <Filter className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-widest">Filters</span>
                </div>
                
                <div className="flex flex-col gap-1 w-full md:w-auto">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-tighter ml-1">Pickup Location</label>
                  <div className="flex items-center bg-slate-100 p-1 rounded-xl gap-1">
                    {(['All', 'SG', 'WB', 'RF', 'Other'] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setPickupFilter(tab)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          pickupFilter === tab 
                            ? 'bg-white text-rose-600 shadow-sm' 
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-1 w-full md:w-auto">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-tighter ml-1">Delivery Status</label>
                  <div className="flex items-center bg-slate-100 p-1 rounded-xl gap-1">
                    {(['All', 'Pending', 'On Board', 'Delivered'] as const).map((status) => (
                      <button
                        key={status}
                        onClick={() => setStatusFilter(status)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          statusFilter === status 
                            ? 'bg-white text-rose-600 shadow-sm' 
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {isFilterActive && (
                <button 
                  onClick={clearFilters}
                  className="flex items-center gap-2 px-4 py-2 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-bold transition-all"
                >
                  <FilterX className="w-4 h-4" />
                  Reset Filters
                </button>
              )}
            </div>
            
            <div className="flex flex-col gap-4 relative">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                  Daily Run Sheet
                  {(statusFilter === 'All' || statusFilter === 'Pending' || statusFilter === 'On Board') && (
                    <span className="text-xs font-normal bg-rose-100 text-rose-600 px-2 py-1 rounded-md">
                      {statusFilter === 'All' ? 'In Progress' : statusFilter}
                    </span>
                  )}
                </h2>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={openGlobalMapPreview}
                    disabled={activeBookings.length === 0}
                    className="flex items-center gap-1.5 text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-4 py-2 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <MapIcon className="w-4 h-4" />
                    View Run on Map
                  </button>
                  <button 
                    onClick={() => {
                      if (confirm('Are you sure you want to clear all data?')) {
                        setBookings([]);
                        setEditingBooking(null);
                        setSelectedIds([]);
                      }
                    }}
                    className="text-xs text-slate-400 hover:text-rose-500 font-medium transition-colors"
                  >
                    Clear All
                  </button>
                </div>
              </div>
              
              {selectedIds.length > 0 && (
                <div className="sticky top-4 z-20 w-full flex justify-center animate-in slide-in-from-top-4 duration-300">
                  <div className="bg-slate-800 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-6 border border-white/10 backdrop-blur-md">
                    <span className="text-sm font-bold">{selectedIds.length} items selected</span>
                    <div className="w-px h-4 bg-white/20" />
                    <button 
                      onClick={bulkMarkDelivered}
                      className="flex items-center gap-2 text-emerald-400 hover:text-emerald-300 text-sm font-black uppercase tracking-wider transition-colors"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Mark Delivered
                    </button>
                    <button 
                      onClick={() => setSelectedIds([])}
                      className="text-slate-400 hover:text-white transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              <RunSheetTable 
                bookings={activeBookings} 
                onToggleStatus={toggleStatus} 
                onDelete={deleteBooking} 
                onEdit={setEditingBooking}
                onPreviewMap={openSingleMapPreview}
                onPrintLabels={printLabels}
                onReorder={moveBooking}
                highlightedId={highlightedBookingId}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelection}
                onToggleSelectAll={toggleSelectAll}
                title="Daily Run Sheet"
                emptyMessage={isFilterActive ? "No matching active deliveries for these filters." : "No pending deliveries. Add some above!"}
              />
            </div>

            {(statusFilter === 'All' || statusFilter === 'Delivered') && (
              <div className="flex flex-col gap-6">
                <div className="flex items-center gap-2">
                  <HistoryIcon className="w-6 h-6 text-slate-400" />
                  <h2 className="text-2xl font-bold text-slate-800">Delivery History</h2>
                </div>

                <RunSheetTable 
                  bookings={historyBookings} 
                  onToggleStatus={toggleStatus} 
                  onDelete={deleteBooking} 
                  onEdit={setEditingBooking}
                  onPreviewMap={openSingleMapPreview}
                  onPrintLabels={printLabels}
                  highlightedId={highlightedBookingId}
                  title="History"
                  emptyMessage={isFilterActive ? "No matching history for these filters." : "No deliveries completed yet today."}
                />
              </div>
            )}
          </div>

          <div className="space-y-8">
            <div className="bg-white rounded-3xl p-6 shadow-xl border border-slate-100 transition-all duration-300 overflow-hidden">
              <button 
                onClick={() => setIsContactsExpanded(!isContactsExpanded)}
                className="w-full flex items-center justify-between group"
              >
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-xl transition-colors ${isContactsExpanded ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-500'}`}>
                    <Users className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800">Saved Contacts</h3>
                </div>
                {isContactsExpanded ? (
                  <ChevronUp className="w-5 h-5 text-slate-400 group-hover:text-rose-500" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-slate-400 group-hover:text-rose-500" />
                )}
              </button>
              
              {isContactsExpanded && (
                <div className="mt-6 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                  {savedCustomers.length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-2">No saved contacts yet. Check "Save to contacts" when adding a new delivery.</p>
                  ) : (
                    <div className="space-y-3 max-h-[450px] overflow-y-auto custom-scrollbar pr-2 pb-2">
                      {savedCustomers.map(customer => (
                        <div key={customer.id} className={`p-4 rounded-2xl border transition-all ${editingCustomerId === customer.id ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-100 group relative'}`}>
                          {editingCustomerId === customer.id ? (
                            <div className="space-y-3 animate-in fade-in duration-200">
                              <input 
                                className="w-full bg-white px-3 py-1.5 rounded-lg border border-rose-200 text-sm font-bold text-slate-700 outline-none focus:ring-1 focus:ring-rose-500"
                                value={customerEditForm.name}
                                onChange={(e) => setCustomerEditForm({...customerEditForm, name: e.target.value})}
                                placeholder="Name"
                              />
                              <input 
                                className="w-full bg-white px-3 py-1.5 rounded-lg border border-rose-200 text-xs text-slate-600 outline-none focus:ring-1 focus:ring-rose-500"
                                value={customerEditForm.address}
                                onChange={(e) => setCustomerEditForm({...customerEditForm, address: e.target.value})}
                                placeholder="Address"
                              />
                              <input 
                                className="w-full bg-white px-3 py-1.5 rounded-lg border border-rose-200 text-xs text-slate-600 outline-none focus:ring-1 focus:ring-rose-500"
                                value={customerEditForm.contact}
                                onChange={(e) => setCustomerEditForm({...customerEditForm, contact: e.target.value})}
                                placeholder="Contact"
                              />
                              <div className="flex gap-2">
                                <button 
                                  onClick={handleUpdateCustomer}
                                  className="flex-1 bg-rose-600 text-white text-[10px] font-bold py-2 rounded-lg flex items-center justify-center gap-1"
                                >
                                  <Save className="w-3 h-3" /> Save Changes
                                </button>
                                <button 
                                  onClick={cancelEditCustomer}
                                  className="px-3 py-2 text-slate-400 hover:text-slate-600"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="flex justify-between items-start">
                                <p className="text-sm font-bold text-slate-700">{customer.name}</p>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button 
                                    onClick={() => startEditCustomer(customer)}
                                    className="p-1.5 text-slate-400 hover:text-amber-500 hover:bg-white rounded-lg transition-colors"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button 
                                    onClick={() => deleteCustomer(customer.id)}
                                    className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-white rounded-lg transition-colors"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                              <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                                <MapPin className="w-2.5 h-2.5" /> {customer.address}
                              </p>
                              <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                                <Users className="w-2.5 h-2.5" /> {customer.contact}
                              </p>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="bg-white rounded-3xl p-6 shadow-xl border border-slate-100">
              <h3 className="text-lg font-bold text-slate-800 mb-4">Quick Actions</h3>
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={exportToExcel}
                  className="flex flex-col items-center justify-center p-4 bg-slate-50 hover:bg-rose-50 rounded-2xl transition-all border border-slate-100 hover:border-rose-100 group"
                >
                  <FileSpreadsheet className="w-6 h-6 text-rose-600 mb-1 group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-bold text-slate-600">Export Excel</span>
                </button>
                <button className="flex flex-col items-center justify-center p-4 bg-slate-50 hover:bg-emerald-50 rounded-2xl transition-all border border-slate-100 hover:border-emerald-100 group">
                  <span className="text-emerald-600 mb-1 group-hover:scale-110 transition-transform text-xl">✉️</span>
                  <span className="text-xs font-bold text-slate-600">Email Run</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
      
      <MapModal 
        isOpen={isMapModalOpen} 
        onClose={() => setIsMapModalOpen(false)} 
        bookings={mapTargetBookings}
        title={mapTitle}
        highlightedId={highlightedBookingId}
        onHighlight={setHighlightedBookingId}
      />

      <div className="fixed bottom-[-100px] left-[-100px] w-96 h-96 bg-rose-500/5 rounded-full blur-[120px] -z-10"></div>
      <div className="fixed top-[20%] right-[-50px] w-64 h-64 bg-red-500/5 rounded-full blur-[100px] -z-10"></div>
    </div>
  );
};

export default App;
