import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';

import api from '@/services/api';
import { getUser, clearAuth } from '@/services/auth';
import type { User } from '@/services/api';
import { Card } from '@/components/ui/Card';
import { Colors } from '@/constants/Colors';

const ROLE_LABEL: Record<string, string> = {
  admin:   '👑 Admin',
  teacher: '🎓 Teacher',
  parent:  '👪 Parent',
  student: '📚 Student',
};

export default function ProfileScreen() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    getUser().then(setUser);
  }, []);

  async function handleLogout() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try { await api.post('/auth/logout'); } catch { /* ignore */ }
          await clearAuth();
          router.replace('/(auth)/login');
        },
      },
    ]);
  }

  const menuItems = [
    {
      section: 'Account',
      items: [
        { icon: 'person-circle-outline', label: 'My Profile',      value: user?.name ?? '…' },
        { icon: 'mail-outline',          label: 'Email',            value: user?.email ?? '…' },
        { icon: 'call-outline',          label: 'Phone',            value: user?.phone ?? 'Not set' },
        { icon: 'shield-checkmark-outline', label: 'Role',          value: ROLE_LABEL[user?.role ?? ''] ?? user?.role ?? '…' },
      ],
    },
    {
      section: 'App',
      items: [
        { icon: 'server-outline',        label: 'Backend URL',      value: process.env.EXPO_PUBLIC_API_URL ?? 'localhost:3000' },
        { icon: 'information-circle-outline', label: 'App Version', value: '1.0.0' },
      ],
    },
  ];

  return (
    <ScrollView style={styles.bg} contentContainerStyle={styles.content}>
      <StatusBar style="auto" />

      {/* Avatar section */}
      <View style={styles.hero}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user?.name?.charAt(0)?.toUpperCase() ?? '?'}</Text>
        </View>
        <Text style={styles.name}>{user?.name ?? 'Loading…'}</Text>
        <Text style={styles.role}>{ROLE_LABEL[user?.role ?? ''] ?? user?.role}</Text>
      </View>

      {/* Menu sections */}
      {menuItems.map((section) => (
        <View key={section.section} style={styles.section}>
          <Text style={styles.sectionLabel}>{section.section}</Text>
          <Card style={styles.sectionCard}>
            {section.items.map((item, idx) => (
              <View
                key={item.label}
                style={[
                  styles.menuRow,
                  idx < section.items.length - 1 && styles.menuRowBorder,
                ]}
              >
                <View style={styles.menuIcon}>
                  <Ionicons name={item.icon as never} size={18} color={Colors.brand} />
                </View>
                <Text style={styles.menuLabel}>{item.label}</Text>
                <Text style={styles.menuValue} numberOfLines={1}>{item.value}</Text>
              </View>
            ))}
          </Card>
        </View>
      ))}

      {/* Logout */}
      <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn} activeOpacity={0.75}>
        <Ionicons name="log-out-outline" size={20} color="#dc2626" />
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bg:           { flex: 1, backgroundColor: Colors.background },
  content:      { padding: 24, paddingBottom: 48 },
  hero:         { alignItems: 'center', marginBottom: 32 },
  avatar: {
    width: 84, height: 84, borderRadius: 42,
    backgroundColor: Colors.brand,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
    shadowColor: Colors.brand,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 10, elevation: 6,
  },
  avatarText:   { fontSize: 36, fontWeight: '700', color: '#fff' },
  name:         { fontSize: 22, fontWeight: '700', color: Colors.text },
  role: {
    fontSize: 14, color: Colors.textSecondary,
    backgroundColor: '#dbeafe', paddingHorizontal: 12, paddingVertical: 4,
    borderRadius: 12, marginTop: 8,
  },
  section:      { marginBottom: 20 },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, marginLeft: 4 },
  sectionCard:  { padding: 0, overflow: 'hidden' },
  menuRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 12, padding: 14,
  },
  menuRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  menuIcon: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: '#dbeafe', alignItems: 'center', justifyContent: 'center',
  },
  menuLabel:    { flex: 1, fontSize: 14, color: Colors.text, fontWeight: '500' },
  menuValue:    { fontSize: 13, color: Colors.textSecondary, maxWidth: 160, textAlign: 'right' },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginTop: 8,
    backgroundColor: '#fee2e2', padding: 16, borderRadius: 16,
  },
  logoutText:   { fontSize: 15, fontWeight: '700', color: '#dc2626' },
});
