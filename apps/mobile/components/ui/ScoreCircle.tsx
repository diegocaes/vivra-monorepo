import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Colors, FontSize, FontWeight } from '../../constants/theme';

interface ScoreCircleProps {
  score: number;
  maxScore?: number;
  color: string;
  size?: number;
  strokeWidth?: number;
  label?: string;
  showScore: boolean;
}

export function ScoreCircle({
  score,
  maxScore = 100,
  color,
  size = 120,
  strokeWidth = 10,
  label,
  showScore,
}: ScoreCircleProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(score / maxScore, 1);
  const strokeDashoffset = circumference * (1 - pct);

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {/* Background circle */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={Colors.cardBorder}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress circle */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90, ${size / 2}, ${size / 2})`}
        />
      </Svg>
      <View style={styles.labelContainer}>
        {showScore ? (
          <Text style={[styles.score, { color }]}>{Math.round(score)}</Text>
        ) : (
          <Text style={styles.building}>...</Text>
        )}
        {label && <Text style={styles.label}>{label}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelContainer: {
    position: 'absolute',
    alignItems: 'center',
  },
  score: {
    fontSize: FontSize.hero,
    fontWeight: FontWeight.bold,
  },
  building: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.muted,
  },
  label: {
    fontSize: FontSize.xs,
    color: Colors.muted,
    marginTop: 2,
  },
});
