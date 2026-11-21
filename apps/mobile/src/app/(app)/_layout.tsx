import { Drawer } from 'expo-router/drawer';
import { useWindowDimensions, View } from 'react-native';
import { CallBar } from '@/features/call/call-bar';
import { CallProvider } from '@/features/call/call';
import { DrawerPanel } from '@/features/nav/drawer-panel';
import { NotificationsProvider } from '@/features/notifications/notifications';
import { ProfileSheetProvider } from '@/features/profile/profile-sheet';
import { PresenceProvider } from '@/features/social/presence';
import { RoomsProvider } from '@/features/social/rooms';
import { SocialProvider, useSocial } from '@/features/social/social';
import { UnreadProvider } from '@/features/social/unread';
import { useSession } from '@/lib/session';
import { useTheme } from '@/theme/theme';

/**
 * Área logada: provedores dos dados (social, presença, não lidas, salas), a folha de perfil e a gaveta
 * (arrastar da esquerda, de qualquer lugar da tela, ou pelo botão de menu), como no Discord.
 */
export default function AppLayout() {
  const { session } = useSession();
  return (
    <SocialProvider>
      <Providers me={session?.user.id ?? ''} />
    </SocialProvider>
  );
}

function Providers({ me }: { me: string }) {
  const { dms, channels } = useSocial();
  return (
    <PresenceProvider me={me}>
      <UnreadProvider me={me} dmIds={dms.map((d) => d.id)}>
        <RoomsProvider voiceChannelIds={channels.filter((c) => c.kind === 'voice').map((c) => c.id)}>
          <ProfileSheetProvider>
            <NotificationsProvider>
              <CallProvider>
                <Navigation />
              </CallProvider>
            </NotificationsProvider>
          </ProfileSheetProvider>
        </RoomsProvider>
      </UnreadProvider>
    </PresenceProvider>
  );
}

function Navigation() {
  const { tokens } = useTheme();
  const { width } = useWindowDimensions();
  return (
    <View style={{ flex: 1, backgroundColor: tokens.bg }}>
    <View style={{ flex: 1 }}>
    <Drawer
      drawerContent={(props) => <DrawerPanel navigation={props.navigation as unknown as { closeDrawer: () => void }} />}
      screenOptions={{
        headerShown: false,
        drawerType: 'front',
        swipeEdgeWidth: width, // arrastar para a direita abre de qualquer ponto da tela
        drawerStyle: { width: Math.min(width * 0.92, 390), backgroundColor: tokens.surface },
        sceneStyle: { backgroundColor: tokens.bg },
      }}
    >
      <Drawer.Screen name="index" />
      <Drawer.Screen name="dm/[id]" />
      <Drawer.Screen name="channel/[id]" />
      <Drawer.Screen name="settings/index" />
      <Drawer.Screen name="settings/profile" />
      <Drawer.Screen name="settings/security" />
      <Drawer.Screen name="servers/new" />
      <Drawer.Screen name="call" />
    </Drawer>
    </View>
    <CallBar />
    </View>
  );
}
