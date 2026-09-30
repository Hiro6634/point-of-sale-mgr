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
import InitializeStockModal from '../components/InitializeStockModal'
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

// El nombre de la categoria se guarda en minusculas pero puede venir de
// documentos escritos antes de esa normalizacion, asi que la clave de busqueda
// se normaliza siempre.
const normalizeKey = (value) => (typeof value === 'string' ? value.trim().toLowerCase() : '')

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
  const [initializing, setInitializing] = useState(null)
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

  // El 'order' se normaliza a numero porque en Firestore el campo puede
  // haber quedado guardado como texto desde la pantalla de categorias. Sin
  // esta conversion el comparador devolveria NaN al restarlos y el sort
  // devolveria las filas en un orden arbitrario.
  useEffect(() => {
    const categoriesRef = collection(db, dbCollectionPath('categories'))
    getDocs(categoriesRef)
      .then((snapshot) =>
        setCategories(
          snapshot.docs.map((item) => {
            const data = item.data()
            const order = Number(data.order)
            return {
              ...data,
              id: item.id,
              order: data.order != null && Number.isFinite(order) ? order : null,
            }
          }),
        ),
      )
      .catch(() => {})
  }, [])

  const rowBackground = (category) => {
    const match = categories.find(
      (item) => item.name === (category ?? '').trim().toUpperCase(),
    )
    return match ? colorBackground(match.color, isDark) : ''
  }

  // El indice de la categoria manda, y dentro de cada categoria se ordena
  // alfabeticamente. No se ordena por nombre de categoria: "bebidas" caeria
  // antes que "carnes" solo por la letra, ignorando el orden que el usuario
  // definio en la pantalla de categorias.
  const rows = useMemo(() => {
    // Indice nombre de categoria -> order. Se comparan normalizadas porque el
    // nombre guardado en el producto y el del documento de categoria pueden
    // diferir en mayusculas.
    const orderByName = new Map()
    for (const category of categories) {
      const key = normalizeKey(category.name)
      if (key && category.order != null) {
        orderByName.set(key, category.order)
      }
    }

    const orderOf = (product) => orderByName.get(normalizeKey(product.category)) ?? null
    const byName = (a, b) => (a ?? '').localeCompare(b ?? '', 'es', { sensitivity: 'base' })

    return [...products].sort((a, b) => {
      const orderA = orderOf(a)
      const orderB = orderOf(b)
      // Sin categoria, o con categoria todavia sin indexar, se van al final:
      // no hay un lugar definido para ellas en el orden del usuario.
      if (orderA == null && orderB == null) {
        return byName(a.category, b.category) || byName(a.name, b.name)
      }
      if (orderA == null) return 1
      if (orderB == null) return -1
      if (orderA !== orderB) return orderA - orderB
      return byName(a.name, b.name)
    })
  }, [products, categories])

  // Plan de la inicializacion masiva: que productos cambian y a que valor. Solo
  // para mostrar la confirmacion; la escritura vuelve a leer los documentos
  // adentro de la transaccion y no se apoya en estos numeros.
  const initPlan = useMemo(() => {
    const items = []
    let skipped = 0
    for (const product of products) {
      const target = normalizeNumber(product.stockInitial)
      // Sin stock inicial cargado no hay a que volver: se deja el producto como
      // esta y se avisa, en vez de mandarlo a cero y dejarlo invendible.
      if (target === null || target < 0) {
        skipped += 1
        continue
      }
      const current = normalizeNumber(product.stock) ?? 0
      if (current === target) continue
      items.push({ id: product.id, name: product.name, current, target })
    }
    return { items, skipped }
  }, [products])

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

  const handleOpenInitialize = () => {
    setInitializing({ reason: 'Inicio de evento', saving: false })
  }

  const handleInitializeConfirm = async () => {
    const reason = initializing.reason.trim() || 'Inicio de evento'
    setInitializing((prev) => ({ ...prev, saving: true }))

    const productsRef = collection(db, dbCollectionPath('products'))
    const movesRef = collection(db, dbCollectionPath('stockMoves'))

    let changed = 0
    let skipped = initPlan.skipped
    let failed = 0

    try {
      // Una transaccion por producto, y no una sola para todos.
      //
      // La transaccion multiple revienta adentro del SDK de Firestore con
      // "Cannot read properties of undefined (reading 'path')", mientras que el
      // ajuste manual, que si funciona, es de un solo documento. Este bloque es
      // el mismo codigo del ajuste manual repetido: si el item por item anda,
      // esto anda.
      //
      // Lo que se pierde es la atomicidad entre productos: si el quinto falla,
      // los cuatro anteriores quedan inicializados. Se puede volver a correr sin
      // drama, porque los que ya estan en su valor inicial se saltean.
      for (const item of initPlan.items) {
        let applied = false
        try {
          await runTransaction(db, async (transaction) => {
            const productRef = doc(productsRef, item.id)
            const snapshot = await transaction.get(productRef)
            // exists() antes que data(): data() es undefined si el documento se
            // borro entre que se armo el plan y el click, y leer stockInitial ahi
            // seria un TypeError.
            if (!snapshot.exists()) {
              skipped += 1
              return
            }
            const data = snapshot.data()
            const target = normalizeNumber(data.stockInitial)
            if (target === null || target < 0) {
              skipped += 1
              return
            }
            const current = normalizeNumber(data.stock) ?? 0
            // Si ya esta en su valor inicial no se toca y no se anota nada: si
            // no, cada producto en valor dejaria un movimiento con delta 0.
            if (current === target) return

            transaction.update(productRef, { stock: target })
            transaction.set(doc(movesRef), {
              productId: item.id,
              productName: String(data.name ?? '').toLowerCase(),
              delta: target - current,
              from: current,
              to: target,
              reason,
              by: currentUser?.email ?? null,
              at: serverTimestamp(),
            })
            applied = true
          })
        } catch (error) {
          // Un producto con datos raros no puede dejar sin inicializar al resto.
          console.error(`No se pudo inicializar ${item.id}`, error)
          failed += 1
        }
        // Se cuenta recien despues del commit, y no adentro del callback: si la
        // transaccion reintenta, el callback corre otra vez y sumaria de más.
        if (applied) changed += 1
      }

      setInitializing(null)

      if (failed > 0) {
        setToast({
          type: 'error',
          message: `Stock inicializado en ${changed} producto${changed === 1 ? '' : 's'}. ${failed} no se pudieron guardar: mira la consola.`,
        })
      } else if (changed === 0) {
        setToast({ type: 'success', message: 'El stock ya estaba en los valores iniciales.' })
      } else {
        const restored = `Stock inicializado en ${changed} producto${changed === 1 ? '' : 's'}.`
        const untouched =
          skipped > 0
            ? ` ${skipped} producto${skipped === 1 ? '' : 's'} sin stock inicial quedaron sin tocar.`
            : ''
        setToast({ type: 'success', message: `${restored}${untouched}` })
      }
    } catch (error) {
      // Sin esto el error real se pierde y solo queda un toast generico, que no
      // sirve ni para diagnosticar ni para saber si reintentar sirve.
      console.error('No se pudo inicializar el stock', error)
      setInitializing((prev) => (prev ? { ...prev, saving: false } : prev))
      setToast({
        type: 'error',
        message: `No se pudo inicializar el stock: ${error?.message ?? 'error desconocido'}`,
      })
    }
  }

  return (
    <div className="p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold text-neutral-900 dark:text-neutral-100">
          Stock
        </h1>
        <button
          type="button"
          onClick={handleOpenInitialize}
          disabled={initPlan.items.length === 0}
          title={
            initPlan.items.length === 0
              ? 'Ningun producto necesita volver a su stock inicial'
              : undefined
          }
          className="text-neutral-900 transition-colors hover:text-green-600 disabled:cursor-not-allowed disabled:opacity-50 dark:text-neutral-100"
        >
          Inicializar stock
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse" style={{ tableLayout: 'auto' }}>
          <thead>
            <tr className="border-b border-neutral-300 bg-neutral-100 text-left dark:border-neutral-700 dark:bg-neutral-800">
              <th className="p-2 text-left">Producto</th>
              <th className="p-2 text-left">Categoria</th>
              <th className="p-2 text-right">Inicial</th>
              <th className="p-2 text-right">Mínimo</th>
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
                    {/* Firestore guarda el nombre en minusculas; las mayusculas
                        son presentacion. */}
                    {String(product.name ?? '').toUpperCase()}
                  </td>
                  <td className="p-2 text-neutral-500 dark:text-neutral-400">
                    {/* Se muestra en mayusculas para que el orden de lectura sea
                        parejo, pero el valor guardado no se toca: el POS agrupa
                        por categoria en minuscula y cambiar el dato aca
                        desalinearia los dos lados. */}
                    {(product.category ?? '').toUpperCase()}
                  </td>
                  <td className="p-2 text-right tabular-nums text-neutral-500 dark:text-neutral-400">
                    {product.stockInitial ?? '-'}
                  </td>
                  <td className="p-2 text-right tabular-nums text-neutral-500 dark:text-neutral-400">
                    {product.minStock ?? '-'}
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
                {String(move.productName ?? move.productId ?? '').toUpperCase()}
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
          name={String(adjust.name ?? '').toUpperCase()}
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

      {initializing && (
        <InitializeStockModal
          items={initPlan.items}
          skipped={initPlan.skipped}
          reason={initializing.reason}
          saving={initializing.saving}
          onReasonChange={(value) => setInitializing((prev) => ({ ...prev, reason: value }))}
          onConfirm={handleInitializeConfirm}
          onClose={() => setInitializing(null)}
        />
      )}
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}