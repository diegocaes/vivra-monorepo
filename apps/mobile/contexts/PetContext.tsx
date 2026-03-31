import { createContext, useContext } from 'react';
import { usePet, type PetData } from '../hooks/usePet';

const PetContext = createContext<PetData | null>(null);

export function PetProvider({ children }: { children: React.ReactNode }) {
  const petData = usePet();
  return <PetContext.Provider value={petData}>{children}</PetContext.Provider>;
}

export function usePetContext(): PetData {
  const ctx = useContext(PetContext);
  if (!ctx) throw new Error('usePetContext must be used within PetProvider');
  return ctx;
}
