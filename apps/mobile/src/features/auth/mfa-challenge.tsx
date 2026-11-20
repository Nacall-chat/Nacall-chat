import { useState } from 'react';
import { View } from 'react-native';
import { Body, Eyebrow, Field, LinkButton, Notice, PrimaryButton, Screen, Title } from '@/components/ui';
import { postJson } from '@/lib/api';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { errorText } from '@nacall/core/validation';
import { onlyDigits } from './flow';

/** Segura o app até o código do autenticador (ou um código de recuperação) ser confirmado — como no site. */
export function MfaChallenge() {
  const { signOut } = useSession();
  const [code, setCode] = useState('');
  const [recovery, setRecovery] = useState('');
  const [useRecovery, setUseRecovery] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');

  async function verify() {
    if (!supabase) return;
    setBusy(true);
    setFeedback('');
    try {
      if (useRecovery) {
        const { data } = await supabase.auth.getSession();
        if (!data.session) throw new Error('Sua sessão expirou. Entre de novo.');
        await postJson('/api/auth/mfa', { action: 'use-code', code: recovery }, data.session.access_token);
        const { error } = await supabase.auth.refreshSession();
        if (error) throw error;
        return;
      }
      const { data, error: listError } = await supabase.auth.mfa.listFactors();
      if (listError) throw listError;
      const factor = data.totp[0];
      if (!factor) throw new Error('Nenhum app autenticador encontrado nesta conta.');
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
      if (error) throw new Error('Código incorreto ou expirado. Confira o app e tente de novo.');
    } catch (error) {
      setFeedback(errorText(error));
      setCode('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <View style={{ gap: 8 }}>
        <Eyebrow>VERIFICAÇÃO EM DUAS ETAPAS</Eyebrow>
        <Title>{'Mais um passo.\nSó pra garantir.'}</Title>
        <Body muted>
          {useRecovery
            ? 'Use um dos códigos de recuperação que você guardou. Ele funciona uma vez e desativa o 2FA para você configurar de novo.'
            : 'Abra o app autenticador e digite o código de 6 dígitos do NACALL.'}
        </Body>
      </View>
      {useRecovery ? (
        <Field label="Código de recuperação" autoCapitalize="characters" autoCorrect={false} placeholder="XXXX-XXXX-XXXX" value={recovery} onChangeText={(v) => setRecovery(v.toUpperCase())} maxLength={40} />
      ) : (
        <Field label="Código de 6 dígitos" keyboardType="number-pad" autoComplete="one-time-code" placeholder="000000" value={code} onChangeText={(v) => setCode(onlyDigits(v))} maxLength={6} />
      )}
      {feedback ? <Notice tone="error">{feedback}</Notice> : null}
      <PrimaryButton label={busy ? 'Conferindo…' : 'Confirmar'} disabled={busy || (useRecovery ? recovery.length < 8 : code.length !== 6)} onPress={() => void verify()} />
      <View>
        <LinkButton label={useRecovery ? 'Usar o app autenticador' : 'Perdi o acesso ao app'} onPress={() => { setUseRecovery(!useRecovery); setFeedback(''); }} />
        <LinkButton label="Sair" onPress={() => void signOut()} />
      </View>
    </Screen>
  );
}
