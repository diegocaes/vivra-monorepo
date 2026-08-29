import type { APIRoute } from 'astro';
import { createSupabaseClient, createSupabaseAdminClient } from '../../../lib/supabase';

export const GET: APIRoute = async ({ request, cookies, redirect }) => {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type');
  const accessToken = url.searchParams.get('access_token');
  const refreshToken = url.searchParams.get('refresh_token');
  // Custom param we append to redirectTo so we know where to send the user after auth
  const next = url.searchParams.get('next');

  const supabase = createSupabaseClient(request, cookies);

  if (tokenHash && type) {
    // Email OTP flow (signup confirmation, recovery, magiclink)
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as 'signup' | 'recovery' | 'email' | 'magiclink' });
    if (error) {
      return redirect('/login?error=link_expired');
    }
    if (type === 'recovery' || next === 'update-password') {
      return redirect('/update-password');
    }
  } else if (accessToken) {
    // Implicit flow: access_token + refresh_token forwarded from /auth/confirm
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken || '',
    });
    if (error) {
      return redirect('/login?error=link_expired');
    }
    if (type === 'recovery' || next === 'update-password') {
      return redirect('/update-password');
    }
  } else if (code) {
    // PKCE flow: OAuth (Google) or email recovery via PKCE
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return redirect('/login?error=auth_failed');
    }
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
    // Note: actual reward granting happens atomically in onboarding via the
    // redeem_referral RPC. Here we just create a pending row that survives
    // the email-confirm roundtrip so the user doesn't need to re-enter the code.
    // Email confirmation may be opened on another browser/device, where the
    // signup cookie does not exist. The validated code is also stored in user
    // metadata so attribution survives that normal journey.
    const metadataPendingRef = typeof user.user_metadata?.pending_referral === 'string'
      ? user.user_metadata.pending_referral.trim().toUpperCase()
      : '';
    const pendingRef = cookies.get('pending_referral')?.value || metadataPendingRef;
    if (pendingRef) {
      let referralHandled = false;
      try {
        const admin = createSupabaseAdminClient();
        const { data: refCode } = await admin
          .from('referral_codes')
          .select('user_id, code')
          .eq('code', pendingRef)
          .maybeSingle();

        // BLOCK self-referral at the earliest point we can check
        if (refCode && refCode.user_id !== user.id) {
          const { data: existingRef } = await admin
            .from('referrals')
            .select('id, status')
            .eq('referred_id', user.id)
            .maybeSingle();

          // Only insert if no previous referral exists for this user
          if (!existingRef) {
            const { error: insErr } = await admin.from('referrals').insert({
              referrer_id: refCode.user_id,
              referred_id: user.id,
              code: refCode.code,
              status: 'pending',
            });
            if (insErr) console.warn('[auth/callback] referral insert failed:', insErr.message);
            referralHandled = !insErr;
          } else {
            referralHandled = true;
          }
        } else {
          // Invalid and self-referral are terminal; there is nothing useful to
          // retry on onboarding.
          referralHandled = true;
        }
      } catch (e) {
        console.warn('[auth/callback] referral processing error:', e);
      }
      if (referralHandled) {
        cookies.delete('pending_referral', { path: '/' });
        if (metadataPendingRef) {
          await supabase.auth.updateUser({ data: { pending_referral: null } });
        }
      }
    }

    // Process pending share invite (from /invite/[token] page)
    const pendingShareInvite = cookies.get('pending_share_invite')?.value;
    if (pendingShareInvite) {
      try {
        const admin = createSupabaseAdminClient();
        const { data: invite } = await admin
          .from('pet_share_invites')
          .select('id, pet_id, inviter_id, status, expires_at')
          .eq('token', pendingShareInvite)
          .eq('status', 'pending')
          .maybeSingle();

        if (invite && invite.inviter_id !== user.id && new Date(invite.expires_at) > new Date()) {
          // Check not already shared
          const { data: existingShare } = await admin
            .from('pet_shares')
            .select('id')
            .eq('pet_id', invite.pet_id)
            .eq('shared_with', user.id)
            .maybeSingle();

          if (!existingShare) {
            // Get the pet's owner
            const { data: pet } = await admin
              .from('pets')
              .select('user_id')
              .eq('id', invite.pet_id)
              .single();

            if (pet) {
              const userName = user.user_metadata?.full_name || user.user_metadata?.name || null;
              await admin.from('pet_shares').insert({
                pet_id: invite.pet_id,
                owner_id: pet.user_id,
                shared_with: user.id,
                shared_with_email: user.email || null,
                shared_with_name: userName,
              });
              await admin
                .from('pet_share_invites')
                .update({ status: 'accepted', accepted_by: user.id })
                .eq('id', invite.id);

              // Set the shared pet as active
              cookies.set('active_pet_id', invite.pet_id, {
                path: '/',
                httpOnly: true,
                sameSite: 'lax',
                maxAge: 60 * 60 * 24 * 365,
                secure: import.meta.env.PROD,
              });

              // Mark that this user joined via invite. Stores the pet_id so
              // the dashboard can render a personalized welcome banner with
              // the pet name + owner name + App Store CTA.
              cookies.set('incoming_share', invite.pet_id, {
                path: '/',
                httpOnly: true, // consumed server-side only (dashboard.astro)
                sameSite: 'lax',
                maxAge: 60 * 60 * 24 * 7, // 7 days
                secure: import.meta.env.PROD,
              });
            }
          }
        }
      } catch {
        // Silently ignore share invite errors
      }
      cookies.delete('pending_share_invite', { path: '/' });
    }

    // Check owned + shared pets
    const [petsRes, sharesRes] = await Promise.all([
      supabase.from('pets').select('id').eq('user_id', user.id).order('created_at', { ascending: true }),
      supabase.from('pet_shares').select('pet_id').eq('shared_with', user.id).limit(1),
    ]);

    const pets = petsRes.data;
    const hasShared = (sharesRes.data?.length ?? 0) > 0;

    if (!pets?.length && !hasShared) {
      return redirect('/onboarding');
    }

    // Set the first pet as active if no cookie exists yet
    if (!cookies.get('active_pet_id')?.value && pets?.[0]) {
      cookies.set('active_pet_id', pets[0].id, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 365,
        secure: import.meta.env.PROD,
      });
    }
  }

  // Venía a comprar Premium: lo mandamos al checkout, no al dashboard.
  // (Si aún no tiene mascota, arriba ya salió hacia /onboarding y la cookie
  //  sigue viva para que onboarding haga este mismo salto al terminar.)
  if (cookies.get('pending_next')?.value === 'premium') {
    cookies.delete('pending_next', { path: '/' });
    return redirect('/premium');
  }

  return redirect('/dashboard');
};
