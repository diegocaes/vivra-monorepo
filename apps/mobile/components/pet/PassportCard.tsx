import { Image, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { formatDate } from '@vivra/shared';
import type { Pet } from '@vivra/shared/lib/database';
import { Colors } from '../../constants/theme';
import { BrandLogo } from '../ui/BrandLogo';

export function PassportCard({ pet }: { pet: Pet }) {
  return (
    <View style={styles.card} testID="passport-identity">
      <View style={styles.map} pointerEvents="none" accessibilityElementsHidden>
        <Svg width={190} height={120} viewBox="0 0 240 140" fill="#DCE7E8">
          <Path d="m13 30 17-17 21 2 12 9 20 1 9 15-12 12-15-2-8 17-13-3-5-14-18-5Zm58 42 18 4 9 23-9 27-11 9-7-29-12-20Zm14-65 24-3 9 11-15 11-12-5Zm41 26 12-16 16 4 8-10 19 8 20-3 29 19-7 17-32-4-17 13-10-9-12 6-16-10-12 5-8-11Zm5 24 26 1 12 19-9 21-18 19-11-21-8-26Zm50 13 9 4 2 18-8-6Zm19 27 21-6 13 16-7 12-27-4-6-9Z" />
        </Svg>
      </View>
      <View style={styles.top}><Ionicons name="globe-outline" size={31} color={Colors.accentDark} /><BrandLogo width={94} /></View>
      <Text style={styles.title}>Pasaporte de mascota</Text>
      <View style={styles.identity}>
        {pet.photo_url ? <Image source={{ uri: pet.photo_url }} style={styles.photo} /> : <View style={[styles.photo, styles.placeholder]}><Ionicons name="paw" size={38} color={Colors.accent} /></View>}
        <View style={styles.info}>
          <Text style={styles.name}>{pet.name}</Text>
          <IdentityField label="Especie" value={pet.species === 'cat' ? 'Gato' : 'Perro'} />
          <IdentityField label="Raza" value={pet.breed} />
          <IdentityField label="Nacimiento" value={pet.birth_date ? formatDate(pet.birth_date) : null} />
          <IdentityField label="Microchip" value={pet.chip_id} />
        </View>
      </View>
    </View>
  );
}

function IdentityField({ label, value }: { label: string; value: string | null | undefined }) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><Text style={styles.value}>{value || 'Sin registrar'}</Text></View>;
}

const styles = StyleSheet.create({
  card: { padding: 19, backgroundColor: '#F2F5F4', borderRadius: 20, borderWidth: 1, borderColor: '#E1E5E1', overflow: 'hidden', shadowColor: Colors.accentDark, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 12 },
  map: { position: 'absolute', top: 20, right: -8, opacity: 0.65 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 20, fontWeight: '600', color: Colors.ink, marginTop: 17, marginBottom: 23 },
  identity: { flexDirection: 'row', alignItems: 'flex-start', gap: 15 },
  photo: { width: 94, height: 130, borderRadius: 13 },
  placeholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#E2DBCD' },
  info: { flex: 1, paddingTop: 3 },
  name: { fontSize: 20, fontWeight: '600', color: Colors.ink, marginBottom: 8 },
  field: { flexDirection: 'row', gap: 5, paddingVertical: 4 },
  label: { width: 66, fontSize: 10, color: '#576C65' },
  value: { flex: 1, fontSize: 10, color: Colors.ink, lineHeight: 14 },
});
