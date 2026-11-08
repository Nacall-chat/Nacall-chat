import type { Metadata } from 'next';
import './globals.css';
import '@livekit/components-styles';
import '@fontsource-variable/nunito';
import './jacall.css';
import { PreferencesProvider } from '@/components/preferences';
export const metadata: Metadata = { manifest:'/manifest.webmanifest', applicationName:'NACALL', appleWebApp:{capable:true,title:'NACALL',statusBarStyle:'black-translucent'}, title: 'NACALL · A call é sua. A resenha é nossa.', description: 'Junta o squad, abre o mic e vem pra resenha com o mascote JACALL. Voz, vídeo, comunidades e música para sua galera.', icons: {icon:'/brand/jacall-favicon.png',apple:'/brand/jacall-avatar.webp'} };
export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR" suppressHydrationWarning><body><PreferencesProvider>{children}</PreferencesProvider></body></html>;
}

