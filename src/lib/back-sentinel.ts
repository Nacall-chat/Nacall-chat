/**
 * Botão Voltar do celular dentro do NACALL (gaveta, conversa e call são só estado do app, sem rota).
 * Enquanto alguma dessas telas está aberta, o app mantém UMA entrada extra no histórico do navegador (a "sentinela"):
 * - Voltar (botão do Android, gesto do iPhone) gasta a sentinela e o app fecha a tela de cima, em vez de sair do site;
 * - se ainda sobra outra tela aberta, a sentinela é recolocada;
 * - se a tela fecha por um toque no app, a sentinela é devolvida com `history.back()` (o popstate disso é ignorado).
 */
export type HistoryLike = { pushState: (state: unknown, title: string) => void; back: () => void };

export function createBackSentinel(history: HistoryLike, schedule: (fn: () => void, ms: number) => unknown = setTimeout) {
  let pushed = false;
  let ignore = 0;
  return {
    /** Chame depois de cada renderização com "há alguma tela de cima aberta?". */
    sync(active: boolean) {
      if (active && !pushed) {
        history.pushState({ nacallBack: true }, '');
        pushed = true;
      } else if (!active && pushed) {
        pushed = false;
        ignore += 1;
        history.back();
        // se o navegador não avisar a volta, o contador não pode "comer" um Voltar de verdade mais tarde
        schedule(() => { ignore = Math.max(0, ignore - 1); }, 600);
      }
    },
    /** Chame no popstate. `true` = foi o Voltar da pessoa: feche a tela de cima. */
    popped(): boolean {
      if (ignore > 0) { ignore -= 1; return false; }
      if (!pushed) return false;
      pushed = false;
      return true;
    },
  };
}
