// MOCK DATA FALLBACK: only used when VITE_SUPABASE_* env vars are missing.
const base = [
  ['Flooded road near market', 'Flooding', 'Port Louis', -20.1609, 57.5012],
  ['Car collision on motorway', 'Accident', 'Quatre Bornes', -20.2655, 57.4797],
  ['Fire in sugar cane field', 'Fire', 'Triolet', -20.0572, 57.5486],
  ['Fallen tree blocking road', 'Falling debris', 'Curepipe', -20.3181, 57.5237],
  ['Overflowing drain', 'Flooding', 'Rose Hill', -20.2328, 57.4704],
  ['Truck overturned', 'Accident', 'Grand Baie', -20.0113, 57.5811],
  ['Loose roof sheets', 'Falling debris', 'Mahébourg', -20.4081, 57.7],
  ['Bush fire near houses', 'Fire', 'Flic en Flac', -20.2757, 57.3639],
  ['Water across both lanes', 'Flooding', 'Port Louis', -20.1654, 57.5075],
  ['Motorbike accident', 'Accident', 'Moka', -20.2236, 57.5058],
  ['Collapsed wall', 'Falling debris', 'Vacoas-Phoenix', -20.2981, 57.4783],
  ['Flooded underpass', 'Flooding', 'Beau Bassin', -20.2299, 57.4673],
];
const statuses = ['pending', 'pending', 'approved', 'approved', 'approved', 'rejected'];
export const makeMock = () =>
  base.map(([title, category, location_name, latitude, longitude], i) => ({
    id: `mock-${i + 1}`, title, category, location_name, latitude, longitude,
    description: `${title}. Reported by a member of the public near ${location_name}.`,
    image_url: null, status: statuses[i % statuses.length],
    created_at: new Date(Date.now() - i * 20 * 3600e3).toISOString(),
  }));
