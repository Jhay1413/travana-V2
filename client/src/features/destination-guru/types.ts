import type { DestinationGuruData } from "./components/destination-guru";

// A single pinnable destination on the globe. Items with a null lat/lng are
// simply not rendered as pins (e.g. destinations awaiting geocoding).
export interface GuruDestinationItem {
  key: string;
  id?: string;
  destination: string;
  country: string;
  data: DestinationGuruData;
  lat: number | null;
  lng: number | null;
  fromDb: boolean;
}
