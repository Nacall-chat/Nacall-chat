import { Alert, Platform } from 'react-native';

/** Pergunta "tem certeza?" (caixa nativa no celular; confirm do navegador na versão web de teste). */
export function confirmAction(title: string, message: string, confirmLabel = 'Remover'): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(typeof window !== 'undefined' && window.confirm(`${title}\n${message}`));
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
}
