type Props = {
  selectedCount: number;
  canInteract: boolean;
  hasSelection: boolean;
  onIncrease: () => void;
  onDecrease: () => void;
  onConfirm: () => void;
  onCancel: () => void;
};

export function GameControls({
  selectedCount,
  canInteract,
  hasSelection,
  onIncrease,
  onDecrease,
  onConfirm,
  onCancel
}: Props): React.ReactElement {
  const buttonBase =
    'inline-flex h-12 items-center justify-center rounded-xl px-4 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <section className="glass-panel rounded-2xl p-4 md:p-5" role="group" aria-label="Controles de selección">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-2">
          <label htmlFor="quantity-display" className="ui-label ml-0">
            Cantidad a quitar
          </label>

          <div className="inline-flex items-center rounded-full border border-white/10 bg-slate-900/60 p-1">
            <button
              id="decrease-btn"
              type="button"
              onClick={onDecrease}
              disabled={!canInteract || !hasSelection}
              className="h-10 w-10 rounded-full border border-white/10 bg-black/30 text-2xl font-light text-slate-200 transition hover:border-primary/50 hover:text-primary disabled:opacity-40"
            >
              −
            </button>

            <span
              id="quantity-display"
              aria-live="polite"
              className="mx-4 min-w-10 text-center text-2xl font-bold tracking-tight text-white"
            >
              {selectedCount}
            </span>

            <button
              id="increase-btn"
              type="button"
              onClick={onIncrease}
              disabled={!canInteract || !hasSelection}
              className="h-10 w-10 rounded-full border border-white/10 bg-black/30 text-2xl font-light text-slate-200 transition hover:border-primary/50 hover:text-primary disabled:opacity-40"
            >
              +
            </button>
          </div>
          <p className="text-xs text-slate-500">Selecciona una fila válida y ajusta la cantidad antes de confirmar.</p>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:min-w-[320px]">
          <button
            id="confirm-btn"
            type="button"
            onClick={onConfirm}
            disabled={!canInteract || !hasSelection}
            className={`${buttonBase} bg-primary text-background-dark hover:brightness-110`}
          >
            Confirmar jugada
          </button>

          <button
            id="cancel-btn"
            type="button"
            onClick={onCancel}
            disabled={!hasSelection}
            className={`${buttonBase} border border-white/10 bg-white/[0.04] text-slate-200 hover:border-white/20 hover:bg-white/[0.08]`}
          >
            Cancelar
          </button>
        </div>
      </div>
    </section>
  );
}
