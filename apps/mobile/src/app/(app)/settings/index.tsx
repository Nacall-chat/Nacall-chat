import { useRouter } from 'expo-router';
import { ChevronRight, Palette, ShieldCheck, UserRound } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Header } from '@/components/header';
import { Body, Eyebrow, LinkButton, Screen } from '@/components/ui';
import { usePresence } from '@/features/social/presence';
import { useSocial } from '@/features/social/social';
import { useSession } from '@/lib/session';
import { useTheme, type ThemePreference } from '@/theme/theme';
import { radius, space } from '@/theme/tokens';
import { statusHint, statusLabel, type PresenceStatus } from '@nacall/core/presence';

const themes: [ThemePreference, string][] = [['system', 'Seguir o sistema'], ['dark', 'Escuro'], ['light', 'Claro']];
const statuses: PresenceStatus[] = ['online', 'away', 'invisible'];

/** Ajustes: perfil e segurança (telas próprias), status, tema e sair. */
export default function Settings() {
  const router = useRouter();
  const { tokens, preference, setPreference } = useTheme();
  const { signOut } = useSession();
  const { mine, setMine } = usePresence();
  const { profiles, me } = useSocial();

  return (
    <View style={{ flex: 1, backgroundColor: tokens.bg }}>
      <Header title="Ajustes" />
      <Screen>
        <View style={{ gap: 4 }}>
          <Eyebrow>CONTA</Eyebrow>
          <Body>{profiles[me] ? `${profiles[me].display_name} · @${profiles[me].username}` : ''}</Body>
        </View>

        <View style={{ gap: space.sm }}>
          <Row icon={<UserRound size={20} color={tokens.accent} />} title="Meu perfil" hint="Nome, usuário, bio, foto e capa" onPress={() => router.navigate('/settings/profile')} />
          <Row icon={<ShieldCheck size={20} color={tokens.accent} />} title="Segurança" hint="Senha, 2FA e sessões" onPress={() => router.navigate('/settings/security')} />
        </View>

        <Group title="Status">
          {statuses.map((status) => (
            <Option key={status} label={statusLabel[status]} hint={statusHint[status]} selected={mine === status} onPress={() => setMine(status)} />
          ))}
        </Group>

        <Group title="Tema" icon={<Palette size={14} color={tokens.muted} />}>
          {themes.map(([id, label]) => (
            <Option key={id} label={label} selected={preference === id} onPress={() => setPreference(id)} />
          ))}
        </Group>

        <LinkButton label="Sair da conta" onPress={() => void signOut()} />
      </Screen>
    </View>
  );
}

function Row({ icon, title, hint, onPress }: { icon: ReactNode; title: string; hint: string; onPress: () => void }) {
  const { tokens } = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.md, borderWidth: 1, backgroundColor: tokens.surface, borderColor: tokens.line }}>
      {icon}
      <View style={{ flex: 1 }}>
        <Text style={{ color: tokens.text, fontWeight: '800', fontSize: 15 }}>{title}</Text>
        <Text style={{ color: tokens.muted, fontSize: 12 }}>{hint}</Text>
      </View>
      <ChevronRight size={18} color={tokens.muted} />
    </Pressable>
  );
}

function Group({ title, icon, children }: { title: string; icon?: ReactNode; children: ReactNode }) {
  const { tokens } = useTheme();
  return (
    <View style={{ gap: space.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {icon}
        <Text style={{ color: tokens.muted, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 }}>{title.toUpperCase()}</Text>
      </View>
      <View style={{ gap: space.sm }}>{children}</View>
    </View>
  );
}

function Option({ label, hint, selected, onPress }: { label: string; hint?: string; selected: boolean; onPress: () => void }) {
  const { tokens } = useTheme();
  return (
    <Pressable accessibilityRole="radio" accessibilityState={{ selected }} onPress={onPress} style={{ padding: space.md, borderRadius: radius.md, borderWidth: 1, backgroundColor: selected ? tokens.soft : tokens.surface, borderColor: selected ? tokens.accent : tokens.line }}>
      <Text style={{ color: selected ? tokens.accent : tokens.text, fontWeight: '800', fontSize: 15 }}>{label}</Text>
      {hint ? <Text style={{ color: tokens.muted, fontSize: 12, marginTop: 2 }}>{hint}</Text> : null}
    </Pressable>
  );
}
