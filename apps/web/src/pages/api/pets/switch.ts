import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request, cookies, redirect, locals }) => {
  const { user, supabase } = locals;

  if (!user) return redirect('/login');

  const formData = await request.formData();
  const petId = formData.get('pet_id') as string;

  if (!petId) return redirect('/dashboard');

  // Verify the pet belongs to this user (RLS also enforces this, but explicit check is cleaner)
  const { data: pet } = await supabase
    .from('pets')
    .select('id')
    .eq('id', petId)
    .eq('user_id', user.id)
    .single();

  if (!pet) return redirect('/dashboard');

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
