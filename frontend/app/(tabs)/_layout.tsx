import { Tabs } from 'expo-router';
import { Feather } from '@expo/vector-icons';

const C = { bg: '#0f172a', card: '#1e293b', border: 'rgba(255,255,255,0.08)', blue: '#3b82f6', muted: '#64748b' };

export default function TabLayout() {
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarStyle: { backgroundColor: C.card, borderTopColor: C.border, borderTopWidth: 1, height: 64, paddingBottom: 8, paddingTop: 6 },
      tabBarActiveTintColor: C.blue,
      tabBarInactiveTintColor: C.muted,
      tabBarLabelStyle: { fontSize: 11, fontWeight: '500', letterSpacing: 0.3 },
    }}>
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ color, size }) => <Feather name="grid" size={size} color={color} /> }} />
      <Tabs.Screen name="shortlists" options={{ title: 'Shortlists', tabBarIcon: ({ color, size }) => <Feather name="list" size={size} color={color} /> }} />
      <Tabs.Screen name="networks" options={{ title: 'Networks', tabBarIcon: ({ color, size }) => <Feather name="users" size={size} color={color} /> }} />
      <Tabs.Screen name="expoday" options={{ title: 'Expo Day', tabBarIcon: ({ color, size }) => <Feather name="calendar" size={size} color={color} /> }} />
      <Tabs.Screen name="admin" options={{ title: 'Admin', tabBarIcon: ({ color, size }) => <Feather name="upload" size={size} color={color} /> }} />
    </Tabs>
  );
}
