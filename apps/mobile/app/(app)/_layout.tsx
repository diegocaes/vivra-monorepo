import { useEffect } from 'react';
import { Tabs, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StackActions } from '@react-navigation/native';
import { Colors, FontSize, FontWeight } from '../../constants/theme';
import { PetProvider } from '../../contexts/PetContext';
import { track } from '../../lib/analytics';

export default function AppLayout() {
  // Screen views → app_events (se leen en /admin)
  const pathname = usePathname();
  useEffect(() => {
    track('screen_view', pathname || '/');
  }, [pathname]);

  return (
    <PetProvider>
    {/* The app has four lightweight tabs. Keeping them mounted is safer than
        letting native-screens detach or freeze a nested stack mid-transition:
        on some iOS devices that produced an intermittent blank content area
        when moving between Inicio, Salud, Comida and Perfil. */}
    <Tabs
      detachInactiveScreens={false}
      screenOptions={{
        headerShown: false,
        lazy: false,
        freezeOnBlur: false,
        tabBarActiveTintColor: Colors.accent,
        tabBarInactiveTintColor: Colors.muted,
        tabBarStyle: {
          backgroundColor: Colors.card,
          borderTopColor: Colors.cardBorder,
          borderTopWidth: 1,
          paddingBottom: 4,
          height: 88,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarLabelStyle: {
          fontSize: FontSize.xs,
          fontWeight: FontWeight.medium,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inicio',
          tabBarAccessibilityLabel: 'Tab Inicio',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="salud"
        options={{
          title: 'Salud',
          tabBarAccessibilityLabel: 'Tab Salud',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'heart' : 'heart-outline'} size={24} color={color} />
          ),
        }}
        // Salud contains a nested stack (Vacunas, Peso, etc.). On returning
        // through its tab, always show the Salud home instead of reviving an
        // old detail screen that may have been frozen while another tab was
        // active. Targeting this stack avoids touching the other tab stacks.
        listeners={({ navigation }) => ({
          tabPress: () => {
            const saludRoute = navigation.getState().routes.find((route: { name: string; state?: unknown }) => route.name === 'salud');
            const saludStackKey = (saludRoute?.state as { key?: string } | undefined)?.key;
            if (saludStackKey) {
              navigation.dispatch({ ...StackActions.popToTop(), target: saludStackKey });
            }
          },
        })}
      />
      <Tabs.Screen
        name="alimentacion"
        options={{
          title: 'Comida',
          tabBarAccessibilityLabel: 'Tab Comida',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'restaurant' : 'restaurant-outline'} size={24} color={color} />
          ),
        }}
      />
      {/* Not a tab: holds grooming/pasaporte/vuelos routes reached from Salud y Perfil */}
      <Tabs.Screen name="actividad" options={{ href: null }} />
      <Tabs.Screen
        name="perfil"
        options={{
          title: 'Perfil',
          tabBarAccessibilityLabel: 'Tab Perfil',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={24} color={color} />
          ),
        }}
      />
    </Tabs>
    </PetProvider>
  );
}
