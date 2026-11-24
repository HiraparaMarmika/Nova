export type Coordinates = { latitude: number; longitude: number };

export function distanceKm(from: Coordinates, to: Coordinates) {
  const radians = (value: number) => value * Math.PI / 180;
  const earthRadiusKm = 6371;
  const deltaLatitude = radians(to.latitude - from.latitude);
  const deltaLongitude = radians(to.longitude - from.longitude);
  const a = Math.sin(deltaLatitude / 2) ** 2 + Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude)) * Math.sin(deltaLongitude / 2) ** 2;
  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function coversPostcode(input: { bookingPostcode: string; explicitPrefixes: string[]; basePostcode: string | null; radiusKm: number | null; bookingLocation?: Coordinates; baseLocation?: Coordinates }) {
  if (input.explicitPrefixes.some(prefix => input.bookingPostcode.startsWith(prefix))) return true;
  if (!input.basePostcode || !input.radiusKm || !input.bookingLocation || !input.baseLocation) return false;
  return distanceKm(input.baseLocation, input.bookingLocation) <= input.radiusKm;
}
