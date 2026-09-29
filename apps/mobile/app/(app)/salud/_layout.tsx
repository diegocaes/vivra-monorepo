import { useReducedMotion } from 'react-native-reanimated';
import { Stack } from 'expo-router';
import { Colors } from '../../../constants/theme';

export default function SaludLayout() {
  const reduceMotion = useReducedMotion();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: reduceMotion ? 'none' : 'slide_from_right',
        contentStyle: { backgroundColor: Colors.canvas },
      }}
    />
  );
}
