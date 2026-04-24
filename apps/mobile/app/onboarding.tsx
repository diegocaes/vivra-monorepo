import { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Alert,
  Animated,
  useWindowDimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, FontWeight, Radius } from '../constants/theme';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/Button';
import { DOG_BREEDS } from '@vivra/shared';
import { DatePickerField } from '../components/ui/DatePickerField';

const PENDING_REF_KEY = 'pending_referral';

const STEPS = [
  { title: 'Nombre', subtitle: 'Cómo se llama tu mascota?' },
  { title: 'Raza', subtitle: 'Qué raza es?' },
  { title: 'Datos básicos', subtitle: 'Últimos detalles' },
];

const GENDER_OPTIONS = [
  { key: 'macho', label: 'Macho', icon: 'male' as const },
  { key: 'hembra', label: 'Hembra', icon: 'female' as const },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { width } = useWindowDimensions();

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;

  // Form state
  const [petName, setPetName] = useState('');
  const [breed, setBreed] = useState('');
  const [breedSearch, setBreedSearch] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState('');
  const [weightKg, setWeightKg] = useState('');

const animateProgress = (toStep: number) => {
    Animated.spring(progress, {
      toValue: (toStep + 1) / STEPS.length,
      useNativeDriver: false,
      damping: 20,
      stiffness: 150,
    }).start();
  };

  const goNext = () => {
    if (step === 0 && !petName.trim()) {
      Alert.alert('', 'Ingresa el nombre de tu mascota');
      return;
    }
    const next = step + 1;
    setStep(next);
    animateProgress(next);
  };

  const goBack = () => {
    if (step === 0) return;
    const prev = step - 1;
    setStep(prev);
    animateProgress(prev);
  };

  const handleFinish = async () => {
    if (!user) return;
    setSaving(true);

    const cleanName = petName.trim();
    const { error } = await supabase.from('pets').insert({
      user_id: user.id,
      name: cleanName,
      breed: breed || null,
      birth_date: birthDate || null,
      gender: gender || null,
      weight_kg: weightKg ? parseFloat(weightKg) : null,
    });

    if (error) {
      setSaving(false);
      Alert.alert('Error', error.message);
      return;
    }

    // ── Post-pet setup: referral code + subscription + pending referral redemption ──
    // All best-effort; we don't block the user from entering the app on failures.
    try {
      // 1. Generate personal referral code (idempotent)
      await supabase.rpc('generate_my_referral_code', {
        p_base: cleanName || 'PET',
      });
    } catch (e) {
      console.warn('[onboarding] generate referral code failed:', e);
    }

    try {
      // 2. Redeem any pending referral code the user entered at signup
      const pendingRef = await AsyncStorage.getItem(PENDING_REF_KEY);
      if (pendingRef) {
        const { data, error: redeemErr } = await supabase.rpc('redeem_referral', { p_code: pendingRef });
        if (redeemErr) {
          console.warn('[onboarding] redeem_referral failed:', redeemErr.message);
        } else if (!data?.ok) {
          console.warn('[onboarding] redeem_referral rejected:', data?.error);
        }
        await AsyncStorage.removeItem(PENDING_REF_KEY);
      } else {
        // 3. Ensure a user_subscriptions row exists (free plan default)
        //    RLS lets users read their own row; inserting uses the user's auth.
        const { data: existingSub } = await supabase
          .from('user_subscriptions')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();
        if (!existingSub) {
          await supabase.from('user_subscriptions').insert({
            user_id: user.id,
            plan: 'free',
          });
        }
      }
    } catch (e) {
      console.warn('[onboarding] post-pet setup error:', e);
    }

    setSaving(false);
    router.replace('/(app)');
  };

  const filteredBreeds = breedSearch
    ? DOG_BREEDS.filter(b => b.toLowerCase().includes(breedSearch.toLowerCase()))
    : DOG_BREEDS;

  const progressWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        {/* Header */}
        <View style={styles.header}>
          {step > 0 ? (
            <TouchableOpacity onPress={goBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="chevron-back" size={24} color={Colors.ink} />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 24 }} />
          )}
          <Text style={styles.stepLabel}>Paso {step + 1} de {STEPS.length}</Text>
          <TouchableOpacity onPress={signOut} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.skipText}>Salir</Text>
          </TouchableOpacity>
        </View>

        {/* Progress bar */}
        <View style={styles.progressBg}>
          <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
        </View>

        {/* Content */}
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.titleSection}>
            <Text style={styles.title}>{STEPS[step].subtitle}</Text>
          </View>

          {/* Step 0: Name */}
          {step === 0 && (
            <View style={styles.stepContent}>
              <View style={styles.iconCircle}>
                <Ionicons name="paw" size={40} color={Colors.accent} />
              </View>
              <Text style={styles.welcomeBadge}>Bienvenido a Vivra</Text>
              <TextInput
                style={styles.bigInput}
                placeholder="Ej: Max, Luna, Rocky..."
                placeholderTextColor={Colors.cardBorder}
                value={petName}
                onChangeText={setPetName}
                autoFocus
                autoCapitalize="words"
                maxLength={30}
                textAlign="center"
              />
              <Text style={styles.hint}>Este será el nombre principal de tu mascota en Vivra</Text>
            </View>
          )}

          {/* Step 1: Breed */}
          {step === 1 && (
            <View style={styles.stepContent}>
              <TextInput
                style={styles.searchInput}
                placeholder="Buscar raza..."
                placeholderTextColor={Colors.muted}
                value={breedSearch}
                onChangeText={setBreedSearch}
                autoCapitalize="none"
              />
              <ScrollView style={styles.breedList} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                {filteredBreeds.map(b => (
                  <TouchableOpacity
                    key={b}
                    style={[styles.breedOption, breed === b && styles.breedOptionActive]}
                    onPress={() => { setBreed(b); setBreedSearch(''); }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.breedText, breed === b && styles.breedTextActive]}>{b}</Text>
                    {breed === b && <Ionicons name="checkmark-circle" size={20} color={Colors.accent} />}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Step 2: Basic data */}
          {step === 2 && (
            <View style={styles.stepContent}>
              {/* Gender */}
              <Text style={styles.fieldLabel}>Género</Text>
              <View style={styles.genderRow}>
                {GENDER_OPTIONS.map(opt => (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.genderBtn, gender === opt.key && styles.genderBtnActive]}
                    onPress={() => setGender(opt.key)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={opt.icon}
                      size={22}
                      color={gender === opt.key ? Colors.white : Colors.muted}
                    />
                    <Text style={[styles.genderText, gender === opt.key && styles.genderTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Birth date */}
              <DatePickerField
                label="Fecha de nacimiento"
                value={birthDate}
                onChange={setBirthDate}
                maxDate={new Date()}
                clearable
              />

              {/* Weight */}
              <Text style={styles.fieldLabel}>Peso actual (kg)</Text>
              <TextInput
                style={styles.input}
                placeholder="Ej: 12.5 (opcional)"
                placeholderTextColor={Colors.muted}
                value={weightKg}
                onChangeText={setWeightKg}
                keyboardType="decimal-pad"
              />

              <Text style={styles.hint}>No te preocupes, puedes completar estos datos después</Text>
            </View>
          )}
        </ScrollView>

        {/* Bottom action */}
        <View style={styles.bottom}>
          {step < STEPS.length - 1 ? (
            <Button title="Continuar" onPress={goNext} />
          ) : (
            <Button title="Crear perfil de mascota" onPress={handleFinish} loading={saving} />
          )}
          {step === 1 && !breed && (
            <TouchableOpacity onPress={goNext} style={styles.skipBtn}>
              <Text style={styles.skipBtnText}>Omitir por ahora</Text>
            </TouchableOpacity>
          )}
          {step === 2 && (
            <TouchableOpacity onPress={handleFinish} style={styles.skipBtn} disabled={saving}>
              <Text style={styles.skipBtnText}>Omitir y crear después</Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.canvas },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  stepLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.muted },
  skipText: { fontSize: FontSize.sm, color: Colors.muted },
  progressBg: {
    height: 4,
    backgroundColor: Colors.cardBorder,
    marginHorizontal: Spacing.lg,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
    backgroundColor: Colors.accent,
    borderRadius: Radius.full,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
  },
  titleSection: { marginBottom: Spacing.xl },
  title: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.ink,
  },
  stepContent: { flex: 1 },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: Spacing.md,
  },
  welcomeBadge: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: Colors.accent,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: Spacing.lg,
  },
  bigInput: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.ink,
    paddingVertical: Spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: Colors.accent,
    textAlign: 'center',
  },
  hint: {
    fontSize: FontSize.sm,
    color: Colors.muted,
    textAlign: 'center',
    marginTop: Spacing.md,
  },
  searchInput: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    fontSize: FontSize.md,
    color: Colors.ink,
    marginBottom: Spacing.md,
  },
  breedList: { maxHeight: 340 },
  breedOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    marginBottom: 2,
  },
  breedOptionActive: { backgroundColor: Colors.accentLight },
  breedText: { fontSize: FontSize.md, color: Colors.ink },
  breedTextActive: { color: Colors.accent, fontWeight: FontWeight.semibold },
  fieldLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.ink,
    marginBottom: Spacing.xs,
    marginTop: Spacing.lg,
  },
  genderRow: { flexDirection: 'row', gap: Spacing.md },
  genderBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: Colors.card,
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
  },
  genderBtnActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  genderText: { fontSize: FontSize.md, fontWeight: FontWeight.medium, color: Colors.ink },
  genderTextActive: { color: Colors.white },
  input: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 4,
    fontSize: FontSize.md,
    color: Colors.ink,
  },
  bottom: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  skipBtn: { alignItems: 'center', paddingVertical: Spacing.xs },
  skipBtnText: { fontSize: FontSize.sm, color: Colors.muted },
});
