import React, { useEffect, useRef, useState } from 'react';
import { X, MapPin, Navigation, Loader2, AlertCircle, Target } from 'lucide-react';
import { DeliveryBooking } from '../types';
import L from 'leaflet';

interface MapModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookings: DeliveryBooking[];
  title?: string;
  highlightedId?: string | null;
  onHighlight?: (id: string | null) => void;
}

interface GeocodedPoint {
  lat: number;
  lng: number;
}

const MapModal: React.FC<MapModalProps> = ({ 
  isOpen, 
  onClose, 
  bookings, 
  title = "Delivery Map Preview", 
  highlightedId,
  onHighlight
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRefs = useRef<Record<string, L.Marker>>({});
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocodedResults, setGeocodedResults] = useState<Record<string, GeocodedPoint>>({});
  const [error, setError] = useState<string | null>(null);

  // Helper to geocode a single address using Nominatim (OpenStreetMap)
  const fetchCoords = async (address: string): Promise<GeocodedPoint | null> => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
        {
          headers: {
            'Accept-Language': 'en',
            'User-Agent': 'SwiftRun-Delivery-Manager' 
          }
        }
      );
      const data = await response.json();
      if (data && data.length > 0) {
        return {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon)
        };
      }
      return null;
    } catch (err) {
      console.error("Geocoding error:", err);
      return null;
    }
  };

  const centerOnBooking = (id: string) => {
    const marker = markerRefs.current[id];
    if (marker && mapInstanceRef.current) {
      mapInstanceRef.current.setView(marker.getLatLng(), 15);
      marker.openPopup();
      if (onHighlight) onHighlight(id);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    const resolveAllCoords = async () => {
      setIsGeocoding(true);
      setError(null);
      const newResults: Record<string, GeocodedPoint> = { ...geocodedResults };
      let foundAny = false;

      for (const booking of bookings) {
        if (booking.latitude && booking.longitude) continue;
        if (newResults[booking.id]) continue;
        await new Promise(r => setTimeout(r, 600)); 
        const coords = await fetchCoords(booking.deliveryAddress);
        if (coords) {
          newResults[booking.id] = coords;
          foundAny = true;
        }
      }

      if (foundAny) {
        setGeocodedResults(newResults);
      }
      setIsGeocoding(false);
    };

    resolveAllCoords();
  }, [isOpen, bookings]);

  useEffect(() => {
    if (isOpen && mapContainerRef.current && !mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapContainerRef.current).setView([0, 0], 2);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(mapInstanceRef.current);
    }

    if (isOpen && mapInstanceRef.current) {
      const map = mapInstanceRef.current;
      map.eachLayer((layer) => {
        if (layer instanceof L.Marker) map.removeLayer(layer);
      });
      markerRefs.current = {};

      const markers: L.Marker[] = [];
      bookings.forEach((booking) => {
        let lat = booking.latitude;
        let lng = booking.longitude;
        if (!lat || !lng) {
          const resolved = geocodedResults[booking.id];
          if (resolved) {
            lat = resolved.lat;
            lng = resolved.lng;
          }
        }

        if (lat !== undefined && lng !== undefined) {
          const marker = L.marker([lat, lng])
            .addTo(map)
            .on('click', () => {
              if (onHighlight) onHighlight(booking.id);
            })
            .bindPopup(`
              <div class="p-1 min-w-[120px]">
                <strong class="text-rose-600 block mb-1">${booking.customerName}</strong>
                <span class="text-xs text-slate-600 leading-tight block mb-2">${booking.deliveryAddress}</span>
              </div>
            `);
          
          markerRefs.current[booking.id] = marker;
          markers.push(marker);
        }
      });

      if (markers.length > 0) {
        const group = L.featureGroup(markers);
        map.fitBounds(group.getBounds().pad(0.2));
      }

      // If one was pre-highlighted, center on it
      if (highlightedId && markerRefs.current[highlightedId]) {
        centerOnBooking(highlightedId);
      }
    }

    return () => {
      if (!isOpen && mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRefs.current = {};
      }
    };
  }, [isOpen, bookings, geocodedResults]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-900/70 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-6xl h-[85vh] rounded-[3rem] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300 border border-white/20">
        <div className="p-6 md:px-8 flex items-center justify-between border-b border-slate-100 bg-white">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-rose-50 rounded-2xl shadow-sm">
              {isGeocoding ? (
                <Loader2 className="w-6 h-6 text-rose-600 animate-spin" />
              ) : (
                <MapPin className="w-6 h-6 text-rose-600" />
              )}
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">{title}</h2>
              <div className="flex items-center gap-2">
                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">{bookings.length} Destinations</p>
                {isGeocoding && (
                   <span className="text-[10px] font-bold text-rose-500 bg-rose-50 px-2 py-0.5 rounded-full animate-pulse">
                     Geocoding addresses...
                   </span>
                )}
              </div>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2.5 hover:bg-slate-100 rounded-full transition-all text-slate-400 hover:text-slate-600 active:scale-90"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 relative bg-slate-50 flex flex-col md:flex-row overflow-hidden">
          {/* Main Map Area */}
          <div className="flex-1 relative order-2 md:order-1">
            <div ref={mapContainerRef} className="absolute inset-0 m-4 md:m-6 rounded-[2rem] overflow-hidden shadow-2xl border border-white" />
          </div>

          {/* Sidebar */}
          <div className="w-full md:w-80 bg-white border-l border-slate-100 overflow-y-auto custom-scrollbar p-6 order-1 md:order-2">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-4">Route Destinations</h3>
            <div className="space-y-3">
              {bookings.map((booking, i) => {
                const isResolved = booking.latitude || geocodedResults[booking.id];
                const isHighlighted = highlightedId === booking.id;
                return (
                  <div 
                    key={booking.id} 
                    onClick={() => centerOnBooking(booking.id)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer group ${
                      isHighlighted 
                        ? 'bg-rose-50 border-rose-200 ring-2 ring-rose-100' 
                        : isResolved 
                          ? 'bg-slate-50 border-slate-100 hover:border-rose-200' 
                          : 'bg-amber-50 border-amber-100 opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${isHighlighted ? 'bg-rose-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                        {i + 1}
                      </span>
                      {isResolved && (
                        <button className={`p-1 rounded-md transition-colors ${isHighlighted ? 'bg-rose-100 text-rose-600' : 'text-slate-400 group-hover:text-rose-500'}`}>
                          <Target className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <p className={`text-xs font-bold truncate ${isHighlighted ? 'text-rose-700' : 'text-slate-700'}`}>{booking.customerName}</p>
                    <p className="text-[10px] text-slate-500 mt-1 line-clamp-1 leading-tight">{booking.deliveryAddress}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="px-8 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          <p>&copy; OpenStreetMap contributors &bull; Click to highlight row in table</p>
          <div className="flex items-center gap-4">
             <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-rose-600"></div> PINNED</div>
             <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-slate-300"></div> PENDING</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MapModal;