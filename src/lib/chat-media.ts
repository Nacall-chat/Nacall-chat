import type {SupabaseClient} from '@supabase/supabase-js';
import type {Sticker} from './types';

/** Limites do áudio e das figurinhas. Os mesmos valores valem no banco (constraint, trigger e buckets). */
export const AUDIO_MAX_MS = 5 * 60 * 1000;
export const AUDIO_MIN_MS = 700;
export const AUDIO_MAX_BYTES = 5 * 1024 * 1024;
export const AUDIO_BITRATE = 48_000;
export const STICKER_MAX_BYTES = 1024 * 1024;
export const STICKER_MAX_SIDE = 1024;
export const STICKER_LIMIT = 200;
export const STICKER_SOURCE_MAX_BYTES = 12 * 1024 * 1024;

export type AudioExt = 'webm' | 'ogg' | 'm4a';
export type ImageExt = Sticker['ext'];
export type ImageKind = { mime: 'image/webp' | 'image/png' | 'image/jpeg' | 'image/gif'; ext: ImageExt };

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) => signature.every((value, index) => bytes[offset + index] === value);
const ascii = (bytes: Uint8Array, text: string, offset: number) => [...text].every((char, index) => bytes[offset + index] === char.charCodeAt(0));

/** Descobre o formato de imagem pelos primeiros bytes, sem confiar no nome nem no tipo informado pelo navegador. */
export function sniffImage(bytes: Uint8Array): ImageKind | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { mime: 'image/png', ext: 'png' };
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return { mime: 'image/jpeg', ext: 'jpg' };
  if (ascii(bytes, 'GIF87a', 0) || ascii(bytes, 'GIF89a', 0)) return { mime: 'image/gif', ext: 'gif' };
  if (ascii(bytes, 'RIFF', 0) && ascii(bytes, 'WEBP', 8)) return { mime: 'image/webp', ext: 'webp' };
  return null;
}

/** Descobre o contêiner de áudio gravado pelo navegador (WebM/Matroska, Ogg ou MP4/M4A). */
export function sniffAudio(bytes: Uint8Array): { mime: 'audio/webm' | 'audio/ogg' | 'audio/mp4'; ext: AudioExt } | null {
  if (startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3])) return { mime: 'audio/webm', ext: 'webm' };
  if (ascii(bytes, 'OggS', 0)) return { mime: 'audio/ogg', ext: 'ogg' };
  if (ascii(bytes, 'ftyp', 4)) return { mime: 'audio/mp4', ext: 'm4a' };
  return null;
}

/** Formatos que o MediaRecorder costuma aceitar, do preferido ao menos preferido. A lista vazia vira o padrão do navegador. */
export const audioMimeCandidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4;codecs=mp4a.40.2', 'audio/mp4'];
export function pickAudioMime(isSupported: (type: string) => boolean): string {
  return audioMimeCandidates.find(type => { try { return isSupported(type); } catch { return false; } }) ?? '';
}
export const baseMime = (mime: string) => mime.split(';')[0].trim().toLowerCase();

/** Mm:ss para o cronômetro e o player. */
export function formatClock(ms: number) {
  const total = Math.max(0, Math.floor((Number.isFinite(ms) ? ms : 0) / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** Insere texto no cursor (ou no lugar da seleção) respeitando o limite de caracteres. */
export function insertAtCursor(value: string, start: number | null, end: number | null, text: string, max = 4000) {
  const from = Math.min(Math.max(start ?? value.length, 0), value.length);
  const to = Math.min(Math.max(end ?? from, from), value.length);
  if (value.length - (to - from) + text.length > max) return { value, cursor: from, inserted: false };
  return { value: value.slice(0, from) + text + value.slice(to), cursor: from + text.length, inserted: true };
}

/** Mensagem só de emojis (até 8) aparece grande, como nos apps de conversa. */
export function isEmojiOnly(body: string) {
  const text = body.trim();
  if (!text || text.length > 64) return false;
  if (!/^[\p{Extended_Pictographic}\p{Emoji_Modifier}\p{Regional_Indicator}‍️⃣\s]+$/u.test(text)) return false;
  const segments = typeof Intl.Segmenter === 'function' ? [...new Intl.Segmenter('pt', { granularity: 'grapheme' }).segment(text.replace(/\s+/g, ''))].length : [...text.replace(/\s+/g, '')].length;
  return segments > 0 && segments <= 8;
}

const randomPart = () => crypto.randomUUID();
export const audioStoragePath = (userId: string, containerId: string, ext: AudioExt) => `${userId}/${containerId}/${randomPart()}.${ext}`;

export type PreparedAudio = { blob: Blob; mime: string; ext: AudioExt };
/** Confere tamanho e formato do áudio pelo conteúdo real antes de enviar. */
export async function prepareAudio(blob: Blob): Promise<PreparedAudio> {
  if (!blob.size) throw new Error('A gravação ficou vazia. Tente gravar de novo.');
  if (blob.size > AUDIO_MAX_BYTES) throw new Error('O áudio passou de 5 MB. Grave um trecho mais curto.');
  const kind = sniffAudio(new Uint8Array(await blob.slice(0, 16).arrayBuffer()));
  if (!kind) throw new Error('Este navegador gravou o áudio em um formato que o NACALL não aceita.');
  return { blob: new Blob([blob], { type: kind.mime }), mime: kind.mime, ext: kind.ext };
}

/** Sobe o áudio para o bucket privado `chat-audio` (<seu id>/<conversa>/<uuid>.<ext>). Devolve o caminho salvo. */
export async function uploadAudio(db: SupabaseClient, userId: string, containerId: string, prepared: PreparedAudio) {
  const path = audioStoragePath(userId, containerId, prepared.ext);
  const { error } = await db.storage.from('chat-audio').upload(path, prepared.blob, { contentType: prepared.mime, cacheControl: '3600', upsert: false });
  if (error) throw new Error(`Não foi possível enviar o áudio: ${error.message}`);
  return path;
}

export type PreparedSticker = { blob: Blob; kind: ImageKind };
/** Valida uma imagem pronta para virar figurinha: formato pelos bytes, até 1 MB e até 1024×1024. */
export async function prepareSticker(blob: Blob): Promise<PreparedSticker> {
  if (blob.size > STICKER_MAX_BYTES) throw new Error('A figurinha passou de 1 MB. Use “Criar figurinha” para reduzir.');
  const kind = sniffImage(new Uint8Array(await blob.slice(0, 16).arrayBuffer()));
  if (!kind) throw new Error('Use uma figurinha WEBP, PNG, JPEG ou GIF.');
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(blob); } catch { throw new Error('Não consegui abrir essa imagem. O arquivo pode estar corrompido.'); }
  const { width, height } = bitmap; bitmap.close();
  if (width > STICKER_MAX_SIDE || height > STICKER_MAX_SIDE) throw new Error('A imagem é maior que 1024×1024. Use “Criar figurinha” para ajustar o tamanho.');
  return { blob: new Blob([blob], { type: kind.mime }), kind };
}

/** Cria a linha da figurinha (o banco gera o nome do arquivo) e envia o arquivo; desfaz tudo se o upload falhar. */
export async function addSticker(db: SupabaseClient, prepared: PreparedSticker): Promise<Sticker> {
  const created = await db.from('stickers').insert({ ext: prepared.kind.ext }).select('*').single();
  if (created.error) throw new Error(created.error.message);
  const sticker = created.data as Sticker;
  const uploaded = await db.storage.from('stickers').upload(sticker.path, prepared.blob, { contentType: prepared.kind.mime, cacheControl: '31536000', upsert: false });
  if (uploaded.error) {
    await db.from('stickers').delete().eq('id', sticker.id);
    throw new Error(`Não foi possível salvar a figurinha: ${uploaded.error.message}`);
  }
  return sticker;
}
