import { View, Text, StyleSheet, Share, Alert, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, FontWeight, Radius } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { usePetContext } from '../../contexts/PetContext';
import { BottomSheet } from '../ui/BottomSheet';
import { Button } from '../ui/Button';

interface SharePetSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function SharePetSheet({ visible, onClose }: SharePetSheetProps) {
  const { user } = useAuth();
  const { pet, coOwners, isOwner, refresh } = usePetContext();
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [revoking, setRevoking] = useState(false);

  // Fetch existing pending invite on open
  useEffect(() => {
    if (!visible || !pet || !user) return;
    setLoading(true);
    supabase
      .from('pet_share_invites')
      .select('token, status, expires_at')
      .eq('pet_id', pet.id)
      .eq('inviter_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data }) => {
        const invite = data?.[0];
        if (invite && new Date(invite.expires_at) > new Date()) {
          setInviteToken(invite.token);
        } else {
          setInviteToken(null);
        }
        setLoading(false);
      });
  }, [visible, pet?.id]);

  const generateInvite = async () => {
    if (!pet || !user) return;
    setLoading(true);

    // Revoke any existing pending invites for this pet
    await supabase
      .from('pet_share_invites')
      .update({ status: 'revoked' })
      .eq('pet_id', pet.id)
      .eq('inviter_id', user.id)
      .eq('status', 'pending');

    // Create new invite
    const { data, error } = await supabase
      .from('pet_share_invites')
      .insert({
        pet_id: pet.id,
        inviter_id: user.id,
      })
      .select('token')
      .single();

    setLoading(false);

    if (error) {
      Alert.alert('Error', 'No se pudo crear la invitación');
      return;
    }

    setInviteToken(data.token);
  };

  const shareLink = async () => {
    if (!inviteToken || !pet) return;
    const url = `https://vivrapet.com/invite/${inviteToken}`;
    const appStore = 'https://apps.apple.com/app/vivra/id6761087142';
    try {
      await Share.share({
        message:
          `¡Hola! Te invito a cuidar juntos a ${pet.name} en Vivra.\n\n` +
          `1. Acepta la invitación: ${url}\n` +
          `2. Descarga la app gratis: ${appStore}\n\n` +
          `Tu acceso se sincroniza automáticamente.`,
        url,
      });
    } catch {
      // User cancelled share
    }
  };

  const revokeCoOwner = async (shareId: string) => {
    if (!pet) return;
    const petId = pet.id;
    Alert.alert(
      'Revocar acceso',
      '¿Seguro que quieres remover a este co-dueño? Perderá acceso a la mascota inmediatamente.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Revocar',
          style: 'destructive',
          onPress: async () => {
            setRevoking(true);
            // Defensive: scope by pet_id so even if RLS allows broader
            // deletes, we can't accidentally remove a share for another pet.
            const { error } = await supabase
              .from('pet_shares')
              .delete()
              .eq('id', shareId)
              .eq('pet_id', petId);
            setRevoking(false);
            if (error) {
              console.warn('[SharePetSheet] revoke error:', error.message);
              Alert.alert('Error', 'No se pudo revocar el acceso. Intenta de nuevo.');
              return;
            }
            // Full refresh of pet context — re-evaluates premium inheritance,
            // co-owner list, etc.
            refresh();
          },
        },
      ],
    );
  };

  if (!pet) return null;

  return (
    <BottomSheet visible={visible} onClose={onClose} title={`Compartir a ${pet.name}`}>
      {/* Existing co-owners */}
      {coOwners.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Co-dueños actuales</Text>
          {coOwners.map((co) => (
            <View key={co.id} style={styles.coOwnerRow}>
              <View style={styles.coOwnerIcon}>
                <Ionicons name="person" size={18} color={Colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.coOwnerText} numberOfLines={1}>
                  {co.shared_with_name || co.shared_with_email || 'Co-dueño'}
                </Text>
                {co.shared_with_name && co.shared_with_email && (
                  <Text style={styles.coOwnerEmail} numberOfLines={1}>
                    {co.shared_with_email}
                  </Text>
                )}
              </View>
              {isOwner && (
                <TouchableOpacity
                  onPress={() => revokeCoOwner(co.id)}
                  disabled={revoking}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close-circle" size={22} color={Colors.bad} />
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Invite section */}
      {isOwner && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Invitar co-dueño</Text>

          {loading ? (
            <ActivityIndicator color={Colors.accent} style={{ padding: Spacing.md }} />
          ) : inviteToken ? (
            <View style={styles.inviteReady}>
              <View style={styles.linkBox}>
                <Ionicons name="link" size={16} color={Colors.accent} />
                <Text style={styles.linkText} numberOfLines={1}>
                  vivrapet.com/invite/{inviteToken.slice(0, 8)}...
                </Text>
              </View>
              <Text style={styles.expiryNote}>Expira en 7 días</Text>
              <Button title="Compartir enlace" onPress={shareLink} style={{ marginTop: Spacing.sm }} />
              <TouchableOpacity onPress={generateInvite} style={styles.regenerateBtn}>
                <Text style={styles.regenerateText}>Generar nuevo enlace</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.inviteEmpty}>
              <Text style={styles.inviteDesc}>
                Genera un enlace para que tu pareja o familiar pueda ver y editar toda la información de {pet.name}.
              </Text>
              <Button title="Generar enlace de invitación" onPress={generateInvite} style={{ marginTop: Spacing.md }} />
            </View>
          )}
        </View>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.ink,
    marginBottom: Spacing.sm,
  },
  coOwnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.canvas,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.xs,
  },
  coOwnerIcon: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    backgroundColor: Colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coOwnerText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.ink,
  },
  coOwnerEmail: {
    fontSize: FontSize.xs,
    color: Colors.muted,
    marginTop: 2,
  },
  inviteReady: {
    alignItems: 'center',
  },
  linkBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.canvas,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    alignSelf: 'stretch',
  },
  linkText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.muted,
    fontFamily: 'monospace',
  },
  expiryNote: {
    fontSize: FontSize.xs,
    color: Colors.muted,
    marginTop: Spacing.xs,
  },
  regenerateBtn: {
    marginTop: Spacing.sm,
    padding: Spacing.xs,
  },
  regenerateText: {
    fontSize: FontSize.xs,
    color: Colors.accent,
    fontWeight: FontWeight.medium,
  },
  inviteEmpty: {
    paddingVertical: Spacing.xs,
  },
  inviteDesc: {
    fontSize: FontSize.sm,
    color: Colors.muted,
    lineHeight: 20,
  },
});
