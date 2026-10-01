import { useEffect, useRef } from 'react'

// Confirmacion para la inicializacion masiva de stock. Se separa del ajuste
// manual porque la operacion es opuesta: el ajuste mueve el stock, esta lo
// pisa. Por eso necesita una pantalla intermedia que diga exactamente que va a
// pasar antes de tocar nada.
export default function InitializeStockModal({
  items,
  skipped,
  reason,
  saving,
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

  const fieldClass =
    'w-full border border-neutral-300 bg-transparent px-3 py-2 text-neutral-900 outline-none transition-colors focus:border-neutral-900 disabled:opacity-50 dark:border-neutral-600 dark:text-neutral-100 dark:focus:border-neutral-100'

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
        aria-label="Inicializar stock"
        className="w-full max-w-md border border-neutral-300 bg-white p-5 shadow-xl dark:border-neutral-700 dark:bg-neutral-900"
      >
        <h2 className="mb-1 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          Inicializar stock
        </h2>
        <p className="mb-4 text-sm text-neutral-500 dark:text-neutral-400">
          Lleva el stock de cada producto a su stock inicial cargado.
        </p>

        {items.length === 0 ? (
          <p className="mb-4 border border-neutral-200 px-3 py-2 text-sm text-neutral-600 dark:border-neutral-800 dark:text-neutral-300">
            Todos los productos con stock inicial ya estan en ese valor. No hay
            nada que hacer.
          </p>
        ) : (
          <div className="mb-4 max-h-52 overflow-y-auto border border-neutral-200 dark:border-neutral-800">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-neutral-100 text-left dark:bg-neutral-800">
                <tr>
                  <th className="p-2">Producto</th>
                  <th className="p-2 text-right">Ahora</th>
                  <th className="p-2 text-right">Queda</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.id}
                    className="border-t border-neutral-200 dark:border-neutral-800"
                  >
                    <td className="p-2 text-neutral-900 dark:text-neutral-100">
                      {String(item.name ?? '').toUpperCase()}
                    </td>
                    <td className="p-2 text-right tabular-nums text-neutral-500 dark:text-neutral-400">
                      {item.current}
                    </td>
                    <td className="p-2 text-right tabular-nums font-semibold text-neutral-900 dark:text-neutral-100">
                      {item.target}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="mb-4 text-sm text-amber-700 dark:text-amber-400">
          Se pisa el stock actual de {items.length}{' '}
          {items.length === 1 ? 'producto' : 'productos'}. Si se hizo despues de
          vender, las ventas del dia no van a quedar reflejadas en el stock.
        </p>

        {skipped > 0 && (
          <p className="mb-4 text-sm text-neutral-500 dark:text-neutral-400">
            {skipped} producto{skipped === 1 ? '' : 's'} sin stock inicial cargado
            no se van a tocar.
          </p>
        )}

        <label
          htmlFor="initialize-stock-reason"
          className="mb-1 block text-sm text-neutral-600 dark:text-neutral-300"
        >
          Motivo
        </label>
        <input
          id="initialize-stock-reason"
          ref={inputRef}
          type="text"
          value={reason}
          onChange={(event) => onReasonChange(event.target.value)}
          disabled={saving}
          placeholder="Inicio de evento"
          className={`${fieldClass} mb-4`}
        />

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
            disabled={items.length === 0 || saving}
            className="bg-neutral-900 px-4 py-2 text-neutral-100 transition-colors hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
          >
            {saving ? 'Inicializando...' : 'Inicializar'}
          </button>
        </div>
      </div>
    </div>
  )
}