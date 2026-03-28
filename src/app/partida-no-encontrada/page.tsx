import Link from 'next/link';

type PageProps = {
  searchParams: Promise<{
    code?: string;
    reason?: string;
  }>;
};

export default async function MissingGamePage({ searchParams }: PageProps): Promise<React.ReactElement> {
  const params = await searchParams;
  const code = (params.code ?? '').trim().toUpperCase();
  const reason = (params.reason ?? '').trim().toUpperCase();

  const reasonMessage =
    reason === 'INVITE_TOKEN_REVOKED'
      ? 'Ese enlace fue revocado porque la partida cambió o se cerró.'
      : reason === 'INVALID_INVITE_TOKEN'
        ? 'El enlace de invitación es inválido o está incompleto.'
        : 'El juego puede haber caducado, haber finalizado o el enlace ya no es válido.';

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-10 sm:px-6">
      <div className="pointer-events-none absolute inset-0">
        <div className="grainy-bg absolute inset-0" />
        <div className="absolute left-1/2 top-[15%] h-[40%] w-[50%] -translate-x-1/2 rounded-full bg-primary/8 blur-[100px] dark:bg-primary/10" />
      </div>

      <div className="relative text-center">
        <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-primary/10 dark:bg-primary/15">
          <span className="text-5xl" role="img" aria-label="piña">🍍</span>
        </div>

        <h1 className="text-3xl font-black uppercase tracking-tight text-[#4a3f32] dark:text-dark-text sm:text-4xl">
          Partida no encontrada
        </h1>

        <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-[#6b5d4f] dark:text-dark-muted sm:text-base">
          {reasonMessage}
        </p>

        {code ? (
          <div className="mx-auto mt-5 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-5 py-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#8c7d6b] dark:text-dark-muted">Código</span>
            <span className="text-lg font-black tracking-[0.2em] text-primary">{code}</span>
          </div>
        ) : null}

        <div className="mt-10">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-8 py-3.5 text-sm font-bold uppercase tracking-wider text-[#4a3f32] shadow-lg shadow-primary/25 transition-all hover:bg-primary-light hover:shadow-xl hover:shadow-primary/30 active:scale-[0.97] dark:shadow-primary/15"
          >
            <span>🏠</span>
            <span>Volver al juego</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
