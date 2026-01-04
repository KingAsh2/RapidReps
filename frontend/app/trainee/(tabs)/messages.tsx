import { useEffect } from 'react';
import { useRouter } from 'expo-router';

export default function MessagesTab() {
  const router = useRouter();
  
  useEffect(() => {
    // Redirect to the messages screen
    router.replace('/messages');
  }, []);

  return null;
}
