import { redirect } from 'next/navigation';

// Root redirect: always send to /dashboard (AppShell handles unauthenticated users)
export default function Home() {
  redirect('/dashboard');
}
