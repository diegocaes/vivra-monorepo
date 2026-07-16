// Vaccine badges — each core vaccine has its own PNG badge art, shown in the
// vaccine screens (mobile and web) next to the registered records.
// The old engagement/achievement badge system was removed from the product.

export const VACCINE_BADGES: { keyword: string; id: string; name: string; img: string }[] = [
  { keyword: 'rabia',      id: 'vac-rabia',      name: 'Rabia',         img: 'vacunas/rabia.png' },
  { keyword: 'parvo',      id: 'vac-parvo',      name: 'Parvovirus',    img: 'vacunas/parvo.png' },
  { keyword: 'moquillo',   id: 'vac-moquillo',   name: 'Moquillo',      img: 'vacunas/moquillo.png' },
  { keyword: 'bordetella', id: 'vac-bordetella', name: 'Bordetella',    img: 'vacunas/bordetella.png' },
  { keyword: 'lepto',      id: 'vac-lepto',      name: 'Leptospirosis', img: 'vacunas/lepto.png' },
  { keyword: 'hepatitis',  id: 'vac-hepatitis',  name: 'Hepatitis',     img: 'vacunas/hepatitis.png' },
];
