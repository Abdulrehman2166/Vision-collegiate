import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';

type IconColor = 'blue' | 'green' | 'red' | 'yellow' | 'purple';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: keyof typeof Ionicons.glyphMap;
  color?: IconColor;
}

const iconBg: Record<IconColor, string> = {
  blue:   '#dbeafe',
  green:  '#dcfce7',
  red:    '#fee2e2',
  yellow: '#fef9c3',
  purple: '#ede9fe',
};
const iconColor: Record<IconColor, string> = {
  blue:   '#2563eb',
  green:  '#16a34a',
  red:    '#dc2626',
  yellow: '#ca8a04',
  purple: '#7c3aed',
};

export function StatCard({ title, value, icon, color = 'blue' }: StatCardProps) {
  return (
    <View style={styles.card}>
      <View style={[styles.iconBox, { backgroundColor: iconBg[color] }]}>
        <Ionicons name={icon} size={22} color={iconColor[color]} />
      </View>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    alignItems: 'flex-start',
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  iconBox:  { padding: 10, borderRadius: 12 },
  value:    { fontSize: 26, fontWeight: '700', color: Colors.text },
  title:    { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' },
});
