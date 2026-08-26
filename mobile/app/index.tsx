import { useEffect } from 'react';
import { router } from 'expo-router';
import { isAuthenticated } from '@/services/auth';
import { LoadingScreen } from '@/components/ui/LoadingScreen';

export default function Index() {
  useEffect(() => {
    async function redirect() {
      try {
        const authed = await Promise.race([
          isAuthenticated(),
          new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 3000)),
        ]);
        router.replace(authed ? '/(tabs)/dashboard' : '/(auth)/login');
      } catch {
        router.replace('/(auth)/login');
      }
    }
    redirect();
  }, []);

  return <LoadingScreen message="Starting Vision Collegiate…" />;
}
