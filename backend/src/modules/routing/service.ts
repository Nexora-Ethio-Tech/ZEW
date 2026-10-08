export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface RouteMatrixResult {
  haversineDistanceKm: number;
  roadDistanceKm: number;
  etaMinutes: number;
  detourFactor: number;
  routeSummary: string;
  isDirectCorridor: boolean;
  provider: 'osrm_live' | 'addis_road_matrix_fallback';
}

export function haversineKm(start: Coordinates, end: Coordinates): number {
  const R = 6371; // Earth radius in km
  const dLat = ((end.latitude - start.latitude) * Math.PI) / 180;
  const dLng = ((end.longitude - start.longitude) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((start.latitude * Math.PI) / 180) *
      Math.cos((end.latitude * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
}

export async function calculateRoadRoute(
  origin: Coordinates,
  destination: Coordinates,
  osrmUrl?: string,
): Promise<RouteMatrixResult> {
  const directKm = haversineKm(origin, destination);

  // If OSRM URL is set, try fetching live road geometry
  if (osrmUrl) {
    try {
      const url = `${osrmUrl}/route/v1/driving/${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}?overview=false`;
      const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        const data = (await res.json()) as any;
        if (data.routes?.[0]) {
          const route = data.routes[0];
          const roadDistanceKm = Math.round((route.distance / 1000) * 100) / 100;
          const etaMinutes = Math.max(1, Math.round(route.duration / 60));
          return {
            haversineDistanceKm: directKm,
            roadDistanceKm,
            etaMinutes,
            detourFactor: Math.round((roadDistanceKm / Math.max(0.1, directKm)) * 100) / 100,
            routeSummary: 'Road route from OSRM',
            isDirectCorridor: true,
            provider: 'osrm_live',
          };
        }
      }
    } catch {
      // Fallback gracefully if OSRM is unreachable
    }
  }

  // Addis Ababa urban corridor road matrix model (1.32x - 1.38x winding detour factor, 28 km/h avg speed)
  const detourFactor = 1.35;
  const roadDistanceKm = Math.round(directKm * detourFactor * 100) / 100;
  const avgSpeedKmH = 28;
  const etaMinutes = Math.max(2, Math.round((roadDistanceKm / avgSpeedKmH) * 60));

  // Determine localized corridor label based on coordinates
  let routeSummary = 'Via Addis Urban Corridor';
  if (origin.longitude > 38.77 && destination.longitude < 38.77) {
    routeSummary = 'Via Bole Road & Meskel Square Interchange';
  } else if (origin.longitude > 38.8 && destination.longitude < 38.77) {
    routeSummary = 'Via CMC Road & Megenagna Expressway';
  }

  return {
    haversineDistanceKm: directKm,
    roadDistanceKm,
    etaMinutes,
    detourFactor,
    routeSummary,
    isDirectCorridor: directKm <= 20,
    provider: 'addis_road_matrix_fallback',
  };
}
