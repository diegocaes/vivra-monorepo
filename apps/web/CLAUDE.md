# Vivra

App móvil-first para registrar la vida de una mascota (perro). Stack: Astro 5 SSR + Supabase + Tailwind CSS v4 + React islands. Deploy en Vercel.

## Stack
- **Astro 5** con `output: 'server'` y adapter Vercel
- **Supabase** para auth (email + Google OAuth) y base de datos
- **Tailwind CSS v4** — usar `bg-linear-to-*` (NO `bg-gradient-to-*`), NO `arbitrary values` como `w-[420px]` (usar escala: `w-105`)
- **React** solo para componentes interactivos con datos (ej. WeightChart)

## Colores del tema (global.css @theme)
- `canvas` #F7F8FA · `sidebar` #13161C · `card` #FFFFFF · `card-border` #EAECF0
- `accent` #F97316 · `accent-dark` #EA580C · `accent-light` #FFF7ED · `ink` #0F1117 · `muted` #6B7280

## Estructura clave
- `src/pages/` — rutas SSR. Rutas públicas: `/`, `/login`, `/api/auth/callback`
- `src/middleware.ts` — auth guard, inyecta `supabase` y `user` en `Astro.locals`
- `src/components/Sidebar.astro` — nav principal (reemplazó Navbar)
- `src/layouts/MainLayout.astro` — layout con sidebar, `lg:ml-55`, `bg-canvas`
- `src/lib/vaccine-badges.ts` — mapa de vacunas → imagen PNG en `/public/badges/`
- `public/badges/` — imágenes PNG de badges de vacunas (rabia.png, parvo.png, etc.)

## Base de datos (tablas principales)
`pets` · `vaccines` · `vet_visits` · `weight_records` · `groomings` · `adventures` · `flights`

La tabla `pets` tiene columnas `color` (TEXT, pelaje) y `theme_color` (TEXT, tema visual):
```sql
ALTER TABLE pets ADD COLUMN IF NOT EXISTS color TEXT;
ALTER TABLE pets ADD COLUMN IF NOT EXISTS theme_color TEXT;
```

### Temas de color por mascota
El usuario elige su color de tema en `/perfil`. Se guarda en `pets.theme_color` (orange|rose|purple|blue|teal|amber).
`MainLayout.astro` pone `data-pet-theme={pet.theme_color}` en el body → CSS en `global.css` aplica las variables `--color-accent`.

## Funciones principales
- Dashboard con hero card vibrante (usa `var(--color-accent)`), resto white cards con bordes `border-card-border`
- Vacunas con badge gallery (imágenes PNG) + contador de dosis `×N`
- Pasaporte imprimible en `/print` con layout tipo documento oficial + franja MRZ
- Landing pública en `/` con hero, features, passport preview y CTA
