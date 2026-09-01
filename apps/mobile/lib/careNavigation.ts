export type CareEntryPoint = 'inicio' | 'salud' | 'perfil';

export function groomingBackRoute(from?: string) {
  return from === 'inicio' ? '/(app)' : '/(app)/salud';
}

export function passportBackRoute() {
  return '/(app)/perfil';
}
