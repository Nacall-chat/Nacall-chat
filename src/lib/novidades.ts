/** Conteúdo da janela "Novidades" mostrada uma vez por conta depois desta atualização. */
export const UPDATE_ID = '2026-11-19-chat-midia';
export const whatsNewKey = (userId: string) => `nacall:novidades:${UPDATE_ID}:${userId}`;

export type WhatsNewSlide = { id: 'barra' | 'audio' | 'emojis' | 'figurinhas' | 'criar'; title: string; text: string; points: string[] };
export const whatsNewSlides: WhatsNewSlide[] = [
  { id: 'barra', title: 'Barra de mensagem renovada', text: 'O campo de texto ganhou o centro da barra e o botão de enviar ficou compacto, com a mesma seta e as mesmas cores.',
    points: ['Emojis e figurinhas à esquerda', 'Campo de texto no meio', 'Microfone e enviar à direita'] },
  { id: 'audio', title: 'Mensagens de áudio', text: 'Toque no microfone, fale e envie. Quem recebe ouve direto no chat, mesmo depois de atualizar a página.',
    points: ['Cronômetro ao vivo e lixeira para cancelar', 'Só envia quando você toca na seta', 'Player com play, pausa, barra para pular trechos e duração'] },
  { id: 'emojis', title: 'Emojis do seu jeito', text: 'Um painel com mais de 1.800 emojis, em categorias, com busca em português e os mais usados no topo.',
    points: ['Entram onde o cursor está, quantos quiser', 'O painel continua aberto enquanto você escolhe', 'Mensagem só de emojis aparece grande'] },
  { id: 'figurinhas', title: 'Figurinhas', text: 'Monte a sua coleção pessoal e mande figurinhas com um toque, nas conversas e nos canais.',
    points: ['Importe do aparelho (WEBP, PNG, JPEG e GIF animado), inclusive as do WhatsApp', 'Favorite e mude a ordem em “Organizar”', 'Até 200 figurinhas, só suas'] },
  { id: 'criar', title: 'Criar figurinha', text: 'Transforme qualquer foto em figurinha sem sair do chat e veja o resultado antes de salvar.',
    points: ['Arraste e use o zoom para enquadrar', 'Quadrado, arredondado ou círculo', 'Remoção de fundo liso e pré-visualização'] },
];

export const nextLabel = (index: number, total: number) => (index >= total - 1 ? 'Fechar' : 'Próximo');
export const clampSlide = (index: number, total: number) => Math.min(Math.max(index, 0), total - 1);
