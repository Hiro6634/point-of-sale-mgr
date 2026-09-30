import { useEffect, useMemo, useRef, useState } from 'react'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../config/firebase'
import { dbCollectionPath } from '../config/database'
import { colorBackground } from '../config/colors'
import StockAdjustModal from '../components/StockAdjustModal'
import Toast from '../components/Toast'
import { useAuth } from '../contexts/auth'
import { useTheme } from '../contexts/theme'
import { isLowStock, normalizeNumber } from '../lib/productFormat'

// Caja con flechas de entrada y salida: sumar o restar stock.
function StockIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 8v8H5l-2 4V4h18v4z" />
      <line x1="12" y1="9" x2="12" y2="15" />
      <line x1="9" y1="12" x2="15" y2="12" />
    </svg>
  )
}

// serverTimestamp() queda en null hasta que el servidor lo resuelve, asi que un
// movimiento recien hecho aparece sin fecha. No es un error, y no se puede pasar
// por toDate() sin romper.
const formatMoveDate = (value) => {
  if (!value) return 'pendiente'
  const date = typeof value.toDate === 'function' ? value.toDate() : new Date(value)
  if (Number.isNaN(date.getTime())) return 'pendiente'
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export default function StockPage() {
  const { theme } = useTheme()
  const { currentUser } = useAuth()
  const isDark = theme === 'dark'
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [moves, setMoves] = useState([])
  // Un solo objeto para todo el modal: null significa cerrado. current === null
  // significa "todavia leyendo el stock real".
  const [adjust, setAdjust] = useState(null)
  const [toast, setToast] = useState(null)
  const [grouped, setGrouped] = useState(true)
  const toastTimer = useRef(null)

  // Los errores quedan hasta que se clickeen. Los de exito se van solos.
  useEffect(() => {
    if (!toast || toast.type !== 'success') return
    toastTimer.current = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(toastTimer.current)
  }, [toast])

  // onSnapshot y no getDocs: el stock lo mueven las cajas con cada venta y esta
  // pantalla tiene que reflejarlo sin recargar.
  //
  // No hay borradores ni campos de texto en esta pagina, asi que el snapshot no
  // puede pisar nada que el operador haya escrito: el unico input es el del
  // modal, que es transitorio. Ese es el motivo de que sea una pagina separada
  // y no la de productos.
  useEffect(() => {
    const productsRef = collection(db, dbCollectionPath('products'))
    return onSnapshot(
      productsRef,
      (snapshot) => {
        setProducts(
          snapshot.docs.map((item) => {
            const data = item.data()
            // El stock se guarda como numero y no como string: acao se muestra,
            // no se tipea, asi que no hay que convertirlo a la inversa.
            return {
              id: item.id,
              name: data.name,
              category: data.category,
              stock: normalizeNumber(data.stock),
              stockInitial: normalizeNumber(data.stockInitial),
              minStock: normalizeNumber(data.minStock),
              enable: data.enable === true,
            }
          }),
        )
      },
      () =>
        setToast({ type: 'error', message: 'No se pudieron cargar los productos.' }),
    )
  }, [])

  // Solo ajustes manuales. Las ventas viven en env/{env}/tickets y esta app no
  // las lee, asi que vender no aparece en esta lista.
  //
  // El orderBy('at') lo cubre el indice de campo unico de Firestore, asi que no
  // hace falta indice compuesto. No se filtra por "hoy" a proposito: agregar un
  // where sobre 'at' si lo exigiria.
  useEffect(() => {
    const movesRef = collection(db, dbCollectionPath('stockMoves'))
    const movesQuery = query(movesRef, orderBy('at', 'desc'), limit(20))
    return onSnapshot(
      movesQuery,
      (snapshot) =>
        setMoves(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
      () =>
        setToast({
          type: 'error',
          message: 'No se pudo cargar el historial de movimientos.',
        }),
    )
  }, [])

  useEffect(() => {
    const categoriesRef = collection(db, dbCollectionPath('categories'))
    getDocs(categoriesRef)
      .then((snapshot) =>
        setCategories(snapshot.docs.map((item) => ({ ...item.data(), id: item.id }))),
      )
      .catch(() => {})
  }, [])

  const rowBackground = (category) => {
    const match = categories.find(
      (item) => item.name === (category ?? '').trim().toUpperCase(),
    )
    return match ? colorBackground(match.color, isDark) : ''
  }

  const rows = useMemo(() => {
    if (!grouped) {
      return [...products].sort((a, b) => a.name.localeCompare(b.name, 'es'))
    }
    return [...products].sort((a, b) => {
      const byCategory = (a.category ?? '')
        .trim()
        .toUpperCase()
        .localeCompare((b.category ?? '').trim().toUpperCase(), 'es')
      return byCategory || a.name.localeCompare(b.name, 'es')
    })
  }, [grouped, products])

  const handleOpenAdjust = async (id) => {
    const product = products.find((item) => item.id === id)
    if (!product) return

    setAdjust({
      id,
      name: product.name,
      current: null,
      delta: '',
      reason: '',
      saving: false,
    })

    try {
      const productsRef = collection(db, dbCollectionPath('products'))
      const snapshot = await getDoc(doc(productsRef, id))
      const current = normalizeNumber(snapshot.data()?.stock) ?? 0
      // Solo se pisa si el modal sigue abierto sobre la misma fila: la lectura
      // es asincrona y el operador pudo cerrarlo o abrir otro producto.
      setAdjust((prev) => (prev && prev.id === id ? { ...prev, current } : prev))
    } catch {
      // No se puede ajustar lo que no se pudo leer: se cierra en vez de asumir 0.
      setAdjust(null)
      setToast({ type: 'error', message: 'No se pudo leer el stock actual.' })
    }
  }

  const handleAdjustChange = (field, value) => {
    setAdjust((prev) => (prev ? { ...prev, [field]: value } : prev))
  }

  const handleAdjustConfirm = async () => {
    if (!adjust) return

    const trimmed = adjust.delta.trim()
    const deltaNumber = trimmed === '' ? NaN : Number(trimmed)
    if (!Number.isInteger(deltaNumber) || deltaNumber === 0) {
      setToast({
        type: 'error',
        message: 'La cantidad debe ser un numero entero distinto de cero.',
      })
      return
    }
    const reason = adjust.reason.trim()
    if (reason === '') {
      setToast({ type: 'error', message: 'El motivo es obligatorio.' })
      return
    }

    setAdjust((prev) => ({ ...prev, saving: true }))
    const productsRef = collection(db, dbCollectionPath('products'))
    const movesRef = collection(db, dbCollectionPath('stockMoves'))

    try {
      let from = 0
      let to = 0

      // Transaccion y no update suelto por dos motivos. Uno, el stock se relee
      // adentro: si se leyera antes y se escribiera despues, una venta que cae
      // en el medio pasaria el filtro de negativos y dejaria el stock en -40.
      // Dos, el increment y el registro van en el mismo commit, asi que no
      // puede quedar stock movido sin movimiento anotado, ni al reves.
      await runTransaction(db, async (transaction) => {
        const productRef = doc(productsRef, adjust.id)
        const snapshot = await transaction.get(productRef)
        const current = normalizeNumber(snapshot.data()?.stock) ?? 0
        const result = current + deltaNumber

        if (result < 0) throw new Error('NEGATIVE_STOCK')

        from = current
        to = result

        transaction.update(productRef, { stock: increment(deltaNumber) })
        transaction.set(doc(movesRef), {
          productId: adjust.id,
          productName: adjust.name,
          delta: deltaNumber,
          from: current,
          to: result,
          reason,
          by: currentUser?.email ?? null,
          at: serverTimestamp(),
        })
      })

      setAdjust(null)
      setToast({
        type: 'success',
        message: `Stock de ${adjust.name}: ${from} a ${to}.`,
      })
      // No hace falta setProducts: el onSnapshot de arriba trae el valor nuevo
      // por si solo. Forzarlo seria pelear con el snapshot.
    } catch (error) {
      setAdjust((prev) => (prev ? { ...prev, saving: false } : prev))
      if (error?.message === 'NEGATIVE_STOCK') {
        setToast({ type: 'error', message: 'No se puede restar mas de lo que hay.' })
      } else {
        setToast({ type: 'error', message: 'No se pudo aplicar el ajuste.' })
      }
    }
  }

  return (
    <div className="p-6">
      <h1 className="mb-4 text-3xl font-bold text-neutral-900 dark:text-neutral-100">
        Stock
      </h1>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse" style={{ tableLayout: 'auto' }}>
          <thead>
            <tr className="border-b border-neutral-300 bg-neutral-100 text-left dark:border-neutral-700 dark:bg-neutral-800">
              <th className="p-2 text-left">Producto</th>
              <th className="p-2 text-left">
                <button
                  type="button"
                  onClick={() => setGrouped((value) => !value)}
                  className={
                    grouped
                      ? 'text-green-600'
                      : 'text-neutral-900 dark:text-neutral-100'
                  }
                >
                  Categoria
                </button>
              </th>
              <th className="p-2 text-right">Inicial</th>
              <th className="p-2 text-right">Stock</th>
              <th className="p-2 text-left">Estado</th>
              <th className="p-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((product) => {
              const lowStock = isLowStock(product.stock, product.minStock)
              const rowStyle = { backgroundColor: rowBackground(product.category) }
              return (
                <tr
                  key={product.id}
                  className="border-b border-neutral-200 dark:border-neutral-700"
                  style={rowStyle}
                >
                  <td className="p-2 text-neutral-900 dark:text-neutral-100">
                    {product.name}
                  </td>
                  <td className="p-2 text-neutral-500 dark:text-neutral-400">
                    {product.category ?? ''}
                  </td>
                  <td className="p-2 text-right tabular-nums text-neutral-500 dark:text-neutral-400">
                    {product.stockInitial ?? '-'}
                  </td>
                  <td className="p-2 text-right text-lg font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
                    {product.stock ?? '-'}
                  </td>
                  <td className="p-2">
                    <div className="flex items-center gap-2">
                      {lowStock && (
                        <span className="shrink-0 rounded bg-red-600 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white dark:bg-red-500/20 dark:text-red-300">
                          Stock bajo
                        </span>
                      )}
                      {!product.enable && (
                        <span className="shrink-0 rounded bg-neutral-500 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white dark:bg-neutral-600 dark:text-neutral-300">
                          Pausado
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-2">
                    <button
                      type="button"
                      onClick={() => handleOpenAdjust(product.id)}
                      aria-label={`Ajustar stock de ${product.name}`}
                      className="text-neutral-900 transition-colors hover:text-blue-600 dark:text-neutral-100"
                    >
                      <StockIcon />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <h2 className="mb-2 mt-8 text-lg font-bold text-neutral-900 dark:text-neutral-100">
        Ultimos movimientos
      </h2>
      <p className="mb-3 text-sm text-neutral-500 dark:text-neutral-400">
        Ajustes manuales de stock. Las ventas que hacen las cajas no aparecen
        aca.
      </p>

      {moves.length === 0 ? (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Todavia no hay movimientos.
        </p>
      ) : (
        <ul className="divide-y divide-neutral-200 border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
          {moves.map((move) => (
            <li
              key={move.id}
              className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3 py-2 text-sm"
            >
              <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                {move.productName ?? move.productId}
              </span>
              <span
                className={`font-bold tabular-nums ${
                  move.delta > 0
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                }`}
              >
                {move.delta > 0 ? `+${move.delta}` : move.delta}
              </span>
              <span className="tabular-nums text-neutral-500 dark:text-neutral-400">
                {move.from} a {move.to}
              </span>
              <span className="text-neutral-600 dark:text-neutral-300">
                {move.reason}
              </span>
              <span className="ml-auto text-xs text-neutral-400 dark:text-neutral-500">
                {formatMoveDate(move.at)}
                {move.by ? ` · ${move.by}` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}

      {adjust && (
        <StockAdjustModal
          name={adjust.name}
          current={adjust.current}
          delta={adjust.delta}
          reason={adjust.reason}
          saving={adjust.saving}
          onDeltaChange={(value) => handleAdjustChange('delta', value)}
          onReasonChange={(value) => handleAdjustChange('reason', value)}
          onConfirm={handleAdjustConfirm}
          onClose={() => setAdjust(null)}
        />
      )}
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}