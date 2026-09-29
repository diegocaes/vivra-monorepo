import { useReducedMotion } from 'react-native-reanimated';
import { Stack } from 'expo-router';

import { Colors } from '../../constants/theme';

export default function AuthLayout() {
  const reduceMotion = useReducedMotion();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.canvas }, animation: reduceMotion ? 'none' : 'slide_from_right' }} />
  );
}
