import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request, cookies, redirect, locals }) => {
  const { user, supabase } = locals;

  if (!user) return redirect('/login');

  const formData = await request.formData();
  const petId = formData.get('pet_id') as string;

  if (!petId) return redirect('/dashboard');

  // One authorization rule for owned and shared pets. The database function
  // is also used by RLS, so a co-owner can select a shared pet while an id
  // outside their accessible list is still rejected.
  const { data: canAccess, error } = await supabase.rpc('user_can_access_pet', {
    p_pet_id: petId,
  });

  if (error || !canAccess) {
    if (error) console.warn('[pets/switch] access check failed:', error.message);
    return redirect('/dashboard');
  }

  // Set active pet cookie — 1 year, HttpOnly, SameSite=Lax
  cookies.set('active_pet_id', petId, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
    secure: import.meta.env.PROD,
  });

  // Always go to dashboard when switching pets
  return redirect('/dashboard');
};
