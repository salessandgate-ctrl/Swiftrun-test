
import React, { useState, useEffect, useRef } from 'react';
import { PlusCircle, Package, User, MapPin, Phone, Hash, Save, XCircle, Users, Search, Edit3, Building, Map, Check, FileText, ListOrdered, StickyNote, Edit2 } from 'lucide-react';
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
    deliveryInstructions: '',
  });
  const [saveToContacts, setSaveToContacts] = useState(false);
  const [isManualPickup, setIsManualPickup] = useState(false);
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
        deliveryInstructions: editingBooking.deliveryInstructions || '',
      });
      const isPreset = PICKUP_PRESETS.some(p => p.address === editingBooking.pickupLocation);
      setIsManualPickup(!isPreset);
    } else {
      resetForm();
    }
  }, [editingBooking]);

  const resetForm = () => {
    setFormData({
      pickupLocation: '',
      customerName: '',
      deliveryAddress: '',
      contact: '',
      cartons: 1,
      salesOrder: '',
      purchaseOrder: '',
      deliveryInstructions: '',
    });
    setSaveToContacts(false);
    setIsManualPickup(false);
    setSearchTerm('');
  };

  const handleCustomerSelect = (customer: Customer) => {
    setFormData(prev => ({ ...prev, customerName: customer.name, deliveryAddress: customer.address, contact: customer.contact }));
    setSearchTerm(customer.name);
    setIsDropdownOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingBooking) onUpdate(editingBooking.id, formData);
    else {
      onAdd(formData);
      if (saveToContacts) onSaveCustomer({ name: formData.customerName, address: formData.deliveryAddress, contact: formData.contact });
    }
    resetForm();
    onCancelEdit();
  };

  const filteredCustomers = savedCustomers.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-6">
      {!editingBooking && savedCustomers.length > 0 && (
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="relative flex-1" ref={dropdownRef}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text"
              placeholder="Quick search saved contacts..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-black outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              value={searchTerm}
              onFocus={() => setIsDropdownOpen(true)}
              onChange={(e) => { setSearchTerm(e.target.value); setIsDropdownOpen(true); }}
            />
            {isDropdownOpen && filteredCustomers.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-100 z-50 max-h-40 overflow-y-auto">
                {filteredCustomers.map(c => (
                  <button key={c.id} onClick={()=>handleCustomerSelect(c)} className="w-full text-left p-3 hover:bg-slate-50 text-xs font-bold text-black flex justify-between">
                    {c.name} <span className="text-[10px] text-slate-400">{c.address.substr(0, 20)}...</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className={`bg-white p-8 rounded-[2.5rem] shadow-xl border transition-all duration-300 ${editingBooking ? 'border-amber-400 ring-4 ring-amber-100' : 'border-slate-100'}`}>
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2 text-blue-600">
            <PlusCircle className="w-6 h-6" />
            <h2 className="text-xl font-black tracking-tight">{editingBooking ? 'Edit Delivery' : 'New Booking'}</h2>
          </div>
          <button 
            type="button" 
            onClick={() => setIsManualPickup(!isManualPickup)} 
            className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 bg-slate-100 rounded-full text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
          >
            {isManualPickup ? "Use Presets" : "Manual Pickup"}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-3">
             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3">Pickup Location</label>
             {isManualPickup ? (
               <div className="relative">
                  <Building className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    required 
                    type="text" 
                    placeholder="Enter manual pickup address..."
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-black focus:ring-2 focus:ring-blue-500 outline-none" 
                    value={formData.pickupLocation} 
                    onChange={(e)=>setFormData({...formData, pickupLocation: e.target.value})} 
                  />
               </div>
             ) : (
               <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                 {PICKUP_PRESETS.map(p => (
                   <button key={p.id} type="button" onClick={()=>setFormData({...formData, pickupLocation: p.address})} className={`p-4 rounded-2xl border text-left transition-all ${formData.pickupLocation === p.address ? 'bg-blue-600 border-blue-600 shadow-lg shadow-blue-100' : 'bg-slate-50 border-slate-100 hover:border-blue-300'}`}>
                      <p className={`text-xs font-black uppercase tracking-widest mb-1 ${formData.pickupLocation === p.address ? 'text-white' : 'text-slate-700'}`}>{p.name}</p>
                      <p className={`text-[9px] ${formData.pickupLocation === p.address ? 'text-blue-100' : 'text-slate-400'}`}>{p.address}</p>
                   </button>
                 ))}
               </div>
             )}
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Customer Name</label>
            <input required type="text" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-black focus:ring-2 focus:ring-blue-500 outline-none" value={formData.customerName} onChange={(e)=>setFormData({...formData, customerName: e.target.value})} />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Delivery Address</label>
            <input required type="text" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-black focus:ring-2 focus:ring-blue-500 outline-none" value={formData.deliveryAddress} onChange={(e)=>setFormData({...formData, deliveryAddress: e.target.value})} />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Contact Details</label>
            <input required type="text" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-black focus:ring-2 focus:ring-blue-500 outline-none" value={formData.contact} onChange={(e)=>setFormData({...formData, contact: e.target.value})} />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Total Cartons</label>
            <input required type="number" min="1" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-black focus:ring-2 focus:ring-blue-500 outline-none" value={formData.cartons} onChange={(e)=>setFormData({...formData, cartons: parseInt(e.target.value)||1})} />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Sales Order #</label>
            <input required type="text" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-black focus:ring-2 focus:ring-blue-500 outline-none" value={formData.salesOrder} onChange={(e)=>setFormData({...formData, salesOrder: e.target.value})} />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Purchase Order #</label>
            <input type="text" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-black focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Optional" value={formData.purchaseOrder} onChange={(e)=>setFormData({...formData, purchaseOrder: e.target.value})} />
          </div>

          <div className="lg:col-span-3 space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Delivery Instructions</label>
            <textarea className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-black focus:ring-2 focus:ring-blue-500 outline-none min-h-[100px] resize-none" placeholder="Gate codes, leave instructions, phone ahead, etc..." value={formData.deliveryInstructions} onChange={(e)=>setFormData({...formData, deliveryInstructions: e.target.value})} />
          </div>
        </div>

        <div className="mt-12 flex flex-col sm:flex-row justify-between items-center gap-6">
          <button 
            type="button"
            onClick={()=>setSaveToContacts(!saveToContacts)}
            className={`flex items-center gap-3 px-6 py-3 rounded-2xl border transition-all w-full sm:w-auto ${saveToContacts ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-100' : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-blue-300'}`}
          >
            <div className={`w-5 h-5 rounded-md flex items-center justify-center ${saveToContacts ? 'bg-white/20' : 'bg-slate-200'}`}>
              {saveToContacts && <Check className="w-3.5 h-3.5 text-white" />}
            </div>
            <span className="text-xs font-black uppercase tracking-widest">Save to device contacts</span>
          </button>

          <div className="flex gap-4 w-full sm:w-auto">
            {editingBooking && <button type="button" onClick={onCancelEdit} className="flex-1 sm:flex-none px-8 py-3 bg-slate-100 text-slate-500 font-bold rounded-2xl">Cancel</button>}
            <button type="submit" className="flex-1 sm:flex-none px-10 py-3 bg-blue-600 text-white font-black rounded-2xl shadow-xl shadow-blue-200 active:scale-95 transition-all">{editingBooking ? 'Update Delivery' : 'Add to Run Sheet'}</button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default BookingForm;
