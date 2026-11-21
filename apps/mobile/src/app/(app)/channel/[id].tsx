import { useLocalSearchParams } from 'expo-router';
import { ChatScreen } from '@/features/chat/chat-screen';

export default function Channel() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ChatScreen key={id} target={{ type: 'channel', id }} />;
}
