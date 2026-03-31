import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, FontWeight, Radius } from '../../constants/theme';

interface SelectFieldProps {
  label: string;
  value: string;
  options: { key: string; label: string }[];
  onSelect: (key: string) => void;
  error?: string;
}

export function SelectField({ label, value, options, onSelect, error }: SelectFieldProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.key === value);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity
        style={[styles.trigger, error && styles.triggerError]}
        onPress={() => setOpen(!open)}
        activeOpacity={0.7}
      >
        <Text style={[styles.triggerText, !selected && styles.placeholder]}>
          {selected?.label ?? 'Seleccionar...'}
        </Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={14} color={Colors.muted} />
      </TouchableOpacity>

      {open && (
        <View style={styles.dropdown}>
          <ScrollView nestedScrollEnabled style={styles.dropdownScroll}>
            {options.map(opt => (
              <TouchableOpacity
                key={opt.key}
                style={[styles.option, opt.key === value && styles.optionActive]}
                onPress={() => { onSelect(opt.key); setOpen(false); }}
              >
                <Text style={[styles.optionText, opt.key === value && styles.optionTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
    zIndex: 10,
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.ink,
    marginBottom: Spacing.xs,
  },
  trigger: {
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
  triggerError: {
    borderColor: Colors.bad,
  },
  triggerText: {
    fontSize: FontSize.md,
    color: Colors.ink,
  },
  placeholder: {
    color: Colors.muted,
  },
  arrow: {
    fontSize: 10,
    color: Colors.muted,
  },
  dropdown: {
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: Radius.md,
    backgroundColor: Colors.card,
    marginTop: Spacing.xs,
    overflow: 'hidden',
  },
  dropdownScroll: {
    maxHeight: 200,
  },
  option: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.cardBorder,
  },
  optionActive: {
    backgroundColor: Colors.accentLight,
  },
  optionText: {
    fontSize: FontSize.md,
    color: Colors.ink,
  },
  optionTextActive: {
    color: Colors.accent,
    fontWeight: FontWeight.semibold,
  },
  error: {
    fontSize: FontSize.xs,
    color: Colors.bad,
    marginTop: Spacing.xs,
  },
});
