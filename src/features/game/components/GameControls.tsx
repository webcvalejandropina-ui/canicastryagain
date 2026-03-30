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
            className="inline-flex items-center rounded-full border border-white/10 bg-slate-900/60 p-1"
          >
            <button
              id="decrease-btn"
              type="button"
              aria-label="Quitar una canica"
              aria-disabled={!canInteract || !hasSelection}
              onClick={onDecrease}
              disabled={!canInteract || !hasSelection}
              className="flex h-11 w-11 min-w-[44px] items-center justify-center rounded-full border border-white/10 bg-black/30 text-2xl font-light text-slate-200 transition hover:border-primary/50 hover:text-primary active:scale-90 disabled:opacity-40"
            >
              −
            </button>

            {/* Visible quantity display — no htmlFor since the parent has role="spinbutton" */}
            <span
              id="quantity-display"
              className="mx-4 min-w-10 text-center text-2xl font-bold tracking-tight text-white"
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
              className="flex h-11 w-11 min-w-[44px] items-center justify-center rounded-full border border-white/10 bg-black/30 text-2xl font-light text-slate-200 transition hover:border-primary/50 hover:text-primary active:scale-90 disabled:opacity-40"
            >
              +
            </button>
          </div>
          <p className="mt-1.5 text-xs text-slate-500" id="quantity-instructions">
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
            className={`${buttonBase} bg-primary text-background-dark hover:brightness-110 active:scale-[0.96]`}
          >
            Confirmar jugada
          </button>

          <button
            id="cancel-btn"
            type="button"
            onClick={onCancel}
            disabled={!hasSelection}
            className={`${buttonBase} border border-white/10 bg-white/[0.04] text-slate-200 hover:border-white/20 hover:bg-white/[0.08] active:scale-[0.96]`}
          >
            Cancelar
          </button>
        </div>
      </div>
    </section>
  );
}
