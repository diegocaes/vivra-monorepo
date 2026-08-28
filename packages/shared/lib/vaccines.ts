export type VaccineSpecies = 'dog' | 'cat';

export interface VaccineOption {
  key: string;
  label: string;
}

// These are familiar vaccine *types*, not medical schedules or product
// recommendations. The veterinarian, product label and local rules determine
// whether a dose is appropriate and when its next application is due.
const DOG_VACCINE_OPTIONS: VaccineOption[] = [
  { key: 'Rabia', label: 'Rabia' },
  { key: 'Múltiple canina (DHPP/DAPP)', label: 'Múltiple canina (DHPP/DAPP)' },
  { key: 'Leptospirosis', label: 'Leptospirosis' },
  { key: 'Bordetella', label: 'Bordetella' },
  { key: 'Influenza canina', label: 'Influenza canina' },
  { key: 'Lyme', label: 'Lyme' },
  { key: 'Otra', label: 'Otra / escrita en el carné' },
];

const CAT_VACCINE_OPTIONS: VaccineOption[] = [
  { key: 'Rabia', label: 'Rabia' },
  { key: 'Triple felina (FVRCP)', label: 'Triple felina (FVRCP)' },
  { key: 'Leucemia felina (FeLV)', label: 'Leucemia felina (FeLV)' },
  { key: 'Chlamydia felina', label: 'Chlamydia felina' },
  { key: 'Bordetella felina', label: 'Bordetella felina' },
  { key: 'Otra', label: 'Otra / escrita en el carné' },
];

export function vaccineOptionsForSpecies(species: VaccineSpecies | null | undefined): VaccineOption[] {
  return species === 'cat' ? CAT_VACCINE_OPTIONS : DOG_VACCINE_OPTIONS;
}

