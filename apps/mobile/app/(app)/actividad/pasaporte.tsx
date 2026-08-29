import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, FontWeight, Radius } from '../../../constants/theme';
import { supabase } from '../../../lib/supabase';
import { usePetContext } from '../../../contexts/PetContext';
import { calculateAge, formatDate } from '@vivra/shared';

interface FlightRow {
  id: string;
  origin: string | null;
  destination: string | null;
  flight_date: string | null;
  airline: string | null;
  flight_number: string | null;
}

/**
 * In-app pet passport. Replaces the old flow that kicked the user out to the
 * web (`vivrapet.com/print`) via Linking. The passport now lives inside the
 * app as a branded, document-style view; the "Exportar a PDF" button opens the
 * printable web version only when the user actually wants a file to share.
 *
 * Pure JS/RN (no native PDF module) so it ships over the air.
 */
export default function PasaporteScreen() {
  const router = useRouter();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const { pet, vaccines, weightRecords } = usePetContext();
  const [flights, setFlights] = useState<FlightRow[]>([]);

  useEffect(() => {
    if (!pet?.id) return;
    supabase
      .from('flights')
      .select('id, origin, destination, flight_date, airline, flight_number')
      .eq('pet_id', pet.id)
      .order('flight_date', { ascending: false })
      .then(({ data }) => setFlights((data as FlightRow[]) ?? []));
  }, [pet?.id]);

  const exportPdf = useCallback(() => {
    if (!pet?.id) return;
    Linking.openURL(`https://vivrapet.com/print?petId=${pet.id}`).catch(() => {});
  }, [pet?.id]);

  // Never fall back to the hidden `actividad` tab history: it may still point
  // at the disabled Vuelos screen from an older session.
  const handleBack = () => {
    router.replace(from === 'perfil' ? '/(app)/perfil' : '/(app)/salud');
  };

  if (!pet) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Header onBack={handleBack} />
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>No hay una mascota seleccionada.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const latestWeight = weightRecords[0]?.weight_kg ?? pet.weight_kg;
  const age = pet.birth_date ? calculateAge(pet.birth_date) : null;
  const location = [pet.birth_city, pet.birth_country].filter(Boolean).join(', ');
  const genderLabel = pet.gender === 'macho' ? 'Macho / M' : pet.gender === 'hembra' ? 'Hembra / F' : '—';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Header onBack={handleBack} onExport={exportPdf} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.passport}>
          {/* ── COVER ── */}
          <View style={styles.cover}>
            <Text style={styles.coverLocation}>{location ? location.toUpperCase() : 'PASAPORTE DE MASCOTA'}</Text>
            <Text style={styles.coverBrand}>VIVRA</Text>
            <Text style={styles.coverTitle}>PET PASSPORT</Text>
            <Text style={styles.coverSubtitle}>Pasaporte de Mascota</Text>
          </View>

          {/* ── PHOTO + IDENTITY ── */}
          <View style={styles.idRow}>
            <View style={styles.photoFrame}>
              {pet.photo_url ? (
                <Image source={{ uri: pet.photo_url }} style={styles.photo} />
              ) : (
                <Ionicons name="paw" size={34} color={Colors.accent} />
              )}
            </View>
            <View style={styles.idInfo}>
              <Text style={styles.idEyebrow}>{pet.species === 'cat' ? 'PASAPORTE · FELINO' : 'PASAPORTE · CANINO'}</Text>
              <Text style={styles.petName}>{pet.name}</Text>
              <Field label="Raza / Breed" value={pet.species === 'cat' ? (pet.breed ?? 'Gato') : pet.breed} />
              <Field
                label="Fecha de nacimiento"
                value={pet.birth_date ? `${formatDate(pet.birth_date)}${age ? `  (${age})` : ''}` : null}
              />
              <Field label="Sexo / Sex" value={pet.gender ? genderLabel : null} />
              {pet.support_type && (
                <Field
                  label="Tipo de asistencia"
                  value={pet.support_type === 'emotional_support' ? 'Apoyo Emocional / ESA' : 'Perro de Servicio / Service Dog'}
                  accent
                />
              )}
            </View>
          </View>

          {/* ── IDENTIFICACIÓN ── */}
          <View style={styles.section}>
            <SectionTitle>Datos de identificación</SectionTitle>
            <View style={styles.grid}>
              <Field label="Nº Microchip" value={pet.chip_id} half />
              <Field label="Peso actual" value={latestWeight ? `${latestWeight} kg` : null} half />
              <Field label="Color de pelaje" value={pet.color} half />
              <Field label="Especie" value={pet.species === 'cat' ? 'Felino' : 'Canino'} half />
              <Field label="Lugar de nacimiento" value={location || null} half />
            </View>
          </View>

          {/* ── VACUNAS ── */}
          {vaccines.length > 0 && (
            <View style={styles.section}>
              <SectionTitle>Registro de vacunación</SectionTitle>
              {vaccines.map(v => (
                <View key={v.id} style={styles.vaccineRow}>
                  <View style={styles.vaccineLeft}>
                    <View style={styles.vaccineDot} />
                    <View style={styles.vaccineCopy}>
                      <Text style={styles.vaccineName}>{v.name}</Text>
                      {(v.brand || v.lot_number) && (
                        <Text style={styles.vaccineMeta}>{[v.brand, v.lot_number ? `Lote ${v.lot_number}` : null].filter(Boolean).join(' · ')}</Text>
                      )}
                      {v.next_due && <Text style={styles.vaccineMeta}>Próxima: {formatDate(v.next_due)}</Text>}
                    </View>
                  </View>
                  <Text style={styles.vaccineDate}>{formatDate(v.date_given)}</Text>
                </View>
              ))}
            </View>
          )}

          {/* ── VIAJES ── */}
          {flights.length > 0 && (
            <View style={styles.section}>
              <SectionTitle>Historial de viajes</SectionTitle>
              {flights.map(f => (
                <View key={f.id} style={styles.flightRow}>
                  <Text style={styles.flightRoute}>{f.origin ?? '—'} → {f.destination ?? '—'}</Text>
                  <Text style={styles.flightMeta}>
                    {f.flight_date ? formatDate(f.flight_date) : '—'}
                    {f.airline ? ` · ${f.airline}` : ''}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* ── EXPORT ── */}
        <TouchableOpacity style={styles.exportBtn} onPress={exportPdf} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel="Exportar pasaporte a PDF">
          <Ionicons name="download-outline" size={18} color="#fff" />
          <Text style={styles.exportBtnText}>Exportar a PDF</Text>
        </TouchableOpacity>
        <Text style={styles.exportHint}>
          Abre una versión imprimible que puedes guardar o compartir.
        </Text>
        <Text style={styles.legalHint}>Resumen personal de Vivra; no es un documento oficial de viaje ni sanitario.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Header({ onBack, onExport }: { onBack: () => void; onExport?: () => void }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button" accessibilityLabel="Volver">
        <Ionicons name="chevron-back" size={26} color={Colors.ink} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Pasaporte</Text>
      {onExport ? (
        <TouchableOpacity onPress={onExport} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button" accessibilityLabel="Exportar a PDF">
          <Ionicons name="share-outline" size={22} color={Colors.accent} />
        </TouchableOpacity>
      ) : (
        <View style={{ width: 22 }} />
      )}
    </View>
  );
}

function SectionTitle({ children }: { children: string }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionLine} />
      <Text style={styles.sectionTitle}>{children}</Text>
      <View style={styles.sectionLine} />
    </View>
  );
}

function Field({ label, value, half, accent }: { label: string; value: string | null | undefined; half?: boolean; accent?: boolean }) {
  return (
    <View style={[styles.field, half && styles.fieldHalf]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={[styles.fieldValue, !value && styles.fieldEmpty, accent && styles.fieldAccent]}>
        {value || '—'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.canvas },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
  },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.ink },
  content: { padding: Spacing.lg, paddingTop: Spacing.xs, paddingBottom: Spacing.xxl },

  // Passport card
  passport: {
    backgroundColor: Colors.card,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 4,
  },

  // Cover
  cover: {
    backgroundColor: Colors.accent,
    paddingVertical: Spacing.lg + 4,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
  },
  coverLocation: {
    fontSize: 9, fontWeight: FontWeight.semibold, letterSpacing: 3,
    color: 'rgba(255,255,255,0.7)', marginBottom: Spacing.sm,
  },
  coverBrand: {
    fontSize: 30, fontWeight: FontWeight.bold, color: '#fff',
    letterSpacing: 2,
  },
  coverTitle: {
    fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: '#fff',
    letterSpacing: 3, marginTop: Spacing.sm,
  },
  coverSubtitle: {
    fontSize: 10, color: 'rgba(255,255,255,0.75)', letterSpacing: 2,
    textTransform: 'uppercase', marginTop: 2,
  },

  // Identity row
  idRow: {
    flexDirection: 'row', gap: Spacing.md, padding: Spacing.lg,
    borderBottomWidth: 1, borderBottomColor: Colors.cardBorder,
  },
  photoFrame: {
    width: 96, height: 116, borderRadius: Radius.md,
    borderWidth: 2, borderColor: Colors.accent,
    backgroundColor: Colors.accentLight,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  photo: { width: '100%', height: '100%' },
  idInfo: { flex: 1, minWidth: 0 },
  idEyebrow: { fontSize: 8, fontWeight: FontWeight.bold, letterSpacing: 2, color: Colors.accent, marginBottom: 2 },
  petName: { fontSize: 24, fontWeight: FontWeight.bold, color: Colors.ink, marginBottom: Spacing.sm },

  // Sections
  section: { padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.cardBorder },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  sectionLine: { flex: 1, height: 1, backgroundColor: Colors.cardBorder },
  sectionTitle: {
    fontSize: 9, fontWeight: FontWeight.bold, letterSpacing: 2,
    color: Colors.accent, textTransform: 'uppercase',
  },

  // Fields
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  field: { marginBottom: Spacing.sm, borderBottomWidth: 1, borderBottomColor: '#F1F3F5', paddingBottom: 6 },
  fieldHalf: { width: '48%' },
  fieldLabel: { fontSize: 8, fontWeight: FontWeight.semibold, letterSpacing: 1.2, color: Colors.muted, textTransform: 'uppercase', marginBottom: 2 },
  fieldValue: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.ink },
  fieldEmpty: { color: Colors.cardBorder },
  fieldAccent: { color: Colors.accent },

  // Vaccines
  vaccineRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: '#F1F3F5',
  },
  vaccineLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, flex: 1, paddingRight: Spacing.sm },
  vaccineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.accent },
  vaccineCopy: { flex: 1 },
  vaccineName: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.ink },
  vaccineMeta: { fontSize: 10, color: Colors.muted, marginTop: 2 },
  vaccineDate: { fontSize: FontSize.xs, color: Colors.muted },

  // Flights
  flightRow: { paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: '#F1F3F5' },
  flightRoute: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.ink },
  flightMeta: { fontSize: FontSize.xs, color: Colors.muted, marginTop: 2 },

  // Export
  exportBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
    backgroundColor: Colors.accent, borderRadius: Radius.lg,
    paddingVertical: Spacing.md, marginTop: Spacing.lg,
  },
  exportBtnText: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: '#fff' },
  exportHint: { fontSize: FontSize.xs, color: Colors.muted, textAlign: 'center', marginTop: Spacing.sm },
  legalHint: { fontSize: 10, color: Colors.muted, textAlign: 'center', marginTop: Spacing.sm, lineHeight: 14 },

  // Empty (no pet selected)
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, gap: Spacing.sm },
  emptyText: { fontSize: FontSize.sm, color: Colors.muted, textAlign: 'center', lineHeight: 20 },
});
