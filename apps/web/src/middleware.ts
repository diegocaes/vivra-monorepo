import { defineMiddleware } from 'astro:middleware';
import { createSupabaseClient } from './lib/supabase';

const PUBLIC_ROUTES = ['/', '/login', '/register', '/forgot-password', '/api/auth/callback', '/privacy', '/terms'];

function withUtf8(response: Response): Response {
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('text/html') && !contentType.includes('charset')) {
    response.headers.set('content-type', 'text/html; charset=utf-8');
  }
  return response;
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  // Allow public routes (exact match for '/', prefix match for others)
  if (PUBLIC_ROUTES.some((route) => route === '/' ? pathname === '/' : pathname === route || pathname.startsWith(route + '/'))) {
    return withUtf8(await next());
  }

  // Allow static assets and PWA files
  if (
    pathname.startsWith('/_') ||
    pathname.startsWith('/icons/') ||
    pathname === '/manifest.json' ||
    pathname === '/sw.js'
  ) {
    return next();
  }

  const supabase = createSupabaseClient(context.request, context.cookies);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return context.redirect('/login');
  }

  // Store user, supabase client, and active pet id in locals for downstream use
  context.locals.user = user;
  context.locals.supabase = supabase;
  context.locals.activePetId = context.cookies.get('active_pet_id')?.value ?? null;

  return withUtf8(await next());
});
