import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors, FontSize, FontWeight, Spacing } from '../../constants/theme';

export type HealthTab = 'summary' | 'history';

export function HealthTabs({ value, onChange }: {
  value: HealthTab;
  onChange: (value: HealthTab) => void;
}) {
  return (
    <View style={styles.tabs} accessibilityRole="tablist">
      {([{ key: 'summary', label: 'Resumen' }, { key: 'history', label: 'Historial' }] as const).map(tab => (
        <TouchableOpacity
          key={tab.key}
          accessibilityRole="tab"
          accessibilityLabel={tab.label}
          accessibilityState={{ selected: value === tab.key }}
          testID={`health-tab-${tab.key}`}
          onPress={() => onChange(tab.key)}
          activeOpacity={0.7}
          style={[styles.tab, value === tab.key && styles.tabActive]}
        >
          <Text style={[styles.label, value === tab.key && styles.labelActive]}>{tab.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.cardBorder },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 46, paddingHorizontal: Spacing.sm, borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: Colors.accent },
  label: { color: Colors.muted, fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  labelActive: { color: Colors.accent, fontWeight: FontWeight.semibold },
});
