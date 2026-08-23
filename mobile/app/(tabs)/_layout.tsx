import { useEffect, useState } from 'react';
import { Tabs, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';
import { getUser, isAuthenticated } from '@/services/auth';
import type { User } from '@/services/api';

function TabIcon({
  name, color, focused,
}: {
  name: keyof typeof Ionicons.glyphMap;
  color: string;
  focused: boolean;
}) {
  return (
    <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
      <Ionicons name={name} size={22} color={color} />
    </View>
  );
}

export default function TabsLayout() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    async function guard() {
      const authed = await isAuthenticated();
      if (!authed) { router.replace('/(auth)/login'); return; }
      setUser(await getUser());
    }
    guard();
  }, []);

  const isAdminOrTeacher = user?.role === 'admin' || user?.role === 'teacher';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor:   Colors.brand,
        tabBarInactiveTintColor: Colors.textSecondary,
        tabBarStyle: {
          backgroundColor:  Colors.tabBar,
          borderTopColor:   Colors.tabBarBorder,
          paddingBottom:    6,
          paddingTop:       6,
          height:           62,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginTop: 2 },
        headerStyle:      { backgroundColor: Colors.brandDark },
        headerTintColor:  '#fff',
        headerTitleStyle: { fontWeight: '700', fontSize: 17 },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="home-outline" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="attendance"
        options={{
          title: 'Attendance',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="calendar-outline" color={color} focused={focused} />
          ),
          href: isAdminOrTeacher ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="students"
        options={{
          title: 'Students',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="people-outline" color={color} focused={focused} />
          ),
          href: isAdminOrTeacher ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="batches"
        options={{
          title: 'Batches',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="school-outline" color={color} focused={focused} />
          ),
          href: isAdminOrTeacher ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="tests"
        options={{
          title: 'Tests',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="book-outline" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="person-outline" color={color} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap:       { alignItems: 'center', justifyContent: 'center', padding: 4, borderRadius: 10 },
  iconWrapActive: { backgroundColor: '#dbeafe' },
});
