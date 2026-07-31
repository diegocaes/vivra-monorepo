import { beforeAll, describe, expect, it } from 'vitest';
import {
  canAccess,
  evaluatePremium,
  FEATURE_GATES,
  MAX_PETS,
  type UserSubscription,
} from './premium';

/** Fecha ISO a N días de hoy (negativo = pasado). */
function daysFromNow(n: number): string {
  return new Date(Date.now() + n * 86400000).toISOString();
}

function sub(overrides: Partial<UserSubscription> = {}): UserSubscription {
  return {
    plan: 'premium',
    source: 'iap',
    premium_until: daysFromNow(30),
    trial_ends_at: null,
    ...overrides,
  };
}

beforeAll(() => {
  // evaluatePremium tiene un bypass FORCE_PREMIUM para desarrollo local. Si
  // estuviera activo, TODOS los tests pasarían por la razón equivocada.
  if (process.env.FORCE_PREMIUM === 'true') {
    throw new Error('FORCE_PREMIUM=true invalida estos tests — desactívalo antes de correrlos');
  }
});

describe('evaluatePremium', () => {
  it('sin suscripción → free', () => {
    const r = evaluatePremium(null);
    expect(r.isPremium).toBe(false);
    expect(r.plan).toBe('free');
    expect(r.daysLeft).toBe(0);
  });

  it('plan free → free aunque tenga premium_until', () => {
    expect(evaluatePremium(sub({ plan: 'free' })).isPremium).toBe(false);
  });

  it('premium sin fecha de vencimiento → free (dato incompleto, no regalamos acceso)', () => {
    expect(evaluatePremium(sub({ premium_until: null })).isPremium).toBe(false);
  });

  it('premium vigente → premium con los días correctos', () => {
    const r = evaluatePremium(sub({ premium_until: daysFromNow(30) }));
    expect(r.isPremium).toBe(true);
    expect(r.plan).toBe('premium');
    expect(r.daysLeft).toBeGreaterThanOrEqual(29);
    expect(r.daysLeft).toBeLessThanOrEqual(30);
  });

  // El bug caro: seguir dando premium a alguien que ya venció.
  it('premium vencido → free', () => {
    const r = evaluatePremium(sub({ premium_until: daysFromNow(-1) }));
    expect(r.isPremium).toBe(false);
    expect(r.plan).toBe('free');
    expect(r.daysLeft).toBe(0);
  });

  it('vencido hace meses → free', () => {
    expect(evaluatePremium(sub({ premium_until: daysFromNow(-90) })).isPremium).toBe(false);
  });

  it('marca isExpiringSoon solo a ≤3 días', () => {
    expect(evaluatePremium(sub({ premium_until: daysFromNow(2) })).isExpiringSoon).toBe(true);
    expect(evaluatePremium(sub({ premium_until: daysFromNow(10) })).isExpiringSoon).toBe(false);
  });

  // RevenueCat (iOS) y Paddle (web) escriben la MISMA tabla. Ambos deben dar
  // premium por igual — si una fuente dejara de contar, el usuario paga y no
  // recibe acceso.
  it.each(['iap', 'web', 'referral', 'promo', 'trial', 'shared'] as const)(
    'source "%s" vigente → premium',
    (source) => {
      const r = evaluatePremium(sub({ source, premium_until: daysFromNow(15) }));
      expect(r.isPremium).toBe(true);
      expect(r.source).toBe(source);
    },
  );

  it('isTrial solo cuando source=trial Y hay trial_ends_at', () => {
    expect(evaluatePremium(sub({ source: 'trial', trial_ends_at: daysFromNow(5) })).isTrial).toBe(true);
    expect(evaluatePremium(sub({ source: 'trial', trial_ends_at: null })).isTrial).toBe(false);
    expect(evaluatePremium(sub({ source: 'iap', trial_ends_at: daysFromNow(5) })).isTrial).toBe(false);
  });

  it('nunca devuelve daysLeft negativo', () => {
    expect(evaluatePremium(sub({ premium_until: daysFromNow(-500) })).daysLeft).toBe(0);
  });

  it('fecha inválida → free, no crashea', () => {
    expect(evaluatePremium(sub({ premium_until: 'no-es-una-fecha' })).isPremium).toBe(false);
  });
});

describe('canAccess', () => {
  const premium = evaluatePremium(sub({ premium_until: daysFromNow(30) }));
  const free = evaluatePremium(null);

  it('las features con gate requieren premium', () => {
    for (const feature of Object.keys(FEATURE_GATES) as (keyof typeof FEATURE_GATES)[]) {
      expect(canAccess(feature, premium)).toBe(true);
      expect(canAccess(feature, free)).toBe(false);
    }
  });

  it('un premium vencido pierde acceso a las features con gate', () => {
    const expirado = evaluatePremium(sub({ premium_until: daysFromNow(-1) }));
    expect(canAccess('coOwnerSharing', expirado)).toBe(false);
    expect(canAccess('costAnalysis', expirado)).toBe(false);
  });

  it('los gates activos son los tres del modelo 2026-07', () => {
    // Si esto falla es porque alguien cambió qué se cobra: revisar a propósito.
    expect(Object.keys(FEATURE_GATES).sort()).toEqual(
      ['coOwnerSharing', 'costAnalysis', 'themeColors'].sort(),
    );
  });
});

describe('MAX_PETS', () => {
  it('el tope anti-abuso sigue en 10', () => {
    expect(MAX_PETS).toBe(10);
  });
});
