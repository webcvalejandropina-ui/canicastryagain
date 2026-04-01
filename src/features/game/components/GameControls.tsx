type Props = {
  selectedCount: number;
  turnLimit: number;
  canInteract: boolean;
  hasSelection: boolean;
  onIncrease: () => void;
  onDecrease: () => void;
  onConfirm: () => void;
  onCancel: () => void;
};

export function GameControls({
  selectedCount,
  turnLimit,
  canInteract,
  hasSelection,
  onIncrease,
  onDecrease,
  onConfirm,
  onCancel
}: Props): React.ReactElement {
  const buttonBase =
    'inline-flex h-12 items-center justify-center rounded-xl px-4 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-40 active:scale-[0.95]';

  return (
    <section className="glass-panel rounded-2xl p-4 md:p-5" role="group" aria-label="Controles de selección">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        {/* Spinbutton group — proper ARIA pattern for adjustable numeric inputs */}
        <fieldset className="min-w-0">
          <legend className="ui-label mb-2 ml-0">
            Cantidad a quitar
          </legend>

          <div
            role="spinbutton"
            aria-valuenow={selectedCount}
            aria-valuemin={1}
            aria-valuemax={turnLimit}
            aria-label="Cantidad de canicas a quitar"
            aria-live="polite"
            aria-atomic="true"
            className="inline-flex items-center rounded-full border border-brown/20 bg-sand/80 p-1 dark:border-white/10 dark:bg-slate-900/80"
          >
            <button
              id="decrease-btn"
              type="button"
              aria-label="Quitar una canica"
              aria-disabled={!canInteract || !hasSelection}
              onClick={onDecrease}
              disabled={!canInteract || !hasSelection}
              className="flex h-11 w-11 min-w-[44px] items-center justify-center rounded-full border border-brown/25 bg-white/80 text-brown transition hover:border-primary hover:text-primary active:scale-90 disabled:opacity-40 dark:border-white/10 dark:bg-black/40 dark:text-slate-200 dark:hover:border-primary/50 dark:hover:text-primary"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-6 w-6" xmlns="http://www.w3.org/2000/svg">
                <rect x="4" y="11" width="16" height="2" rx="1" fill="currentColor" />
              </svg>
            </button>

            {/* Visible quantity display — no htmlFor since the parent has role="spinbutton" */}
            <span
              id="quantity-display"
              className="mx-4 min-w-10 text-center text-2xl font-bold tracking-tight text-brown dark:text-white"
            >
              {selectedCount}
            </span>

            <button
              id="increase-btn"
              type="button"
              aria-label="Añadir una canica"
              aria-disabled={!canInteract || !hasSelection}
              onClick={onIncrease}
              disabled={!canInteract || !hasSelection}
              className="flex h-11 w-11 min-w-[44px] items-center justify-center rounded-full border border-brown/25 bg-white/80 text-brown transition hover:border-primary hover:text-primary active:scale-90 disabled:opacity-40 dark:border-white/10 dark:bg-black/40 dark:text-slate-200 dark:hover:border-primary/50 dark:hover:text-primary"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-6 w-6" xmlns="http://www.w3.org/2000/svg">
                <rect x="11" y="4" width="2" height="16" rx="1" fill="currentColor" />
                <rect x="4" y="11" width="16" height="2" rx="1" fill="currentColor" />
              </svg>
            </button>
          </div>
          <p className="mt-1.5 text-xs text-brown/60 dark:text-slate-400" id="quantity-instructions">
            {hasSelection
              ? `${selectedCount} de ${turnLimit} · toca − / + para ajustar`
              : 'Selecciona una fila válida para activar los controles.'}
          </p>
        </fieldset>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:min-w-[320px]">
          <button
            id="confirm-btn"
            type="button"
            onClick={onConfirm}
            disabled={!canInteract || !hasSelection}
            className={`${buttonBase} bg-primary text-[#2a1a00] hover:brightness-110 active:scale-[0.96] dark:text-[#2a1a00]`}
          >
            Confirmar jugada
          </button>

          <button
            id="cancel-btn"
            type="button"
            onClick={onCancel}
            disabled={!hasSelection}
            className={`${buttonBase} border border-brown/25 bg-white/80 text-brown hover:border-primary hover:bg-primary/10 active:scale-[0.96] dark:border-white/30 dark:bg-dark-card dark:text-dark-text dark:hover:border-primary/50 dark:hover:bg-primary/10`}
          >
            Cancelar
          </button>
        </div>
      </div>
    </section>
  );
}
