import React, { useState } from 'react';
import { StyleSheet, TextInput, TextInputProps, TouchableOpacity, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

const MARGIN_KEYS = ['margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight', 'marginHorizontal', 'marginVertical', 'flex', 'alignSelf'] as const;

/** Password box with a show / hide eye. Margins of `style` move to the wrapper so the eye stays centred. */
export default function PasswordInput({ style, ...props }: TextInputProps) {
  const [shown, setShown] = useState(false);
  const flat = { ...(StyleSheet.flatten(style) || {}) } as Record<string, any>;
  const outer: ViewStyle = {};
  for (const k of MARGIN_KEYS) {
    if (flat[k] !== undefined) {
      (outer as any)[k] = flat[k];
      delete flat[k];
    }
  }
  return (
    <View style={[styles.wrap, outer]}>
      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        {...props}
        secureTextEntry={!shown}
        style={[flat, styles.input]}
      />
      <TouchableOpacity
        style={styles.eye}
        onPress={() => setShown((s) => !s)}
        accessibilityRole="button"
        accessibilityLabel={shown ? 'Hide password' : 'Show password'}
        hitSlop={8}
      >
        <Ionicons name={shown ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textSecondary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative', justifyContent: 'center' },
  input: { paddingRight: 44 },
  eye: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 44, alignItems: 'center', justifyContent: 'center' },
});
