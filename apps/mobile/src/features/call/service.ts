import { requireOptionalNativeModule } from 'expo';
import { PermissionsAndroid, Platform } from 'react-native';

type CallServiceModule = { start: (title: string, message: string) => void; stop: () => void };

/**
 * Mantém a call viva com o app em segundo plano (Android): liga um serviço em primeiro plano com um aviso fixo
 * "Em call". Sem o módulo nativo (web, testes, iPhone) não faz nada; no iPhone o modo de áudio em segundo plano
 * do app.json cuida disso.
 */
function nativeService(): CallServiceModule | null {
  if (Platform.OS !== 'android') return null;
  try {
    return requireOptionalNativeModule<CallServiceModule>('NacallCallService');
  } catch {
    return null;
  }
}

export function startCallService(roomName: string): void {
  try {
    nativeService()?.start('NACALL · Em call', roomName);
  } catch {
    // sem o serviço a call funciona com o app aberto; em segundo plano o Android pode pausá-la
  }
}

export function stopCallService(): void {
  try {
    nativeService()?.stop();
  } catch {
    // já parado
  }
}

/** Android 13+: o aviso fixo da call precisa da permissão de notificações. Se negar, a call continua em segundo plano, só sem o aviso à vista. */
export async function askNotificationPermission(): Promise<void> {
  if (Platform.OS !== 'android' || Number(Platform.Version) < 33) return;
  try {
    await PermissionsAndroid.request('android.permission.POST_NOTIFICATIONS');
  } catch {
    // opcional
  }
}
