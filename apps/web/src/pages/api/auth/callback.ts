import type { APIRoute } from 'astro';
import { createSupabaseClient, createSupabaseAdminClient } from '../../../lib/supabase';
import { parsePetShareInviteResult, resolveActivePet } from '@vivra/shared';

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
      let clearPendingInvite = false;
      try {
        // Use the same authenticated, atomic database operation as mobile.
        // This prevents a partial state where the share exists but the invite
        // was not marked accepted (or the inverse).
        const { data, error } = await supabase.rpc('accept_pet_share_invite', {
          p_token: pendingShareInvite,
        });
        const result = parsePetShareInviteResult(data);

        if (error) {
          console.warn('[auth/callback] share invite RPC failed:', error.message);
        } else if (result.ok) {
          clearPendingInvite = true;
          cookies.set('active_pet_id', result.petId, {
            path: '/',
            httpOnly: true,
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 365,
            secure: import.meta.env.PROD,
          });
          cookies.set('incoming_share', result.petId, {
            path: '/',
            httpOnly: true,
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 7,
            secure: import.meta.env.PROD,
          });
        } else {
          // These outcomes cannot improve on retry. Transient/unknown failures
          // keep the cookie so a later login can safely try again.
          clearPendingInvite = [
            'not_found',
            'already_used',
            'expired',
            'self_invite',
            'pet_not_found',
          ].includes(result.error);
        }
      } catch (inviteError) {
        console.warn('[auth/callback] share invite processing error:', inviteError);
      }
      if (clearPendingInvite) {
        cookies.delete('pending_share_invite', { path: '/' });
      }
    }

    // Check owned + shared pets
    const [petsRes, sharesRes] = await Promise.all([
      supabase.from('pets').select('id').eq('user_id', user.id).order('created_at', { ascending: true }),
      supabase.from('pet_shares').select('pet_id').eq('shared_with', user.id),
    ]);

    if (petsRes.error || sharesRes.error) {
      // A temporary lookup error must never send an existing user through
      // onboarding or overwrite their current selection.
      console.warn(
        '[auth/callback] accessible pets lookup failed:',
        petsRes.error?.message || sharesRes.error?.message,
      );
    } else {
      const accessiblePets = [
        ...(petsRes.data ?? []),
        ...(sharesRes.data ?? []).map((share) => ({ id: share.pet_id })),
      ];

      if (accessiblePets.length === 0) {
        return redirect('/onboarding');
      }

      const currentPetId = cookies.get('active_pet_id')?.value;
      const resolvedPet = resolveActivePet(accessiblePets, currentPetId);
      if (resolvedPet && resolvedPet.id !== currentPetId) {
        cookies.set('active_pet_id', resolvedPet.id, {
          path: '/',
          httpOnly: true,
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 365,
          secure: import.meta.env.PROD,
        });
      }
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
