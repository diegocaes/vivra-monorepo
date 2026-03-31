import { useEffect } from 'react';
import { Stack, useNavigation } from 'expo-router';
import { StackActions } from '@react-navigation/native';
import { Colors } from '../../../constants/theme';

export default function ActividadLayout() {
  const navigation = useNavigation();

  useEffect(() => {
    const parent = navigation.getParent();
    if (!parent) return;
    const unsubscribe = parent.addListener('tabPress' as any, () => {
      navigation.dispatch(StackActions.popToTop());
    });
    return unsubscribe;
  }, [navigation]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.canvas },
      }}
    />
  );
}
