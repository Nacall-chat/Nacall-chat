import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Body, Brand, Eyebrow, Field, LinkButton, Notice, PrimaryButton, Screen, Title } from '@/components/ui';
import { postJson, type ApiError } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { emailSchema, errorText, usernamePattern } from '@nacall/core/validation';
import { copy, mismatchHint, noSpaces, onlyDigits, passwordHint, submitLabel, usernameHint, validated, isNewPasswordMode, type AuthMode } from './flow';

type Credentials = { access_token: string; refresh_token: string };

/** Entrar, criar conta, confirmar email e recuperar senha — as mesmas rotas e regras do site. */
export function AuthFlow() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [identifier, setIdentifier] = useState('');
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false); // dois toques seguidos não repetem o cadastro/login
  const [feedback, setFeedback] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [existing, setExisting] = useState(false);
  const [missing, setMissing] = useState(false);
  const [lookup, setLookup] = useState<{ key: string; username?: boolean; email?: boolean } | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  // Aviso ao vivo no cadastro: usuário e email já em uso (consulta o servidor depois de uma pausa na digitação).
  const checkUser = mode === 'signup' && usernamePattern.test(username) ? username : undefined;
  const checkMail = mode === 'signup' && emailSchema.safeParse(email).success ? email.trim().toLowerCase() : undefined;
  const lookupKey = `${checkUser ?? ''}|${checkMail ?? ''}`;
  // o resultado só vale para os valores que foram consultados (digitou outra coisa: some o aviso antigo)
  const taken: { username?: boolean; email?: boolean } = lookup && lookup.key === lookupKey ? lookup : {};

  useEffect(() => {
    if (!checkUser && !checkMail) return;
    let live = true;
    const timer = setTimeout(() => {
      void postJson<{ usernameTaken?: boolean; emailTaken?: boolean }>('/api/auth', { action: 'check', ...(checkUser ? { username: checkUser } : {}), ...(checkMail ? { email: checkMail } : {}) })
        .then((r) => { if (live) setLookup({ key: lookupKey, username: r.usernameTaken, email: r.emailTaken }); })
        .catch(() => { if (live) setLookup(null); });
    }, 500);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [checkUser, checkMail, lookupKey]);

  const newPassword = isNewPasswordMode(mode);
  const passwordError = passwordHint(mode, password);
  const mismatch = mismatchHint(mode, password, confirm);

  function go(next: AuthMode, message = '') {
    setMode(next);
    setFeedback(message);
    setExisting(false);
    setMissing(false);
    setPassword('');
    setConfirm('');
    setCode('');
  }

  async function enter(session: Credentials) {
    const { error } = (await supabase?.auth.setSession(session)) ?? { error: new Error('O app não está configurado (Supabase).') };
    if (error) throw error;
    // a navegação acontece sozinha: o SessionProvider percebe a sessão e libera o grupo (app)
  }

  async function submit() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setFeedback('');
    setExisting(false);
    setMissing(false);
    try {
      if (mode === 'login') {
        const result = await postJson<{ session: Credentials }>('/api/auth', validated({ action: 'login', identifier, password }));
        await enter(result.session);
        return;
      }
      if (mode === 'signup') {
        await postJson('/api/auth', validated({ action: 'signup', username, displayName: name, email, password, confirmPassword: confirm }));
        go('verify', `Enviamos um código para ${email}. Confira também o spam.`);
        setCooldown(60);
        return;
      }
      if (mode === 'verify') {
        await postJson('/api/auth', validated({ action: 'verify', email, code }));
        go('login', 'Email confirmado! Agora é só entrar.');
        setIdentifier(username || email);
        return;
      }
      if (mode === 'recover') {
        await postJson('/api/auth', validated({ action: 'recover', email }));
        go('recover-confirm', 'Enviamos o código para o seu email. Confira também o spam.');
        return;
      }
      await postJson('/api/auth', validated({ action: 'recover-confirm', email, code, password, confirmPassword: confirm }));
      go('login', 'Senha atualizada. Entre com a nova senha.');
      setIdentifier(email);
    } catch (error) {
      const failure = error as ApiError;
      if (failure.data?.needsVerification) {
        setEmail(String(failure.data.email ?? ''));
        go('verify', failure.message);
      } else {
        setFeedback(errorText(error));
        setExisting(failure.data?.code === 'email_exists');
        setMissing(failure.data?.code === 'email_not_found');
      }
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  }

  async function resend() {
    if (cooldown > 0 || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setFeedback('');
    try {
      await postJson('/api/auth', validated({ action: 'resend', email }));
      setFeedback('Código reenviado. Pode levar um minutinho.');
      setCooldown(60);
    } catch (error) {
      setFeedback(errorText(error));
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  }

  const text = copy[mode];
  const blocked = busy || Boolean(passwordError) || Boolean(mismatch) || (mode === 'signup' && Boolean(taken.username || taken.email));

  return (
    <Screen>
      <Brand />
      <View style={{ gap: 8 }}>
        <Eyebrow>{text.eyebrow}</Eyebrow>
        <Title>{text.title}</Title>
        <Body muted>{mode === 'verify' && email ? `Enviamos 6 dígitos para ${email}. O código vale por poucos minutos e só funciona uma vez.` : text.text}</Body>
      </View>

      <View style={{ gap: 14 }}>
        {mode === 'login' && (
          <Field label="Usuário ou email" autoComplete="username" autoCapitalize="none" autoCorrect={false} placeholder="seu_nick ou voce@exemplo.com" value={identifier} onChangeText={setIdentifier} maxLength={254} />
        )}
        {mode === 'signup' && (
          <>
            <Field label="Usuário" autoComplete="username" autoCapitalize="none" autoCorrect={false} placeholder="seu_nick" value={username} onChangeText={(v) => setUsername(noSpaces(v))} maxLength={24} hint={usernameHint} error={taken.username ? 'Esse usuário já está na party. Escolha outro nome.' : undefined} />
            <Field label="Como a galera te chama?" autoComplete="nickname" placeholder="Nome que aparece na call" value={name} onChangeText={setName} maxLength={60} />
          </>
        )}
        {(mode === 'signup' || mode === 'recover' || mode === 'recover-confirm') && (
          <Field label="Email" keyboardType="email-address" autoComplete="email" autoCapitalize="none" autoCorrect={false} placeholder="voce@exemplo.com" value={email} onChangeText={setEmail} maxLength={254} error={mode === 'signup' && taken.email ? 'Esse email já tem uma conta. Entre ou recupere a senha.' : undefined} />
        )}
        {(mode === 'verify' || mode === 'recover-confirm') && (
          <Field label="Código de 6 dígitos" keyboardType="number-pad" autoComplete="one-time-code" placeholder="000000" value={code} onChangeText={(v) => setCode(onlyDigits(v))} maxLength={6} />
        )}
        {mode !== 'recover' && mode !== 'verify' && (
          <Field label={mode === 'recover-confirm' ? 'Nova senha' : 'Senha'} secure autoComplete={newPassword ? 'new-password' : 'current-password'} autoCapitalize="none" placeholder={newPassword ? 'Pelo menos 12 caracteres' : 'Sua senha'} value={password} onChangeText={setPassword} maxLength={128} error={passwordError} />
        )}
        {newPassword && <Field label="Confirmar senha" secure autoComplete="new-password" autoCapitalize="none" placeholder="Repita a senha" value={confirm} onChangeText={setConfirm} maxLength={128} error={mismatch} />}
      </View>

      {feedback ? <Notice>{feedback}</Notice> : null}
      <PrimaryButton label={submitLabel(mode, busy)} onPress={() => void submit()} disabled={blocked} />

      <View style={{ gap: 2 }}>
        {mode === 'verify' ? (
          <>
            <LinkButton label={cooldown > 0 ? `Reenviar código em ${cooldown}s` : 'Reenviar código'} disabled={cooldown > 0 || busy} onPress={() => void resend()} />
            <LinkButton label="Corrigir meus dados" onPress={() => go('signup')} />
          </>
        ) : (
          <>
            <LinkButton label={mode === 'signup' ? 'Já sou da casa. Entrar' : 'Primeira call? Crie sua conta'} onPress={() => go(mode === 'signup' ? 'login' : 'signup')} />
            <LinkButton label={mode === 'recover' || mode === 'recover-confirm' ? 'Voltar ao login' : 'Esqueci a senha'} onPress={() => go(mode === 'recover' || mode === 'recover-confirm' ? 'login' : 'recover')} />
          </>
        )}
        {missing && mode === 'recover' ? <LinkButton label="Criar uma conta com esse email" onPress={() => go('signup')} /> : null}
        {existing && mode === 'signup' ? (
          <>
            <LinkButton label="Entrar com esse email" onPress={() => { setIdentifier(email); go('login'); }} />
            <LinkButton label="Esqueci a senha" onPress={() => go('recover')} />
          </>
        ) : null}
      </View>
    </Screen>
  );
}
