// Hardcoded coordinates for known cities in the Veerapathra fleet network.
// [lat, lng] — all South India locations.

export const CITY_COORDS: Record<string, [number, number]> = {
  // Tamil Nadu
  Memisal: [10.65, 79.35],
  Kanchipuram: [12.83, 79.7],
  Sirkali: [11.24, 79.74],
  Thiruvarur: [10.77, 79.64],
  Pattukottai: [10.42, 79.32],
  Thondi: [9.74, 79.01],
  Thavanikarai: [9.55, 78.5],
  Rajapalayam: [9.45, 77.55],
  Mannachanallur: [10.78, 78.83],
  Kangeyam: [10.56, 77.56],
  "Kangayam area": [10.56, 77.56],
  Perundurai: [11.28, 77.59],
  Kumbakonam: [10.96, 79.39],
  Sangarankovil: [9.24, 77.53],
  Idappadi: [11.59, 77.84],
  Devakottai: [10.16, 78.95],
  Tiruchirappalli: [10.79, 78.69],
  Dharapuram: [10.73, 77.53],
  Ponnachi: [10.55, 77.48],
  "Velankanni area": [10.68, 79.84],
  "Madurai area": [9.92, 78.12],
  "Madurai Kovil": [9.92, 78.12],
  Muruvathur: [12.05, 79.75],
  Vijayamangalam: [11.11, 77.89],
  Kaladi: [10.17, 76.44],
  Madathukulam: [10.52, 77.35],
  Varannatchi: [10.48, 78.45],
  "Thondaipadi area": [12.0, 79.05],
  Amaindhipparandalayam: [10.4, 79.1],
  Isainarduppu: [9.5, 78.5],
  Vayalur: [10.5, 79.2],
  Orathanadu: [10.63, 79.32],
  Panankudi: [8.28, 77.58],
  Nagercoil: [8.18, 77.43],
  Ullikottai: [10.55, 79.33], // Home base area

  // Kerala
  Kochin: [9.93, 76.26],

  // Andhra Pradesh
  Nellore: [14.44, 79.97],
  "Ongole area": [15.5, 80.05],
  "Andhra Pradesh": [15.5, 80.05],

  // Kerala
  Thiruvananthapuram: [8.52, 76.94],
};

// Fuzzy match: try exact, then lowercase, then partial
export function getCoords(city: string): [number, number] | null {
  if (!city || city.startsWith("(")) return null;
  const exact = CITY_COORDS[city];
  if (exact) return exact;
  const lower = city.toLowerCase();
  for (const [k, v] of Object.entries(CITY_COORDS)) {
    if (k.toLowerCase() === lower) return v;
    if (lower.includes(k.toLowerCase()) || k.toLowerCase().includes(lower))
      return v;
  }
  return null;
}

// Home base (Thanjavur / Ullikottai area)
export const HOME_BASE: [number, number] = [10.55, 79.33];
