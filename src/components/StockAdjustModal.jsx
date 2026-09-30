import { useEffect, useRef } from 'react'

// Modal de ajuste de stock. El ajuste es relativo (cuanto sumar o restar), no
// absoluto, porque dos escrituras relativas conviven sin pisarse: un increment
// del POS por venta y este increment desde la app no se pisan nunca. Por eso
// la operacion va en una transaccion, no en un update suelto.
export default function StockAdjustModal({
  name,
  current,
  delta,
  reason,
  saving,
  onDeltaChange,
  onReasonChange,
  onConfirm,
  onClose,
}) {
  const inputRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Number() y no parseInt: parseInt acepta "10abc" como 10 y dejaria pasar un
  // valor mal tipeado. El trim evita que un campo con solo espacios cuente como 0.
  const trimmed = delta.trim()
  const deltaNumber = trimmed === '' ? NaN : Number(trimmed)
  const isDeltaValid = Number.isInteger(deltaNumber) && deltaNumber !== 0
  const isReasonValid = reason.trim() !== ''
  // current === null es "todavia leyendo". Sin este chequeo, null + 10 da 10 en
  // JavaScript y el modal mostraria un resultante inventado con la pantalla a
  // medio cargar, y dejaria el boton habilitado para confirmar a ciegas.
  const isCurrentReady = current !== null
  const next = isDeltaValid && isCurrentReady ? current + deltaNumber : null
  const wouldGoNegative = next !== null && next < 0
  const canConfirm =
    isCurrentReady && isDeltaValid && isReasonValid && !wouldGoNegative && !saving

  const fieldClass =
    'w-full border border-neutral-300 bg-transparent px-3 py-2 text-neutral-900 outline-none transition-colors focus:border-neutral-900 dark:border-neutral-600 dark:text-neutral-100 dark:focus:border-neutral-100'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Ajustar stock de ${name}`}
        className="w-full max-w-sm border border-neutral-300 bg-white p-5 shadow-xl dark:border-neutral-700 dark:bg-neutral-900"
      >
        <h2 className="mb-1 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          Ajustar stock
        </h2>
        <p className="mb-4 text-sm text-neutral-500 dark:text-neutral-400">{name}</p>

        <div className="mb-4 flex items-baseline justify-between border border-neutral-200 px-3 py-2 dark:border-neutral-800">
          <span className="text-sm text-neutral-500 dark:text-neutral-400">
            Stock actual
          </span>
          <span className="text-lg font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
            {current === null ? '...' : current}
          </span>
        </div>

        <label
          htmlFor="stock-adjust-delta"
          className="mb-1 block text-sm text-neutral-600 dark:text-neutral-300"
        >
          Cantidad a sumar o restar
        </label>
        <input
          id="stock-adjust-delta"
          ref={inputRef}
          type="number"
          step="1"
          value={delta}
          onChange={(event) => onDeltaChange(event.target.value)}
          disabled={saving}
          placeholder="+10 para sumar, -10 para restar"
          className={`${fieldClass} mb-1`}
        />
        <p className="mb-4 text-xs text-neutral-500 dark:text-neutral-400">
          Es una operacion relativa: no define el stock final, lo mueve.
        </p>

        <label
          htmlFor="stock-adjust-reason"
          className="mb-1 block text-sm text-neutral-600 dark:text-neutral-300"
        >
          Motivo
        </label>
        <input
          id="stock-adjust-reason"
          type="text"
          value={reason}
          onChange={(event) => onReasonChange(event.target.value)}
          disabled={saving}
          placeholder="Compra a proveedor, conteo, merma..."
          className={`${fieldClass} mb-4`}
        />

        <div className="mb-4 flex items-baseline justify-between border border-neutral-200 px-3 py-2 dark:border-neutral-800">
          <span className="text-sm text-neutral-500 dark:text-neutral-400">
            Stock resultante
          </span>
          <span
            className={`text-lg font-semibold tabular-nums ${
              wouldGoNegative
                ? 'text-red-600 dark:text-red-400'
                : 'text-neutral-900 dark:text-neutral-100'
            }`}
          >
            {next === null ? '-' : next}
          </span>
        </div>

        {wouldGoNegative && (
          <p className="mb-4 text-sm text-red-600 dark:text-red-400">
            No se puede restar mas de lo que hay. Hacelo sobre un conteo real.
          </p>
        )}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-neutral-600 transition-colors hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-50 dark:text-neutral-400 dark:hover:text-neutral-100"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!canConfirm}
            className="bg-neutral-900 px-4 py-2 text-neutral-100 transition-colors hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
          >
            {saving ? 'Guardando...' : 'Aplicar'}
          </button>
        </div>
      </div>
    </div>
  )
}