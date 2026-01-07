
import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle, Clock, Trash2, MapPin, Building2, Package, Hash, User, Truck, Edit3, Eye, Calendar, Square, CheckSquare, FileText, Printer, GripVertical, ListOrdered } from 'lucide-react';
import { DeliveryBooking, BookingStatus, PICKUP_PRESETS } from '../types';

interface RunSheetTableProps {
  bookings: DeliveryBooking[];
  onToggleStatus: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (booking: DeliveryBooking) => void;
  onPreviewMap: (booking: DeliveryBooking) => void;
  onPrintLabels?: (booking: DeliveryBooking) => void;
  onReorder?: (draggedId: string, targetId: string) => void;
  highlightedId?: string | null;
  selectedIds?: string[];
  onToggleSelect?: (id: string) => void;
  onToggleSelectAll?: (ids: string[]) => void;
  title?: string;
  emptyMessage?: string;
}

const RunSheetTable: React.FC<RunSheetTableProps> = ({ 
  bookings, 
  onToggleStatus, 
  onDelete, 
  onEdit,
  onPreviewMap,
  onPrintLabels,
  onReorder,
  highlightedId,
  selectedIds = [],
  onToggleSelect,
  onToggleSelectAll,
  title = "Run Sheet",
  emptyMessage = "No deliveries booked yet"
}) => {
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  useEffect(() => {
    if (highlightedId && rowRefs.current[highlightedId]) {
      rowRefs.current[highlightedId]?.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center' 
      });
    }
  }, [highlightedId]);

  if (bookings.length === 0) {
    return (
      <div className="bg-white rounded-3xl p-12 text-center shadow-xl border border-slate-100">
        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <Package className="w-8 h-8 text-slate-300" />
        </div>
        <h3 className="text-xl font-semibold text-slate-600">{emptyMessage}</h3>
      </div>
    );
  }

  const getStatusStyle = (status: BookingStatus) => {
    switch (status) {
      case 'Delivered':
        return 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200';
      case 'On Board':
        return 'bg-blue-100 text-blue-700 ring-1 ring-blue-200';
      default:
        return 'bg-amber-100 text-amber-700 ring-1 ring-amber-200';
    }
  };

  const getStatusIcon = (status: BookingStatus) => {
    switch (status) {
      case 'Delivered':
        return <CheckCircle className="w-3 h-3" />;
      case 'On Board':
        return <Truck className="w-3 h-3" />;
      default:
        return <Clock className="w-3 h-3" />;
    }
  };

  const getPickupAbbreviation = (address: string) => {
    const matched = PICKUP_PRESETS.find(p => p.address === address);
    return matched ? matched.id : "Custom";
  };

  const isAllSelected = bookings.length > 0 && selectedIds.length === bookings.length;

  // Reordering handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (draggedId !== id) {
      setDragOverId(id);
    }
  };

  const handleDrop = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (onReorder && draggedId && draggedId !== id) {
      onReorder(draggedId, id);
    }
    setDraggedId(null);
    setDragOverId(null);
  };

  return (
    <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              {onReorder && <th className="w-10 px-4"></th>}
              {onToggleSelect && (
                <th className="pl-6 py-4 w-10">
                  <button 
                    onClick={() => onToggleSelectAll?.(bookings.map(b => b.id))}
                    className="p-1 rounded-md text-slate-400 hover:text-rose-600 transition-colors"
                  >
                    {isAllSelected ? <CheckSquare className="w-5 h-5 text-rose-600" /> : <Square className="w-5 h-5" />}
                  </button>
                </th>
              )}
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Seq & Status</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Customer & Order</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Address Details</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Logistics</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {bookings.map((booking) => {
              const isHighlighted = highlightedId === booking.id;
              const isSelected = selectedIds.includes(booking.id);
              const isDragging = draggedId === booking.id;
              const isDragOver = dragOverId === booking.id;

              return (
                <tr 
                  key={booking.id} 
                  ref={el => { rowRefs.current[booking.id] = el; }}
                  draggable={!!onReorder}
                  onDragStart={(e) => handleDragStart(e, booking.id)}
                  onDragOver={(e) => handleDragOver(e, booking.id)}
                  onDrop={(e) => handleDrop(e, booking.id)}
                  onDragEnd={() => { setDraggedId(null); setDragOverId(null); }}
                  className={`transition-all duration-300 border-l-4 ${
                    isDragOver ? 'border-l-rose-500 bg-rose-50/50 scale-[0.99] translate-x-1' : 'border-l-transparent'
                  } ${
                    isDragging ? 'opacity-30' : ''
                  } ${
                    isSelected
                      ? 'bg-rose-50/40'
                      : isHighlighted 
                        ? 'bg-rose-50 ring-2 ring-inset ring-rose-500 z-10' 
                        : booking.status === 'Delivered' 
                          ? 'bg-emerald-50/30' 
                          : 'hover:bg-slate-50/80'
                  }`}
                >
                  {onReorder && (
                    <td className="px-4 py-5 cursor-grab active:cursor-grabbing text-slate-300 hover:text-rose-400">
                      <GripVertical className="w-5 h-5" />
                    </td>
                  )}
                  {onToggleSelect && (
                    <td className="pl-6 py-5">
                      <button 
                        onClick={() => onToggleSelect(booking.id)}
                        className="p-1 rounded-md transition-colors"
                      >
                        {isSelected ? <CheckSquare className="w-5 h-5 text-rose-600" /> : <Square className="w-5 h-5 text-slate-300" />}
                      </button>
                    </td>
                  )}
                  <td className="px-6 py-5">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-tighter">
                        <ListOrdered className="w-3 h-3" /> Seq: {booking.sequence || '-'}
                      </div>
                      <button 
                        onClick={() => onToggleStatus(booking.id)}
                        className={`flex items-center justify-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all hover:opacity-80 active:scale-95 ${getStatusStyle(booking.status)}`}
                      >
                        {getStatusIcon(booking.status)}
                        {booking.status}
                      </button>
                      {booking.status === 'Delivered' && booking.deliveredAt && (
                        <div className="text-[10px] text-slate-400 ml-1 flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" /> {booking.deliveredAt}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex flex-col">
                      <span className={`font-bold flex items-center gap-1.5 ${isHighlighted ? 'text-rose-700' : 'text-slate-800'}`}>
                        <Building2 className={`w-3.5 h-3.5 ${isHighlighted ? 'text-rose-600' : 'text-rose-400'}`} />
                        {booking.customerName}
                      </span>
                      <div className="flex flex-col gap-0.5 mt-0.5">
                        <span className="text-xs text-slate-500 flex items-center gap-1.5">
                          <Hash className="w-3 h-3" />
                          SO: {booking.salesOrder}
                        </span>
                        {booking.purchaseOrder && (
                          <span className="text-xs text-slate-500 flex items-center gap-1.5">
                            <FileText className="w-3 h-3" />
                            PO: {booking.purchaseOrder}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex flex-col max-w-xs group cursor-pointer" onClick={() => onPreviewMap(booking)}>
                      <span className={`text-sm font-semibold flex items-start gap-1.5 transition-colors ${isHighlighted ? 'text-rose-700' : 'text-slate-700 group-hover:text-rose-600'}`}>
                        <MapPin className={`w-3.5 h-3.5 mt-0.5 transition-transform ${isHighlighted ? 'text-rose-600' : 'text-rose-400 group-hover:scale-125'}`} />
                        {booking.deliveryAddress}
                      </span>
                      <span className="text-xs text-slate-500 flex items-center gap-1.5 mt-1">
                        <User className="w-3.5 h-3.5" />
                        {booking.contact}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex flex-col">
                      <span className={`text-sm font-bold flex items-center gap-1.5 ${isHighlighted ? 'text-rose-700' : 'text-slate-700'}`}>
                        <Package className={`w-3.5 h-3.5 ${isHighlighted ? 'text-rose-600' : 'text-rose-500'}`} />
                        {booking.cartons} Cartons
                      </span>
                      <span className="text-xs text-slate-500 mt-1 italic font-bold">
                        Pick: {getPickupAbbreviation(booking.pickupLocation)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button 
                        onClick={() => onPrintLabels?.(booking)}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                        title="Print 4x6 Labels"
                      >
                        <Printer className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => onPreviewMap(booking)}
                        className={`p-2 rounded-lg transition-all ${isHighlighted ? 'text-rose-600 bg-rose-100' : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'}`}
                        title="View Map"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => onEdit(booking)}
                        className="p-2 text-slate-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-all"
                        title="Edit Delivery"
                      >
                        <Edit3 className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => onDelete(booking.id)}
                        className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                        title="Delete Delivery"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RunSheetTable;
