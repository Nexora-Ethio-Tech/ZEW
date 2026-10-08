// A coarse service-area bound. Place search also requires the provider's Ethiopia country tag.
export const ETHIOPIA_BOUNDS = {
  minLatitude: 3.3,
  maxLatitude: 15,
  minLongitude: 32.9,
  maxLongitude: 48,
} as const;

export function withinEthiopiaBounds(place: { latitude: number; longitude: number }) {
  return (
    place.latitude >= ETHIOPIA_BOUNDS.minLatitude &&
    place.latitude <= ETHIOPIA_BOUNDS.maxLatitude &&
    place.longitude >= ETHIOPIA_BOUNDS.minLongitude &&
    place.longitude <= ETHIOPIA_BOUNDS.maxLongitude
  );
}
