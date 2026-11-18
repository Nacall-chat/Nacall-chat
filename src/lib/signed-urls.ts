import type {SupabaseClient} from '@supabase/supabase-js';

/**
 * Links assinados dos buckets privados (`chat-audio` e `stickers`). O arquivo só é entregue a quem a RLS do Storage
 * deixa ler (membros do canal/DM da mensagem), e o link vale 1 hora. Pedidos próximos viram uma única chamada ao Storage
 * e o resultado fica em memória, então recarregar a conversa só pede de novo o que expirou.
 */
const TTL_SECONDS = 3600;
const REUSE_MS = 50 * 60 * 1000;
const cache = new Map<string, { url: string; until: number }>();
type Waiter = { resolve: (url: string) => void; reject: (error: Error) => void };
const queue = new Map<string, Map<string, Waiter[]>>();
let timer: ReturnType<typeof setTimeout> | null = null;

async function flush(db: SupabaseClient) {
  timer = null;
  const batches = [...queue.entries()];
  queue.clear();
  await Promise.all(batches.map(async ([bucket, paths]) => {
    const list = [...paths.keys()];
    const fail = (message: string) => paths.forEach(waiters => waiters.forEach(w => w.reject(new Error(message))));
    try {
      const { data, error } = await db.storage.from(bucket).createSignedUrls(list, TTL_SECONDS);
      if (error || !data) return fail(error?.message ?? 'Não foi possível carregar a mídia.');
      for (const item of data) {
        const waiters = (item.path ? paths.get(item.path) : undefined) ?? [];
        const url = item.signedUrl;
        if (url && !item.error) { cache.set(`${bucket}/${item.path}`, { url, until: Date.now() + REUSE_MS }); waiters.forEach(w => w.resolve(url)); }
        else waiters.forEach(w => w.reject(new Error('Esta mídia não está mais disponível.')));
      }
    } catch (e) { fail(e instanceof Error ? e.message : 'Não foi possível carregar a mídia.'); }
  }));
}

export function signedUrl(db: SupabaseClient, bucket: 'chat-audio' | 'stickers', path: string): Promise<string> {
  const hit = cache.get(`${bucket}/${path}`);
  if (hit && hit.until > Date.now()) return Promise.resolve(hit.url);
  return new Promise((resolve, reject) => {
    const paths = queue.get(bucket) ?? new Map<string, Waiter[]>();
    paths.set(path, [...(paths.get(path) ?? []), { resolve, reject }]);
    queue.set(bucket, paths);
    timer ??= setTimeout(() => void flush(db), 20);
  });
}

/** Esquece o link (por exemplo, depois de um erro de carregamento) para que o próximo pedido gere um novo. */
export function forgetSignedUrl(bucket: 'chat-audio' | 'stickers', path: string) { cache.delete(`${bucket}/${path}`); }
export function clearSignedUrls() { cache.clear(); }
