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
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, FontWeight, Radius } from '../constants/theme';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/Button';
import { calculateAge, DOG_BREEDS, friendlyError } from '@vivra/shared';
import { DatePickerField } from '../components/ui/DatePickerField';
import { requestPushPermissionAndRegister } from '../hooks/useNotifications';

// Lazy-load native image modules so the bundle doesn't fail if a build
// somehow ships without them (matches the pattern already used in /perfil).
let ImagePicker: typeof import('expo-image-picker') | null = null;
try { ImagePicker = require('expo-image-picker'); } catch { /* unavailable */ }
let ImageManipulator: typeof import('expo-image-manipulator') | null = null;
try { ImageManipulator = require('expo-image-manipulator'); } catch { /* unavailable */ }

const PENDING_REF_KEY = 'pending_referral';

const STEPS = [
  { title: 'Bienvenida', subtitle: '¡Conozcamos a tu mascota!' },
  { title: 'Raza', subtitle: 'Qué raza es?' },
  { title: 'Datos básicos', subtitle: 'Unos detalles más' },
];

const GENDER_OPTIONS = [
  { key: 'macho', label: 'Macho', icon: 'male' as const },
  { key: 'hembra', label: 'Hembra', icon: 'female' as const },
];

const SPECIES_OPTIONS = [
  { key: 'dog' as const, label: 'Perro', icon: 'paw' as const },
  { key: 'cat' as const, label: 'Gato', icon: 'paw-outline' as const },
];

// Small presentational helper for the success screen stat row.
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCell}>
      <Text style={styles.statValue} numberOfLines={1}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function OnboardingScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;

  // Form state
  const [petName, setPetName] = useState('');
  const [species, setSpecies] = useState<'dog' | 'cat'>('dog');
  const [breed, setBreed] = useState('');
  const [breedSearch, setBreedSearch] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState('');
  const [weightKg, setWeightKg] = useState('');

  // Photo picked locally (before upload). Stored as a file:// URI; uploaded
  // to the pet-photos bucket inside handleFinish once we have a pet.id.
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  // Once the pet is created and the post-pet setup completes, we set this
  // and the success screen renders in place of the wizard.
  const [createdPet, setCreatedPet] = useState<null | {
    id: string;
    name: string;
    breed: string;
    gender: string;
    weightKg: string;
    birthDate: string;
    photoUrl: string | null;
  }>(null);

  const pickPhoto = async () => {
    if (!ImagePicker) {
      Alert.alert('No disponible', 'La selección de fotos no está disponible en este momento.');
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a tu galería para agregar una foto.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled) return;
    setPhotoUri(result.assets[0].uri);
  };

  /**
   * Upload the local photoUri to the pet-photos bucket and return the public
   * URL (with cache-buster). Returns null on any failure — callers should
   * tolerate that and let the pet exist without a photo. The user can add it
   * later from /perfil.
   */
  const uploadPetPhoto = async (uri: string, userId: string, petId: string): Promise<string | null> => {
    try {
      let finalUri = uri;
      if (ImageManipulator) {
        try {
          const manipulated = await ImageManipulator.manipulateAsync(
            uri,
            [{ resize: { width: 1080 } }],
            { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
          );
          finalUri = manipulated.uri;
        } catch {
          // Fall back to original if manipulation fails
        }
      }

      const fileName = `${userId}/${petId}.jpg`;
      const response = await fetch(finalUri);
      const blob = await response.blob();
      if (blob.size > 5 * 1024 * 1024) {
        // Too large — skip but don't block onboarding
        console.warn('[onboarding] photo too large, skipping upload');
        return null;
      }
      const arrayBuffer = await new Response(blob).arrayBuffer();
      const { error: uploadError } = await supabase.storage
        .from('pet-photos')
        .upload(fileName, arrayBuffer, { contentType: 'image/jpeg', upsert: true });
      if (uploadError) {
        console.warn('[onboarding] photo upload failed:', uploadError.message);
        return null;
      }
      const { data: urlData } = supabase.storage.from('pet-photos').getPublicUrl(fileName);
      return `${urlData.publicUrl}?t=${Date.now()}`;
    } catch (e: any) {
      console.warn('[onboarding] photo upload threw:', e?.message ?? e);
      return null;
    }
  };

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
    // Gatos no piden raza — saltar el paso de razas
    const next = step === 0 && species === 'cat' ? 2 : step + 1;
    setStep(next);
    animateProgress(next);
  };

  const goBack = () => {
    if (step === 0) return;
    const prev = step === 2 && species === 'cat' ? 0 : step - 1;
    setStep(prev);
    animateProgress(prev);
  };

  const handleFinish = async () => {
    if (!user) return;
    setSaving(true);

    const cleanName = petName.trim();
    // Insert + return the new row so we have its id for the photo upload
    // and for the success card.
    const { data: insertedPet, error } = await supabase
      .from('pets')
      .insert({
        user_id: user.id,
        name: cleanName,
        species,
        breed: species === 'cat' ? null : (breed || null),
        birth_date: birthDate || null,
        gender: gender || null,
        weight_kg: weightKg ? parseFloat(weightKg) : null,
      })
      .select('id')
      .single();

    if (error || !insertedPet) {
      setSaving(false);
      if (error) console.warn('[onboarding] pet insert error:', error.message);
      Alert.alert('Error', error ? friendlyError(error) : 'No se pudo crear la mascota.');
      return;
    }

    // Upload the photo (if any) and persist the URL on the pet row. Failure
    // is non-blocking: the pet exists, the user can add a photo later.
    let photoUrl: string | null = null;
    if (photoUri) {
      photoUrl = await uploadPetPhoto(photoUri, user.id, insertedPet.id);
      if (photoUrl) {
        await supabase.from('pets').update({ photo_url: photoUrl }).eq('id', insertedPet.id);
      }
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
      const storedPendingRef = await AsyncStorage.getItem(PENDING_REF_KEY);
      const metadataPendingRef = typeof user.user_metadata?.pending_referral === 'string'
        ? user.user_metadata.pending_referral
        : null;
      const pendingRef = storedPendingRef || metadataPendingRef;
      if (pendingRef) {
        const { data, error: redeemErr } = await supabase.rpc('redeem_referral', { p_code: pendingRef });
        let shouldClearPending = false;
        if (redeemErr) {
          console.warn('[onboarding] redeem_referral failed:', redeemErr.message);
          // Keep the attribution so a temporary network/server failure can be
          // retried; never silently lose a valid referral after onboarding.
        } else if (!data?.ok) {
          const err = data?.error;
          shouldClearPending = ['self_referral', 'invalid_code', 'referral_already_attributed'].includes(err);
          if (err && !shouldClearPending) {
            console.warn('[onboarding] redeem_referral rejected:', err, data);
          }
        } else {
          shouldClearPending = true;
          if (data?.referred_trial_days) {
            Alert.alert(
              '¡Premium activado!',
              `Tienes ${data.referred_trial_days} días de Vivra Premium gratis para probar todas las funciones.`,
            );
          }
        }
        if (shouldClearPending) {
          await AsyncStorage.removeItem(PENDING_REF_KEY);
          if (metadataPendingRef) {
            await supabase.auth.updateUser({ data: { pending_referral: null } });
          }
        }
      }
      // We intentionally do NOT pre-insert a user_subscriptions row with
      // plan='free'. With RLS enabled the authenticated client can't write
      // to this table directly anyway, and "no row = free" is the default
      // both in evaluatePremium and getPremiumStatus. Rows are created when
      // a real subscription event happens: signed RevenueCat webhook,
      // referral redeem (redeem_referral), or admin promo grant.
    } catch (e) {
      console.warn('[onboarding] post-pet setup error:', e);
    }

    setSaving(false);
    // Show the success screen instead of jumping straight into the app.
    // The user taps "Entrar a Vivra" to navigate from the success screen.
    setCreatedPet({
      id: insertedPet.id,
      name: cleanName,
      breed: species === 'cat' ? 'Gato' : breed,
      gender,
      weightKg,
      birthDate,
      photoUrl,
    });
  };

  const filteredBreeds = breedSearch
    ? DOG_BREEDS.filter(b => b.toLowerCase().includes(breedSearch.toLowerCase()))
    : DOG_BREEDS;

  const progressWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  // ─────────────────────────────────────────────────────────────────────────
  // SUCCESS SCREEN — shown after handleFinish creates the pet. The user taps
  // "Entrar a Vivra" to navigate into the app. Replaces the immediate
  // router.replace that used to happen at the end of handleFinish.
  // ─────────────────────────────────────────────────────────────────────────
  if (createdPet) {
    // Compact age for the narrow stat cell: just the leading unit
    // (e.g. "2 años", "5 meses", "12 días") so it never truncates.
    // calculateAge returns granular strings like "2 años y 3 meses"; we keep
    // only the first "<n> <unit>" pair.
    const fullAge = createdPet.birthDate ? calculateAge(createdPet.birthDate) : '';
    const ageLabel = fullAge
      ? (fullAge.match(/^\d+\s+\S+/)?.[0] ?? fullAge)
      : '—';
    const weightLabel = createdPet.weightKg ? `${createdPet.weightKg} kg` : '—';
    const sexLabel =
      createdPet.gender === 'macho' ? 'Macho'
      : createdPet.gender === 'hembra' ? 'Hembra'
      : '—';
    const breedLabel = createdPet.breed || 'Sin raza';

    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.successBody}>
          <View style={styles.successAvatar}>
            {createdPet.photoUrl ? (
              <Image source={{ uri: createdPet.photoUrl }} style={styles.successAvatarImg} />
            ) : photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.successAvatarImg} />
            ) : (
              <Ionicons name="paw" size={44} color={Colors.accent} />
            )}
            <View style={styles.successCheck}>
              <Ionicons name="checkmark" size={18} color={Colors.white} />
            </View>
          </View>

          <Text style={styles.successTitle}>¡Todo listo!</Text>
          <Text style={styles.successSubtitle}>
            El perfil de {createdPet.name} está completo.
          </Text>

          <View style={styles.profileCard}>
            <View style={styles.profileHead}>
              <View style={styles.profileAvatar}>
                {createdPet.photoUrl ? (
                  <Image source={{ uri: createdPet.photoUrl }} style={styles.profileAvatarImg} />
                ) : photoUri ? (
                  <Image source={{ uri: photoUri }} style={styles.profileAvatarImg} />
                ) : (
                  <Ionicons name="paw" size={26} color={Colors.accent} />
                )}
              </View>
              <View style={styles.profileNameWrap}>
                <Text style={styles.profileName} numberOfLines={1}>{createdPet.name}</Text>
                <Text style={styles.profileBreed} numberOfLines={1}>{breedLabel}</Text>
              </View>
            </View>
            <View style={styles.profileDivider} />
            <View style={styles.statRow}>
              <Stat label="Edad" value={ageLabel} />
              <View style={styles.statSep} />
              <Stat label="Peso" value={weightLabel} />
              <View style={styles.statSep} />
              <Stat label="Sexo" value={sexLabel} />
            </View>
          </View>
        </View>

        <View style={styles.bottom}>
          <Button
            title="Entrar a Vivra"
            onPress={async () => {
              // Moment of value: the user just created their pet's profile —
              // ask for notification permission HERE (not at cold start) so
              // the reminders (vacunas, preventivos, peso) can do their job.
              // Fire the iOS dialog before navigating; if denied we proceed
              // anyway, the app works fine without push.
              await requestPushPermissionAndRegister();
              router.replace('/(app)' as any);
            }}
          />
        </View>
      </SafeAreaView>
    );
  }

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

          {/* Step 0: Name + optional photo */}
          {step === 0 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepIntro}>
                Empecemos por lo básico. Podrás completar el resto cuando quieras.
              </Text>

              <Text style={styles.firstFieldLabel}>¿Cómo se llama?</Text>
              <TextInput
                style={styles.bigInput}
                placeholder="Ej: Max, Luna, Rocky..."
                placeholderTextColor={Colors.cardBorder}
                value={petName}
                onChangeText={setPetName}
                autoCapitalize="words"
                maxLength={30}
                textAlign="center"
              />
              <Text style={styles.hint}>Así aparecerá en Vivra</Text>

              {/* Species picker — perros piden raza, gatos no */}
              <Text style={styles.fieldLabel}>¿Es perro o gato?</Text>
              <View style={styles.speciesRow}>
                {SPECIES_OPTIONS.map(opt => (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.speciesBtn, species === opt.key && styles.speciesBtnActive]}
                    onPress={() => setSpecies(opt.key)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={opt.label}
                  >
                    <Ionicons
                      name={opt.icon}
                      size={30}
                      color={species === opt.key ? Colors.accent : Colors.muted}
                      style={styles.speciesEmoji}
                    />
                    <Text style={[styles.speciesText, species === opt.key && styles.speciesTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity onPress={pickPhoto} activeOpacity={0.75} style={styles.photoRow}>
                <View style={styles.photoThumb}>
                  {photoUri ? (
                    <Image source={{ uri: photoUri }} style={styles.photoThumbImg} />
                  ) : (
                    <Ionicons name="camera-outline" size={24} color={Colors.accent} />
                  )}
                </View>
                <View style={styles.photoCopy}>
                  <Text style={styles.addPhoto}>{photoUri ? 'Cambiar foto' : 'Agregar foto (opcional)'}</Text>
                  <Text style={styles.photoHint}>Puedes hacerlo después</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={Colors.muted} />
              </TouchableOpacity>
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

              <Text style={styles.hint}>Todo esto es opcional; puedes completarlo después</Text>
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

          {/* Always-visible "skip entirely" affordance — co-owners or users
              who just want to look around shouldn't be forced to create a pet
              before seeing the app. Dashboard handles the no-pet empty state. */}
          {step === 0 && (
            <TouchableOpacity
              onPress={() => router.replace('/(app)' as any)}
              style={styles.skipBtn}
              disabled={saving}
            >
              <Text style={styles.skipBtnText}>Explorar Vivra sin mascota</Text>
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
  stepIntro: {
    fontSize: FontSize.md,
    color: Colors.muted,
    lineHeight: 23,
    marginBottom: Spacing.xl,
  },
  firstFieldLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.ink,
    marginBottom: Spacing.xs,
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

  // ── Species picker ──
  speciesRow: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.lg },
  speciesBtn: {
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
  speciesBtnActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  speciesEmoji: { marginBottom: 2 },
  speciesText: { fontSize: FontSize.md, fontWeight: FontWeight.medium, color: Colors.ink },
  speciesTextActive: { color: Colors.white },

  // ── Step 0 optional photo ──
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    marginTop: Spacing.sm,
  },
  photoThumb: {
    width: 52,
    height: 52,
    borderRadius: Radius.md,
    backgroundColor: Colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photoThumbImg: { width: 52, height: 52 },
  photoCopy: { flex: 1 },
  addPhoto: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.ink,
  },
  photoHint: { fontSize: FontSize.xs, color: Colors.muted, marginTop: 2 },

  // ── Success screen ──
  successBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  successAvatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
    marginBottom: Spacing.sm,
  },
  successAvatarImg: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  successCheck: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.good,
    borderWidth: 3,
    borderColor: Colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.ink,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: FontSize.md,
    color: Colors.muted,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  profileCard: {
    width: '100%',
    backgroundColor: Colors.card,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Spacing.md,
    marginTop: Spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  profileHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  profileAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  profileAvatarImg: { width: 52, height: 52 },
  profileNameWrap: { flex: 1, minWidth: 0 },
  profileName: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.ink,
  },
  profileBreed: {
    fontSize: FontSize.sm,
    color: Colors.muted,
    marginTop: 1,
  },
  profileDivider: {
    height: 1,
    backgroundColor: Colors.cardBorder,
    marginVertical: Spacing.md,
  },
  statRow: { flexDirection: 'row' },
  statSep: {
    width: 1,
    backgroundColor: Colors.cardBorder,
    marginVertical: 2,
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  statValue: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.ink,
  },
  statLabel: {
    fontSize: FontSize.xs,
    color: Colors.muted,
    marginTop: 3,
  },
});
