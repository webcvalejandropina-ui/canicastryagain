'use client';

import { useEffect, useState } from 'react';

import { HomePage } from '@/features/lobby/components/HomePage';

function PageShell(): React.ReactElement {
  return (
    <div className="relative min-h-screen">
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="grainy-bg absolute inset-0" />
        <div className="absolute left-[-8%] top-[-8%] h-[34%] w-[34%] rounded-full bg-sand/40 blur-[120px] dark:bg-primary/10" />
        <div className="absolute bottom-[-8%] right-[-8%] h-[24%] w-[24%] rounded-full bg-leaf-soft/20 blur-[100px] dark:bg-primary/8" />
      </div>
      <div className="relative z-10 flex min-h-screen items-center justify-center px-6">
        <div className="glass-panel rounded-2xl px-8 py-6 text-sm uppercase tracking-[0.2em] text-brown/80 dark:text-dark-muted">
          Inicializando plataforma...
        </div>
      </div>
    </div>
  );
}

export function HomePageClient(): React.ReactElement {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <PageShell />;
  }

  return <HomePage />;
}
