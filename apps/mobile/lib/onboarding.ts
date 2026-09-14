import { DOG_BREEDS, parseNumericField } from '@vivra/shared';

export type OnboardingStep = 'species' | 'name' | 'breed' | 'gender' | 'birthDate' | 'weight' | 'photo';

export function onboardingSteps(species: 'dog' | 'cat' | null): OnboardingStep[] {
  return ['species', 'name', ...(species === 'cat' ? [] : ['breed'] as const), 'gender', 'birthDate', 'weight', 'photo'];
}

const breedLabels: Record<string, string> = {
  'Australian Shepherd': 'Pastor australiano', 'Dachshund': 'Teckel (salchicha)',
  'French Bulldog': 'Bulldog francés', 'German Shepherd': 'Pastor alemán',
  'Great Dane': 'Gran danés', 'Maltese': 'Maltés', 'Poodle': 'Caniche (poodle)',
  'Mixed / Rescue': 'Mestizo', 'Other': 'Otra raza',
};

// Keep stored values compatible with existing breed-specific features.
export const onboardingBreeds = DOG_BREEDS.map(value => ({ value, label: breedLabels[value] || value }))
  .sort((a, b) => a.value === 'Mixed / Rescue' ? -1 : b.value === 'Mixed / Rescue' ? 1 : a.label.localeCompare(b.label, 'es'));

interface OnboardingDraft {
  name: string;
  species: 'dog' | 'cat' | null;
  birthDate: string;
  weightKg: string;
}

export function validateOnboarding(draft: OnboardingDraft, step?: OnboardingStep, now = new Date()) {
  const weightText = draft.weightKg.trim().replace(',', '.');
  const weight = /^\d+(?:\.\d+)?$/.test(weightText) ? parseNumericField(weightText, { min: 0.1, max: 150 }) : null;
  let error = '';
  if ((!step || step === 'species') && !draft.species) error = 'Elige perro o gato para continuar.';
  if ((!step || step === 'name') && !draft.name.trim()) error = 'Escribe el nombre de tu mascota.';
  if ((!step || step === 'weight') && weightText && weight === null) error = 'Escribe un peso entre 0,1 y 150 kg, o agrégalo después.';
  if ((!step || step === 'birthDate') && draft.birthDate) {
    const [year, month, day] = draft.birthDate.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.birthDate) || date.getFullYear() !== year
      || date.getMonth() !== month - 1 || date.getDate() !== day || date > today) {
      error = 'Elige una fecha de nacimiento válida, hasta hoy.';
    }
  }
  return { error, weight };
}
