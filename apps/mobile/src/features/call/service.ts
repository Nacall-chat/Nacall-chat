import { requireOptionalNativeModule } from 'expo';
import { PermissionsAndroid, Platform } from 'react-native';

type CallServiceModule = { start: (title: string, message: string, camera: boolean) => void; stop: () => void };

/**
 * Mantém a call viva com o app em segundo plano (Android): liga um serviço em primeiro plano com um aviso fixo
 * "Em call". Sem o módulo nativo (web, testes, iPhone) não faz nada; no iPhone o modo de áudio em segundo plano
 * do app.json cuida disso.
 *
 * Com a câmera ligada o serviço passa a ser também do tipo câmera: sem isso o Android corta a câmera assim que o app
 * vai para segundo plano. Chamar de novo com outro `camera` só troca o tipo (o aviso continua o mesmo).
 */
function nativeService(): CallServiceModule | null {
  if (Platform.OS !== 'android') return null;
  try {
    return requireOptionalNativeModule<CallServiceModule>('NacallCallService');
  } catch {
    return null;
  }
}

export function startCallService(roomName: string, camera = false): void {
  try {
    nativeService()?.start('NACALL · Em call', roomName, camera);
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
