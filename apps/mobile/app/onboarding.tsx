import { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, FontWeight, Radius } from '../constants/theme';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/Button';
import { calculateAge, friendlyError } from '@vivra/shared';
import { onboardingSteps, onboardingBreeds, validateOnboarding, type OnboardingStep } from '../lib/onboarding';
import { asJsonObject } from '@vivra/shared/lib/database';
import { DatePickerField } from '../components/ui/DatePickerField';
import { requestPushPermissionAndRegister } from '../hooks/useNotifications';

// Lazy-load native image modules so the bundle doesn't fail if a build
// somehow ships without them (matches the pattern already used in /perfil).
let ImagePicker: typeof import('expo-image-picker') | null = null;
try { ImagePicker = require('expo-image-picker'); } catch { /* unavailable */ }
let ImageManipulator: typeof import('expo-image-manipulator') | null = null;
try { ImageManipulator = require('expo-image-manipulator'); } catch { /* unavailable */ }

const PENDING_REF_KEY = 'pending_referral';

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
  const saveInFlight = useRef(false);
  const [formError, setFormError] = useState('');

  // Form state
  const [petName, setPetName] = useState('');
  const [species, setSpecies] = useState<'dog' | 'cat' | null>(null);
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

  const steps = onboardingSteps(species);
  const currentStep = steps[step];
  const moveTo = (next: number) => {
    Keyboard.dismiss();
    setFormError('');
    setStep(next);
  };
  const goNext = () => {
    const result = validateOnboarding({ name: petName, species, birthDate, weightKg }, currentStep);
    if (result.error) { setFormError(result.error); return; }
    moveTo(step + 1);
  };
  const goBack = () => { if (!saving && step > 0) moveTo(step - 1); };

  const handleFinish = async () => {
    if (!user || saveInFlight.current) return;
    const validation = validateOnboarding({ name: petName, species, birthDate, weightKg });
    if (validation.error) { setFormError(validation.error); return; }
    saveInFlight.current = true;
    setSaving(true);
    setFormError('');
    try {

      const cleanName = petName.trim();
      // Insert + return the new row so we have its id for the photo upload
      // and for the success card.
      const { data: insertedPet, error } = await supabase
        .from('pets')
        .insert({
          user_id: user.id,
          name: cleanName,
          species: species ?? 'dog',
          breed: species === 'cat' ? null : (breed || null),
          birth_date: birthDate || null,
          gender: gender || null,
          weight_kg: validation.weight,
        })
        .select('id')
        .single();

      if (error || !insertedPet) {
        setSaving(false);
        if (error) console.warn('[onboarding] pet insert error:', error.message);
        Alert.alert('Error', error ? friendlyError(error) : 'No se pudo crear la mascota.');
        return;
      }

      // The row now exists. Keep that outcome even if optional setup fails.
      setCreatedPet({ id: insertedPet.id, name: cleanName, breed: species === 'cat' ? 'Gato' : breed, gender, weightKg, birthDate, photoUrl: null });

      // Upload the photo (if any) and persist the URL on the pet row. Failure
      // is non-blocking: the pet exists, the user can add a photo later.
      let photoUrl: string | null = null;
      if (photoUri) {
        photoUrl = await uploadPetPhoto(photoUri, user.id, insertedPet.id);
        if (photoUrl) {
          const { error: photoError } = await supabase.from('pets').update({ photo_url: photoUrl }).eq('id', insertedPet.id);
          if (photoError) { console.warn('[onboarding] photo link failed:', photoError.message); photoUrl = null; }
        }
      }

      // ── Post-pet setup: referral code + subscription + pending referral redemption ──
      // All best-effort; we don't block the user from entering the app on failures.
      try {
        // 1. Generate personal referral code (idempotent)
        const { error: referralError } = await supabase.rpc('generate_my_referral_code', { p_base: cleanName || 'PET' });
        if (referralError) console.warn('[onboarding] referral code failed:', referralError.message);
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
          const result = asJsonObject(data);
          let shouldClearPending = false;
          if (redeemErr) {
            console.warn('[onboarding] redeem_referral failed:', redeemErr.message);
            // Keep the attribution so a temporary network/server failure can be
            // retried; never silently lose a valid referral after onboarding.
          } else if (result?.ok !== true) {
            const err = typeof result?.error === 'string' ? result.error : null;
            shouldClearPending = err !== null && ['self_referral', 'invalid_code', 'referral_already_attributed'].includes(err);
            if (err && !shouldClearPending) {
              console.warn('[onboarding] redeem_referral rejected:', err, result);
            }
          } else {
            shouldClearPending = true;
            const trialDays = typeof result.referred_trial_days === 'number'
              ? result.referred_trial_days
              : 0;
            if (trialDays > 0) {
              Alert.alert(
                '¡Premium activado!',
                `Tienes ${trialDays} días de Vivra Premium gratis para probar todas las funciones.`,
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
        weightKg: validation.weight === null ? '' : String(validation.weight),
        birthDate,
        photoUrl,
      });
    } catch (error) {
      Alert.alert('No pudimos guardar', friendlyError(error instanceof Error ? error : null));
    } finally {
      saveInFlight.current = false;
      setSaving(false);
    }
  };

  const filteredBreeds = onboardingBreeds.filter(({ label }) =>
    label.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(
      breedSearch.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(),
    ),
  );
  const petLabel = petName.trim() || 'tu mascota';
  const titles: Record<OnboardingStep, string> = {
    species: '¿Qué mascota tienes?', name: '¿Cómo se llama?', breed: `¿Qué raza es ${petLabel}?`,
    gender: `¿${petLabel} es macho o hembra?`, birthDate: `¿Cuándo nació ${petLabel}?`,
    weight: `¿Cuánto pesa ${petLabel}?`, photo: `Una foto de ${petLabel}`,
  };

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
    const breedLabel = onboardingBreeds.find(b => b.value === createdPet.breed)?.label || createdPet.breed || 'Raza sin indicar';

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
            El perfil de {createdPet.name} ya está creado.
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
            loading={saving}
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
    <SafeAreaView style={styles.safe} testID="screen-onboarding">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <View style={styles.header}>
          <TouchableOpacity onPress={step > 0 ? goBack : () => router.replace('/(app)')} disabled={saving}
            accessibilityLabel="Volver" style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color={Colors.ink} />
          </TouchableOpacity>
          <Text style={styles.stepLabel}>Paso {step + 1} de {steps.length}</Text>
          <TouchableOpacity onPress={signOut} disabled={saving} accessibilityLabel="Cerrar sesión">
            <Text style={styles.skipText}>Salir</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.progressBg} accessibilityLabel={`Paso ${step + 1} de ${steps.length}`}>
          <View style={[styles.progressFill, { width: `${((step + 1) / steps.length) * 100}%` }]} />
        </View>
        <ScrollView key={currentStep} style={styles.flex} contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}>
          <Text style={styles.title} accessibilityRole="header">{titles[currentStep]}</Text>
          {currentStep === 'species' && <View style={styles.options}>
            {SPECIES_OPTIONS.map(option => <TouchableOpacity key={option.key}
              testID={`onboarding-species-${option.key}`} accessibilityRole="button" accessibilityLabel={option.label}
              accessibilityState={{ selected: species === option.key }} style={[styles.choice, species === option.key && styles.choiceActive]}
              onPress={() => { if (species !== option.key) setBreed(''); setSpecies(option.key); moveTo(1); }}>
              <View style={styles.choiceIcon}><Ionicons name={option.icon} size={30} color={Colors.accent} /></View>
              <Text style={styles.choiceLabel}>{option.label}</Text>
              <Ionicons name="chevron-forward" size={20} color={Colors.muted} />
            </TouchableOpacity>)}
          </View>}
          {currentStep === 'name' && <>
            <Text style={styles.intro}>Así aparecerá en su perfil. Puedes cambiarlo después.</Text>
            <TextInput testID="onboarding-name" accessibilityLabel="Nombre de tu mascota" style={styles.bigInput}
              placeholder="Nombre de tu mascota" placeholderTextColor={Colors.muted} value={petName}
              onChangeText={value => { setPetName(value); setFormError(''); }} autoCapitalize="words" autoFocus maxLength={30}
              returnKeyType="next" onSubmitEditing={goNext} />
          </>}
          {currentStep === 'breed' && <>
            <TextInput testID="onboarding-breed-search" accessibilityLabel="Buscar raza" style={styles.searchInput}
              placeholder="Buscar raza" placeholderTextColor={Colors.muted} value={breedSearch} onChangeText={setBreedSearch}
              autoCorrect={false} returnKeyType="done" onSubmitEditing={Keyboard.dismiss} />
            <Text style={styles.intro}>Si no la sabes, puedes elegir Mestizo o continuar sin indicarla.</Text>
            {filteredBreeds.map(option => <TouchableOpacity key={option.value} accessibilityRole="radio"
              accessibilityLabel={option.label} accessibilityState={{ checked: breed === option.value }}
              onPress={() => { setBreed(option.value); Keyboard.dismiss(); }}
              style={[styles.breedOption, breed === option.value && styles.choiceActive]}>
              <Text style={styles.breedText}>{option.label}</Text>
              <Ionicons name={breed === option.value ? 'radio-button-on' : 'radio-button-off'} size={24} color={Colors.accent} />
            </TouchableOpacity>)}
            {!filteredBreeds.length && <Text style={styles.intro}>No encontramos esa raza. Prueba otro nombre o continúa sin indicarla.</Text>}
          </>}
          {currentStep === 'gender' && <View style={styles.options}>
            {GENDER_OPTIONS.map(option => <TouchableOpacity key={option.key} accessibilityRole="button"
              accessibilityLabel={option.label} accessibilityState={{ selected: gender === option.key }}
              style={[styles.choice, gender === option.key && styles.choiceActive]}
              onPress={() => { setGender(option.key); moveTo(step + 1); }}>
              <View style={styles.choiceIcon}><Ionicons name={option.icon} size={26} color={Colors.ink} /></View>
              <Text style={styles.choiceLabel}>{option.label}</Text>
              <Ionicons name="chevron-forward" size={20} color={Colors.muted} />
            </TouchableOpacity>)}
          </View>}
          {currentStep === 'birthDate' && <>
            <Text style={styles.intro}>Una fecha aproximada está bien. Nos ayuda a mostrar su edad.</Text>
            <DatePickerField label="Fecha de nacimiento" value={birthDate} onChange={setBirthDate} maxDate={new Date()} clearable />
          </>}
          {currentStep === 'weight' && <>
            <Text style={styles.intro}>Usaremos este dato como punto de partida. Si no lo sabes, agrégalo después.</Text>
            <View style={styles.weightField}>
              <TextInput testID="onboarding-weight" accessibilityLabel="Peso en kilogramos" style={styles.weightInput}
                placeholder="Ej. 6,5" placeholderTextColor={Colors.muted} value={weightKg}
                onChangeText={value => { setWeightKg(value); setFormError(''); }} keyboardType="decimal-pad" autoFocus />
              <Text style={styles.unit}>kg</Text>
            </View>
          </>}
          {currentStep === 'photo' && <>
            <Text style={styles.intro}>Dale un toque personal a su perfil. También puedes hacerlo después.</Text>
            <TouchableOpacity onPress={pickPhoto} disabled={saving} accessibilityLabel={photoUri ? 'Cambiar foto' : 'Agregar foto'} style={styles.photoPicker}>
              {photoUri ? <Image source={{ uri: photoUri }} style={styles.photoImage} /> : <Ionicons name="camera-outline" size={48} color={Colors.accent} />}
            </TouchableOpacity>
            <Text style={styles.hint}>{photoUri ? 'Toca para cambiar la foto' : 'Agregar foto (opcional)'}</Text>
          </>}
          {!!formError && <Text accessibilityRole="alert" style={styles.error}>{formError}</Text>}
        </ScrollView>
        <View style={styles.bottom}>
          {!['species', 'gender'].includes(currentStep) && <Button
            title={currentStep === 'photo' ? 'Crear perfil' : 'Continuar'}
            onPress={currentStep === 'photo' ? handleFinish : goNext} loading={saving}
            disabled={currentStep === 'name' && !petName.trim()} style={styles.continueButton} />}
          {['breed', 'gender', 'birthDate', 'weight'].includes(currentStep) && <TouchableOpacity
            style={styles.skipBtn} onPress={() => {
              if (currentStep === 'breed') setBreed('');
              if (currentStep === 'gender') setGender('');
              if (currentStep === 'birthDate') setBirthDate('');
              if (currentStep === 'weight') setWeightKg('');
              moveTo(step + 1);
            }}><Text style={styles.skipBtnText}>Agregar después</Text></TouchableOpacity>}
          {currentStep === 'species' && <TouchableOpacity style={styles.skipBtn} onPress={() => router.replace('/(app)')}>
            <Text style={styles.skipBtnText}>Explorar sin mascota</Text>
          </TouchableOpacity>}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.white },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 12 },
  backButton: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.canvas, alignItems: 'center', justifyContent: 'center' },
  stepLabel: { fontSize: 13, color: Colors.muted },
  skipText: { fontSize: 14, color: Colors.muted, padding: 8 },
  progressBg: { height: 3, backgroundColor: Colors.canvas, marginHorizontal: 24, borderRadius: 2 },
  progressFill: { height: 3, backgroundColor: Colors.accent, borderRadius: 2 },
  content: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 32, paddingBottom: 24 },
  title: { fontSize: 30, lineHeight: 37, fontWeight: FontWeight.bold, color: Colors.ink, marginBottom: 28 },
  intro: { fontSize: 16, lineHeight: 24, color: Colors.muted, marginBottom: 24 },
  options: { gap: 12 },
  choice: { minHeight: 94, padding: 20, backgroundColor: Colors.canvas, borderRadius: 24, borderWidth: 1, borderColor: Colors.canvas, flexDirection: 'row', alignItems: 'center', gap: 16 },
  choiceActive: { backgroundColor: Colors.accentLight, borderColor: Colors.accent },
  choiceIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center' },
  choiceLabel: { fontSize: 21, fontWeight: FontWeight.semibold, color: Colors.ink, flex: 1 },
  bigInput: { borderWidth: 2, borderColor: Colors.accent, borderRadius: 30, paddingHorizontal: 22, paddingVertical: 18, fontSize: 21, color: Colors.ink },
  searchInput: { borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 30, paddingHorizontal: 22, paddingVertical: 16, fontSize: 17, color: Colors.ink, marginBottom: 16 },
  breedOption: { backgroundColor: Colors.canvas, borderWidth: 1, borderColor: Colors.canvas, borderRadius: 18, padding: 18, marginBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  breedText: { flex: 1, fontSize: 17, color: Colors.ink },
  weightField: { flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderColor: Colors.accent, borderRadius: 30, paddingHorizontal: 22 },
  weightInput: { flex: 1, paddingVertical: 18, fontSize: 24, color: Colors.ink },
  unit: { fontSize: 20, color: Colors.ink },
  photoPicker: { alignSelf: 'center', width: 160, height: 160, borderRadius: 80, backgroundColor: Colors.accentLight, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  photoImage: { width: 160, height: 160 },
  hint: { textAlign: 'center', fontSize: 14, color: Colors.muted, marginTop: 16 },
  error: { color: Colors.bad, fontSize: 15, marginTop: 16 },
  bottom: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 12, gap: 8, backgroundColor: Colors.white },
  continueButton: { borderRadius: 30, minHeight: 56 },
  skipBtn: { alignItems: 'center', paddingVertical: 12 },
  skipBtnText: { fontSize: 15, color: Colors.muted },

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
