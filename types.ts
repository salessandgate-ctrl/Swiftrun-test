
export type BookingStatus = 'Pending' | 'On Board' | 'Delivered';

export interface DeliveryBooking {
  id: string;
  pickupLocation: string;
  customerName: string;
  deliveryAddress: string;
  contact: string;
  cartons: number;
  salesOrder: string;
  purchaseOrder: string;
  deliveryInstructions?: string;
  status: BookingStatus;
  bookedAt?: string;
  deliveredAt?: string;
  sequence?: number;
  latitude?: number;
  longitude?: number;
}

export interface Customer {
  id: string;
  name: string;
  address: string;
  contact: string;
}

export interface RunSheetStats {
  totalDeliveries: number;
  deliveredCount: number;
  totalCartons: number;
}

export const PICKUP_PRESETS = [
  { id: 'SG', name: 'Sandgate (SG)', address: '58 Maitland Road, Sandgate NSW 2304' },
  { id: 'WB', name: 'Warners Bay (WB)', address: '391 Hillsborough Rd, Warners Bay NSW 2282' },
  { id: 'RF', name: 'Rutherford (RF)', address: 'Homemaker Centre, Building B/366 New England Hwy, Rutherford NSW 2320' },
];
