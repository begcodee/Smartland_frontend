'use client';

import dynamic from 'next/dynamic';

const AppShell = dynamic(() => import('@/App'), { ssr: false });

export default function CatchAllPage() {
  return <AppShell />;
}
