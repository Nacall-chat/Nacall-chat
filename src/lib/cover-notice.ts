import type {ImageExt} from './chat-media';

const saved = 'Capa atualizada. Seu perfil entrou no clima.';
const label: Record<string, string> = { jpg: 'JPEG', png: 'PNG', webp: 'WebP' };

/** Mensagem depois de salvar a capa. Pinterest, Google Imagens e afins entregam prévias paradas (JPEG/PNG) com nome
 * .gif; sem aviso, a capa parada parecia bug do NACALL. `ext` é o formato real, lido dos bytes (sniffImage). */
export function coverNotice(fileName: string, mimeType: string, ext: ImageExt, animated: boolean): string {
  const namedGif = /\.gif$/i.test(fileName) || mimeType === 'image/gif';
  if (!namedGif || ext === 'gif' || animated) return saved;
  return `Capa salva parada: esse arquivo tem nome .gif, mas não é animado (é uma imagem ${label[ext] ?? ext.toUpperCase()}). Para ter animação, baixe o GIF original.`;
}
