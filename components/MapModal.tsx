
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

      // FIX: When initializing in a modal with an animation (300ms duration),
      // we must wait for the transition to finish before recalculating size.
      // Otherwise, Leaflet only renders the top-left chunk of the map.
      setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      }, 400);
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
                <strong class="text-blue-600 block mb-1">${booking.customerName}</strong>
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-6xl h-[85vh] rounded-[3rem] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
        <div className="p-8 flex items-center justify-between border-b border-slate-100">
          <div className="flex items-center gap-5">
            <div className="p-4 bg-blue-50 rounded-2xl">
              {isGeocoding ? (
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              ) : (
                <MapPin className="w-8 h-8 text-blue-600" />
              )}
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">{title}</h2>
              <div className="flex items-center gap-3">
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">{bookings.length} Locations Mapped</p>
                {isGeocoding && (
                   <span className="text-[9px] font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-full animate-pulse uppercase tracking-widest">
                     Resolving GPS...
                   </span>
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-slate-100 rounded-full transition-all text-slate-400 active:scale-90">
            <X className="w-8 h-8" />
          </button>
        </div>

        <div className="flex-1 relative bg-slate-50 flex flex-col md:flex-row overflow-hidden">
          <div className="flex-1 relative order-2 md:order-1 p-6">
            <div ref={mapContainerRef} className="absolute inset-6 rounded-[2rem] overflow-hidden shadow-2xl border border-white" />
          </div>

          <div className="w-full md:w-96 bg-white border-l border-slate-100 overflow-y-auto custom-scrollbar p-8 order-1 md:order-2">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">Route Sequence</h3>
            <div className="space-y-4">
              {bookings.map((booking, i) => {
                const isResolved = booking.latitude || geocodedResults[booking.id];
                const isHighlighted = highlightedId === booking.id;
                return (
                  <div 
                    key={booking.id} 
                    onClick={() => centerOnBooking(booking.id)}
                    className={`p-5 rounded-2xl border transition-all cursor-pointer group shadow-sm ${
                      isHighlighted 
                        ? 'bg-blue-600 border-blue-600 text-white shadow-blue-100' 
                        : isResolved 
                          ? 'bg-white border-slate-100 hover:border-blue-300' 
                          : 'bg-slate-50 border-slate-100 opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${isHighlighted ? 'bg-white text-blue-600' : 'bg-slate-100 text-slate-500'}`}>
                        {i + 1}
                      </span>
                      {isResolved && (
                        <Target className={`w-4 h-4 ${isHighlighted ? 'text-white/80' : 'text-slate-300 group-hover:text-blue-500'}`} />
                      )}
                    </div>
                    <p className={`text-sm font-black truncate ${isHighlighted ? 'text-white' : 'text-slate-900'}`}>{booking.customerName}</p>
                    <p className={`text-[10px] mt-1 line-clamp-2 leading-relaxed font-bold ${isHighlighted ? 'text-blue-100' : 'text-slate-500'}`}>{booking.deliveryAddress}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="px-8 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest">
          <p>Coordinates provided by OpenStreetMap &bull; Map is real-time interactive</p>
          <div className="flex items-center gap-6">
             <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-blue-600"></div> PINNED</div>
             <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-slate-300"></div> UNRESOLVED</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MapModal;
