'use client';
import MapExplorer from '@/components/MapExplorer';
import { useRequireAuth } from '@/hooks/use-auth';
import { Loader2 } from 'lucide-react';

export default function Home() {
  const { user, loading } = useRequireAuth();

  if (loading || !user) {
    return (
      <div className="w-full h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return <MapExplorer user={user} />;
}
