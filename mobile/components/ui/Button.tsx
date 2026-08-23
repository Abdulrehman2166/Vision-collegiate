import React from 'react';
import {
  TouchableOpacity, Text, ActivityIndicator,
  StyleSheet, ViewStyle, TextStyle,
} from 'react-native';
import { Colors } from '@/constants/Colors';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
}

export function Button({
  title, onPress, variant = 'primary',
  loading = false, disabled = false,
  style, textStyle, icon,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.75}
      style={[
        styles.base,
        styles[variant],
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'secondary' || variant === 'ghost' ? Colors.brand : '#fff'} size="small" />
      ) : (
        <>
          {icon}
          <Text style={[styles.text, styles[`${variant}Text`], textStyle]}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    paddingHorizontal: 20,
    borderRadius: 14,
  },
  primary:       { backgroundColor: Colors.brand },
  secondary:     { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  danger:        { backgroundColor: '#ef4444' },
  ghost:         { backgroundColor: 'transparent' },
  disabled:      { opacity: 0.5 },
  text:          { fontSize: 15, fontWeight: '600' },
  primaryText:   { color: '#fff' },
  secondaryText: { color: Colors.text },
  dangerText:    { color: '#fff' },
  ghostText:     { color: Colors.brand },
});
