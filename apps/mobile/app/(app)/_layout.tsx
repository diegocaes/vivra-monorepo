import { useEffect } from 'react';
import { Tabs, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StackActions } from '@react-navigation/native';
import { Colors, FontSize, FontWeight } from '../../constants/theme';
import { track } from '../../lib/analytics';

export default function AppLayout() {
  const insets = useSafeAreaInsets();
  // Screen views → app_events (se leen en /admin)
  const pathname = usePathname();
  useEffect(() => {
    track('screen_view', pathname || '/');
  }, [pathname]);

  // The app has five lightweight tabs. Keeping them mounted is safer than
  // letting native-screens detach or freeze a nested stack mid-transition:
  // on some iOS devices that produced an intermittent blank content area.
  return (
    <Tabs
      detachInactiveScreens={false}
      screenOptions={{
        headerShown: false,
        lazy: false,
        freezeOnBlur: false,
        tabBarActiveTintColor: Colors.accent,
        tabBarInactiveTintColor: Colors.muted,
        tabBarStyle: {
          backgroundColor: Colors.canvas,
          borderTopColor: Colors.cardBorder,
          borderTopWidth: 1,
          paddingTop: 8,
          paddingBottom: Math.max(insets.bottom, 10),
          height: 60 + Math.max(insets.bottom, 10),
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
      <Tabs.Screen name="cuidado" options={{
        title: 'Cuidado', tabBarAccessibilityLabel: 'Tab Cuidado',
        tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'paw' : 'paw-outline'} size={25} color={color} />,
        popToTopOnBlur: true,
      }} />
      <Tabs.Screen name="viajes" options={{
        title: 'Viajes', tabBarAccessibilityLabel: 'Tab Viajes',
        tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'airplane' : 'airplane-outline'} size={25} color={color} />,
        popToTopOnBlur: true,
      }} />
      <Tabs.Screen name="alimentacion" options={{ href: null }} />
      {/* Legacy hidden route: Vuelos remains unavailable in the tab bar. */}
      <Tabs.Screen name="actividad" options={{ href: null }} />
      <Tabs.Screen
        name="perfil"
        listeners={({ navigation }) => ({ tabPress: (event) => { event.preventDefault(); navigation.navigate("perfil", { view: "menu" }); } })}
        options={{
          title: 'Más',
          tabBarAccessibilityLabel: 'Tab Más',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'ellipsis-horizontal' : 'ellipsis-horizontal-outline'} size={24} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
