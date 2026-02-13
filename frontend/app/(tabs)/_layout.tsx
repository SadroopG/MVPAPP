import { Tabs } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { colors } from '../../src/theme';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarStyle: { backgroundColor: colors.bgSecondary, borderTopColor: colors.border, borderTopWidth: 1, height: 60, paddingBottom: 8, paddingTop: 4 },
      tabBarActiveTintColor: colors.primary,
      tabBarInactiveTintColor: colors.fgMuted,
      tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
    }}>
      <Tabs.Screen name="index" options={{ title: 'Browse', tabBarIcon: ({ color, size }) => <Feather name="search" size={size} color={color} /> }} />
      <Tabs.Screen name="shortlists" options={{ title: 'Shortlists', tabBarIcon: ({ color, size }) => <Feather name="bookmark" size={size} color={color} /> }} />
      <Tabs.Screen name="expoday" options={{ title: 'Expo Day', tabBarIcon: ({ color, size }) => <Feather name="calendar" size={size} color={color} /> }} />
      <Tabs.Screen name="admin" options={{ title: 'Admin', tabBarIcon: ({ color, size }) => <Feather name="settings" size={size} color={color} /> }} />
    </Tabs>
  );
}
