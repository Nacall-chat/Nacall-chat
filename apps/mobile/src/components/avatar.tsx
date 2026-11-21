import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { avatarUrl, groupIconUrl } from '@/lib/media-url';
import { useTheme } from '@/theme/theme';
import type { PresenceState } from '@nacall/core/presence';
import type { Profile, Server } from '@nacall/core/types';
import { initialsOf } from '@/features/social/logic';

/** Bolinha de status: verde online, amarela ausente, cinza offline. */
export function StatusDot({ state, size = 12 }: { state: PresenceState | 'invisible'; size?: number }) {
  const { tokens } = useTheme();
  const color = state === 'online' ? '#3ecf8e' : state === 'away' ? '#f0b232' : '#8a8f98';
  return <View accessibilityRole="image" accessibilityLabel={state === 'online' ? 'Online' : state === 'away' ? 'Ausente' : 'Offline'} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, borderWidth: 2, borderColor: tokens.surface }} />;
}

/** Foto (ou iniciais) com a bolinha de status no canto. Sem `state`, só o avatar. */
export function Avatar({ profile, name, size = 40, state, radius }: { profile?: Profile; name?: string; size?: number; state?: PresenceState; radius?: number }) {
  const { tokens } = useTheme();
  const [failed, setFailed] = useState('');
  const src = avatarUrl(profile?.avatar_path);
  const label = profile?.display_name ?? name ?? 'Jogador';
  const r = radius ?? Math.round(size * 0.33);
  return (
    <View style={{ width: size, height: size }}>
      <View style={[styles.box, { width: size, height: size, borderRadius: r, backgroundColor: tokens.soft, borderColor: tokens.line }]}>
        {src && failed !== src ? (
          <Image source={{ uri: src }} style={{ width: size, height: size }} contentFit="cover" onError={() => setFailed(src)} />
        ) : (
          <Text style={{ color: tokens.accent, fontSize: Math.max(10, size * 0.32), fontWeight: '800' }}>{initialsOf(label)}</Text>
        )}
      </View>
      {state ? <View style={{ position: 'absolute', right: -2, bottom: -2 }}><StatusDot state={state} size={Math.max(10, size * 0.3)} /></View> : null}
    </View>
  );
}

/** Ícone do servidor: o do grupo, o mascote no oficial, ou as iniciais. */
export function GroupIcon({ server, size = 46 }: { server: Pick<Server, 'name' | 'icon_path' | 'is_official'>; size?: number }) {
  const { tokens } = useTheme();
  const [failed, setFailed] = useState('');
  const src = server.is_official ? '' : groupIconUrl(server.icon_path);
  return (
    <View style={[styles.box, { width: size, height: size, borderRadius: size * 0.32, backgroundColor: tokens.soft, borderColor: tokens.line }]}>
      {server.is_official ? (
        <Image source={require('../../assets/brand/jacall-avatar.webp')} style={{ width: size, height: size }} contentFit="cover" />
      ) : src && failed !== src ? (
        <Image source={{ uri: src }} style={{ width: size, height: size }} contentFit="cover" onError={() => setFailed(src)} />
      ) : (
        <Text style={{ color: tokens.accent, fontSize: size * 0.32, fontWeight: '800' }}>{initialsOf(server.name)}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({ box: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 1 } });
