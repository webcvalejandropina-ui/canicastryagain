'use client';

import { useCallback, useEffect, useState } from 'react';

type UserView = {
  id: string;
  alias: string;
  isAdmin: boolean;
  passwordReset: boolean;
  createdAt: string;
};

function IconShield({ className }: { className?: string }): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function IconRefresh({ className }: { className?: string }): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      <path d="M5 11a7 7 0 0 1 11.5-4.9L18.5 9" />
      <path d="M18.5 5.5V9h-3.5" />
      <path d="M19 13a7 7 0 0 1-11.5 4.9L5.5 15" />
      <path d="M5.5 18.5V15H9" />
    </svg>
  );
}

function IconKey({ className }: { className?: string }): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
    </svg>
  );
}

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

type AdminPanelProps = {
  adminId: string;
};

export function AdminPanel({ adminId }: AdminPanelProps): React.ReactElement {
  const [users, setUsers] = useState<UserView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ type: 'delete' | 'reset'; userId: string; alias: string } | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/users?adminId=${encodeURIComponent(adminId)}`);
      const data = await response.json() as { users?: UserView[]; error?: string };
      if (!response.ok) {
        setError(data.error ?? 'Error al cargar usuarios');
        return;
      }
      setUsers(data.users ?? []);
    } catch {
      setError('No se pudo conectar con el servidor');
    } finally {
      setLoading(false);
    }
  }, [adminId]);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  const handleDelete = useCallback(async (targetId: string) => {
    setActionLoading(targetId);
    try {
      const response = await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId, targetId })
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) {
        setError(data.error ?? 'Error al eliminar usuario');
        return;
      }
      setUsers((prev) => prev.filter((u) => u.id !== targetId));
    } catch {
      setError('No se pudo conectar con el servidor');
    } finally {
      setActionLoading(null);
      setConfirmAction(null);
    }
  }, [adminId]);

  const handleResetPassword = useCallback(async (targetId: string) => {
    setActionLoading(targetId);
    try {
      const response = await fetch('/api/admin/users/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId, targetId })
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) {
        setError(data.error ?? 'Error al resetear contraseña');
        return;
      }
      setUsers((prev) => prev.map((u) => u.id === targetId ? { ...u, passwordReset: true } : u));
    } catch {
      setError('No se pudo conectar con el servidor');
    } finally {
      setActionLoading(null);
      setConfirmAction(null);
    }
  }, [adminId]);

  const formatDate = (iso: string): string => {
    try {
      return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return iso;
    }
  };

  return (
    <article id="admin" className="overflow-hidden rounded-2xl border border-amber-500/15 bg-white/70 p-5 backdrop-blur dark:border-amber-500/15 dark:bg-dark-card/80 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <IconShield className="h-5 w-5 text-amber-500" />
          <h3 className="text-sm font-black uppercase tracking-wider text-[#4a3f32] dark:text-dark-text">
            Panel de administración
          </h3>
        </div>
        <button
          type="button"
          onClick={() => void fetchUsers()}
          disabled={loading}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#8c7d6b] transition-colors hover:bg-amber-500/10 hover:text-amber-600 active:scale-95 disabled:opacity-50 dark:text-dark-muted dark:hover:bg-amber-500/15"
          aria-label="Actualizar lista"
          title="Actualizar lista"
        >
          <IconRefresh className="h-4 w-4 shrink-0" />
        </button>
      </div>

      {error ? (
        <div className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">
          {error}
          <button type="button" onClick={() => setError(null)} className="ml-2 underline">Cerrar</button>
        </div>
      ) : null}

      <div className="mt-4">
        {loading && users.length === 0 ? (
          <p className="text-sm text-[#8c7d6b] dark:text-dark-muted">Cargando usuarios...</p>
        ) : users.length === 0 ? (
          <p className="text-sm text-[#8c7d6b] dark:text-dark-muted">No hay usuarios registrados.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#e8e0d4] dark:border-white/10">
                  <th className="pb-2 pr-4 text-[10px] font-black uppercase tracking-wider text-[#8c7d6b] dark:text-dark-muted">Alias</th>
                  <th className="pb-2 pr-4 text-[10px] font-black uppercase tracking-wider text-[#8c7d6b] dark:text-dark-muted">Registro</th>
                  <th className="pb-2 pr-4 text-[10px] font-black uppercase tracking-wider text-[#8c7d6b] dark:text-dark-muted">Estado</th>
                  <th className="pb-2 text-[10px] font-black uppercase tracking-wider text-[#8c7d6b] dark:text-dark-muted">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-[#e8e0d4]/50 last:border-0 dark:border-white/5">
                    <td className="py-2.5 pr-4">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#4a3f32] dark:text-dark-text">{user.alias}</span>
                        {user.isAdmin ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
                            <IconShield className="h-3 w-3" />
                            Admin
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="py-2.5 pr-4 text-xs text-[#8c7d6b] dark:text-dark-muted">
                      {formatDate(user.createdAt)}
                    </td>
                    <td className="py-2.5 pr-4">
                      {user.passwordReset ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-orange-600 dark:bg-orange-500/20 dark:text-orange-400">
                          Reset pendiente
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
                          Activo
                        </span>
                      )}
                    </td>
                    <td className="py-2.5">
                      {user.isAdmin ? (
                        <span className="text-[10px] text-[#b5a898] dark:text-dark-muted">---</span>
                      ) : (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={actionLoading === user.id}
                            onClick={() => setConfirmAction({ type: 'reset', userId: user.id, alias: user.alias })}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-amber-600 transition-colors hover:bg-amber-500/10 active:scale-95 disabled:opacity-40 dark:text-amber-400 dark:hover:bg-amber-500/15"
                            aria-label={`Resetear contraseña de ${user.alias}`}
                            title="Resetear contraseña"
                          >
                            <IconKey className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            disabled={actionLoading === user.id}
                            onClick={() => setConfirmAction({ type: 'delete', userId: user.id, alias: user.alias })}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-rose-500 transition-colors hover:bg-rose-500/10 active:scale-95 disabled:opacity-40 dark:text-rose-400 dark:hover:bg-rose-500/15"
                            aria-label={`Eliminar a ${user.alias}`}
                            title="Eliminar usuario"
                          >
                            <IconTrash className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {confirmAction ? (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setConfirmAction(null); }}
        >
          <div className="mx-4 w-full max-w-sm rounded-2xl border border-[#d4cbbf] bg-white/95 p-6 shadow-2xl backdrop-blur-xl dark:border-white/15 dark:bg-dark-card/95">
            <h3 className="text-base font-black text-[#4a3f32] dark:text-dark-text">
              {confirmAction.type === 'delete' ? 'Eliminar usuario' : 'Resetear contraseña'}
            </h3>
            <p className="mt-2 text-sm text-[#6b5d4f] dark:text-dark-muted">
              {confirmAction.type === 'delete'
                ? <>Se eliminará permanentemente a <strong className="text-rose-500">{confirmAction.alias}</strong> y todas sus estadísticas.</>
                : <>La próxima vez que <strong className="text-amber-600 dark:text-amber-400">{confirmAction.alias}</strong> inicie sesión, deberá establecer una nueva contraseña.</>}
            </p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                disabled={actionLoading !== null}
                className="flex h-10 flex-1 items-center justify-center rounded-xl border border-[#d4cbbf] bg-white/80 text-xs font-bold uppercase tracking-wider text-[#6b5d4f] transition-all hover:bg-[#f5f0e8] active:scale-[0.97] disabled:opacity-50 dark:border-white/15 dark:bg-dark-surface dark:text-dark-muted"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={actionLoading !== null}
                onClick={() => {
                  if (confirmAction.type === 'delete') {
                    void handleDelete(confirmAction.userId);
                  } else {
                    void handleResetPassword(confirmAction.userId);
                  }
                }}
                className={[
                  'flex h-10 flex-1 items-center justify-center gap-2 rounded-xl font-bold uppercase tracking-wider shadow-lg transition-all hover:brightness-110 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50',
                  confirmAction.type === 'delete'
                    ? 'bg-rose-500 text-white shadow-rose-500/25'
                    : 'bg-amber-500 text-white shadow-amber-500/25'
                ].join(' ')}
              >
                {actionLoading ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : (
                  <span className="text-xs">{confirmAction.type === 'delete' ? 'Eliminar' : 'Resetear'}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </article>
  );
}
