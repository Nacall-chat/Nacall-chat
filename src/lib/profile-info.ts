/** Dados que o cartão de perfil mostra além do básico. */

/** "25 de out. de 2019" — data de criação da conta, no fuso informado (padrão: o do aparelho). Vazio se a data faltar ou for inválida. */
export function memberSinceLabel(iso?: string | null, timeZone?: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric', ...(timeZone ? { timeZone } : {}) });
}

/** A chamada em que a pessoa está agora (só vale para salas de servidores que você também participa). */
export type ProfileCall = {
  channelName: string;
  serverName: string;
  people: { id: string; name: string; avatar: string }[];
  /** Entrar na mesma sala; ausente quando você já está nela. */
  join?: () => void;
};
