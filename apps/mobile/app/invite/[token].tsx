import { View, Text, StyleSheet, Image, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Colors, Spacing, FontSize, FontWeight, Radius } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../../components/ui/Button';

interface InviteData {
  petName: string;
  petPhoto: string | null;
  petBreed: string | null;
  inviterEmail: string | null;
  inviteId: string;
  petId: string;
  ownerId: string;
}

type InviteStatus = 'loading' | 'ready' | 'expired' | 'self' | 'already_shared' | 'accepted' | 'error';

export default function InviteScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [status, setStatus] = useState<InviteStatus>('loading');
  const [invite, setInvite] = useState<InviteData | null>(null);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    if (!token || !user) return;
    fetchInvite();
  }, [token, user]);

  const fetchInvite = async () => {
    if (!token || !user) return;
    setStatus('loading');

    const { data, error } = await supabase
      .from('pet_share_invites')
      .select('id, pet_id, inviter_id, status, expires_at')
      .eq('token', token)
      .maybeSingle();

    if (error || !data) {
      setStatus('error');
      return;
    }

    if (data.status !== 'pending') {
      setStatus('expired');
      return;
    }

    if (new Date(data.expires_at) < new Date()) {
      setStatus('expired');
      return;
    }

    if (data.inviter_id === user.id) {
      setStatus('self');
      return;
    }

    // Check if already shared
    const { data: existingShare } = await supabase
      .from('pet_shares')
      .select('id')
      .eq('pet_id', data.pet_id)
      .eq('shared_with', user.id)
      .maybeSingle();

    if (existingShare) {
      setStatus('already_shared');
      return;
    }

    // Fetch pet info
    const { data: pet } = await supabase
      .from('pets')
      .select('name, photo_url, breed, user_id')
      .eq('id', data.pet_id)
      .single();

    if (!pet) {
      setStatus('error');
      return;
    }

    setInvite({
      petName: pet.name,
      petPhoto: pet.photo_url,
      petBreed: pet.breed,
      inviterEmail: null,
      inviteId: data.id,
      petId: data.pet_id,
      ownerId: pet.user_id,
    });
    setStatus('ready');
  };

  const handleAccept = async () => {
    if (!invite || !user || !token) return;
    setAccepting(true);

    // Use RPC so the co-owner can insert into pet_shares
    // (RLS only allows the pet owner to INSERT directly, so we bypass via SECURITY DEFINER function)
    const { data, error } = await supabase.rpc('accept_pet_share_invite', { p_token: token });

    setAccepting(false);

    if (error || !data?.ok) {
      const errCode = (data?.error as string | undefined) || 'unknown';
      const messages: Record<string, string> = {
        not_found: 'Esta invitación ya no existe',
        already_used: 'Esta invitación ya fue usada',
        expired: 'Esta invitación expiró',
        self_invite: 'No puedes aceptar tu propia invitación',
        pet_not_found: 'La mascota ya no está disponible',
      };
      Alert.alert('No se pudo aceptar', messages[errCode] || 'Intenta de nuevo más tarde');
      return;
    }

    setStatus('accepted');

    // Navigate to app after a brief delay
    setTimeout(() => {
      router.replace('/(app)' as any);
    }, 1500);
  };

  const renderContent = () => {
    switch (status) {
      case 'loading':
        return (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={Colors.accent} />
            <Text style={styles.messageText}>Cargando invitación...</Text>
          </View>
        );

      case 'ready':
        return (
          <View style={styles.center}>
            {invite?.petPhoto ? (
              <Image source={{ uri: invite.petPhoto }} style={styles.petPhoto} />
            ) : (
              <View style={[styles.petPhoto, styles.petPhotoPlaceholder]}>
                <Ionicons name="paw" size={40} color={Colors.accent} />
              </View>
            )}
            <Text style={styles.inviteTitle}>
              Te invitan a cuidar a {invite?.petName}
            </Text>
            {invite?.petBreed && (
              <Text style={styles.petBreed}>{invite.petBreed}</Text>
            )}
            <Text style={styles.inviteDesc}>
              Tendrás acceso completo para ver y registrar vacunas, peso, paseos y toda la información de salud.
            </Text>
            <Button
              title={accepting ? 'Aceptando...' : 'Aceptar invitación'}
              onPress={handleAccept}
              loading={accepting}
              style={{ alignSelf: 'stretch', marginTop: Spacing.lg }}
            />
            <Button
              title="Cancelar"
              onPress={() => router.back()}
              variant="ghost"
              style={{ alignSelf: 'stretch', marginTop: Spacing.xs }}
            />
          </View>
        );

      case 'accepted':
        return (
          <View style={styles.center}>
            <View style={styles.successCircle}>
              <Ionicons name="checkmark" size={40} color={Colors.white} />
            </View>
            <Text style={styles.inviteTitle}>¡Listo!</Text>
            <Text style={styles.messageText}>
              {invite?.petName} ahora aparece en tu lista de mascotas
            </Text>
          </View>
        );

      case 'expired':
        return (
          <View style={styles.center}>
            <Ionicons name="time-outline" size={48} color={Colors.muted} />
            <Text style={styles.inviteTitle}>Invitación expirada</Text>
            <Text style={styles.messageText}>
              Esta invitación ya no es válida. Pide al dueño que te envíe una nueva.
            </Text>
            <Button title="Cerrar" onPress={() => router.back()} variant="outline" style={{ marginTop: Spacing.lg }} />
          </View>
        );

      case 'self':
        return (
          <View style={styles.center}>
            <Ionicons name="person-outline" size={48} color={Colors.muted} />
            <Text style={styles.inviteTitle}>Esta es tu mascota</Text>
            <Text style={styles.messageText}>
              No puedes aceptar una invitación de tu propia mascota.
            </Text>
            <Button title="Cerrar" onPress={() => router.back()} variant="outline" style={{ marginTop: Spacing.lg }} />
          </View>
        );

      case 'already_shared':
        return (
          <View style={styles.center}>
            <Ionicons name="checkmark-circle" size={48} color={Colors.good} />
            <Text style={styles.inviteTitle}>Ya tienes acceso</Text>
            <Text style={styles.messageText}>
              Esta mascota ya está en tu lista.
            </Text>
            <Button title="Ir al inicio" onPress={() => router.replace('/(app)' as any)} style={{ marginTop: Spacing.lg }} />
          </View>
        );

      default:
        return (
          <View style={styles.center}>
            <Ionicons name="alert-circle-outline" size={48} color={Colors.bad} />
            <Text style={styles.inviteTitle}>Invitación no válida</Text>
            <Text style={styles.messageText}>
              No pudimos encontrar esta invitación.
            </Text>
            <Button title="Cerrar" onPress={() => router.back()} variant="outline" style={{ marginTop: Spacing.lg }} />
          </View>
        );
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <BlurView intensity={60} tint="light" style={styles.glassCard}>
          {renderContent()}
        </BlurView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.canvas },
  container: {
    flex: 1,
    padding: Spacing.lg,
    justifyContent: 'center',
  },
  glassCard: {
    borderRadius: 24,
    overflow: 'hidden',
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  center: {
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
  },
  petPhoto: {
    width: 96,
    height: 96,
    borderRadius: Radius.full,
    marginBottom: Spacing.lg,
  },
  petPhotoPlaceholder: {
    backgroundColor: Colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.ink,
    textAlign: 'center',
  },
  petBreed: {
    fontSize: FontSize.sm,
    color: Colors.muted,
    marginTop: Spacing.xs,
  },
  inviteDesc: {
    fontSize: FontSize.sm,
    color: Colors.muted,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: Spacing.md,
  },
  messageText: {
    fontSize: FontSize.sm,
    color: Colors.muted,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  successCircle: {
    width: 72,
    height: 72,
    borderRadius: Radius.full,
    backgroundColor: Colors.good,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
});
