import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Share, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useState, useEffect, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, FontWeight, Radius } from '../constants/theme';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Card } from '../components/ui/Card';

const TIERS = [
  { target: 1, label: '1 Referido', reward: 'Color especial de tema', emoji: '\uD83C\uDFA8', description: 'Desbloquea un color de tema exclusivo para tu mascota' },
  { target: 3, label: '3 Referidos', reward: 'Mascota extra gratis', emoji: '\uD83D\uDC3E', description: 'Agrega una mascota adicional sin necesidad de Premium' },
  { target: 5, label: '5 Referidos', reward: '1 mes Premium gratis', emoji: '\u2B50', description: 'Disfruta de todas las funciones Premium por 1 mes' },
];

export default function ReferidosScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [completedCount, setCompletedCount] = useState(0);
  const [copied, setCopied] = useState(false);

  const fetchReferralData = useCallback(async () => {
    if (!user) return;

    // Fetch referral code
    const { data: codeData } = await supabase
      .from('referral_codes')
      .select('code')
      .eq('user_id', user.id)
      .maybeSingle();

    if (codeData?.code) {
      setReferralCode(codeData.code);
    } else {
      // Generate a new referral code: first 3 chars of pet name + 4 random digits
      const { data: petData } = await supabase
        .from('pets')
        .select('name')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      const petPrefix = petData?.name
        ? petData.name.replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase()
        : 'VIV';
      const digits = Math.floor(1000 + Math.random() * 9000).toString();
      const newCode = petPrefix + digits;

      const { error: insertError } = await supabase
        .from('referral_codes')
        .insert({ user_id: user.id, code: newCode, uses_count: 0 });

      if (!insertError) {
        setReferralCode(newCode);
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

  const shareLink = referralCode ? `https://vivrapet.com/register?ref=${referralCode}` : '';

  const handleCopy = async () => {
    if (!shareLink) return;
    try {
      await Share.share({ message: shareLink });
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // User cancelled
    }
  };

  const handleShare = async () => {
    if (!shareLink) return;
    try {
      await Share.share({
        message: `Registra a tu mascota en Vivra y lleva el control de su salud 🐾 Disponible en web y en iPhone.\n\n${shareLink}`,
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
          <Text style={styles.heroTitle}>Invita y gana premios</Text>
          <Text style={styles.heroSubtitle}>
            Regala 30 dias de Vivra Premium a tus amigos y gana recompensas exclusivas
          </Text>
        </View>

        {/* Referral link section */}
        <Card>
          <Text style={styles.sectionTitle}>Tu link de referido</Text>
          <View style={styles.linkBox}>
            <Text style={styles.linkText} numberOfLines={1}>{shareLink}</Text>
          </View>
          <View style={styles.linkActions}>
            <TouchableOpacity style={styles.copyBtn} onPress={handleCopy} activeOpacity={0.7}>
              <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={18} color={copied ? Colors.good : Colors.accent} />
              <Text style={[styles.copyBtnText, copied && { color: Colors.good }]}>
                {copied ? 'Copiado' : 'Copiar'}
              </Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.shareBtn} onPress={handleShare} activeOpacity={0.8}>
            <Ionicons name="share-outline" size={20} color={Colors.white} />
            <Text style={styles.shareBtnText}>Compartir tu link</Text>
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
              {TIERS.filter(t => completedCount >= t.target).length}/{TIERS.length}
            </Text>
            <Text style={styles.statLabel}>Premios</Text>
          </View>
        </View>

        {/* Rewards tiers */}
        <View>
          <Text style={styles.rewardsSectionTitle}>Tus Recompensas</Text>
          {TIERS.map((tier, index) => {
            const unlocked = completedCount >= tier.target;
            const progress = Math.min(completedCount, tier.target);
            return (
              <View key={index} style={[styles.tierCard, unlocked && styles.tierCardUnlocked]}>
                <View style={styles.tierHeader}>
                  <View style={[styles.tierEmoji, unlocked && styles.tierEmojiUnlocked]}>
                    <Text style={styles.tierEmojiText}>{tier.emoji}</Text>
                  </View>
                  <View style={styles.tierInfo}>
                    <Text style={styles.tierLabel}>{tier.label}</Text>
                    <Text style={[styles.tierReward, unlocked && styles.tierRewardUnlocked]}>{tier.reward}</Text>
                    <Text style={styles.tierDesc}>{tier.description}</Text>
                  </View>
                </View>
                {/* Progress bar */}
                <View style={styles.tierProgressRow}>
                  <View style={styles.tierProgressBarBg}>
                    <View
                      style={[
                        styles.tierProgressBarFill,
                        {
                          width: `${(progress / tier.target) * 100}%`,
                          backgroundColor: unlocked ? Colors.good : Colors.accent,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.tierProgressText}>
                    {'\uD83D\uDC64'} {progress}/{tier.target}
                  </Text>
                </View>
                {/* Redeem button */}
                <TouchableOpacity
                  style={[styles.redeemBtn, unlocked ? styles.redeemBtnUnlocked : styles.redeemBtnLocked]}
                  disabled={!unlocked}
                  activeOpacity={0.7}
                  onPress={() => {
                    if (unlocked) {
                      Alert.alert('Recompensa', `Tu recompensa "${tier.reward}" sera aplicada automaticamente.`);
                    }
                  }}
                >
                  {!unlocked && <Ionicons name="lock-closed" size={14} color={Colors.muted} style={{ marginRight: 4 }} />}
                  <Text style={[styles.redeemBtnText, unlocked ? styles.redeemTextUnlocked : styles.redeemTextLocked]}>
                    {unlocked ? 'Canjear' : 'Bloqueado'}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>

        {/* Footer note */}
        <Text style={styles.footerNote}>
          Los referidos son verificados por nuestro equipo
        </Text>
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

  // Rewards section
  rewardsSectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.ink,
    marginBottom: Spacing.sm,
  },
  tierCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  tierCardUnlocked: {
    borderColor: Colors.good + '40',
    backgroundColor: '#F0FDF4',
  },
  tierHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  tierEmoji: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: Colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tierEmojiUnlocked: {
    backgroundColor: Colors.good + '15',
  },
  tierEmojiText: {
    fontSize: 22,
  },
  tierInfo: {
    flex: 1,
  },
  tierLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: Colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tierReward: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.ink,
    marginTop: 2,
  },
  tierRewardUnlocked: {
    color: Colors.good,
  },
  tierDesc: {
    fontSize: FontSize.xs,
    color: Colors.muted,
    marginTop: 2,
    lineHeight: 16,
  },

  // Progress
  tierProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  tierProgressBarBg: {
    flex: 1,
    height: 6,
    backgroundColor: Colors.cardBorder,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  tierProgressBarFill: {
    height: 6,
    borderRadius: Radius.full,
  },
  tierProgressText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    color: Colors.muted,
    minWidth: 36,
    textAlign: 'right' as const,
  },

  // Redeem button
  redeemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
  },
  redeemBtnUnlocked: {
    backgroundColor: Colors.good,
  },
  redeemBtnLocked: {
    backgroundColor: Colors.canvas,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  redeemBtnText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  redeemTextUnlocked: {
    color: Colors.white,
  },
  redeemTextLocked: {
    color: Colors.muted,
  },

  // Footer
  footerNote: {
    fontSize: FontSize.xs,
    color: Colors.muted,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
});
