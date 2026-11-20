import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, use, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { useColorScheme } from 'react-native';
import { dark, light, type ThemeTokens } from './tokens';

export type ThemePreference = 'system' | 'dark' | 'light';
const KEY = 'nacall-theme';

type ThemeValue = {
  tokens: ThemeTokens;
  scheme: 'dark' | 'light';
  preference: ThemePreference;
  setPreference: (value: ThemePreference) => void;
};
const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: PropsWithChildren) {
  const system = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    void AsyncStorage.getItem(KEY)
      .then((saved) => {
        if (saved === 'dark' || saved === 'light' || saved === 'system') setPreferenceState(saved);
      })
      .catch(() => undefined); // sem armazenamento, segue o sistema
  }, []);

  const value = useMemo<ThemeValue>(() => {
    const scheme = preference === 'system' ? (system === 'light' ? 'light' : 'dark') : preference;
    return {
      scheme,
      tokens: scheme === 'light' ? light : dark,
      preference,
      setPreference: (next) => {
        setPreferenceState(next);
        void AsyncStorage.setItem(KEY, next).catch(() => undefined);
      },
    };
  }, [preference, system]);

  return <ThemeContext value={value}>{children}</ThemeContext>;
}

export function useTheme() {
  const value = use(ThemeContext);
  if (!value) throw new Error('useTheme precisa estar dentro de <ThemeProvider />');
  return value;
}
