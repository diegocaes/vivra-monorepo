export type CareEntryPoint = 'inicio' | 'salud' | 'perfil' | 'cuidado';

export function groomingBackRoute(from?: string) {
  return from === 'inicio' ? '/(app)' : '/(app)/cuidado';
}

export function passportBackRoute() {
  return '/(app)/viajes' as const;
}
