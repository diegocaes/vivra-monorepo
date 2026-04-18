import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, RefreshControl, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
let ImagePicker: typeof import('expo-image-picker') | null = null;
try { ImagePicker = require('expo-image-picker'); } catch {}
let ImageManipulator: typeof import('expo-image-manipulator') | null = null;
try { ImageManipulator = require('expo-image-manipulator'); } catch {}
import { Colors, PetThemeColors, Spacing, FontSize, FontWeight, Radius } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { usePetContext } from '../../contexts/PetContext';
import { calculateAge, formatDate } from '@vivra/shared';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { FormField } from '../../components/ui/FormField';
import { SelectField } from '../../components/ui/SelectField';
import { useSubscription } from '../../hooks/useSubscription';
import { PremiumGate } from '../../components/ui/PremiumGate';
import { FREE_LIMITS } from '../../constants/revenueCat';
import { SpendingSummary } from '../../components/pet/SpendingSummary';
import { SharePetSheet } from '../../components/pet/SharePetSheet';
import * as Linking from 'expo-linking';

const THEME_COLORS = Object.entries(PetThemeColors).map(([key, hex]) => ({ key, hex }));

const GENDER_OPTIONS = [
  { key: 'macho', label: 'Macho' },
  { key: 'hembra', label: 'Hembra' },
];

const SUPPORT_OPTIONS = [
  { key: '', label: 'No aplica' },
  { key: 'emotional_support', label: 'Emotional Support (ESA)' },
  { key: 'service', label: 'Service Dog' },
];

const FAQ_ITEMS = [
  {
    q: '¿Qué es el score de bienestar?',
    a: 'Un número de 0 a 100 que resume qué tan bien documentado está el cuidado de tu perro. Se calcula con 5 pilares de 20 pts cada uno: peso (vs. rango ideal de la raza), cuidado preventivo (vacunas, vet, antipulgas, desparasitante), raza y edad, actividad (paseos + grooming) y nutrición. No es un diagnóstico médico.',
  },
  {
    q: '¿Un score bajo significa que mi perro está enfermo?',
    a: 'No. Un score bajo casi siempre significa que faltan datos registrados, no que haya un problema real. Solo refleja lo que está en Vivra. A medida que completes el perfil, el score sube. Si te preocupa algo concreto, siempre consulta al vet.',
  },
  {
    q: '¿Vivra reemplaza al veterinario?',
    a: 'No. Vivra es un diario digital para organizar la información de tu mascota. Tu veterinario sigue siendo esencial para diagnósticos y tratamientos.',
  },
  {
    q: '¿Puedo tener varias mascotas?',
    a: 'Sí. Con el plan gratuito puedes tener 1 mascota. Con Vivra Premium puedes agregar hasta 5.',
  },
  {
    q: '¿Mis datos están seguros?',
    a: 'Sí. Usamos Supabase con encriptación de datos. Solo tú puedes acceder a la información de tus mascotas.',
  },
];

export default function PerfilScreen() {
  const { user, signOut } = useAuth();
  const { isPremium } = useSubscription();
  const router = useRouter();
  const petData = usePetContext();
  const { pet, pets, isOwner, coOwners, setActivePetId, refresh } = petData;
  const [refreshing, setRefreshing] = useState(false);
  const [showFaq, setShowFaq] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  // Edit form
  const [showEdit, setShowEdit] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [breed, setBreed] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [chipId, setChipId] = useState('');
  const [color, setColor] = useState('');
  const [supportType, setSupportType] = useState('');

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const openEdit = () => {
    if (!pet) return;
    setName(pet.name); setBreed(pet.breed ?? ''); setBirthDate(pet.birth_date ?? '');
    setGender(pet.gender ?? ''); setWeightKg(pet.weight_kg?.toString() ?? '');
    setChipId(pet.chip_id ?? ''); setColor(pet.color ?? '');
    setSupportType(pet.support_type ?? '');
    setShowEdit(true);
  };

  const handleSave = async () => {
    if (!pet) return;
    if (!name.trim()) { Alert.alert('Error', 'El nombre es obligatorio'); return; }
    setSaving(true);

    const newWeight = weightKg ? parseFloat(weightKg) : null;
    const weightChanged = newWeight !== null && newWeight !== pet.weight_kg;

    const { error } = await supabase.from('pets').update({
      name: name.trim(),
      breed: breed || null,
      birth_date: birthDate || null,
      gender: gender || null,
      weight_kg: newWeight,
      chip_id: chipId || null,
      color: color || null,
      support_type: supportType || null,
    }).eq('id', pet.id);

    if (!error && weightChanged && newWeight) {
      await supabase.from('weight_records').insert({
        pet_id: pet.id,
        weight_kg: newWeight,
        date: new Date().toISOString().slice(0, 10),
        notes: 'Actualizado desde perfil',
      });
    }

    setSaving(false);
    if (error) { Alert.alert('Error', error.message); return; }
    setShowEdit(false);
    refresh();
  };

  const handleSetTheme = async (themeColor: string) => {
    if (!pet) return;
    await supabase.from('pets').update({ theme_color: themeColor }).eq('id', pet.id);
    refresh();
  };

  const handleDeletePet = () => {
    if (!pet) return;
    Alert.alert(
      'Eliminar mascota',
      `¿Estás seguro de que quieres eliminar a ${pet.name}? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar', style: 'destructive',
          onPress: async () => {
            await supabase.from('pets').delete().eq('id', pet.id);
            signOut();
          },
        },
      ],
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Eliminar cuenta',
      'Se eliminarán permanentemente tu cuenta y todos los datos de tus mascotas. Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar cuenta', style: 'destructive',
          onPress: () => {
            Alert.alert(
              '¿Estás completamente seguro?',
              'Todos tus datos serán eliminados permanentemente.',
              [
                { text: 'No, cancelar', style: 'cancel' },
                {
                  text: 'Sí, eliminar todo', style: 'destructive',
                  onPress: async () => {
                    try {
                      const { error } = await supabase.functions.invoke('delete-account');
                      if (error) throw error;
                      await signOut();
                    } catch (e: any) {
                      Alert.alert('Error', 'No se pudo eliminar la cuenta. Contacta soporte.');
                    }
                  },
                },
              ],
            );
          },
        },
      ],
    );
  };

  const handleChangePhoto = async () => {
    if (!ImagePicker) {
      Alert.alert('No disponible', 'La función de fotos no está disponible en este momento.');
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a tu galería para cambiar la foto.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (result.canceled || !pet || !user) return;

    let uri = result.assets[0].uri;

    // Resize to max 1080px and compress to JPEG for consistent uploads
    if (ImageManipulator) {
      try {
        const manipulated = await ImageManipulator.manipulateAsync(
          uri,
          [{ resize: { width: 1080 } }],
          { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
        );
        uri = manipulated.uri;
      } catch {
        // Fall back to original if manipulation fails
      }
    }

    const ext = 'jpg';
    const fileName = `${user.id}/${pet.id}.${ext}`;

    const response = await fetch(uri);
    const blob = await response.blob();

    if (blob.size > 5 * 1024 * 1024) {
      Alert.alert('Imagen muy grande', 'La foto debe ser menor a 5 MB. Intenta con otra imagen.');
      return;
    }

    const arrayBuffer = await new Response(blob).arrayBuffer();

    const { error: uploadError } = await supabase.storage
      .from('pet-photos')
      .upload(fileName, arrayBuffer, { contentType: `image/${ext}`, upsert: true });

    if (uploadError) {
      Alert.alert('Error', 'No se pudo subir la foto.');
      return;
    }

    const { data: urlData } = supabase.storage.from('pet-photos').getPublicUrl(fileName);
    const photoUrl = urlData.publicUrl + '?t=' + Date.now();

    await supabase.from('pets').update({ photo_url: photoUrl }).eq('id', pet.id);
    refresh();
  };

  const handleAddPet = () => {
    if (!isPremium && pets.length >= FREE_LIMITS.MAX_PETS) {
      Alert.alert(
        'Mascota adicional',
        'Con el plan gratuito puedes tener 1 mascota. Actualiza a Premium para agregar más.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Ver Premium', onPress: () => router.push('/paywall' as any) },
        ],
      );
      return;
    }
    router.push('/onboarding' as any);
  };

  // Profile completion
  const fields = pet ? [pet.name, pet.breed, pet.birth_date, pet.gender, pet.photo_url, pet.weight_kg, pet.chip_id, pet.color] : [];
  const completed = fields.filter(Boolean).length;
  const completionPct = Math.round((completed / 8) * 100);

  const themeColor = PetThemeColors[pet?.theme_color ?? 'orange'] ?? Colors.accent;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Perfil</Text>
        {pet && (
          <TouchableOpacity onPress={openEdit}>
            <Ionicons name="create-outline" size={24} color={Colors.accent} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
      >
        {pet ? (
          <>
            {/* Pet switcher */}
            {pets.length > 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.petChips}>
                {pets.map(p => {
                  const isActive = p.id === pet.id;
                  const chipColor = PetThemeColors[p.theme_color ?? 'orange'] ?? Colors.accent;
                  return (
                    <TouchableOpacity
                      key={p.id}
                      onPress={() => setActivePetId(p.id)}
                      activeOpacity={0.7}
                      style={[styles.petChip, isActive && { backgroundColor: chipColor, borderColor: chipColor }]}
                    >
                      <Text style={[styles.petChipText, isActive && { color: Colors.white }]}>{p.name}</Text>
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity onPress={handleAddPet} style={styles.addPetChip}>
                  <Ionicons name="add" size={16} color={Colors.accent} />
                </TouchableOpacity>
              </ScrollView>
            )}

            {/* Pet hero */}
            <View style={[styles.heroCard, { backgroundColor: themeColor }]}>
              <TouchableOpacity onPress={handleChangePhoto} activeOpacity={0.8}>
                {pet.photo_url ? (
                  <Image source={{ uri: pet.photo_url }} style={styles.heroPhoto} />
                ) : (
                  <View style={styles.heroPlaceholder}>
                    <Ionicons name="camera" size={28} color="rgba(255,255,255,0.6)" />
                  </View>
                )}
                <View style={styles.photoEditBadge}>
                  <Ionicons name="pencil" size={10} color={Colors.white} />
                </View>
              </TouchableOpacity>
              <Text style={styles.heroName}>{pet.name}</Text>
              {pet.breed && <Text style={styles.heroBreed}>{pet.breed}</Text>}
              <Text style={styles.heroAge}>
                {pet.birth_date ? calculateAge(pet.birth_date) : ''}
                {pet.weight_kg ? ` · ${pet.weight_kg} kg` : ''}
              </Text>
            </View>

            {/* Completion — hide when 100% */}
            {completionPct < 100 && (
              <Card>
                <View style={styles.completionRow}>
                  <Text style={styles.completionLabel}>Perfil completo</Text>
                  <Text style={styles.completionPct}>{completionPct}%</Text>
                </View>
                <View style={styles.completionBg}>
                  <View style={[styles.completionFill, { width: `${completionPct}%`, backgroundColor: Colors.accent }]} />
                </View>
                <Text style={styles.completionHint}>{completed}/8 campos completados</Text>
              </Card>
            )}

            {/* Info cards */}
            <Card>
              <Text style={styles.sectionTitle}>Datos de {pet.name}</Text>
              <InfoRow label="Nombre" value={pet.name} />
              <InfoRow label="Raza" value={pet.breed} />
              <InfoRow label="Nacimiento" value={pet.birth_date ? formatDate(pet.birth_date) : null} />
              <InfoRow label="Género" value={pet.gender === 'macho' ? 'Macho' : pet.gender === 'hembra' ? 'Hembra' : null} />
              <InfoRow label="Peso" value={pet.weight_kg ? `${pet.weight_kg} kg` : null} />
              <InfoRow label="Microchip" value={pet.chip_id} />
              <InfoRow label="Color pelaje" value={pet.color} />
              <InfoRow label="Tipo soporte" value={
                pet.support_type === 'emotional_support' ? 'ESA' :
                pet.support_type === 'service' ? 'Service Dog' : null
              } />
            </Card>

            {/* Spending summary */}
            <SpendingSummary petId={pet.id} isPremium={isPremium} />

            {/* Export passport */}
            {isPremium ? (
              <TouchableOpacity
                style={styles.passportBtn}
                onPress={() => Linking.openURL(`https://vivrapet.com/print?petId=${pet.id}`)}
                activeOpacity={0.8}
              >
                <Ionicons name="document-text-outline" size={20} color={Colors.accent} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.passportTitle}>Exportar pasaporte</Text>
                  <Text style={styles.passportDesc}>Genera el pasaporte de viaje de {pet.name}</Text>
                </View>
                <Ionicons name="open-outline" size={18} color={Colors.accent} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.passportBtn}
                onPress={() => router.push('/paywall' as any)}
                activeOpacity={0.8}
              >
                <Ionicons name="document-text-outline" size={20} color={Colors.muted} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.passportTitle}>Exportar pasaporte</Text>
                  <Text style={styles.passportDesc}>Disponible con Premium</Text>
                </View>
                <Ionicons name="lock-closed" size={18} color={Colors.muted} />
              </TouchableOpacity>
            )}

            {/* Theme color */}
            <Card>
              <Text style={styles.sectionTitle}>Color del perfil</Text>
              {isPremium ? (
                <View style={styles.colorGrid}>
                  {THEME_COLORS.map(({ key, hex }) => (
                    <TouchableOpacity
                      key={key}
                      style={[
                        styles.colorCircle,
                        { backgroundColor: hex },
                        pet.theme_color === key && styles.colorCircleActive,
                      ]}
                      onPress={() => handleSetTheme(key)}
                    />
                  ))}
                </View>
              ) : (
                <PremiumGate feature="Los temas de color" />
              )}
            </Card>

            {/* Premium upsell */}
            {!isPremium && (
              <TouchableOpacity style={styles.premiumCard} onPress={() => router.push('/paywall' as any)}>
                <View style={styles.premiumIconWrap}>
                  <Ionicons name="star" size={20} color={Colors.white} />
                </View>
                <View style={styles.premiumInfo}>
                  <Text style={styles.premiumTitle}>Vivra Premium</Text>
                  <Text style={styles.premiumDesc}>Estadísticas, PDF, mascotas ilimitadas y más</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={Colors.accent} />
              </TouchableOpacity>
            )}

            {/* Account */}
            <Card>
              <Text style={styles.sectionTitle}>Cuenta</Text>
              <InfoRow label="Email" value={user?.email ?? null} />
              {isPremium && <InfoRow label="Plan" value="Premium" />}

              {/* Co-owner row */}
              {pet && isOwner && (
                <TouchableOpacity
                  style={styles.coOwnerRow}
                  onPress={() => {
                    if (isPremium) setShowShareSheet(true);
                    else router.push('/premium' as any);
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="people-outline" size={20} color={Colors.accent} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.coOwnerLabel}>
                      {coOwners.length > 0
                        ? (coOwners[0]?.shared_with_name || coOwners[0]?.shared_with_email || `Co-dueño (${coOwners.length})`)
                        : 'Agregar co-dueño'}
                    </Text>
                    <Text style={styles.coOwnerSub}>
                      {coOwners.length > 0
                        ? (coOwners.length > 1 ? `+${coOwners.length - 1} más · Administrar acceso` : 'Co-dueño · Administrar acceso')
                        : isPremium ? `Comparte a ${pet.name}` : 'Disponible con Premium'}
                    </Text>
                  </View>
                  <Ionicons name={coOwners.length > 0 ? 'chevron-forward' : 'add-circle-outline'} size={20} color={Colors.accent} />
                </TouchableOpacity>
              )}

              {/* Invite friends row */}
              <TouchableOpacity
                style={styles.coOwnerRow}
                onPress={() => router.push('/referidos' as any)}
                activeOpacity={0.7}
              >
                <Ionicons name="gift-outline" size={20} color={Colors.accent} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.coOwnerLabel}>Invitar amigos</Text>
                  <Text style={styles.coOwnerSub}>Gana recompensas por cada referido</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={Colors.accent} />
              </TouchableOpacity>

              <Button title="Cerrar sesión" onPress={signOut} variant="outline" style={{ marginTop: Spacing.md }} />
            </Card>

            {/* FAQ - minimalist collapsible */}
            <TouchableOpacity
              style={styles.faqToggle}
              onPress={() => setShowFaq(!showFaq)}
              activeOpacity={0.7}
            >
              <Ionicons name="help-circle-outline" size={18} color={Colors.muted} />
              <Text style={styles.faqToggleText}>Preguntas frecuentes</Text>
              <Ionicons name={showFaq ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.muted} />
            </TouchableOpacity>
            {showFaq && (
              <Card>
                {FAQ_ITEMS.map((item, i) => (
                  <TouchableOpacity
                    key={i}
                    onPress={() => setExpandedFaq(expandedFaq === i ? null : i)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.faqRow}>
                      <Text style={styles.faqQuestion}>{item.q}</Text>
                      <Ionicons name={expandedFaq === i ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.muted} />
                    </View>
                    {expandedFaq === i && (
                      <Text style={styles.faqAnswer}>{item.a}</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </Card>
            )}

            {/* Danger zone */}
            <Card>
              <Text style={[styles.sectionTitle, { color: Colors.bad }]}>Zona de peligro</Text>
              {petData.isOwner ? (
                <TouchableOpacity style={styles.dangerBtn} onPress={handleDeletePet}>
                  <Ionicons name="trash-outline" size={16} color={Colors.bad} />
                  <Text style={styles.dangerText}>Eliminar a {pet.name}</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.dangerBtn} onPress={() => {
                  Alert.alert(
                    'Dejar de seguir',
                    `¿Seguro que quieres dejar de seguir a ${pet.name}? Perderás el acceso a su información.`,
                    [
                      { text: 'Cancelar', style: 'cancel' },
                      {
                        text: 'Dejar de seguir', style: 'destructive', onPress: async () => {
                          await supabase.from('pet_shares').delete().eq('pet_id', pet.id).eq('shared_with', user!.id);
                          petData.refresh();
                        },
                      },
                    ],
                  );
                }}>
                  <Ionicons name="log-out-outline" size={16} color={Colors.bad} />
                  <Text style={styles.dangerText}>Dejar de seguir a {pet.name}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.dangerBtn} onPress={handleDeleteAccount}>
                <Ionicons name="warning-outline" size={16} color={Colors.bad} />
                <Text style={styles.dangerText}>Eliminar mi cuenta</Text>
              </TouchableOpacity>
            </Card>

            {/* Add pet button (if only 1 pet) */}
            {pets.length === 1 && (
              <TouchableOpacity style={styles.addPetBtn} onPress={handleAddPet}>
                <Ionicons name="add-circle-outline" size={20} color={Colors.accent} />
                <Text style={styles.addPetText}>Agregar otra mascota</Text>
                {!isPremium && <PremiumGate feature="" compact />}
              </TouchableOpacity>
            )}
          </>
        ) : (
          <>
            <Card>
              <View style={styles.emptyCard}>
                <Ionicons name="paw-outline" size={36} color={Colors.cardBorder} />
                <Text style={styles.emptyTitle}>Sin mascota</Text>
                <Text style={styles.emptyText}>Crea el perfil de tu mascota para empezar</Text>
                <Button
                  title="Agregar mascota"
                  onPress={() => router.replace('/onboarding' as any)}
                  style={{ marginTop: Spacing.md }}
                />
              </View>
            </Card>
            <Card>
              <Text style={styles.sectionTitle}>Cuenta</Text>
              <InfoRow label="Email" value={user?.email ?? null} />
              <Button title="Cerrar sesión" onPress={signOut} variant="outline" style={{ marginTop: Spacing.md }} />
              <TouchableOpacity style={styles.dangerBtn} onPress={handleDeleteAccount}>
                <Ionicons name="warning-outline" size={16} color={Colors.bad} />
                <Text style={styles.dangerText}>Eliminar mi cuenta</Text>
              </TouchableOpacity>
            </Card>
          </>
        )}
      </ScrollView>

      {/* Edit form */}
      <BottomSheet visible={showEdit} onClose={() => setShowEdit(false)} title="Editar perfil">
        <FormField label="Nombre" value={name} onChangeText={setName} placeholder="Nombre de tu mascota" />
        <FormField label="Raza" value={breed} onChangeText={setBreed} placeholder="Ej: Labrador Retriever" />
        <FormField label="Fecha de nacimiento" value={birthDate} onChangeText={setBirthDate} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" />
        <SelectField label="Género" value={gender} options={GENDER_OPTIONS} onSelect={setGender} />
        <FormField label="Peso (kg)" value={weightKg} onChangeText={setWeightKg} placeholder="Ej: 12.5" keyboardType="decimal-pad" />
        <FormField label="Microchip ID" value={chipId} onChangeText={setChipId} placeholder="Número de chip" />
        <FormField label="Color pelaje" value={color} onChangeText={setColor} placeholder="Ej: Dorado, Negro" />
        <SelectField label="Tipo de soporte" value={supportType} options={SUPPORT_OPTIONS} onSelect={setSupportType} />
        <Button title="Guardar" onPress={handleSave} loading={saving} style={{ marginTop: Spacing.sm }} />
      </BottomSheet>

      <SharePetSheet visible={showShareSheet} onClose={() => setShowShareSheet(false)} />
    </SafeAreaView>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, !value && styles.infoEmpty]} numberOfLines={1}>{value ?? '—'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.canvas },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
  },
  title: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.ink },
  scroll: { flex: 1 },
  content: { padding: Spacing.lg, paddingTop: Spacing.sm, gap: Spacing.sm, paddingBottom: Spacing.xxl },
  // Pet chips
  petChips: { flexDirection: 'row', gap: Spacing.sm, paddingBottom: Spacing.xs },
  petChip: {
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs + 2, borderRadius: Radius.full,
    backgroundColor: Colors.card, borderWidth: 1.5, borderColor: Colors.cardBorder,
  },
  petChipText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.ink },
  addPetChip: {
    width: 32, height: 32, borderRadius: Radius.full, backgroundColor: Colors.accentLight,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: Colors.accent + '30',
  },
  // Hero
  heroCard: { borderRadius: Radius.xl, padding: Spacing.lg, alignItems: 'center' },
  heroPhoto: { width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderColor: 'rgba(255,255,255,0.5)' },
  heroPlaceholder: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  photoEditBadge: {
    position: 'absolute', bottom: 0, right: 0, width: 22, height: 22, borderRadius: 11,
    backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.white,
  },
  heroName: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.white, marginTop: Spacing.sm },
  heroBreed: { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  heroAge: { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  // Completion
  completionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  completionLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.ink },
  completionPct: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.accent },
  completionBg: { height: 6, backgroundColor: Colors.cardBorder, borderRadius: Radius.full, overflow: 'hidden', marginTop: Spacing.sm },
  completionFill: { height: 6, borderRadius: Radius.full },
  completionHint: { fontSize: FontSize.xs, color: Colors.muted, marginTop: Spacing.xs },
  // Info rows
  sectionTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.ink, marginBottom: Spacing.sm },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.xs, borderBottomWidth: 1, borderBottomColor: Colors.cardBorder },
  infoLabel: { fontSize: FontSize.sm, color: Colors.muted, flexShrink: 0 },
  infoValue: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.ink, flexShrink: 1, textAlign: 'right' as const },
  infoEmpty: { color: Colors.cardBorder },
  // Co-owner
  coOwnerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.cardBorder, marginTop: Spacing.sm },
  coOwnerLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.ink },
  coOwnerSub: { fontSize: FontSize.xs, color: Colors.muted, marginTop: 2 },
  // Colors
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  colorCircle: { width: 36, height: 36, borderRadius: 18 },
  colorCircleActive: { borderWidth: 3, borderColor: Colors.ink },
  // FAQ - minimalist
  faqToggle: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.xs, paddingVertical: Spacing.sm,
  },
  faqToggleText: { fontSize: FontSize.sm, color: Colors.muted },
  faqRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.cardBorder },
  faqQuestion: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.ink, flex: 1, marginRight: Spacing.sm },
  faqAnswer: { fontSize: FontSize.sm, color: Colors.muted, lineHeight: 20, paddingVertical: Spacing.sm },
  // Empty
  emptyCard: { alignItems: 'center', paddingVertical: Spacing.md },
  emptyTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.ink, marginTop: Spacing.sm },
  emptyText: { fontSize: FontSize.sm, color: Colors.muted, marginTop: 2 },
  // Danger zone
  dangerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.xs, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.cardBorder,
  },
  dangerText: { fontSize: FontSize.sm, color: Colors.bad, fontWeight: FontWeight.medium },
  // Add pet
  addPetBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
    paddingVertical: Spacing.md, backgroundColor: Colors.card, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.cardBorder,
  },
  addPetText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.accent },
  // Premium
  premiumCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.accentLight, borderRadius: Radius.lg, padding: Spacing.lg,
    borderWidth: 1, borderColor: Colors.accent + '30',
  },
  premiumIconWrap: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  premiumInfo: { flex: 1 },
  premiumTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.ink },
  premiumDesc: { fontSize: FontSize.sm, color: Colors.muted, marginTop: 2 },
  // Passport
  passportBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.cardBorder,
  },
  passportTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.ink },
  passportDesc: { fontSize: FontSize.xs, color: Colors.muted, marginTop: 1 },
});
