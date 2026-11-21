import type { SupabaseClient } from '@supabase/supabase-js';
import { useRouter } from 'expo-router';
import { Users } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { GroupIcon } from '@/components/avatar';
import { Header } from '@/components/header';
import { Body, Field, Notice, PrimaryButton, Screen } from '@/components/ui';
import { inviteCode } from '@/features/account/logic';
import { useSocial } from '@/features/social/social';
import { friendlyError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/theme/theme';
import { radius, space } from '@/theme/tokens';
import type { Server } from '@nacall/core/types';
import { errorText, nameSchema } from '@nacall/core/validation';

type Preview = Server & { member_count: number };

/** Criar uma comunidade ou entrar numa por convite (link ou código) — as mesmas funções do banco do site. */
export default function NewServer() {
  const { tokens } = useTheme();
  const router = useRouter();
  const { reload, setRailId } = useSocial();
  const db = supabase as SupabaseClient;
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  const [name, setName] = useState('');
  const [raw, setRaw] = useState('');
  const [code, setCode] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);

  async function run(task: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setMessage(null);
    try { await task(); } catch (e) { setMessage({ text: friendlyError(errorText(e)), error: true }); } finally { setBusy(false); lock.current = false; }
  }

  /** Depois de criar ou entrar: recarrega, escolhe o servidor na gaveta e abre o primeiro canal de texto. */
  async function open(serverId: string) {
    await reload();
    setRailId(serverId);
    const first = await db.from('channels').select('*').eq('server_id', serverId).eq('kind', 'text').order('created_at').limit(1).maybeSingle();
    if (first.data) router.navigate(`/channel/${first.data.id}`);
    else router.navigate('/');
  }

  const create = () => run(async () => {
    const { data, error } = await db.rpc('create_server', { server_name: nameSchema.parse(name) });
    if (error) throw error;
    setName('');
    await open(data as string);
  });

  const look = () => run(async () => {
    const found = inviteCode(raw);
    if (!found) throw new Error('Cole um link de convite válido ou o código completo.');
    const { data, error } = await db.rpc('preview_invite', { invite_code: found });
    if (error) throw new Error('Não foi possível abrir o convite.');
    const group = (data as Preview[] | null)?.[0];
    if (!group) throw new Error('Esse convite expirou, foi revogado ou chegou ao limite.');
    setCode(found);
    setPreview(group);
  });

  const join = () => run(async () => {
    if (!code) return;
    const { data, error } = await db.rpc('join_server', { invite_code: code });
    if (error) throw error;
    setPreview(null); setCode(null); setRaw('');
    await open(data as string);
  });

  return (
    <View style={{ flex: 1, backgroundColor: tokens.bg }}>
      <Header title="Comunidades" />
      <Screen>
        {message ? <Notice tone={message.error ? 'error' : 'info'}>{message.text}</Notice> : null}

        <Card title="Montar meu lobby">
          <Body muted small>Crie sua comunidade e chame a galera por convite.</Body>
          <Field label="Nome da sua comunidade" placeholder="Nome da sua comunidade" value={name} onChangeText={setName} maxLength={60} />
          <PrimaryButton label="Criar comunidade" disabled={busy || name.trim().length < 2} onPress={() => void create()} />
        </Card>

        <Card title="Recebeu a convocação?">
          {preview ? (
            <View style={{ gap: space.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                <GroupIcon server={preview} size={56} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: tokens.text, fontSize: 18, fontWeight: '800' }}>{preview.name}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Users size={14} color={tokens.muted} />
                    <Text style={{ color: tokens.muted, fontSize: 13 }}>{`${preview.member_count} membro(s)`}</Text>
                  </View>
                </View>
              </View>
              {preview.description ? <Body muted small>{preview.description}</Body> : null}
              <PrimaryButton label={busy ? 'Preparando sua cadeira…' : 'Aceitar convite e entrar'} disabled={busy} onPress={() => void join()} />
              <Text onPress={() => { setPreview(null); setCode(null); }} style={{ color: tokens.accent, fontWeight: '700', textAlign: 'center', padding: space.sm }}>Escolher outro convite</Text>
            </View>
          ) : (
            <>
              <Body muted small>Cole o link ou o código do convite.</Body>
              <Field label="Link ou código do convite" placeholder="https://… ou código" autoCapitalize="none" autoCorrect={false} value={raw} onChangeText={setRaw} />
              <PrimaryButton label="Ver convite" disabled={busy || !raw.trim()} onPress={() => void look()} />
              
            </>
          )}
        </Card>
      </Screen>
    </View>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  const { tokens } = useTheme();
  return (
    <View style={{ gap: space.md, padding: space.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: tokens.line, backgroundColor: tokens.surface }}>
      <Text style={{ color: tokens.text, fontSize: 17, fontWeight: '800' }}>{title}</Text>
      {children}
    </View>
  );
}
