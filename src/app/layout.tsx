import type { Metadata } from 'next';
import './globals.css';
import '@livekit/components-styles';
import '@fontsource-variable/nunito';
import './jacall.css';
import { PreferencesProvider } from '@/components/preferences';
export const metadata: Metadata = { title: 'NACALL · A call é sua. A resenha é nossa.', description: 'Junta o squad, abre o mic e vem pra resenha com o JACALL. Voz, vídeo, comunidades e música para sua galera.', icons: {icon:'/brand/symbol.svg',apple:'/brand/avatar-192.png'} };
export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR" suppressHydrationWarning><body><PreferencesProvider>{children}</PreferencesProvider></body></html>;
}

