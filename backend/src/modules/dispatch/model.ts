export interface DriverProfile {
  id: string;
  name: string;
  vehicle: string;
  seats: number;
}
export interface DispatchRequest {
  id: string;
  kind: 'circle' | 'planned';
  status: string;
  riderName: string;
  pickup: string;
  destination: string;
  pickupPoint?: { latitude: number; longitude: number; label: string };
  destinationPoint?: { latitude: number; longitude: number; label: string };
  seats: number;
  fare: number;
  payout: number;
  departure?: string;
  departureId?: string;
  boardingVerified?: boolean;
  requestedUntil?: number;
  tripId?: string;
  preview: true;
  updatedAt?: string;
}
