# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

| Task | Command |
|---|---|
| Start dev server | `npx expo start` |
| Start with iOS simulator | `npx expo start --ios` |
| Production build (iOS) | `npx eas build --platform ios --profile production` |
| Submit to TestFlight | `npx eas submit --platform ios --profile production` |
| OTA update (JS-only changes) | `npx eas update --branch production --message "description"` |
| List past builds | `npx eas build:list` |

There is no test runner or lint script configured in this project.

## Architecture

**Vivra** is a React Native pet health management app (iOS-first) built with Expo SDK 55 and file-based routing via Expo Router.

### Routing and Authentication Flow

The root layout ([app/_layout.tsx](app/_layout.tsx)) drives the auth routing decision:
1. No session → `/(auth)/login`
2. Session + no pets → `/onboarding`
3. Session + pets → `/(app)` (main app)

The `(auth)/` group contains login/register/forgot-password screens. The `(app)/` group is the authenticated tab-based interface.

### Main Tabs (`app/(app)/`)

| Tab | File | Feature |
|---|---|---|
| Home | `index.tsx` | Dashboard with vitality score, reminders, food progress |
| Health | `salud/` | Nested routes: vaccines, weight, grooming, preventive, vet history |
| Nutrition | `alimentacion.tsx` | Food brand, portions, bag tracking |
| Travel | `viajes.tsx` | Flight info, travel documents, checklist |
| Profile | `perfil.tsx` | Account settings, pet editing, subscription |

### State Management

- **PetContext** (`contexts/PetContext.tsx`) — wraps authenticated app, provides the active pet and all related data (vaccines, weight records, foods, vet visits, groomings, activity logs, preventive treatments). Use `usePet()` hook to consume.
- **useAuth** (`hooks/useAuth.ts`) — Supabase session and signOut.
- **useSubscription** (`hooks/useSubscription.ts`) — RevenueCat IAP integration, tracks premium status.

### Key Libraries

- **Backend:** Supabase (auth + PostgreSQL). Client initialized in `lib/supabase.ts`. Types auto-generated in `types/supabase.ts`.
- **In-app purchases:** RevenueCat (`react-native-purchases`). Keys in `constants/revenueCat.ts`.
- **Navigation:** Expo Router (file-based, segment groups for layout isolation).
- **Animations:** React Native Reanimated 4.

### Vivra Vitality Score

The proprietary health scoring engine lives in `lib/vitality-score.ts`. It calculates a 0-100 score across 5 pillars (20 pts each): body weight (WSAVA BCS), preventive care, breed+age, activity/wellbeing, and nutrition. Requires a minimum data threshold before a score is shown. This is core product logic — handle changes carefully.

### Theme and Conventions

- Centralized theme in `constants/theme.ts` (Colors, Spacing, FontSize, FontWeight, Radius). Primary accent: `#F97316` (orange).
- UI labels are in Spanish (the app is Spanish-language). Code and comments are in English.
- Path alias `@/` maps to the project root (configured in `tsconfig.json`).

### Build and Deploy Rules

- **Never edit the `ios/` folder manually** — it is managed by EAS.
- Only native changes (new native library, permissions, Expo SDK upgrade, `app.json` changes) require a full `eas build`. JS/UI/logic changes can use `eas update` (OTA).
- Bump `version` in `app.json` before each production build. EAS auto-increments the internal build number.
