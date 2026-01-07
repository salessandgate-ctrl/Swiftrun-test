import React, { useState, useEffect, useRef } from 'react';
import { PlusCircle, Package, User, MapPin, Phone, Hash, Save, XCircle, Users, Search, Edit3, Building, Map, Check, FileText } from 'lucide-react';
import { DeliveryBooking, Customer, PICKUP_PRESETS } from '../types';

interface BookingFormProps {
  onAdd: (booking: Omit<DeliveryBooking, 'id' | 'status'>) => void;
  onUpdate: (id: string, booking: Partial<DeliveryBooking>) => void;
  editingBooking: DeliveryBooking | null;
  onCancelEdit: () => void;
  savedCustomers: Customer[];
  onSaveCustomer: (customer: Omit<Customer, 'id'>) => void;
}

const BookingForm: React.FC<BookingFormProps> = ({ 
  onAdd, 
  onUpdate, 
  editingBooking, 
  onCancelEdit,
  savedCustomers,
  onSaveCustomer
}) => {
  const [formData, setFormData] = useState({
    pickupLocation: '',
    customerName: '',
    deliveryAddress: '',
    contact: '',
    cartons: 1,
    salesOrder: '',
    purchaseOrder: '',
  });
  const [saveToContacts, setSaveToContacts] = useState(false);
  const [isManualPickup, setIsManualPickup] = useState(false);
  
  // Predictive Search States
  const [searchTerm, setSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editingBooking) {
      setFormData({
        pickupLocation: editingBooking.pickupLocation,
        customerName: editingBooking.customerName,
        deliveryAddress: editingBooking.deliveryAddress,
        contact: editingBooking.contact,
        cartons: editingBooking.cartons,
        salesOrder: editingBooking.salesOrder,
        purchaseOrder: editingBooking.purchaseOrder || '',
      });
      const isPreset = PICKUP_PRESETS.some(p => p.address === editingBooking.pickupLocation);
      setIsManualPickup(!isPreset);
    } else {
      resetForm();
    }
  }, [editingBooking]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const resetForm = () => {
    setFormData({
      pickupLocation: '',
      customerName: '',
      deliveryAddress: '',
      contact: '',
      cartons: 1,
      salesOrder: '',
      purchaseOrder: '',
    });
    setSaveToContacts(false);
    setIsManualPickup(false);
    setSearchTerm('');
  };

  const handleCustomerSelect = (customer: Customer) => {
    setFormData(prev => ({
      ...prev,
      customerName: customer.name,
      deliveryAddress: customer.address,
      contact: customer.contact
    }));
    setSearchTerm(customer.name);
    setIsDropdownOpen(false);
  };

  const handlePresetSelect = (address: string) => {
    setFormData({ ...formData, pickupLocation: address });
    setIsManualPickup(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.pickupLocation.trim()) {
      alert("Please enter or select a Pickup Location.");
      return;
    }
    if (editingBooking) {
      onUpdate(editingBooking.id, formData);
      onCancelEdit();
    } else {
      onAdd(formData);
      if (saveToContacts) {
        onSaveCustomer({
          name: formData.customerName,
          address: formData.deliveryAddress,
          contact: formData.contact
        });
      }
    }
    resetForm();
  };

  const filteredCustomers = savedCustomers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.address.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4 mb-8">
      {!editingBooking && savedCustomers.length > 0 && (
        <div className="bg-white p-5 rounded-3xl shadow-md border border-slate-100 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 bg-rose-50 rounded-lg">
              <Users className="w-4 h-4 text-rose-600" />
            </div>
            <h3 className="text-sm font-bold text-slate-700">Predictive Profile Search</h3>
          </div>
          <div className="relative" ref={dropdownRef}>
            <div className="relative group">
              <input 
                type="text"
                placeholder="Type to search saved contacts (Name or Address)..."
                className="w-full h-12 pl-11 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white transition-all shadow-inner"
                value={searchTerm}
                onFocus={() => setIsDropdownOpen(true)}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setIsDropdownOpen(true);
                }}
              />
              <Search className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${isDropdownOpen ? 'text-rose-500' : 'text-slate-400'}`} />
            </div>

            {isDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-50 max-h-60 overflow-y-auto custom-scrollbar animate-in slide-in-from-top-2 duration-200">
                {filteredCustomers.length > 0 ? (
                  <div className="p-2">
                    {filteredCustomers.map(customer => (
                      <button
                        key={customer.id}
                        type="button"
                        onClick={() => handleCustomerSelect(customer)}
                        className="w-full text-left p-3 rounded-xl hover:bg-rose-50 flex items-center justify-between group transition-colors"
                      >
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-700 group-hover:text-rose-700">{customer.name}</span>
                          <span className="text-[10px] text-slate-400 truncate max-w-[250px] md:max-w-md">{customer.address}</span>
                        </div>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <Check className="w-4 h-4 text-rose-500" />
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 text-center">
                    <p className="text-xs text-slate-400 font-medium italic">No matching contacts found</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className={`bg-white p-6 rounded-3xl shadow-xl border transition-all duration-300 ${editingBooking ? 'border-amber-400 ring-2 ring-amber-100' : 'border-slate-100'}`}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2 text-rose-600">
            {editingBooking ? <Edit3 className="w-6 h-6" /> : <PlusCircle className="w-6 h-6" />}
            <h2 className="text-xl font-bold">{editingBooking ? 'Edit Delivery' : 'New Delivery Booking'}</h2>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="space-y-4 lg:col-span-3">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <Building className="w-3 h-3" /> Pickup Location
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {PICKUP_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handlePresetSelect(preset.address)}
                  className={`flex flex-col items-start p-4 rounded-2xl border text-left transition-all ${
                    !isManualPickup && formData.pickupLocation === preset.address 
                      ? 'bg-rose-50 border-rose-500 ring-1 ring-rose-500 shadow-md scale-[1.02]' 
                      : 'bg-slate-50 border-slate-200 hover:border-rose-300'
                  }`}
                >
                  <span className={`text-sm font-black mb-1 ${!isManualPickup && formData.pickupLocation === preset.address ? 'text-rose-600' : 'text-slate-700'}`}>
                    {preset.name}
                  </span>
                  <span className="text-[10px] text-slate-500 leading-tight">
                    {preset.address}
                  </span>
                </button>
              ))}
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                 <button 
                  type="button"
                  onClick={() => {
                    setIsManualPickup(!isManualPickup);
                    if (!isManualPickup) setFormData({ ...formData, pickupLocation: '' });
                  }}
                  className="text-[11px] font-bold text-rose-600 hover:underline flex items-center gap-1"
                >
                  {isManualPickup ? "Use Presets instead" : "Enter manual pickup location..."}
                </button>
              </div>
              
              {(isManualPickup || (formData.pickupLocation && !PICKUP_PRESETS.some(p => p.address === formData.pickupLocation))) && (
                <div className="animate-in slide-in-from-top-2 duration-300">
                  <div className="relative">
                    <input
                      type="text"
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-rose-200 bg-rose-50/30 focus:ring-2 focus:ring-rose-500 outline-none text-slate-700 text-sm font-medium"
                      placeholder="Enter custom pickup address..."
                      value={formData.pickupLocation}
                      onChange={(e) => {
                        setFormData({ ...formData, pickupLocation: e.target.value });
                        setIsManualPickup(true);
                      }}
                    />
                    <Map className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-rose-400" />
                  </div>
                  <p className="text-[10px] text-rose-400 mt-1 font-medium ml-1">Manual override active</p>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <User className="w-3 h-3" /> Customer Name
            </label>
            <input
              required
              type="text"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-rose-500 focus:border-transparent transition-all outline-none text-slate-700 bg-slate-50"
              placeholder="e.g. Acme Corp"
              value={formData.customerName}
              onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <MapPin className="w-3 h-3 text-red-500" /> Delivery Address
            </label>
            <input
              required
              type="text"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-rose-500 focus:border-transparent transition-all outline-none text-slate-700 bg-slate-50"
              placeholder="e.g. 123 Main St"
              value={formData.deliveryAddress}
              onChange={(e) => setFormData({ ...formData, deliveryAddress: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <Phone className="w-3 h-3" /> Contact Info
            </label>
            <input
              required
              type="text"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-rose-500 focus:border-transparent transition-all outline-none text-slate-700 bg-slate-50"
              placeholder="e.g. 0400 123 456"
              value={formData.contact}
              onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <Package className="w-3 h-3" /> No. of Cartons
            </label>
            <input
              required
              type="number"
              min="1"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-rose-500 focus:border-transparent transition-all outline-none text-slate-700 bg-slate-50"
              value={formData.cartons}
              onChange={(e) => setFormData({ ...formData, cartons: parseInt(e.target.value) || 1 })}
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <Hash className="w-3 h-3" /> Sales Order #
            </label>
            <input
              required
              type="text"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-rose-500 focus:border-transparent transition-all outline-none text-slate-700 bg-slate-50"
              placeholder="e.g. SO-98765"
              value={formData.salesOrder}
              onChange={(e) => setFormData({ ...formData, salesOrder: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <FileText className="w-3 h-3" /> Purchase Order No.
            </label>
            <input
              type="text"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-rose-500 focus:border-transparent transition-all outline-none text-slate-700 bg-slate-50"
              placeholder="e.g. PO-12345"
              value={formData.purchaseOrder}
              onChange={(e) => setFormData({ ...formData, purchaseOrder: e.target.value })}
            />
          </div>
        </div>

        <div className="mt-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          {!editingBooking ? (
            <label className="flex items-center gap-2 cursor-pointer group">
              <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${saveToContacts ? 'bg-rose-500 border-rose-500' : 'bg-slate-50 border-slate-200 group-hover:border-rose-300'}`}>
                <input 
                  type="checkbox" 
                  className="hidden" 
                  checked={saveToContacts}
                  onChange={() => setSaveToContacts(!saveToContacts)}
                />
                {saveToContacts && <Save className="w-3 h-3 text-white" />}
              </div>
              <span className="text-sm font-medium text-slate-600">Save to contacts</span>
            </label>
          ) : <div />}

          <div className="flex items-center gap-3">
            {editingBooking && (
              <button
                type="button"
                onClick={() => {
                  onCancelEdit();
                  resetForm();
                }}
                className="text-slate-500 hover:text-slate-700 font-bold py-3 px-6 flex items-center gap-2 transition-all"
              >
                <XCircle className="w-5 h-5" />
                Cancel
              </button>
            )}
            <button
              type="submit"
              className={`${editingBooking ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-200' : 'bg-rose-600 hover:bg-rose-700 shadow-rose-200'} text-white font-bold py-3 px-8 rounded-xl shadow-lg transition-all flex items-center gap-2 active:scale-95`}
            >
              {editingBooking ? <Save className="w-5 h-5" /> : <PlusCircle className="w-5 h-5" />}
              {editingBooking ? 'Update Delivery' : 'Add to Run Sheet'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default BookingForm;
