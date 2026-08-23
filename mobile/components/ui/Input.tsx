import React, { useState } from 'react';
import {
  View, TextInput, Text, TouchableOpacity,
  StyleSheet, TextInputProps,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  secureToggle?: boolean;
  leftIcon?: keyof typeof Ionicons.glyphMap;
}

export function Input({ label, error, secureToggle, leftIcon, style, ...props }: InputProps) {
  const [show, setShow] = useState(false);

  return (
    <View style={styles.wrapper}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={[styles.container, !!error && styles.containerError]}>
        {leftIcon && (
          <Ionicons name={leftIcon} size={18} color={Colors.textSecondary} style={styles.leftIcon} />
        )}
        <TextInput
          {...props}
          secureTextEntry={secureToggle ? !show : props.secureTextEntry}
          style={[styles.input, style]}
          placeholderTextColor={Colors.textSecondary}
        />
        {secureToggle && (
          <TouchableOpacity onPress={() => setShow((s) => !s)} style={styles.eyeBtn}>
            <Ionicons name={show ? 'eye-off' : 'eye'} size={18} color={Colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper:        { marginBottom: 4 },
  label:          { fontSize: 13, fontWeight: '500', color: Colors.text, marginBottom: 6 },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  containerError: { borderColor: '#ef4444' },
  leftIcon:       { marginRight: 8 },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.text,
  },
  eyeBtn:  { padding: 4 },
  error:   { fontSize: 12, color: '#ef4444', marginTop: 4 },
});
