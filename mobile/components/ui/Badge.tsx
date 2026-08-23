import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

type BadgeVariant = 'green' | 'red' | 'yellow' | 'blue' | 'gray';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
}

const variantStyles: Record<BadgeVariant, { bg: string; text: string }> = {
  green:  { bg: '#dcfce7', text: '#16a34a' },
  red:    { bg: '#fee2e2', text: '#dc2626' },
  yellow: { bg: '#fef9c3', text: '#ca8a04' },
  blue:   { bg: '#dbeafe', text: '#2563eb' },
  gray:   { bg: '#f1f5f9', text: '#64748b' },
};

export function Badge({ label, variant = 'gray' }: BadgeProps) {
  const v = variantStyles[variant];
  return (
    <View style={[styles.base, { backgroundColor: v.bg }]}>
      <Text style={[styles.text, { color: v.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  text: { fontSize: 11, fontWeight: '600' },
});
