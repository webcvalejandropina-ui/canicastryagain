'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

function IconTrash({ className }: { className?: string }): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

function IconLock({ className }: { className?: string }): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

function IconEye({ className }: { className?: string }): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconEyeOff({ className }: { className?: string }): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <path d="m1 1 22 22" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
    </svg>
  );
}

type DeleteAccountModalProps = {
  alias: string;
  playerId: string;
  onDeleted: () => void;
  onCancel: () => void;
};

export function DeleteAccountModal({ alias, playerId, onDeleted, onCancel }: DeleteAccountModalProps): React.ReactElement {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && !isLoading) onCancel();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isLoading, onCancel]);

  const handleSubmit = useCallback(async () => {
    if (!password) {
      setError('Ingresa tu contraseña para confirmar');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, password })
      });

      const data = await response.json() as { success?: boolean; error?: string };

      if (!response.ok) {
        setError(data.error ?? 'Error al eliminar la cuenta');
        return;
      }

      onDeleted();
    } catch {
      setError('No se pudo conectar con el servidor');
    } finally {
      setIsLoading(false);
    }
  }, [playerId, password, onDeleted]);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget && !isLoading) onCancel(); }}
    >
      <div className="relative mx-4 w-full max-w-sm overflow-hidden rounded-2xl border border-rose-500/25 bg-white/95 shadow-2xl shadow-rose-500/10 backdrop-blur-xl dark:border-rose-500/30 dark:bg-dark-card/95 dark:shadow-rose-500/5">
        <div className="px-6 pb-6 pt-7 sm:px-8 sm:pt-8">
          <div className="mb-5 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/10 dark:bg-rose-500/15">
              <IconTrash className="h-6 w-6 text-rose-500" />
            </div>
            <h2 className="text-lg font-black tracking-tight text-[#4a3f32] dark:text-dark-text">
              Eliminar cuenta
            </h2>
            <p className="mt-1 text-xs text-[#8c7d6b] dark:text-dark-muted">
              Se eliminará la cuenta <span className="font-bold text-rose-500">{alias}</span> y todas sus estadísticas. Esta acción es irreversible.
            </p>
          </div>

          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void handleSubmit();
            }}
          >
            <div className="space-y-1.5">
              <label htmlFor="delete-password-input" className="text-[10px] font-black uppercase tracking-wider text-[#8c7d6b] dark:text-dark-muted">
                Confirma tu contraseña
              </label>
              <div className="group relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-[#b5a898] transition-colors group-focus-within:text-rose-500">
                  <IconLock className="h-5 w-5" />
                </div>
                <input
                  ref={inputRef}
                  id="delete-password-input"
                  className="h-12 w-full rounded-xl border border-[#d4cbbf] bg-white/90 pl-11 pr-12 text-sm font-medium text-[#4a3f32] placeholder:text-[#b5a898] outline-none transition-all focus:border-rose-500 focus:ring-2 focus:ring-rose-500/25 dark:border-white/15 dark:bg-dark-surface dark:text-dark-text dark:placeholder:text-dark-muted dark:focus:border-rose-500"
                  placeholder="Tu contraseña..."
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(null); }}
                  maxLength={64}
                  disabled={isLoading}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-[#b5a898] transition-colors hover:text-rose-500"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword
                    ? <IconEyeOff className="h-5 w-5" />
                    : <IconEye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {error ? (
              <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">
                {error}
              </p>
            ) : null}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onCancel}
                disabled={isLoading}
                className="flex h-11 flex-1 items-center justify-center rounded-xl border border-[#d4cbbf] bg-white/80 text-xs font-bold uppercase tracking-wider text-[#6b5d4f] transition-all hover:bg-[#f5f0e8] active:scale-[0.97] disabled:opacity-50 dark:border-white/15 dark:bg-dark-surface dark:text-dark-muted dark:hover:bg-dark-surface/80"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isLoading || !password}
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-rose-500 font-bold uppercase tracking-wider text-white shadow-lg shadow-rose-500/25 transition-all hover:brightness-110 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLoading ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : (
                  <span className="text-xs">Eliminar</span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
