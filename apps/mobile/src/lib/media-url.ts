/** Endereços públicos das imagens (buckets públicos do Supabase). Mesmos padrões de caminho validados pelo site. */
const base = () => (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');
const pub = (bucket: string, path: string) => `${base()}/storage/v1/object/public/${bucket}/${path}`;

export const avatarUrl = (path?: string) => (path && /^[0-9a-f-]{36}\/[a-zA-Z0-9_-]+\.webp$/.test(path) ? pub('avatars', path) : '');
export const coverUrl = (path?: string) => (path && /^[0-9a-f-]+\/[0-9a-f-]+\.(webp|gif)$/.test(path) ? pub('profile-covers', path) : '');
export const groupIconUrl = (path?: string) => (path && /^[0-9a-f-]+\/[0-9a-f-]+\.webp$/.test(path) ? pub('group-icons', path) : '');
