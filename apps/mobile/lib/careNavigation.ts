export type CareEntryPoint = 'inicio' | 'salud' | 'perfil';

export function groomingBackRoute(from?: string) {
  return from === 'inicio' ? '/(app)' : '/(app)/salud';
}

export function passportBackRoute(from?: string) {
  return from === 'perfil' ? '/(app)/perfil' : '/(app)/salud';
}
