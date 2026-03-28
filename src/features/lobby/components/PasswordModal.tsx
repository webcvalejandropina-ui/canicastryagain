'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

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

type PasswordModalProps = {
  alias: string;
  onSuccess: (playerId: string, alias: string, isAdmin: boolean) => void;
  onCancel: () => void;
};

export function PasswordModal({ alias, onSuccess, onCancel }: PasswordModalProps): React.ReactElement {
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
    if (!password || password.length < 4) {
      setError('La contraseña debe tener al menos 4 caracteres');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alias, password })
      });

      const data = await response.json() as { playerId?: string; alias?: string; isNew?: boolean; isAdmin?: boolean; error?: string; code?: string };

      if (!response.ok) {
        setError(data.error ?? 'Error al iniciar sesión');
        return;
      }

      if (data.playerId && data.alias) {
        onSuccess(data.playerId, data.alias, data.isAdmin === true);
      }
    } catch {
      setError('No se pudo conectar con el servidor');
    } finally {
      setIsLoading(false);
    }
  }, [alias, password, onSuccess]);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget && !isLoading) onCancel(); }}
    >
      <div className="relative mx-4 w-full max-w-sm overflow-hidden rounded-2xl border border-primary/20 bg-white/95 shadow-2xl shadow-primary/15 backdrop-blur-xl dark:border-primary/25 dark:bg-dark-card/95 dark:shadow-primary/5">
        <div className="px-6 pb-6 pt-7 sm:px-8 sm:pt-8">
          <div className="mb-5 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 dark:bg-primary/15">
              <IconLock className="h-6 w-6 text-primary" />
            </div>
            <h2 className="text-lg font-black tracking-tight text-[#4a3f32] dark:text-dark-text">
              Contraseña
            </h2>
            <p className="mt-1 text-xs text-[#8c7d6b] dark:text-dark-muted">
              Ingresa la contraseña para <span className="font-bold text-primary">{alias}</span>
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
              <label htmlFor="password-input" className="text-[10px] font-black uppercase tracking-wider text-[#8c7d6b] dark:text-dark-muted">
                Contraseña
              </label>
              <div className="group relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-[#b5a898] transition-colors group-focus-within:text-primary">
                  <IconLock className="h-5 w-5" />
                </div>
                <input
                  ref={inputRef}
                  id="password-input"
                  className="h-12 w-full rounded-xl border border-[#d4cbbf] bg-white/90 pl-11 pr-12 text-sm font-medium text-[#4a3f32] placeholder:text-[#b5a898] outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/25 dark:border-white/15 dark:bg-dark-surface dark:text-dark-text dark:placeholder:text-dark-muted dark:focus:border-primary"
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
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-[#b5a898] transition-colors hover:text-primary"
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
                disabled={isLoading || password.length < 4}
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-primary font-bold uppercase tracking-wider text-[#4a3f32] shadow-lg shadow-primary/25 transition-all hover:brightness-110 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 dark:shadow-primary/15"
              >
                {isLoading ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#4a3f32]/30 border-t-[#4a3f32]" />
                ) : (
                  <span className="text-xs">Entrar</span>
                )}
              </button>
            </div>

            <p className="text-center text-[10px] text-[#b5a898] dark:text-dark-muted">
              Si es tu primera vez, se creará tu cuenta automáticamente
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
