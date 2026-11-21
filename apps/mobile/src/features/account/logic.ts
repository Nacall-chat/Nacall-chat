/**
 * Regras da conta, sem tela: formulário do perfil, recorte das imagens, convite e QR do 2FA.
 * Espelham profile-settings.tsx, profile-cover-editor.tsx, invite.tsx e mfa.tsx do site.
 */
import qrGenerator from 'qrcode-generator';
import { passwordIssue } from '@nacall/core/auth-schema';
import { nameSchema, usernameHint, usernamePattern, usernameSchema } from '@nacall/core/validation';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const AVATAR_SIZE = 256;
export const COVER_WIDTH = 1200;
export const COVER_HEIGHT = 400;
export const BIO_MAX = 300;

export type ProfileForm = { displayName: string; username: string; bio: string };

/** Primeira regra violada do formulário do perfil, ou null. As mesmas validações do site e do banco. */
export function profileFormIssue(form: ProfileForm): string | null {
  const name = nameSchema.safeParse(form.displayName);
  if (!name.success) return name.error.issues[0]?.message ?? 'Confira o nome.';
  if (!usernamePattern.test(form.username.trim())) return `Use ${usernameHint}`;
  const user = usernameSchema.safeParse(form.username);
  if (!user.success) return user.error.issues[0]?.message ?? 'Confira o usuário.';
  if (form.bio.length > BIO_MAX) return `A bio tem no máximo ${BIO_MAX} caracteres.`;
  return null;
}

/** O que mudou em relação ao perfil salvo (para só enviar e avisar quando há mudança). */
export function profileChanged(saved: ProfileForm, next: ProfileForm): boolean {
  return saved.displayName.trim() !== next.displayName.trim() || saved.username.trim() !== next.username.trim() || saved.bio !== next.bio;
}

export const avatarFilePath = (userId: string, uuid: string) => `${userId}/${uuid}.webp`;
export const coverFilePath = (userId: string, uuid: string, ext: 'webp' | 'gif') => `${userId}/${uuid}.${ext}`;

/** Recorte central 3:1 (como a capa do site): o maior retângulo 3:1 que cabe na imagem, centralizado. */
export function coverCrop(width: number, height: number): { originX: number; originY: number; width: number; height: number } {
  const ratio = COVER_WIDTH / COVER_HEIGHT;
  const cropWidth = Math.min(width, Math.floor(height * ratio));
  const cropHeight = Math.floor(cropWidth / ratio);
  return { originX: Math.floor((width - cropWidth) / 2), originY: Math.floor((height - cropHeight) / 2), width: cropWidth, height: cropHeight };
}

/** Recorte central quadrado (foto de perfil). */
export function squareCrop(width: number, height: number): { originX: number; originY: number; width: number; height: number } {
  const side = Math.min(width, height);
  return { originX: Math.floor((width - side) / 2), originY: Math.floor((height - side) / 2), width: side, height: side };
}

/** O arquivo começa como um GIF de verdade? (o site confere o cabeçalho antes de aceitar) */
export function isGifBytes(bytes: Uint8Array): boolean {
  const head = String.fromCharCode(...bytes.slice(0, 6));
  return head === 'GIF87a' || head === 'GIF89a';
}

/** Link ou código de convite → o código (UUID) ou null. */
export function inviteCode(raw: string): string | null {
  try {
    const value = raw.trim();
    const code = value.includes('://') ? new URL(value).searchParams.get('invite') : value;
    return code && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(code) ? code : null;
  } catch {
    return null;
  }
}

/** Matriz do QR (true = quadrado escuro), para desenhar com react-native-svg. */
export function qrMatrix(text: string): boolean[][] {
  const qr = qrGenerator(0, 'M');
  qr.addData(text);
  qr.make();
  const size = qr.getModuleCount();
  return Array.from({ length: size }, (_, row) => Array.from({ length: size }, (_, col) => qr.isDark(row, col)));
}

/** Texto dos códigos de recuperação para copiar. */
export const recoveryText = (codes: string[]) => `NACALL — códigos de recuperação do 2FA\nCada código funciona uma vez. Guarde em local privado.\n\n${codes.join('\n')}\n`;

export type PasswordForm = { current: string; next: string; confirm: string };

/** Dicas ao vivo da troca de senha (as mesmas regras do servidor). */
export function passwordFormHints(form: PasswordForm): { next?: string; confirm?: string; ready: boolean } {
  const next = form.next ? passwordIssue(form.next) ?? undefined : undefined;
  const confirm = form.confirm && form.confirm !== form.next ? 'As senhas não conferem.' : undefined;
  return { next, confirm, ready: Boolean(form.current && form.next && form.confirm) && !next && !confirm };
}
