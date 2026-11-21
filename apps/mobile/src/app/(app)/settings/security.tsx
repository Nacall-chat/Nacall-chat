import * as Clipboard from 'expo-clipboard';
import { Copy, KeyRound, ShieldCheck } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { Header } from '@/components/header';
import { Body, Field, Notice, PrimaryButton, Screen } from '@/components/ui';
import { passwordFormHints, qrMatrix, recoveryText } from '@/features/account/logic';
import { useSocial } from '@/features/social/social';
import { postJson } from '@/lib/api';
import { confirmAction } from '@/lib/confirm';
import { friendlyError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/theme/theme';
import { radius, space } from '@/theme/tokens';
import { brandTotpUri, TOTP_ISSUER } from '@nacall/core/totp';
import { errorText } from '@nacall/core/validation';
import { onlyDigits } from '@/features/auth/flow';

type Enrollment = { id: string; uri: string; secret: string };

async function accessToken(): Promise<string> {
  const { data } = (await supabase?.auth.getSession()) ?? { data: { session: null } };
  if (!data.session) throw new Error('Sua sessão expirou. Entre de novo.');
  return data.session.access_token;
}

/** Segurança: trocar senha, ativar/desativar o 2FA (QR, códigos de recuperação) e encerrar sessões — como no site. */
export default function Security() {
  const { tokens } = useTheme();
  const { me, profiles } = useSocial();
  const account = profiles[me]?.username;
  const db = supabase;

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const lock = useRef(false);

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const hints = passwordFormHints({ current, next, confirm });

  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [codesLeft, setCodesLeft] = useState(0);
  const [enrolling, setEnrolling] = useState<Enrollment | null>(null);
  const [code, setCode] = useState('');
  const [codes, setCodes] = useState<string[] | null>(null);
  const [disabling, setDisabling] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');

  const refresh = useCallback(async () => {
    try {
      const status = await postJson<{ enabled: boolean; codesLeft: number }>('/api/auth/mfa', { action: 'status' }, await accessToken());
      setEnabled(status.enabled);
      setCodesLeft(status.codesLeft);
    } catch {
      setEnabled(null);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- o setState acontece depois da resposta do servidor
  useEffect(() => { void refresh(); }, [refresh]);

  async function run(task: () => Promise<string | void>) {
    if (lock.current || !db) return;
    lock.current = true;
    setBusy(true);
    setMessage(null);
    try {
      const text = await task();
      if (text) setMessage({ text, error: false });
    } catch (e) {
      setMessage({ text: friendlyError(errorText(e)), error: true });
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }

  const changePassword = () => run(async () => {
    await postJson('/api/auth/password', { current, password: next, confirmPassword: confirm }, await accessToken());
    setCurrent(''); setNext(''); setConfirm('');
    await db!.auth.signOut({ scope: 'others' });
    return 'Senha atualizada. Os outros dispositivos foram desconectados.';
  });

  const startEnroll = () => run(async () => {
    const { data: list } = await db!.auth.mfa.listFactors();
    for (const factor of list?.all ?? []) if (factor.status === 'unverified') await db!.auth.mfa.unenroll({ factorId: factor.id });
    const { data, error } = await db!.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'NACALL', issuer: TOTP_ISSUER });
    if (error) throw error;
    setEnrolling({ id: data.id, uri: brandTotpUri(data.totp.uri, account || 'conta'), secret: data.totp.secret });
    setCode('');
  });

  const confirmEnroll = () => run(async () => {
    if (!enrolling) return;
    const { error } = await db!.auth.mfa.challengeAndVerify({ factorId: enrolling.id, code });
    if (error) throw new Error('Código incorreto. Confira o app e tente de novo.'); // o 2FA só vale depois desta confirmação
    const generated = await postJson<{ codes: string[] }>('/api/auth/mfa', { action: 'generate-codes' }, await accessToken());
    setEnrolling(null); setCode(''); setCodes(generated.codes); setEnabled(true); setCodesLeft(generated.codes.length);
    return '2FA ativado. Guarde os códigos de recuperação.';
  });

  const regenerate = () => run(async () => {
    const generated = await postJson<{ codes: string[] }>('/api/auth/mfa', { action: 'generate-codes' }, await accessToken());
    setCodes(generated.codes); setCodesLeft(generated.codes.length);
    return 'Novos códigos gerados. Os anteriores deixaram de valer.';
  });

  const disable = () => run(async () => {
    await postJson('/api/auth/mfa', { action: 'disable', password: disablePassword }, await accessToken());
    await db!.auth.refreshSession();
    setDisablePassword(''); setDisabling(false); setCodes(null); setEnabled(false); setCodesLeft(0);
    return '2FA desativado.';
  });

  async function copyCodes() {
    if (!codes) return;
    try {
      await Clipboard.setStringAsync(recoveryText(codes), { android: { isSensitive: true } });
      setMessage({ text: 'Códigos copiados. Guarde fora do celular também.', error: false });
    } catch {
      setMessage({ text: 'Não foi possível copiar. Anote os códigos manualmente.', error: true });
    }
  }

  async function endSessions(scope: 'others' | 'global') {
    const ok = await confirmAction(scope === 'global' ? 'Sair em todos os aparelhos?' : 'Sair dos outros aparelhos?', scope === 'global' ? 'Você também será desconectado daqui.' : 'Você continua conectado neste aparelho.', 'Sair');
    if (!ok) return;
    void run(async () => {
      const { error } = await db!.auth.signOut({ scope });
      if (error) throw error;
      return scope === 'global' ? undefined : 'Os outros aparelhos foram desconectados.';
    });
  }

  return (
    <View style={{ flex: 1, backgroundColor: tokens.bg }}>
      <Header title="Segurança" />
      <Screen>
        {message ? <Notice tone={message.error ? 'error' : 'info'}>{message.text}</Notice> : null}

        <Section title="Senha forte. Memória nem tanto.">
          <Field label="Senha atual" secure autoComplete="current-password" autoCapitalize="none" value={current} onChangeText={setCurrent} maxLength={128} />
          <Field label="Nova senha" secure autoComplete="new-password" autoCapitalize="none" placeholder="Pelo menos 12 caracteres" value={next} onChangeText={setNext} maxLength={128} error={hints.next} />
          <Field label="Confirmar nova senha" secure autoComplete="new-password" autoCapitalize="none" value={confirm} onChangeText={setConfirm} maxLength={128} error={hints.confirm} />
          <PrimaryButton label="Alterar senha" disabled={busy || !hints.ready} onPress={() => void changePassword()} />
        </Section>

        <Section title="Verificação em duas etapas (2FA)">
          {enabled === null ? <Body muted small>Conferindo o estado do 2FA…</Body> : null}

          {enabled === false && !enrolling ? (
            <>
              <Body muted small>Além da senha, o login pede um código do app autenticador (Google Authenticator, Authy, 1Password…). Mesmo que descubram sua senha, não entram.</Body>
              <PrimaryButton label="Ativar 2FA" disabled={busy} onPress={() => void startEnroll()} />
            </>
          ) : null}

          {enrolling ? (
            <View style={{ gap: space.md }}>
              <Body muted small>{`1. No app autenticador, escaneie o QR Code (se estiver neste celular, copie a chave abaixo e cole no app). 2. Digite o código de 6 dígitos que ele mostrar. A conta aparece como NACALL (${account || 'seu nick'}). O 2FA só é ativado depois dessa confirmação.`}</Body>
              <Qr text={enrolling.uri} />
              <Body muted small>Digite esta chave no app autenticador:</Body>
              <Text selectable style={{ color: tokens.text, fontFamily: 'monospace', fontSize: 15, letterSpacing: 1 }}>{enrolling.secret}</Text>
              <Field label="Código de 6 dígitos" keyboardType="number-pad" autoComplete="one-time-code" placeholder="000000" value={code} onChangeText={(v) => setCode(onlyDigits(v))} maxLength={6} />
              <PrimaryButton label="Confirmar e ativar" disabled={busy || code.length !== 6} onPress={() => void confirmEnroll()} />
              <Pressable accessibilityRole="button" disabled={busy} onPress={() => { setEnrolling(null); setCode(''); }} style={{ alignItems: 'center', padding: space.sm }}>
                <Text style={{ color: tokens.accent, fontWeight: '700' }}>Cancelar</Text>
              </Pressable>
            </View>
          ) : null}

          {enabled ? (
            <View style={{ gap: space.md }}>
              {codes ? (
                <View style={{ gap: space.md }}>
                  <Body muted small>Guarde estes códigos agora. Eles só aparecem esta vez. Cada um funciona uma vez, se você perder o app.</Body>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                    {codes.map((c) => (
                      <View key={c} style={{ paddingVertical: 8, paddingHorizontal: 10, borderRadius: radius.sm, borderWidth: 1, borderColor: tokens.line, backgroundColor: tokens.surface }}>
                        <Text selectable style={{ color: tokens.text, fontFamily: 'monospace', fontSize: 13 }}>{c}</Text>
                      </View>
                    ))}
                  </View>
                  <Pressable accessibilityRole="button" onPress={() => void copyCodes()} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 44, borderRadius: radius.md, borderWidth: 1, borderColor: tokens.line, backgroundColor: tokens.panel }}>
                    <Copy size={16} color={tokens.text} />
                    <Text style={{ color: tokens.text, fontWeight: '700' }}>Copiar códigos</Text>
                  </Pressable>
                  <PrimaryButton label="Guardei os códigos" onPress={() => setCodes(null)} />
                </View>
              ) : (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <ShieldCheck size={16} color={tokens.success} />
                    <Body small>{`2FA ativo. Códigos de recuperação restantes: ${codesLeft}.`}</Body>
                  </View>
                  <Pressable accessibilityRole="button" disabled={busy} onPress={() => void regenerate()} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 44, borderRadius: radius.md, borderWidth: 1, borderColor: tokens.line, backgroundColor: tokens.panel }}>
                    <KeyRound size={16} color={tokens.text} />
                    <Text style={{ color: tokens.text, fontWeight: '700' }}>Gerar novos códigos</Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" disabled={busy} onPress={() => setDisabling((v) => !v)} style={{ alignItems: 'center', padding: space.sm }}>
                    <Text style={{ color: tokens.error, fontWeight: '700' }}>Desativar 2FA</Text>
                  </Pressable>
                  {disabling ? (
                    <View style={{ gap: space.md }}>
                      <Field label="Confirme sua senha para desativar" secure autoComplete="current-password" autoCapitalize="none" value={disablePassword} onChangeText={setDisablePassword} maxLength={128} />
                      <PrimaryButton label="Desativar 2FA" disabled={busy || !disablePassword} onPress={() => void disable()} />
                    </View>
                  ) : null}
                </>
              )}
            </View>
          ) : null}
        </Section>

        <Section title="Sessões">
          <Body muted small>Se perdeu um aparelho ou suspeita de acesso, encerre as sessões.</Body>
          <Pressable accessibilityRole="button" disabled={busy} onPress={() => void endSessions('others')} style={{ minHeight: 44, borderRadius: radius.md, borderWidth: 1, borderColor: tokens.line, backgroundColor: tokens.panel, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: tokens.text, fontWeight: '700' }}>Sair dos outros aparelhos</Text>
          </Pressable>
          <Pressable accessibilityRole="button" disabled={busy} onPress={() => void endSessions('global')} style={{ alignItems: 'center', padding: space.sm }}>
            <Text style={{ color: tokens.error, fontWeight: '700' }}>Sair em todos os aparelhos</Text>
          </Pressable>
        </Section>
      </Screen>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { tokens } = useTheme();
  return (
    <View style={{ gap: space.md, padding: space.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: tokens.line, backgroundColor: tokens.bg }}>
      <Text style={{ color: tokens.text, fontSize: 17, fontWeight: '800' }}>{title}</Text>
      {children}
    </View>
  );
}

/** QR do autenticador desenhado com react-native-svg (fundo branco e margem, para qualquer leitor). */
function Qr({ text }: { text: string }) {
  const matrix = useMemo(() => qrMatrix(text), [text]);
  const size = matrix.length;
  const margin = 2;
  const total = size + margin * 2;
  return (
    <View accessible accessibilityLabel="QR Code para configurar o app autenticador" style={{ alignSelf: 'center', width: 220, height: 220, backgroundColor: '#fff', borderRadius: 12, padding: 6 }}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${total} ${total}`}>
        {matrix.flatMap((row, y) => row.map((dark, x) => (dark ? <Rect key={`${x}-${y}`} x={x + margin} y={y + margin} width={1.02} height={1.02} fill="#000" /> : null)))}
      </Svg>
    </View>
  );
}
