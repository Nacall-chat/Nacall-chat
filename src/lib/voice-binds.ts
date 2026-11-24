import { pttKeyLabel, pttShouldOpen, validatePttKey, type KeyInput, type PttKey, type PttKeyCheck } from './ptt-key';

/** Atalhos de teclado da call. O apertar para falar já existia; ligar/desligar o microfone e o fone são opcionais (sem tecla = sem atalho). */
export type BindName = 'pushToTalkKey' | 'muteKey' | 'deafenKey';
export const BIND_LABEL: Record<BindName, string> = {
  pushToTalkKey: 'apertar para falar',
  muteKey: 'ligar/desligar o microfone',
  deafenKey: 'ligar/desligar o fone',
};
export type Binds = Partial<Record<BindName, PttKey | null>>;

/** Lê um atalho opcional salvo no navegador. Qualquer coisa inválida vira "sem atalho" (nunca um atalho que a pessoa não escolheu). */
export function parseOptionalKey(raw: unknown): PttKey | null {
  if (!raw || typeof raw !== 'object') return null;
  const { code, label } = raw as { code?: unknown; label?: unknown };
  if (typeof code !== 'string' || !validatePttKey({ code }).ok) return null;
  const text = typeof label === 'string' ? label.trim().slice(0, 16) : '';
  return { code, label: text || pttKeyLabel(code) };
}

/** Confere a tecla escolhida para um atalho: as mesmas regras do apertar para falar e nunca a mesma tecla de outro atalho. */
export function checkBind(input: KeyInput, name: BindName, binds: Binds): PttKeyCheck {
  const result = validatePttKey(input);
  if (!result.ok) return result;
  for (const other of Object.keys(BIND_LABEL) as BindName[]) {
    if (other !== name && binds[other]?.code === result.key.code) return { ok: false, reason: `A tecla ${result.key.label} já é usada para ${BIND_LABEL[other]}. Escolha outra.` };
  }
  return result;
}

/** A tecla apertada é este atalho? Mesmas regras do apertar para falar: sem repetição, sem Ctrl/Alt/Windows, fora de campos de texto. */
export const shortcutPressed = (e: Parameters<typeof pttShouldOpen>[0], key: PttKey | null | undefined) => Boolean(key) && pttShouldOpen(e, key!);

/** Estado da voz na call. `micBeforeDeaf` lembra se o microfone estava aberto quando a pessoa desligou o fone. */
export type VoiceState = { deaf: boolean; mic: boolean; micBeforeDeaf: boolean };

/** Fone, como no Discord: desligar o fone também fecha o microfone (não dá para falar sem ouvir quem responde);
 * religar o fone devolve o microfone como estava antes. No apertar para falar o microfone volta fechado (abre pela tecla). */
export function toggleDeafen(s: VoiceState, opts: { pushToTalk: boolean }): VoiceState {
  if (!s.deaf) return { deaf: true, mic: false, micBeforeDeaf: s.mic };
  return { deaf: false, mic: opts.pushToTalk ? false : s.micBeforeDeaf, micBeforeDeaf: false };
}

/** Microfone: abrir o microfone com o fone desligado religa o fone (quem fala precisa ouvir a resposta). */
export function toggleMicrophone(s: VoiceState): VoiceState {
  if (s.mic) return { ...s, mic: false };
  return { deaf: false, mic: true, micBeforeDeaf: false };
}
