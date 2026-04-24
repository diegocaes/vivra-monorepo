import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Platform,
  Pressable,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, FontWeight, Radius } from '../../constants/theme';

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function formatDisplay(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${parseInt(d, 10)} ${MONTHS[parseInt(m, 10) - 1]} ${y}`;
}

function parseDate(dateStr: string): Date {
  // Avoid timezone offset issues by parsing as noon local time
  return new Date(`${dateStr}T12:00:00`);
}

interface DatePickerFieldProps {
  label: string;
  value: string;             // YYYY-MM-DD or ''
  onChange: (date: string) => void;
  placeholder?: string;
  maxDate?: Date;
  minDate?: Date;
  clearable?: boolean;       // shows "Sin fecha" option
  error?: string;
}

export function DatePickerField({
  label,
  value,
  onChange,
  placeholder = 'Seleccionar fecha',
  maxDate,
  minDate,
  clearable = false,
  error,
}: DatePickerFieldProps) {
  const [show, setShow] = useState(false);

  // Use value date, fall back to today for the picker initial position
  const pickerDate = value ? parseDate(value) : (maxDate && maxDate < new Date() ? maxDate : new Date());

  const handleChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShow(false);
      if (selectedDate) {
        onChange(selectedDate.toISOString().split('T')[0]);
      }
    } else {
      // iOS: keep modal open, update value in real time
      if (selectedDate) {
        onChange(selectedDate.toISOString().split('T')[0]);
      }
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>

      <TouchableOpacity
        style={[styles.field, error && styles.fieldError]}
        onPress={() => setShow(true)}
        activeOpacity={0.7}
      >
        <Text style={[styles.valueText, !value && styles.placeholderText]}>
          {value ? formatDisplay(value) : placeholder}
        </Text>
        <View style={styles.iconRow}>
          {clearable && value ? (
            <TouchableOpacity
              onPress={() => onChange('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={18} color={Colors.muted} />
            </TouchableOpacity>
          ) : null}
          <Ionicons name="calendar-outline" size={18} color={Colors.muted} />
        </View>
      </TouchableOpacity>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {/* iOS: bottom sheet modal */}
      {Platform.OS === 'ios' && (
        <Modal visible={show} transparent animationType="slide">
          <Pressable style={styles.backdrop} onPress={() => setShow(false)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{label}</Text>
              <TouchableOpacity onPress={() => setShow(false)}>
                <Text style={styles.doneBtn}>Listo</Text>
              </TouchableOpacity>
            </View>
            <DateTimePicker
              value={pickerDate}
              mode="date"
              display="inline"
              locale="es"
              maximumDate={maxDate}
              minimumDate={minDate}
              onChange={handleChange}
              style={styles.picker}
              accentColor={Colors.accent}
            />
            {clearable && value ? (
              <TouchableOpacity
                style={styles.clearBtn}
                onPress={() => { onChange(''); setShow(false); }}
              >
                <Text style={styles.clearBtnText}>Sin fecha</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </Modal>
      )}

      {/* Android: native dialog (no modal needed) */}
      {Platform.OS === 'android' && show && (
        <DateTimePicker
          value={pickerDate}
          mode="date"
          display="default"
          maximumDate={maxDate}
          minimumDate={minDate}
          onChange={handleChange}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.ink,
    marginBottom: Spacing.xs,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 4,
    backgroundColor: Colors.canvas,
  },
  fieldError: {
    borderColor: Colors.bad,
  },
  valueText: {
    fontSize: FontSize.md,
    color: Colors.ink,
    flex: 1,
  },
  placeholderText: {
    color: Colors.muted,
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  error: {
    fontSize: FontSize.xs,
    color: Colors.bad,
    marginTop: Spacing.xs,
  },
  // iOS modal
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Spacing.xl + 8,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  sheetTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.ink,
  },
  doneBtn: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.accent,
  },
  picker: {
    marginHorizontal: Spacing.md,
  },
  clearBtn: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.xs,
  },
  clearBtnText: {
    fontSize: FontSize.sm,
    color: Colors.muted,
    textDecorationLine: 'underline',
  },
});
