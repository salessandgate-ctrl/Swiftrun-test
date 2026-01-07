import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Header from './components/Header';
import BookingForm from './components/BookingForm';
import RunSheetTable from './components/RunSheetTable';
import StatsCard from './components/StatsCard';
import MapModal from './components/MapModal';
import { DeliveryBooking, RunSheetStats, BookingStatus, Customer, PICKUP_PRESETS } from './types';
import { getSmartOptimization, OptimizationResult } from './services/geminiService';
import { BrainCircuit, Sparkles, Loader2, RefreshCw, History as HistoryIcon, Users, Trash2, Edit3, Save, X, MapPin, Map as MapIcon, ExternalLink, ChevronDown, ChevronUp, LayoutGrid, FileSpreadsheet, CheckCircle2 } from 'lucide-react';
import * as XLSX from 'xlsx';

const App: React.FC = () => {
  const [bookings, setBookings] = useState<DeliveryBooking[]>([]);
  const [savedCustomers, setSavedCustomers] = useState<Customer[]>(() => {
    const saved = localStorage.getItem('swiftRun_customers');
    return saved ? JSON.parse(saved) : [];
  });
  const [editingBooking, setEditingBooking] = useState<DeliveryBooking | null>(null);
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [customerEditForm, setCustomerEditForm] = useState<Omit<Customer, 'id'>>({ name: '', address: '', contact: '' });
  const [aiResult, setAiResult] = useState<OptimizationResult | null>(null);
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [isContactsExpanded, setIsContactsExpanded] = useState(false);
  const [historyTab, setHistoryTab] = useState<'All' | 'SG' | 'WB' | 'RF' | 'Other'>('All');
  const [highlightedBookingId, setHighlightedBookingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // Map Modal State
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);
  const [mapTargetBookings, setMapTargetBookings] = useState<DeliveryBooking[]>([]);
  const [mapTitle, setMapTitle] = useState("Delivery Route Map");

  useEffect(() => {
    localStorage.setItem('swiftRun_customers', JSON.stringify(savedCustomers));
  }, [savedCustomers]);

  // Clear highlight after some time when modal closes
  useEffect(() => {
    if (!isMapModalOpen && highlightedBookingId) {
      const timer = setTimeout(() => setHighlightedBookingId(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [isMapModalOpen, highlightedBookingId]);

  // Stats calculation
  const stats: RunSheetStats = {
    totalDeliveries: bookings.length,
    deliveredCount: bookings.filter(b => b.status === 'Delivered').length,
    totalCartons: bookings.reduce((acc, b) => acc + b.cartons, 0),
  };

  const addBooking = (newBooking: Omit<DeliveryBooking, 'id' | 'status'>) => {
    const booking: DeliveryBooking = {
      ...newBooking,
      id: Math.random().toString(36).substr(2, 9),
      status: 'Pending',
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

  const handleAiOptimize = useCallback(async () => {
    const active = bookings.filter(b => b.status !== 'Delivered');
    if (active.length === 0) return;
    setIsAiLoading(true);
    const result = await getSmartOptimization(active);
    setAiResult(result);
    setIsAiLoading(false);
  }, [bookings]);

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

  // Helper to categorize pickup location
  const getBookingCategory = (booking: DeliveryBooking): 'SG' | 'WB' | 'RF' | 'Other' => {
    const matched = PICKUP_PRESETS.find(p => p.address === booking.pickupLocation);
    return matched ? matched.id as 'SG' | 'WB' | 'RF' : 'Other';
  };

  // Derived collections
  const activeBookings = useMemo(() => 
    bookings.filter(b => b.status !== 'Delivered'), 
  [bookings]);

  const historyBookings = useMemo(() => {
    const completed = bookings
      .filter(b => b.status === 'Delivered')
      .sort((a, b) => {
        const dateA = a.deliveredAt ? new Date(a.deliveredAt).getTime() : 0;
        const dateB = b.deliveredAt ? new Date(b.deliveredAt).getTime() : 0;
        return dateB - dateA;
      });

    if (historyTab === 'All') return completed;
    return completed.filter(b => getBookingCategory(b) === historyTab);
  }, [bookings, historyTab]);

  const getTabCount = (id: 'All' | 'SG' | 'WB' | 'RF' | 'Other') => {
    const completed = bookings.filter(b => b.status === 'Delivered');
    if (id === 'All') return completed.length;
    return completed.filter(b => getBookingCategory(b) === id).length;
  };

  const exportToExcel = () => {
    const dataToExport = historyBookings.length > 0 ? historyBookings : bookings;
    if (dataToExport.length === 0) {
      alert("No data available to export.");
      return;
    }

    const worksheet = XLSX.utils.json_to_sheet(dataToExport.map(b => ({
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

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20">
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
            
            <div className="flex flex-col gap-4 relative">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                  Daily Run Sheet
                  <span className="text-xs font-normal bg-rose-100 text-rose-600 px-2 py-1 rounded-md">In Progress</span>
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
              
              {/* Bulk Action Floating Bar */}
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
                highlightedId={highlightedBookingId}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelection}
                onToggleSelectAll={toggleSelectAll}
                title="Daily Run Sheet"
                emptyMessage="No pending deliveries. Add some above!"
              />
            </div>

            {/* History Section */}
            <div className="flex flex-col gap-6">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="flex items-center gap-2">
                  <HistoryIcon className="w-6 h-6 text-slate-400" />
                  <h2 className="text-2xl font-bold text-slate-800">Delivery History</h2>
                </div>

                {/* Tabbed Navigation */}
                <div className="flex items-center bg-slate-100 p-1 rounded-xl gap-1">
                  {(['All', 'SG', 'WB', 'RF', 'Other'] as const).map((tab) => {
                    const count = getTabCount(tab);
                    if (tab === 'Other' && count === 0) return null;
                    return (
                      <button
                        key={tab}
                        onClick={() => setHistoryTab(tab)}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                          historyTab === tab 
                            ? 'bg-white text-rose-600 shadow-sm' 
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        {tab === 'All' ? <LayoutGrid className="w-3 h-3" /> : null}
                        {tab}
                        <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${historyTab === tab ? 'bg-rose-50' : 'bg-slate-200 text-slate-500'}`}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <RunSheetTable 
                bookings={historyBookings} 
                onToggleStatus={toggleStatus} 
                onDelete={deleteBooking} 
                onEdit={setEditingBooking}
                onPreviewMap={openSingleMapPreview}
                onPrintLabels={printLabels}
                highlightedId={highlightedBookingId}
                title={`History - ${historyTab}`}
                emptyMessage={historyTab === 'All' ? "No deliveries completed yet today." : `No completed deliveries from ${historyTab} yet.`}
              />
            </div>
          </div>

          <div className="space-y-8">
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl p-6 shadow-2xl text-white relative overflow-hidden group">
              <div className="absolute top-[-20%] right-[-10%] w-40 h-40 bg-rose-500/10 rounded-full blur-3xl group-hover:scale-125 transition-transform duration-700"></div>
              
              <div className="flex items-center gap-2 mb-4">
                <BrainCircuit className="w-6 h-6 text-rose-400" />
                <h3 className="text-lg font-bold">AI Route Assistant</h3>
                <span className="text-[10px] bg-rose-500 text-white px-2 py-0.5 rounded-full font-black uppercase tracking-widest ml-auto">Gemini 2.5</span>
              </div>
              
              <p className="text-slate-300 text-sm mb-6 leading-relaxed">
                Optimize your current run with real-time <span className="text-rose-400 font-bold">Google Maps</span> intelligence. Gemini verifies locations and traffic flow.
              </p>

              <button 
                onClick={handleAiOptimize}
                disabled={activeBookings.length === 0 || isAiLoading}
                className="w-full bg-rose-600 hover:bg-rose-700 text-white py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group shadow-lg shadow-rose-900/20"
              >
                {isAiLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Sparkles className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                )}
                {isAiLoading ? 'Analyzing Route...' : 'Optimize with Google Maps'}
              </button>

              {aiResult && (
                <div className="mt-6 p-4 bg-white/5 rounded-2xl border border-white/10 animate-in fade-in slide-in-from-bottom-2 duration-500">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-rose-400">Logistics Recommendation</span>
                    <button onClick={() => setAiResult(null)} className="text-white/40 hover:text-white"><RefreshCw className="w-3 h-3" /></button>
                  </div>
                  <div className="text-sm leading-relaxed whitespace-pre-wrap text-slate-200 max-h-[300px] overflow-y-auto custom-scrollbar pr-2 mb-4">
                    {aiResult.text}
                  </div>
                  
                  {aiResult.links.length > 0 && (
                    <div className="pt-3 border-t border-white/10">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Maps & Web Sources</p>
                      <div className="flex flex-wrap gap-2">
                        {aiResult.links.map((link, idx) => (
                          <a 
                            key={idx} 
                            href={link.uri} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 hover:bg-rose-500/20 text-white hover:text-rose-300 text-[11px] font-bold rounded-lg transition-all border border-white/5"
                          >
                            <ExternalLink className="w-3 h-3" />
                            {link.title}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Saved Customers List (Collapsible Contacts) */}
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
      
      {/* Map Modal */}
      <MapModal 
        isOpen={isMapModalOpen} 
        onClose={() => setIsMapModalOpen(false)} 
        bookings={mapTargetBookings}
        title={mapTitle}
        highlightedId={highlightedBookingId}
        onHighlight={setHighlightedBookingId}
      />

      {/* Visual background elements */}
      <div className="fixed bottom-[-100px] left-[-100px] w-96 h-96 bg-rose-500/5 rounded-full blur-[120px] -z-10"></div>
      <div className="fixed top-[20%] right-[-50px] w-64 h-64 bg-red-500/5 rounded-full blur-[100px] -z-10"></div>
    </div>
  );
};

export default App;