import type { APIRoute } from 'astro';
import { createSupabaseClient, createSupabaseAdminClient } from '../../../lib/supabase';

export const GET: APIRoute = async ({ request, cookies, redirect }) => {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type');
  // Custom param we append to redirectTo so we know where to send the user after auth
  const next = url.searchParams.get('next');

  const supabase = createSupabaseClient(request, cookies);

  if (tokenHash && type) {
    // Email OTP flow (signup confirmation, recovery, magiclink)
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as 'signup' | 'recovery' | 'email' | 'magiclink' });
    if (error) {
      return redirect('/login?error=link_expired');
    }
    // Password recovery: session is now active, send to update-password
    if (type === 'recovery' || next === 'update-password') {
      return redirect('/update-password');
    }
  } else if (code) {
    // PKCE flow: OAuth (Google) or email recovery via PKCE
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return redirect('/login?error=auth_failed');
    }
    // If our custom next param is present, use it
    if (next === 'update-password') {
      return redirect('/update-password');
    }
  } else {
    return redirect('/login?error=no_code');
  }

  // Route new users (no pet yet) to onboarding, set active_pet_id cookie for returning users
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    // Process pending referral code (from registration)
    const pendingRef = cookies.get('pending_referral')?.value;
    if (pendingRef) {
      try {
        const admin = createSupabaseAdminClient();
        // Find the referral code and its owner
        const { data: refCode } = await admin
          .from('referral_codes')
          .select('user_id, code')
          .eq('code', pendingRef)
          .maybeSingle();

        if (refCode && refCode.user_id !== user.id) {
          // Check if this user wasn't already referred
          const { data: existingRef } = await admin
            .from('referrals')
            .select('id')
            .eq('referred_id', user.id)
            .maybeSingle();

          if (!existingRef) {
            // Create pending referral (completed after pet creation in onboarding)
            await admin.from('referrals').insert({
              referrer_id: refCode.user_id,
              referred_id: user.id,
              code: refCode.code,
              status: 'pending',
            });
          }
        }
      } catch {
        // Silently ignore if referral tables don't exist yet
      }
      // Clear the cookie
      cookies.delete('pending_referral', { path: '/' });
    }

    const { data: pets } = await supabase
      .from('pets')
      .select('id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    if (!pets?.length) {
      return redirect('/onboarding');
    }

    // Set the first pet as active if no cookie exists yet
    if (!cookies.get('active_pet_id')?.value) {
      cookies.set('active_pet_id', pets[0].id, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 365,
        secure: import.meta.env.PROD,
      });
    }
  }

  return redirect('/dashboard');
};
