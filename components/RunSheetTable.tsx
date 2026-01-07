
import React from 'react';
import { CheckCircle, Clock, Trash2, MapPin, Building2, Package, Hash, Truck, Edit3, Eye, Printer, GripVertical, ListOrdered, StickyNote, FileText } from 'lucide-react';
import { DeliveryBooking, BookingStatus, PICKUP_PRESETS } from '../types';

interface RunSheetTableProps {
  bookings: DeliveryBooking[];
  onToggleStatus: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (booking: DeliveryBooking) => void;
  onPreviewMap: (booking: DeliveryBooking) => void;
  onPrintLabels?: (booking: DeliveryBooking) => void;
  onReorder?: (draggedId: string, targetId: string) => void;
}

const RunSheetTable: React.FC<RunSheetTableProps> = ({ 
  bookings, onToggleStatus, onDelete, onEdit, onPreviewMap, onPrintLabels, onReorder 
}) => {
  if (bookings.length === 0) return <div className="bg-white rounded-[2.5rem] p-16 text-center border border-slate-100 shadow-sm"><Package className="w-16 h-16 text-slate-200 mx-auto mb-6" /><p className="text-slate-400 font-black uppercase tracking-widest text-sm">Task list is currently empty</p></div>;

  return (
    <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/50 border-b border-slate-100">
              <th className="w-10 px-8 py-6"></th>
              <th className="px-6 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
              <th className="px-6 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Destination</th>
              <th className="px-6 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Order Info</th>
              <th className="px-6 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Logistics</th>
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {bookings.map((b, i) => (
              <tr key={b.id} className={`group hover:bg-blue-50/20 transition-colors ${b.status === 'Delivered' ? 'bg-emerald-50/20' : ''}`}>
                <td className="px-8 py-6">
                  <div className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-blue-500 transition-colors" onDragStart={(e)=>{ e.dataTransfer.setData('id', b.id); }} onDragOver={(e)=>e.preventDefault()} onDrop={(e)=>{ const did = e.dataTransfer.getData('id'); if(onReorder && did !== b.id) onReorder(did, b.id); }} draggable={!!onReorder}>
                    <GripVertical className="w-6 h-6" />
                  </div>
                </td>
                <td className="px-6 py-6">
                  <div className="flex flex-col gap-2">
                    <span className="text-[10px] font-black text-slate-400 flex items-center gap-1 uppercase tracking-tighter">STOP #{i + 1}</span>
                    <button onClick={()=>onToggleStatus(b.id)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 shadow-sm transition-all active:scale-95 ${b.status === 'Delivered' ? 'bg-emerald-100 text-emerald-600' : b.status === 'On Board' ? 'bg-blue-600 text-white shadow-blue-100' : 'bg-amber-100 text-amber-600'}`}>
                       {b.status === 'Delivered' ? <CheckCircle className="w-3.5 h-3.5" /> : b.status === 'On Board' ? <Truck className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                       {b.status}
                    </button>
                  </div>
                </td>
                <td className="px-6 py-6">
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-black text-black leading-none">{b.customerName}</p>
                    <p className="text-[11px] text-slate-500 font-bold flex items-center gap-1"><MapPin className="w-3 h-3 text-blue-500" />{b.deliveryAddress}</p>
                    {b.deliveryInstructions && (
                      <div className="mt-2 flex items-center gap-2 px-2.5 py-1 bg-amber-50 border border-amber-100 rounded-lg">
                        <StickyNote className="w-3 h-3 text-amber-600" />
                        <span className="text-[9px] font-black text-amber-600 truncate max-w-[180px] uppercase tracking-tighter">Special Note Attached</span>
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-6 py-6">
                  <div className="flex flex-col gap-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">SO: {b.salesOrder}</p>
                    {b.purchaseOrder && <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">PO: {b.purchaseOrder}</p>}
                  </div>
                </td>
                <td className="px-6 py-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-100 rounded-xl"><Package className="w-4 h-4 text-slate-500" /></div>
                    <span className="text-sm font-black text-slate-800">{b.cartons} Cartons</span>
                  </div>
                </td>
                <td className="px-8 py-6 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={()=>onPrintLabels?.(b)} className="p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all" title="Print Labels"><Printer className="w-5 h-5" /></button>
                    <button onClick={()=>onPreviewMap(b)} className="p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all" title="View Map"><Eye className="w-5 h-5" /></button>
                    <button onClick={()=>onEdit(b)} className="p-2.5 text-slate-400 hover:text-amber-500 hover:bg-amber-50 rounded-xl transition-all" title="Edit"><Edit3 className="w-5 h-5" /></button>
                    <button onClick={()=>onDelete(b.id)} className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all" title="Delete"><Trash2 className="w-5 h-5" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RunSheetTable;
