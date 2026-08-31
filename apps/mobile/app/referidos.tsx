import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Share, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useState, useEffect, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, FontWeight, Radius } from '../constants/theme';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Card } from '../components/ui/Card';
import { asJsonObject } from '@vivra/shared/lib/database';

// Honest milestones — matches backend: 30 days per completed referral, cumulative.
const MILESTONES = [
  { target: 1, label: '1 referido', reward: '30 días premium' },
  { target: 3, label: '3 referidos', reward: '90 días premium' },
  { target: 5, label: '5 referidos', reward: '150 días premium' },
  { target: 10, label: '10 referidos', reward: '300 días premium' },
];

const APP_STORE_URL = 'https://apps.apple.com/app/vivra/id6761087142';

export default function ReferidosScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [completedCount, setCompletedCount] = useState(0);
  // Block referrals for users who only access shared pets (no pets of their own).
  // Co-owners already share premium with the owner — they can't double-dip.
  const [blockedAsCoOwner, setBlockedAsCoOwner] = useState(false);

  const fetchReferralData = useCallback(async () => {
    if (!user) return;

    // Check ownership status: if the user has zero owned pets but does have
    // shared pets, they're a "pure co-owner" — block referrals.
    const [ownedPetsRes, sharedPetsRes] = await Promise.all([
      supabase.from('pets').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('pet_shares').select('id', { count: 'exact', head: true }).eq('shared_with', user.id),
    ]);
    const ownedCount = ownedPetsRes.count ?? 0;
    const sharedCount = sharedPetsRes.count ?? 0;
    if (ownedCount === 0 && sharedCount > 0) {
      setBlockedAsCoOwner(true);
      setLoading(false);
      return;
    }

    // Fetch referral code; use RPC fallback so pet-name prefix matches the web scheme
    const { data: codeData } = await supabase
      .from('referral_codes')
      .select('code')
      .eq('user_id', user.id)
      .maybeSingle();

    if (codeData?.code) {
      setReferralCode(codeData.code);
    } else {
      // No code yet — ask backend to generate one (uses the first pet's name if available)
      const { data: petData } = await supabase
        .from('pets')
        .select('name')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      const { data: rpcData, error: rpcError } = await supabase.rpc('generate_my_referral_code', {
        p_base: petData?.name || 'PET',
      });
      const result = asJsonObject(rpcData);
      if (rpcError) {
        console.warn('[referidos] generate_my_referral_code error:', rpcError.message);
      } else if (result?.ok === true && typeof result.code === 'string') {
        setReferralCode(result.code);
      } else if (result && result.ok !== true) {
        console.warn('[referidos] generate_my_referral_code returned not-ok:', result.error);
      }
    }

    // Fetch completed referrals count
    const { count } = await supabase
      .from('referrals')
      .select('id', { count: 'exact', head: true })
      .eq('referrer_id', user.id)
      .in('status', ['completed', 'rewarded']);

    setCompletedCount(count ?? 0);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchReferralData(); }, [fetchReferralData]);

  const handleShareCode = async () => {
    if (!referralCode) return;
    try {
      await Share.share({ message: referralCode });
    } catch {
      // User cancelled
    }
  };

  const handleShare = async () => {
    if (!referralCode) return;
    try {
      await Share.share({
        message:
          `Te invito a usar Vivra para llevar la salud de tu mascota.\n\n` +
          `Descarga la app gratis: ${APP_STORE_URL}\n\n` +
          `Cuando te registres, usa mi código ${referralCode} y ambos ganamos premium gratis.`,
      });
    } catch {
      // User cancelled share
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="chevron-back" size={24} color={Colors.ink} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Referidos</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  // Co-owner without their own pet: can't refer (would double-dip premium)
  if (blockedAsCoOwner) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="chevron-back" size={24} color={Colors.ink} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Referidos</Text>
          <View style={{ width: 24 }} />
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.heroSection}>
            <View style={styles.heroIconWrap}>
              <Ionicons name="people" size={32} color={Colors.accent} />
            </View>
            <Text style={styles.heroTitle}>Ya compartes premium</Text>
            <Text style={styles.heroSubtitle}>
              Como codueño, ya tienes acceso premium gracias al dueño principal de la mascota. El programa de referidos está disponible para dueños principales.
            </Text>
          </View>
          <Card>
            <Text style={styles.sectionTitle}>¿Quieres referir?</Text>
            <Text style={[styles.howDesc, { marginBottom: Spacing.sm }]}>
              Registra tu propia mascota para activar tu código de referido y ganar 30 días premium por cada amigo que invites.
            </Text>
            <TouchableOpacity
              style={styles.shareBtn}
              onPress={() => router.push('/perfil' as any)}
              activeOpacity={0.8}
            >
              <Text style={styles.shareBtnText}>Ir a Perfil</Text>
            </TouchableOpacity>
          </Card>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header bar */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={24} color={Colors.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Referidos</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Hero section */}
        <View style={styles.heroSection}>
          <View style={styles.heroIconWrap}>
            <Ionicons name="gift" size={32} color={Colors.accent} />
          </View>
          <Text style={styles.heroTitle}>Invita y gana premium</Text>
          <Text style={styles.heroSubtitle}>
            Tus amigos reciben 7 días Premium gratis y tú ganas 30 días por cada referido que cree su mascota
          </Text>
        </View>

        {/* Referral link section */}
        <Card>
          <Text style={styles.sectionTitle}>Tu código de referido</Text>
          <View style={styles.linkBox}>
            <Text style={styles.linkText} numberOfLines={1}>{referralCode || '—'}</Text>
          </View>
          <View style={styles.linkActions}>
            <TouchableOpacity style={styles.copyBtn} onPress={handleShareCode} activeOpacity={0.7}>
              <Ionicons name="share-outline" size={18} color={Colors.accent} />
              <Text style={styles.copyBtnText}>Compartir código</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.shareBtn} onPress={handleShare} activeOpacity={0.8}>
            <Ionicons name="share-outline" size={20} color={Colors.white} />
            <Text style={styles.shareBtnText}>Compartir invitación</Text>
          </TouchableOpacity>
        </Card>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{completedCount}</Text>
            <Text style={styles.statLabel}>Referidos</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNumber, { color: Colors.accent }]}>
              {completedCount * 30}d
            </Text>
            <Text style={styles.statLabel}>Premium ganado</Text>
          </View>
        </View>

        {/* Milestones — cumulative, no fake tiers */}
        <View>
          <Text style={styles.rewardsSectionTitle}>Tus metas</Text>
          {MILESTONES.map((m) => {
            const done = completedCount >= m.target;
            return (
              <View key={m.target} style={[styles.milestoneRow, done && styles.milestoneRowDone]}>
                <View style={[styles.milestoneDot, done && styles.milestoneDotDone]}>
                  {done ? (
                    <Ionicons name="checkmark" size={14} color={Colors.accent} />
                  ) : (
                    <Text style={styles.milestoneTarget}>{m.target}</Text>
                  )}
                </View>
                <Text style={[styles.milestoneLabel, done && styles.milestoneLabelDone]}>{m.label}</Text>
                <View style={[styles.milestoneBadge, done && styles.milestoneBadgeDone]}>
                  <Text style={[styles.milestoneBadgeText, done && styles.milestoneBadgeTextDone]}>
                    {m.reward}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* How it works */}
        <Card>
          <Text style={styles.sectionTitle}>Cómo funciona</Text>
          <View style={styles.howRow}>
            <View style={styles.howNum}><Text style={styles.howNumText}>1</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.howTitle}>Comparte tu invitación</Text>
              <Text style={styles.howDesc}>Envíaselo a otros dueños de mascotas</Text>
            </View>
          </View>
          <View style={styles.howRow}>
            <View style={styles.howNum}><Text style={styles.howNumText}>2</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.howTitle}>Ellos crean su mascota</Text>
              <Text style={styles.howDesc}>Reciben 7 días de Premium gratis al unirse</Text>
            </View>
          </View>
          <View style={styles.howRow}>
            <View style={styles.howNum}><Text style={styles.howNumText}>3</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.howTitle}>Tú ganas 30 días Premium</Text>
              <Text style={styles.howDesc}>Automático, sin límite, acumulativo</Text>
            </View>
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.canvas },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  headerTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.ink,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { flex: 1 },
  content: {
    padding: Spacing.lg,
    paddingTop: Spacing.sm,
    gap: Spacing.md,
    paddingBottom: Spacing.xxl,
  },

  // Hero
  heroSection: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  heroIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  heroTitle: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.ink,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.muted,
    textAlign: 'center',
    marginTop: Spacing.xs,
    lineHeight: 20,
    paddingHorizontal: Spacing.md,
  },

  // Link box
  sectionTitle: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: Colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.sm,
  },
  linkBox: {
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
    borderStyle: 'dashed',
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.canvas,
    alignItems: 'center',
  },
  linkText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.ink,
    letterSpacing: 0.5,
  },
  linkActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: Spacing.sm,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.full,
    backgroundColor: Colors.accentLight,
  },
  copyBtnText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.accent,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    backgroundColor: Colors.ink,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    minHeight: 50,
  },
  shareBtnText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.white,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.ink,
  },
  statLabel: {
    fontSize: FontSize.xs,
    color: Colors.muted,
    marginTop: 2,
  },

  // Milestones
  rewardsSectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.ink,
    marginBottom: Spacing.sm,
  },
  milestoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.xs,
  },
  milestoneRowDone: {
    borderColor: Colors.accentLight,
    backgroundColor: Colors.accentLight,
  },
  milestoneDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
  },
  milestoneDotDone: {
    backgroundColor: Colors.card,
  },
  milestoneTarget: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.muted,
  },
  milestoneLabel: {
    flex: 1,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.muted,
  },
  milestoneLabelDone: {
    color: Colors.ink,
  },
  milestoneBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.full,
    backgroundColor: Colors.canvas,
  },
  milestoneBadgeDone: {
    backgroundColor: Colors.card,
  },
  milestoneBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: Colors.muted,
  },
  milestoneBadgeTextDone: {
    color: Colors.accent,
  },

  // How it works
  howRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  howNum: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  howNumText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.accent,
  },
  howTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.ink,
  },
  howDesc: {
    fontSize: FontSize.xs,
    color: Colors.muted,
    marginTop: 2,
  },
});
