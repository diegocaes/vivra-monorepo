import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert,
  RefreshControl, ActivityIndicator, Image, Modal, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  buildVaccineOverview, daysUntilDate, formatDate, friendlyError,
  localDateKey, vaccineBrandOptions, vaccineOptionsForSpecies, vaccineScheduleStatus,
  type VaccineScheduleStatus,
} from '@vivra/shared';
import { Colors, Spacing, FontSize, FontWeight, Radius } from '../../../constants/theme';
import { supabase } from '../../../lib/supabase';
import { usePetContext } from '../../../contexts/PetContext';
import { useAuth } from '../../../hooks/useAuth';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { BottomSheet } from '../../../components/ui/BottomSheet';
import { FormField } from '../../../components/ui/FormField';
import { DatePickerField } from '../../../components/ui/DatePickerField';
import { SelectField } from '../../../components/ui/SelectField';
import type { Vaccine } from '@vivra/shared/lib/database';
import { track } from '../../../lib/analytics';

let ImagePicker: typeof import('expo-image-picker') | null = null;
try { ImagePicker = require('expo-image-picker'); } catch {}
let ImageManipulator: typeof import('expo-image-manipulator') | null = null;
try { ImageManipulator = require('expo-image-manipulator'); } catch {}

const BRAND_OPTIONS = vaccineBrandOptions();

const STATUS_STYLE: Record<VaccineScheduleStatus, {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  background: string;
  border: string;
}> = {
  overdue: { label: 'Fecha pendiente', icon: 'alert-circle-outline', color: '#DC2626', background: '#FEF2F2', border: '#FECACA' },
  due_soon: { label: 'Próxima', icon: 'calendar-outline', color: '#C2410C', background: '#FFF7ED', border: '#FED7AA' },
  scheduled: { label: 'Programada', icon: 'calendar-clear-outline', color: '#2563EB', background: '#EFF6FF', border: '#BFDBFE' },
  recorded: { label: 'Registrada', icon: 'checkmark-circle-outline', color: '#15803D', background: '#F0FDF4', border: '#BBF7D0' },
};

function scheduleDetail(vaccine: Vaccine): string {
  if (!vaccine.next_due) return 'Sin próxima fecha registrada';
  const days = daysUntilDate(vaccine.next_due);
  if (days < 0) return `${formatDate(vaccine.next_due)} · hace ${Math.abs(days)} día${Math.abs(days) === 1 ? '' : 's'}`;
  if (days === 0) return `${formatDate(vaccine.next_due)} · corresponde hoy`;
  if (days === 1) return `${formatDate(vaccine.next_due)} · mañana`;
  return `${formatDate(vaccine.next_due)} · en ${days} días`;
}

async function removeStoredImage(url: string | null | undefined) {
  if (!url) return;
  try {
    const marker = '/pet-photos/';
    const index = url.indexOf(marker);
    if (index === -1) return;
    const path = decodeURIComponent(url.slice(index + marker.length).split('?')[0]);
    if (path) await supabase.storage.from('pet-photos').remove([path]);
  } catch {
    // A stale image is preferable to blocking a successful replacement.
  }
}

export default function VacunasScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { pet, refresh } = usePetContext();
  const [vaccines, setVaccines] = useState<Vaccine[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingVaccine, setEditingVaccine] = useState<Vaccine | null>(null);
  const [cardBusy, setCardBusy] = useState(false);
  const [showCardPreview, setShowCardPreview] = useState(false);

  const [name, setName] = useState('');
  const [customName, setCustomName] = useState('');
  const [dateGiven, setDateGiven] = useState(localDateKey());
  const [nextDue, setNextDue] = useState('');
  const [vetName, setVetName] = useState('');
  const [brandChoice, setBrandChoice] = useState('');
  const [customBrand, setCustomBrand] = useState('');
  const [lotNumber, setLotNumber] = useState('');
  const [notes, setNotes] = useState('');

  const vaccineOptions = useMemo(() => vaccineOptionsForSpecies(pet?.species), [pet?.species]);
  const overview = useMemo(() => buildVaccineOverview(vaccines), [vaccines]);

  const fetchData = useCallback(async () => {
    if (!pet?.id) {
      setVaccines([]);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('vaccines').select('*').eq('pet_id', pet.id).order('date_given', { ascending: false });
    if (error) console.warn('[vacunas] fetch error:', error.message);
    setVaccines(data ?? []);
    setLoading(false);
  }, [pet?.id]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchData(), refresh()]);
    setRefreshing(false);
  }, [fetchData, refresh]);

  const resetForm = () => {
    setName(''); setCustomName(''); setDateGiven(localDateKey());
    setNextDue(''); setVetName(''); setBrandChoice(''); setCustomBrand('');
    setLotNumber(''); setNotes(''); setEditingVaccine(null);
  };

  const openNew = () => { resetForm(); setShowForm(true); };

  const openEdit = (vaccine: Vaccine) => {
    setEditingVaccine(vaccine);
    const knownVaccine = vaccineOptions.find(option => option.key === vaccine.name);
    setName(knownVaccine ? vaccine.name : 'Otra');
    setCustomName(knownVaccine ? '' : vaccine.name);
    setDateGiven(vaccine.date_given);
    setNextDue(vaccine.next_due ?? '');
    setVetName(vaccine.vet_name ?? '');
    const knownBrand = BRAND_OPTIONS.find(option => option.key && option.key === vaccine.brand);
    setBrandChoice(knownBrand ? vaccine.brand! : vaccine.brand ? 'Otra' : '');
    setCustomBrand(knownBrand ? '' : vaccine.brand ?? '');
    setLotNumber(vaccine.lot_number ?? '');
    setNotes(vaccine.notes ?? '');
    setShowForm(true);
  };

  const closeForm = () => { setShowForm(false); resetForm(); };

  const handleSave = async () => {
    if (!pet) return;
    const vaccineName = name === 'Otra' ? customName.trim() : name;
    const vaccineBrand = brandChoice === 'Otra' ? customBrand.trim() : brandChoice;
    if (!vaccineName) {
      Alert.alert('Falta la vacuna', 'Selecciona una vacuna o escribe el nombre que aparece en el carné.');
      return;
    }
    if (!dateGiven) {
      Alert.alert('Falta la fecha', 'Ingresa la fecha en que se aplicó la dosis.');
      return;
    }
    if (nextDue && nextDue < dateGiven) {
      Alert.alert('Revisa las fechas', 'La próxima dosis no puede ser anterior a la fecha de aplicación.');
      return;
    }

    setSaving(true);
    const payload = {
      name: vaccineName,
      date_given: dateGiven,
      next_due: nextDue || null,
      vet_name: vetName.trim() || null,
      brand: vaccineBrand || null,
      lot_number: lotNumber.trim() || null,
      notes: notes.trim() || null,
    };
    const { error } = editingVaccine
      ? await supabase.from('vaccines').update(payload).eq('id', editingVaccine.id).eq('pet_id', pet.id)
      : await supabase.from('vaccines').insert({ ...payload, pet_id: pet.id });
    setSaving(false);

    if (error) {
      console.warn('[vacunas] save error:', error.message);
      Alert.alert('No se pudo guardar', friendlyError(error));
      return;
    }
    track('crud', `vacuna_${editingVaccine ? 'editar' : 'crear'}`);
    closeForm();
    await Promise.all([fetchData(), refresh()]);
  };

  const handleDelete = (id: string) => {
    if (!pet) return;
    Alert.alert('Eliminar aplicación', 'Se eliminará esta dosis del historial. Esta acción no se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive', onPress: async () => {
          const { error } = await supabase.from('vaccines').delete().eq('id', id).eq('pet_id', pet.id);
          if (error) {
            Alert.alert('No se pudo eliminar', friendlyError(error));
            return;
          }
          closeForm();
          await Promise.all([fetchData(), refresh()]);
        },
      },
    ]);
  };

  const handleCardPhoto = async () => {
    if (!ImagePicker || !pet || !user) {
      Alert.alert('No disponible', 'La función de fotos no está disponible en este momento.');
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a tus fotos para guardar el carné.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 0.85 });
    if (result.canceled) return;

    setCardBusy(true);
    try {
      let uri = result.assets[0].uri;
      if (ImageManipulator) {
        try {
          const resized = await ImageManipulator.manipulateAsync(
            uri, [{ resize: { width: 1600 } }],
            { compress: 0.82, format: ImageManipulator.SaveFormat.JPEG },
          );
          uri = resized.uri;
        } catch {}
      }
      const response = await fetch(uri);
      const blob = await response.blob();
      if (blob.size > 10 * 1024 * 1024) {
        Alert.alert('Imagen muy grande', 'La foto debe pesar menos de 10 MB.');
        return;
      }
      const path = `${user.id}/vaccine-card-${pet.id}-${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('pet-photos').upload(path, await new Response(blob).arrayBuffer(), { contentType: 'image/jpeg' });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('pet-photos').getPublicUrl(path);
      const previousUrl = pet.vaccine_card_url;
      const { error: updateError } = await supabase.from('pets').update({ vaccine_card_url: data.publicUrl }).eq('id', pet.id);
      if (updateError) throw updateError;
      await removeStoredImage(previousUrl);
      await refresh();
    } catch (error) {
      console.warn('[vacunas] card upload error:', error);
      Alert.alert('No se pudo guardar', 'Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      setCardBusy(false);
    }
  };

  const summary = vaccines.length === 0
    ? { title: `Empieza el carné de ${pet?.name ?? 'tu mascota'}`, text: 'Registra la primera dosis tal como aparece en el documento físico.' }
    : overview.overdueCount > 0
      ? { title: `${overview.overdueCount} fecha${overview.overdueCount === 1 ? '' : 's'} por confirmar`, text: 'Revisa con tu veterinario si corresponde registrar un refuerzo.' }
      : overview.dueSoonCount > 0
        ? { title: `${overview.dueSoonCount} próxima${overview.dueSoonCount === 1 ? '' : 's'} en 30 días`, text: 'Tu calendario tiene fechas cercanas para revisar.' }
        : overview.schedule.length > 0
          ? { title: 'Calendario organizado', text: 'Las próximas fechas están guardadas y visibles abajo.' }
          : { title: 'Historial organizado', text: 'Puedes añadir la próxima fecha cuando la confirme tu veterinario.' };

  return (
    <SafeAreaView testID="screen-vaccines" style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity accessibilityLabel="Volver a Salud" onPress={() => router.replace('/(app)/salud' as any)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={24} color={Colors.ink} />
        </TouchableOpacity>
        <Text style={styles.title}>Vacunas</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
      >
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={styles.heroIcon}><Ionicons name="shield-checkmark" size={26} color={Colors.accent} /></View>
            <View style={styles.heroCopy}>
              <Text style={styles.heroEyebrow}>CARNÉ DIGITAL</Text>
              <Text style={styles.heroTitle}>{summary.title}</Text>
              <Text style={styles.heroText}>{summary.text}</Text>
            </View>
          </View>
          <View style={styles.metrics}>
            <View style={styles.metric}><Text style={styles.metricValue}>{vaccines.length}</Text><Text style={styles.metricLabel}>dosis</Text></View>
            <View style={styles.metricDivider} />
            <View style={styles.metric}><Text style={styles.metricValue}>{overview.latestByName.length}</Text><Text style={styles.metricLabel}>vacunas</Text></View>
            <View style={styles.metricDivider} />
            <View style={styles.metric}><Text style={[styles.metricValue, overview.overdueCount > 0 && styles.metricValueDanger]}>{overview.schedule.length}</Text><Text style={styles.metricLabel}>con próxima fecha</Text></View>
          </View>
        </View>

        <Button title="Registrar vacuna" onPress={openNew} icon={<Ionicons name="add" size={21} color={Colors.white} />} style={styles.primaryAction} />

        <Card style={styles.cardPhoto}>
          <View style={styles.cardPhotoRow}>
            {pet?.vaccine_card_url ? (
              <TouchableOpacity onPress={() => setShowCardPreview(true)} activeOpacity={0.8}>
                <Image source={{ uri: pet.vaccine_card_url }} style={styles.cardThumbnail} />
              </TouchableOpacity>
            ) : (
              <View style={styles.cardPhotoIcon}><Ionicons name="camera-outline" size={22} color="#2563EB" /></View>
            )}
            <View style={styles.cardPhotoCopy}>
              <Text style={styles.cardPhotoTitle}>Foto del carné físico</Text>
              <Text style={styles.cardPhotoText}>{pet?.vaccine_card_url ? 'Guardada y sincronizada con la web' : 'Ten el documento completo a mano cuando lo necesites'}</Text>
            </View>
            <TouchableOpacity style={styles.cardPhotoButton} onPress={handleCardPhoto} disabled={cardBusy} activeOpacity={0.7}>
              {cardBusy ? <ActivityIndicator size="small" color={Colors.accent} /> : <Text style={styles.cardPhotoButtonText}>{pet?.vaccine_card_url ? 'Cambiar' : 'Agregar'}</Text>}
            </TouchableOpacity>
          </View>
        </Card>

        {loading ? (
          <View style={styles.loading}><ActivityIndicator color={Colors.accent} /><Text style={styles.loadingText}>Cargando vacunas…</Text></View>
        ) : vaccines.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}><Ionicons name="medkit-outline" size={30} color={Colors.accent} /></View>
            <Text style={styles.emptyTitle}>Todavía no hay dosis registradas</Text>
            <Text style={styles.emptyText}>Empieza con cualquier vacuna que aparezca en el carné. Podrás completar el resto después.</Text>
            <TouchableOpacity onPress={openNew} style={styles.emptyButton}><Text style={styles.emptyButtonText}>Registrar primera vacuna</Text></TouchableOpacity>
          </View>
        ) : (
          <>
            {overview.schedule.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View><Text style={styles.sectionEyebrow}>CALENDARIO</Text><Text style={styles.sectionTitle}>Próximas dosis</Text></View>
                  <Text style={styles.sectionCount}>{overview.schedule.length}</Text>
                </View>
                {overview.schedule.map(vaccine => {
                  const status = vaccineScheduleStatus(vaccine);
                  const meta = STATUS_STYLE[status];
                  return (
                    <TouchableOpacity key={`schedule-${vaccine.id}`} onPress={() => openEdit(vaccine)} activeOpacity={0.75}>
                      <View style={[styles.scheduleCard, { borderColor: meta.border, backgroundColor: meta.background }]}>
                        <View style={[styles.scheduleIcon, { backgroundColor: Colors.white }]}><Ionicons name={meta.icon} size={22} color={meta.color} /></View>
                        <View style={styles.scheduleCopy}>
                          <View style={styles.scheduleTitleRow}>
                            <Text style={styles.scheduleName} numberOfLines={2}>{vaccine.name}</Text>
                            <View style={[styles.statusPill, { backgroundColor: Colors.white }]}><Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text></View>
                          </View>
                          <Text style={[styles.scheduleDate, { color: meta.color }]}>{scheduleDetail(vaccine)}</Text>
                          <Text style={styles.scheduleApplied}>Última aplicación: {formatDate(vaccine.date_given)}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={17} color={meta.color} />
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View><Text style={styles.sectionEyebrow}>APLICACIONES</Text><Text style={styles.sectionTitle}>Historial</Text></View>
                <Text style={styles.sectionCount}>{overview.history.length}</Text>
              </View>
              <Card padded={false}>
                {overview.history.map((vaccine, index) => (
                  <TouchableOpacity key={vaccine.id} style={[styles.historyRow, index < overview.history.length - 1 && styles.historyRowBorder]} onPress={() => openEdit(vaccine)} activeOpacity={0.7}>
                    <View style={styles.historyIcon}><Ionicons name="shield-checkmark-outline" size={20} color={Colors.good} /></View>
                    <View style={styles.historyCopy}>
                      <Text style={styles.historyName}>{vaccine.name}</Text>
                      <Text style={styles.historyDate}>Aplicada el {formatDate(vaccine.date_given)}</Text>
                      {(vaccine.brand || vaccine.lot_number || vaccine.vet_name) && (
                        <Text style={styles.historyMeta} numberOfLines={2}>{[vaccine.brand, vaccine.lot_number ? `Lote ${vaccine.lot_number}` : null, vaccine.vet_name].filter(Boolean).join(' · ')}</Text>
                      )}
                    </View>
                    <Ionicons name="pencil-outline" size={17} color={Colors.muted} />
                  </TouchableOpacity>
                ))}
              </Card>
            </View>
          </>
        )}

        <Text style={styles.medicalNote}>Las fechas y productos deben copiarse del carné o confirmarse con el veterinario. Vivra organiza el historial, no define el esquema de vacunación.</Text>
      </ScrollView>

      <BottomSheet visible={showForm} onClose={closeForm} title={editingVaccine ? 'Editar aplicación' : 'Registrar vacuna'}>
        <View style={styles.formIntro}><Ionicons name="information-circle-outline" size={19} color={Colors.accent} /><Text style={styles.formIntroText}>Copia la información de esta dosis. Solo vacuna y fecha aplicada son obligatorias.</Text></View>
        <SelectField label="Vacuna" value={name} options={vaccineOptions} onSelect={setName} />
        {name === 'Otra' && <FormField label="Nombre escrito en el carné" value={customName} onChangeText={setCustomName} placeholder="Ej: Lyme, Influenza…" autoCapitalize="words" />}
        <DatePickerField label="Fecha de aplicación" value={dateGiven} onChange={setDateGiven} maxDate={new Date()} />
        <DatePickerField label="Próxima dosis (opcional)" value={nextDue} onChange={setNextDue} minDate={dateGiven ? new Date(`${dateGiven}T12:00:00`) : undefined} clearable />
        <SelectField label="Marca o laboratorio (opcional)" value={brandChoice} options={BRAND_OPTIONS} onSelect={setBrandChoice} />
        {brandChoice === 'Otra' && <FormField label="Marca escrita en el carné" value={customBrand} onChangeText={setCustomBrand} placeholder="Nombre del producto o laboratorio" autoCapitalize="words" />}
        <FormField label="Número de lote (opcional)" value={lotNumber} onChangeText={setLotNumber} placeholder="Ej: AB1234" autoCapitalize="characters" />
        <FormField label="Veterinario o clínica (opcional)" value={vetName} onChangeText={setVetName} placeholder="Nombre que aparece en el carné" />
        <FormField label="Notas (opcional)" value={notes} onChangeText={setNotes} placeholder="Observaciones de esta aplicación" multiline style={styles.notesField} />
        <Button title={editingVaccine ? 'Guardar cambios' : 'Registrar aplicación'} onPress={handleSave} loading={saving} />
        {editingVaccine && (
          <TouchableOpacity style={styles.deleteRecord} onPress={() => handleDelete(editingVaccine.id)}>
            <Ionicons name="trash-outline" size={17} color={Colors.bad} /><Text style={styles.deleteRecordText}>Eliminar esta aplicación</Text>
          </TouchableOpacity>
        )}
      </BottomSheet>

      <Modal visible={showCardPreview} transparent animationType="fade" onRequestClose={() => setShowCardPreview(false)}>
        <View style={styles.previewOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowCardPreview(false)} />
          <View style={styles.previewHeader}>
            <Text style={styles.previewTitle}>Carné de {pet?.name}</Text>
            <TouchableOpacity style={styles.previewClose} onPress={() => setShowCardPreview(false)}><Ionicons name="close" size={24} color={Colors.white} /></TouchableOpacity>
          </View>
          {pet?.vaccine_card_url && <Image source={{ uri: pet.vaccine_card_url }} style={styles.previewImage} resizeMode="contain" />}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.canvas },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
  title: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.ink },
  headerSpacer: { width: 24 },
  scroll: { flex: 1 },
  content: { padding: Spacing.lg, paddingTop: Spacing.sm, gap: Spacing.md, paddingBottom: Spacing.xxl },
  heroCard: { padding: Spacing.md, borderRadius: Radius.xl, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  heroIcon: { width: 52, height: 52, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.accentLight },
  heroCopy: { flex: 1 },
  heroEyebrow: { fontSize: 10, fontWeight: FontWeight.bold, color: Colors.accent, letterSpacing: 1.2 },
  heroTitle: { marginTop: 3, fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.ink },
  heroText: { marginTop: 4, fontSize: FontSize.xs, lineHeight: 18, color: Colors.muted },
  metrics: { flexDirection: 'row', marginTop: Spacing.md, paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.cardBorder },
  metric: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 46 },
  metricDivider: { width: 1, backgroundColor: Colors.cardBorder },
  metricValue: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.ink },
  metricValueDanger: { color: Colors.bad },
  metricLabel: { marginTop: 2, fontSize: 10, color: Colors.muted, textAlign: 'center' },
  primaryAction: { borderRadius: Radius.lg },
  cardPhoto: { padding: Spacing.sm + 4 },
  cardPhotoRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  cardPhotoIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EFF6FF' },
  cardThumbnail: { width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.canvas },
  cardPhotoCopy: { flex: 1 },
  cardPhotoTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.ink },
  cardPhotoText: { marginTop: 2, fontSize: 10, lineHeight: 14, color: Colors.muted },
  cardPhotoButton: { minWidth: 58, alignItems: 'center', paddingVertical: Spacing.sm, paddingHorizontal: Spacing.sm },
  cardPhotoButtonText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.accent },
  loading: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xxl },
  loadingText: { color: Colors.muted, fontSize: FontSize.sm },
  empty: { alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.xl, borderRadius: Radius.xl, borderWidth: 1, borderStyle: 'dashed', borderColor: Colors.cardBorder, backgroundColor: Colors.card },
  emptyIcon: { width: 58, height: 58, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.accentLight },
  emptyTitle: { marginTop: Spacing.md, fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.ink, textAlign: 'center' },
  emptyText: { marginTop: Spacing.xs, fontSize: FontSize.sm, lineHeight: 20, color: Colors.muted, textAlign: 'center' },
  emptyButton: { marginTop: Spacing.md, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md },
  emptyButtonText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.accent },
  section: { gap: Spacing.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: Spacing.xs },
  sectionEyebrow: { fontSize: 10, fontWeight: FontWeight.bold, color: Colors.muted, letterSpacing: 1.2 },
  sectionTitle: { marginTop: 2, fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.ink },
  sectionCount: { overflow: 'hidden', minWidth: 27, paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.full, backgroundColor: Colors.card, color: Colors.muted, fontSize: FontSize.xs, fontWeight: FontWeight.semibold, textAlign: 'center' },
  scheduleCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, borderRadius: Radius.lg, borderWidth: 1 },
  scheduleIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  scheduleCopy: { flex: 1 },
  scheduleTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.xs },
  scheduleName: { flex: 1, fontSize: FontSize.md, lineHeight: 20, fontWeight: FontWeight.bold, color: Colors.ink },
  statusPill: { borderRadius: Radius.full, paddingHorizontal: 7, paddingVertical: 3 },
  statusText: { fontSize: 9, fontWeight: FontWeight.bold },
  scheduleDate: { marginTop: 5, fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  scheduleApplied: { marginTop: 3, fontSize: FontSize.xs, color: Colors.muted },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md },
  historyRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.cardBorder },
  historyIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0FDF4' },
  historyCopy: { flex: 1 },
  historyName: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.ink },
  historyDate: { marginTop: 3, fontSize: FontSize.xs, color: Colors.muted },
  historyMeta: { marginTop: 3, fontSize: 10, lineHeight: 14, color: Colors.muted },
  medicalNote: { paddingHorizontal: Spacing.sm, marginTop: Spacing.sm, fontSize: 10, lineHeight: 15, textAlign: 'center', color: Colors.muted },
  formIntro: { flexDirection: 'row', gap: Spacing.sm, padding: Spacing.sm, marginBottom: Spacing.md, borderRadius: Radius.md, backgroundColor: Colors.accentLight },
  formIntroText: { flex: 1, color: Colors.muted, fontSize: FontSize.xs, lineHeight: 17 },
  notesField: { minHeight: 72, textAlignVertical: 'top' },
  deleteRecord: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, paddingVertical: Spacing.md, marginTop: Spacing.sm, marginBottom: Spacing.lg },
  deleteRecordText: { color: Colors.bad, fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  previewOverlay: { flex: 1, backgroundColor: 'rgba(15, 17, 23, 0.96)', justifyContent: 'center' },
  previewHeader: { position: 'absolute', zIndex: 2, top: 54, left: Spacing.lg, right: Spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  previewTitle: { color: Colors.white, fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  previewClose: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.12)' },
  previewImage: { width: '100%', height: '78%' },
});
