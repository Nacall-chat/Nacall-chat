import { useLocalSearchParams } from 'expo-router';
import { ChatScreen } from '@/features/chat/chat-screen';

export default function Dm() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ChatScreen key={id} target={{ type: 'dm', id }} />;
}
