import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight } from '../../constants/theme';
import { PetProvider } from '../../contexts/PetContext';

export default function AppLayout() {
  return (
    <PetProvider>
    <Tabs
      screenOptions={{
        headerShown: false,
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
        animation: 'fade',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inicio',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="salud"
        options={{
          title: 'Salud',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'heart' : 'heart-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="alimentacion"
        options={{
          title: 'Comida',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'restaurant' : 'restaurant-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="actividad"
        options={{
          title: 'Actividad',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'flash' : 'flash-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={24} color={color} />
          ),
        }}
      />
    </Tabs>
    </PetProvider>
  );
}
