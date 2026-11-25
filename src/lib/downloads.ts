/** Instalador do NACALL para Windows. Fica num repositório público só de downloads (o repositório do código é privado), publicado
 * pelo workflow "Desktop · Build Windows" a partir da main. O link "latest" sempre aponta para a versão mais nova. */
export const DOWNLOADS_REPO = 'Nacall-chat/nacall-downloads';
export const WINDOWS_SETUP_FILE = 'NACALL-Setup-x64.exe';
export const WINDOWS_LATEST_URL = `https://github.com/${DOWNLOADS_REPO}/releases/latest/download/${WINDOWS_SETUP_FILE}`;

/** Link do botão "Download Windows". Vazio = botão "Em breve" (antes da primeira publicação não há arquivo para baixar).
 * Liga com NEXT_PUBLIC_WINDOWS_DOWNLOAD_URL na Vercel. Só aceita https no GitHub ou no próprio nacall.site, para um erro de
 * configuração nunca mandar a pessoa baixar um .exe de outro lugar. */
export function windowsDownloadUrl(raw: string | undefined = process.env.NEXT_PUBLIC_WINDOWS_DOWNLOAD_URL): string {
  const value = (raw ?? '').trim();
  if (!value) return '';
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const allowed = host === 'github.com' || host === 'nacall.site' || host.endsWith('.nacall.site');
    return url.protocol === 'https:' && allowed && !url.username && !url.password ? url.href : '';
  } catch {
    return '';
  }
}
