import { Image } from 'expo-image';
import { useState, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { mix } from '@/theme/mix';
import { radius, space } from '@/theme/tokens';
import { useKeyboardVisible } from '@/lib/use-keyboard';
import { useTheme } from '@/theme/theme';

/** Tela com fundo do tema, áreas seguras e rolagem que desvia do teclado. */
export function Screen({ children, scroll = true, style }: { children: ReactNode; scroll?: boolean; style?: StyleProp<ViewStyle> }) {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardVisible();
  const padding = { paddingTop: insets.top + space.lg, paddingBottom: (keyboard ? 0 : insets.bottom) + space.lg, paddingHorizontal: space.lg };
  const body = scroll ? (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.grow, padding, style]}>
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.grow, padding, style]}>{children}</View>
  );
  return (
    <KeyboardAvoidingView style={[styles.fill, { backgroundColor: tokens.bg }]} behavior="padding">
      {body}
    </KeyboardAvoidingView>
  );
}

export function Body({ children, muted, small, style }: { children: ReactNode; muted?: boolean; small?: boolean; style?: StyleProp<TextStyle> }) {
  const { tokens } = useTheme();
  return (
    <Text style={[{ color: muted ? tokens.muted : tokens.text, fontSize: small ? 13 : 15, lineHeight: small ? 18 : 22 }, style]}>
      {children}
    </Text>
  );
}

export function Eyebrow({ children }: { children: string }) {
  const { tokens } = useTheme();
  return <Text style={{ color: tokens.accent, fontSize: 11, fontWeight: '800', letterSpacing: 1.6 }}>{children}</Text>;
}

export function Title({ children }: { children: string }) {
  const { tokens } = useTheme();
  return <Text accessibilityRole="header" style={{ color: tokens.text, fontSize: 30, lineHeight: 34, fontWeight: '800', letterSpacing: -0.8 }}>{children}</Text>;
}

/** Campo de texto com rótulo, dica e erro. */
export function Field({
  label,
  hint,
  error,
  secure,
  ...input
}: { label: string; hint?: string; error?: string; secure?: boolean } & TextInputProps) {
  const { tokens } = useTheme();
  const [visible, setVisible] = useState(false);
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: space.xs }}>
      <Text style={{ color: tokens.muted, fontSize: 12, fontWeight: '700' }}>{label}</Text>
      <View style={[styles.inputBox, { backgroundColor: tokens.surface, borderColor: error ? tokens.error : focused ? tokens.accent : tokens.line }]}>
        <TextInput
          {...input}
          accessibilityLabel={label}
          secureTextEntry={secure && !visible}
          placeholderTextColor={tokens.faint}
          onFocus={(e) => { setFocused(true); input.onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); input.onBlur?.(e); }}
          style={[styles.input, { color: tokens.text }, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as TextStyle) : null]}
        />
        {secure ? (
          <Pressable accessibilityRole="button" accessibilityLabel={visible ? 'Ocultar senha' : 'Mostrar senha'} hitSlop={10} onPress={() => setVisible((v) => !v)}>
            <Text style={{ color: tokens.accent, fontSize: 13, fontWeight: '700' }}>{visible ? 'Ocultar' : 'Mostrar'}</Text>
          </Pressable>
        ) : null}
      </View>
      {error ? <Text accessibilityRole="alert" style={{ color: tokens.error, fontSize: 12 }}>{error}</Text> : hint ? <Text style={{ color: tokens.muted, fontSize: 12 }}>{hint}</Text> : null}
    </View>
  );
}

export function PrimaryButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  const { tokens } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.button, { backgroundColor: tokens.primary, opacity: disabled ? 0.45 : pressed ? 0.85 : 1 }]}
    >
      <Text style={{ color: tokens.onPrimary, fontSize: 16, fontWeight: '800' }}>{label}</Text>
    </Pressable>
  );
}

export function LinkButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  const { tokens } = useTheme();
  return (
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} hitSlop={8} style={{ paddingVertical: space.sm, opacity: disabled ? 0.5 : 1 }}>
      <Text style={{ color: tokens.accent, fontSize: 14, fontWeight: '700', textAlign: 'center' }}>{label}</Text>
    </Pressable>
  );
}

export function Notice({ children, tone = 'info' }: { children: string; tone?: 'info' | 'error' }) {
  const { tokens } = useTheme();
  return (
    <View accessibilityRole={tone === 'error' ? 'alert' : undefined} style={[styles.notice, { backgroundColor: tone === 'error' ? mix(tokens.error, tokens.surface, 0.14) : tokens.soft, borderColor: tone === 'error' ? tokens.error : tokens.line }]}>
      <Text style={{ color: tokens.text, fontSize: 13, lineHeight: 18 }}>{children}</Text>
    </View>
  );
}

/** Mascote + NACALL com as cores da marca do tema. */
export function Brand() {
  const { tokens } = useTheme();
  return (
    <View style={styles.brand} accessible accessibilityLabel="NACALL">
      <Image source={require('../../assets/brand/jacall-avatar.webp')} style={styles.avatar} contentFit="cover" />
      <Text style={{ fontSize: 26, fontWeight: '900', letterSpacing: -1.2, color: tokens.text }}>
        NA<Text style={{ color: tokens.brandCall }}>CALL</Text>
        <Text style={{ color: tokens.brandDot }}>.</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  grow: { flexGrow: 1, gap: space.lg },
  inputBox: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 50, paddingHorizontal: space.md, borderWidth: 1, borderRadius: radius.md },
  input: { flex: 1, fontSize: 16, paddingVertical: space.sm },
  button: { minHeight: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.lg },
  notice: { borderWidth: 1, borderRadius: radius.md, padding: space.md },
  brand: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  avatar: { width: 44, height: 44, borderRadius: 14 },
});
