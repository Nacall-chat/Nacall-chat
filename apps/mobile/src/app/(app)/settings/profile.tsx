import { Image } from 'expo-image';
import { Camera, Trash2 } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '@/components/avatar';
import { Header } from '@/components/header';
import { Body, Field, Notice, PrimaryButton, Screen } from '@/components/ui';
import { changeAvatar, changeCover, removeCover } from '@/features/account/images';
import { BIO_MAX, profileChanged, profileFormIssue } from '@/features/account/logic';
import { useSocial } from '@/features/social/social';
import { friendlyError } from '@/lib/errors';
import { coverUrl } from '@/lib/media-url';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/theme/theme';
import { radius } from '@/theme/tokens';
import type { Profile } from '@nacall/core/types';
import { errorText, usernameHint } from '@nacall/core/validation';

/** Editar perfil: nome, usuário, bio, foto e capa (as mesmas regras e o mesmo armazenamento do site). */
export default function ProfileSettings() {
  const { tokens } = useTheme();
  const { me, profiles } = useSocial();
  const profile = profiles[me];
  if (!profile) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.bg }}>
        <Header title="Meu perfil" />
        <Screen><Body muted>Carregando seu perfil…</Body></Screen>
      </View>
    );
  }
  // key: se o perfil for recarregado de outro lugar, o formulário recomeça com os valores salvos
  return <ProfileForm key={profile.id} profile={profile} />;
}

function ProfileForm({ profile }: { profile: Profile }) {
  const { tokens } = useTheme();
  const { reload } = useSocial();
  const [displayName, setDisplayName] = useState(profile.display_name);
  const [username, setUsername] = useState(profile.username);
  const [bio, setBio] = useState(profile.bio);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const lock = useRef(false);

  const form = { displayName, username, bio };
  const saved = { displayName: profile.display_name, username: profile.username, bio: profile.bio };
  const issue = profileFormIssue(form);
  const changed = profileChanged(saved, form);

  async function run(task: () => Promise<string | null>) {
    if (lock.current || !supabase) return;
    lock.current = true;
    setBusy(true);
    setMessage(null);
    try {
      const text = await task();
      if (text) { await reload(); setMessage({ text, error: false }); }
    } catch (e) {
      setMessage({ text: friendlyError(errorText(e)), error: true });
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }

  const save = () => run(async () => {
    const { error } = await supabase!.from('profiles').update({ username: username.trim(), display_name: displayName.trim(), bio }).eq('id', profile.id);
    if (error) throw error.code === '23505' ? new Error('Esse usuário já está na party. Escolha outro nome.') : error;
    return 'Perfil salvo. Novo nick, mesma lenda.';
  });

  const cover = coverUrl(profile.cover_path);

  return (
    <View style={{ flex: 1, backgroundColor: tokens.bg }}>
      <Header title="Meu perfil" />
      <Screen>
        <View>
          <View style={[styles.cover, { backgroundColor: tokens.soft }]}>
            {cover ? <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
            <View style={styles.coverActions}>
              <Pill label={profile.cover_path ? 'Trocar capa' : 'Adicionar capa'} disabled={busy} onPress={() => void run(async () => (supabase && (await changeCover(supabase, profile)) ? 'Capa atualizada. Seu perfil entrou no clima.' : null))}>
                <Camera size={15} color="#fff" />
              </Pill>
              {profile.cover_path ? (
                <Pill label="Remover capa" iconOnly disabled={busy} onPress={() => void run(async () => { if (supabase) await removeCover(supabase, profile); return 'Capa removida.'; })}>
                  <Trash2 size={15} color="#fff" />
                </Pill>
              ) : null}
            </View>
          </View>
          <View style={[styles.avatarRing, { borderColor: tokens.bg }]}>
            <Avatar profile={profile} size={84} radius={28} />
            <Pressable accessibilityRole="button" accessibilityLabel="Trocar foto" disabled={busy} onPress={() => void run(async () => (supabase && (await changeAvatar(supabase, profile)) ? 'Foto atualizada. Agora a call tem rosto.' : null))} style={[styles.avatarEdit, { backgroundColor: tokens.primary, borderColor: tokens.bg }]}>
              <Camera size={15} color={tokens.onPrimary} />
            </Pressable>
          </View>
        </View>
        <Body muted small>Foto e nome aparecem para a galera (JPG, PNG ou WebP, até 5 MB). A capa aceita GIF, é pública no seu perfil e usa recorte 3:1; evite efeitos piscantes.</Body>

        <View style={{ gap: 14 }}>
          <Field label="Nome que aparece na call" value={displayName} onChangeText={setDisplayName} maxLength={60} autoComplete="nickname" />
          <Field label="Usuário de login" value={username} onChangeText={(v) => setUsername(v.replace(/\s/g, ''))} maxLength={24} autoCapitalize="none" autoCorrect={false} hint={`${usernameHint} Ao mudar, use o novo usuário no próximo login. A senha continua igual.`} />
          <Field label="Bio" value={bio} onChangeText={setBio} maxLength={BIO_MAX} multiline placeholder="Main suporte. Culpa do ping. E outras verdades." hint={`${bio.length}/${BIO_MAX}`} />
        </View>

        {issue && changed ? <Notice tone="error">{issue}</Notice> : null}
        {message ? <Notice tone={message.error ? 'error' : 'info'}>{message.text}</Notice> : null}
        <PrimaryButton label={busy ? 'Salvando…' : 'Salvar perfil'} disabled={busy || !changed || Boolean(issue)} onPress={() => void save()} />
      </Screen>
    </View>
  );
}

function Pill({ label, iconOnly, disabled, onPress, children }: { label: string; iconOnly?: boolean; disabled?: boolean; onPress: () => void; children: React.ReactNode }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} style={[styles.pill, iconOnly ? styles.pillIcon : null, { opacity: disabled ? 0.5 : 1 }]}>
      {children}
      {iconOnly ? null : <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{label}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cover: { height: 140, borderRadius: radius.lg, overflow: 'hidden' },
  coverActions: { position: 'absolute', right: 10, bottom: 10, flexDirection: 'row', gap: 8 },
  pill: { height: 36, paddingHorizontal: 12, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#0d0d0dcc', borderWidth: 1, borderColor: '#ffffff33' },
  pillIcon: { width: 36, paddingHorizontal: 0 },
  avatarRing: { marginTop: -42, marginLeft: 14, alignSelf: 'flex-start', borderWidth: 5, borderRadius: 33 },
  avatarEdit: { position: 'absolute', right: -6, bottom: -6, width: 34, height: 34, borderRadius: 17, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
});
