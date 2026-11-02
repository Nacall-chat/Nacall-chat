import type { Metadata } from 'next';
import './globals.css';
import '@livekit/components-styles';
import '@fontsource-variable/manrope';
import { PreferencesProvider } from '@/components/preferences';
export const metadata: Metadata = { title: 'NACALL · A resenha não dá lag', description: 'Entra na call. O resto a gente improvisa.', icons: {icon:'/brand/favicon-gamer.png',apple:'/brand/avatar-gamer.webp'} };
export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR" suppressHydrationWarning><body><PreferencesProvider>{children}</PreferencesProvider></body></html>;
}

