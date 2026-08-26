import { Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, FontWeight, Radius } from '../../constants/theme';

/**
 * Botón de "agregar" para las cabeceras de pantalla.
 *
 * Antes cada pantalla ponía un `<Ionicons name="add-circle">` suelto: se
 * confundía con el resto de iconos y la acción principal de la pantalla
 * quedaba escondida. Relleno naranja + etiqueta lo vuelve lo primero que se
 * ve, sin ocupar más espacio del que ya usaba el icono.
 */
interface AddButtonProps {
  label: string;
  onPress: () => void;
  /** Para acciones secundarias (ej. "Snack" al lado de "Alimento"). */
  variant?: 'primary' | 'outline';
}

export function AddButton({ label, onPress, variant = 'primary' }: AddButtonProps) {
  const outline = variant === 'outline';
  return (
    <TouchableOpacity
      style={[styles.btn, outline && styles.btnOutline]}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Ionicons name="add" size={16} color={outline ? Colors.accent : '#fff'} />
      <Text style={[styles.label, outline && styles.labelOutline]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.accent,
    borderRadius: Radius.full,
    paddingLeft: Spacing.sm,
    paddingRight: Spacing.md,
    paddingVertical: 7,
    // Sombra suave: separa el botón del fondo sin gritar.
    shadowColor: Colors.accent,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  btnOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: Colors.accent,
    shadowOpacity: 0,
    elevation: 0,
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: '#fff',
  },
  labelOutline: { color: Colors.accent },
});
