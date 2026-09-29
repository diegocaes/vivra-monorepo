import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';

export function CategoryIcon({ name, color, size = 28 }: { name: 'vaccine' | 'bowl' | 'vet' | 'pill' | keyof typeof Ionicons.glyphMap; color: string; size?: number }) {
  if (name === 'vet') return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden><Path d="M5 2v3m6-3v3M5 3H4a2 2 0 0 0-2 2v4a6 6 0 0 0 12 0V5a2 2 0 0 0-2-2h-1M8 15a6 6 0 0 0 12 0v-3m2-2a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
  if (name === 'pill') return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden><Path d="m9 15 6-6m-8-5a5 5 0 0 1 7 0l6 6a5 5 0 0 1-7 7l-6-6a5 5 0 0 1 0-7Z" transform="rotate(90 12 12)" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
  if (name === 'bowl') return <Svg width={size} height={size} viewBox="0 0 32 32" fill="none" accessibilityElementsHidden><Path d="M8 10c0-2 16-2 16 0l5 15c-3 4-23 4-26 0L8 10Z" fill={color} opacity={0.9}/><Path d="M8 10c0 4 16 4 16 0M4 23c5 4 19 4 24 0" stroke="#FFF8EA" strokeWidth={1.5}/></Svg>;
  if (name !== 'vaccine') return <Ionicons name={name} size={size} color={color} />;
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none" accessibilityElementsHidden>
      <Path d="m20 4 8 8m-6-10 8 8M24 8l-5 5m-4-4 8 8M6 22l4 4 12-12-4-4L6 22Zm2 2-6 6m9-13 4 4m0-8 4 4" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
