/**
 * Regras do fluxo de entrada (login, cadastro, código, recuperação), sem tela.
 * Os textos e as validações são os do site (components/auth.tsx), que usa as mesmas regras do servidor.
 */
import { authSchema, passwordIssue } from '@nacall/core/auth-schema';
import { usernameHint } from '@nacall/core/validation';

export type AuthMode = 'login' | 'signup' | 'verify' | 'recover' | 'recover-confirm';

export const copy: Record<AuthMode, { eyebrow: string; title: string; text: string }> = {
  login: { eyebrow: 'O LOBBY ESTÁ ABERTO', title: 'Sumiu, né?\nChega NACALL.', text: 'Entra com seu usuário ou email. A senha a gente não adivinha.' },
  signup: { eyebrow: 'SEU PRÓXIMO PONTO DE ENCONTRO', title: 'Seu nick.\nSua galera.', text: 'Escolha seu usuário, seu email e uma senha forte. Vamos confirmar o email com um código.' },
  verify: { eyebrow: 'CONFIRME SEU EMAIL', title: 'Olha o email.\nTem código lá.', text: 'Digite os 6 dígitos que enviamos. O código vale por poucos minutos e só funciona uma vez.' },
  recover: { eyebrow: 'ESQUECEU A SENHA?', title: 'Acontece até\ncom pro.', text: 'Informe o email da conta. Se ela existir, enviamos um código de 6 dígitos; se não, avisamos aqui.' },
  'recover-confirm': { eyebrow: 'QUASE LÁ', title: 'Código e\nsenha nova.', text: 'Digite o código do email e escolha a nova senha. Ela precisa ter pelo menos 12 caracteres.' },
};

export const submitLabel = (mode: AuthMode, busy: boolean) =>
  busy
    ? 'Conectando o lobby…'
    : { login: 'Bora NACALL', signup: 'Criar minha conta', verify: 'Confirmar email', recover: 'Enviar código', 'recover-confirm': 'Trocar senha' }[mode];

export const isNewPasswordMode = (mode: AuthMode) => mode === 'signup' || mode === 'recover-confirm';

/** Dica ao vivo da regra de senha (só nos modos em que a pessoa cria uma senha). */
export function passwordHint(mode: AuthMode, password: string): string | undefined {
  return isNewPasswordMode(mode) && password ? passwordIssue(password) ?? undefined : undefined;
}

export function mismatchHint(mode: AuthMode, password: string, confirm: string): string | undefined {
  return isNewPasswordMode(mode) && confirm && confirm !== password ? 'As senhas não conferem.' : undefined;
}

/** A mesma validação do servidor roda antes de enviar, para o erro aparecer sem esperar a rede. */
export function validated<T extends { action: string }>(body: T): T {
  const result = authSchema.safeParse(body);
  if (!result.success) throw new Error(result.error.issues[0]?.message ?? 'Confira os campos.');
  return body;
}

export const onlyDigits = (value: string) => value.replace(/\D/g, '').slice(0, 6);
export const noSpaces = (value: string) => value.replace(/\s/g, '');
export { usernameHint };
