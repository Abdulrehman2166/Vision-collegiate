import { useEffect } from 'react';
import { router } from 'expo-router';
import { isAuthenticated } from '@/services/auth';
import { LoadingScreen } from '@/components/ui/LoadingScreen';

export default function Index() {
  useEffect(() => {
    async function redirect() {
      const authed = await isAuthenticated();
      if (authed) {
        router.replace('/(tabs)/dashboard');
      } else {
        router.replace('/(auth)/login');
      }
    }
    redirect();
  }, []);

  return <LoadingScreen message="Starting Vision Collegiate…" />;
}
