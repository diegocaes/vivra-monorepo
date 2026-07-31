import { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, type ViewStyle } from 'react-native';
import { Colors, Radius, Spacing } from '../../constants/theme';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  radius?: number;
  style?: ViewStyle;
}

function SkeletonBox({ width = '100%', height = 16, radius = Radius.sm, style }: SkeletonProps) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, []);

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          borderRadius: radius,
          backgroundColor: Colors.cardBorder,
          opacity,
        },
        style,
      ]}
    />
  );
}

export function DashboardSkeleton() {
  return (
    <View style={styles.container}>
      {/* Hero card skeleton */}
      <SkeletonBox height={120} radius={Radius.xl} />

      {/* Vitality widget skeleton */}
      <View style={styles.card}>
        <SkeletonBox width={120} height={20} />
        <View style={styles.vitalityRow}>
          <SkeletonBox width={100} height={100} radius={50} />
          <View style={styles.pillarsCol}>
            <SkeletonBox height={8} />
            <SkeletonBox height={8} />
            <SkeletonBox height={8} />
            <SkeletonBox height={8} />
            <SkeletonBox height={8} />
          </View>
        </View>
      </View>

      {/* Food progress skeleton */}
      <View style={styles.card}>
        <SkeletonBox width={80} height={18} />
        <SkeletonBox height={10} radius={Radius.full} />
      </View>

      {/* Reminder cards skeleton */}
      <View style={styles.reminderRow}>
        <View style={[styles.card, styles.reminderCard]}>
          <SkeletonBox width={60} height={16} />
          <SkeletonBox width={100} height={12} />
        </View>
        <View style={[styles.card, styles.reminderCard]}>
          <SkeletonBox width={60} height={16} />
          <SkeletonBox width={100} height={12} />
        </View>
      </View>

      {/* Fun fact skeleton */}
      <View style={styles.card}>
        <SkeletonBox width={80} height={14} />
        <SkeletonBox height={14} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.md,
    padding: Spacing.lg,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  vitalityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  pillarsCol: {
    flex: 1,
    gap: Spacing.sm,
  },
  reminderRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  reminderCard: {
    flex: 1,
  },
});

export { SkeletonBox };
