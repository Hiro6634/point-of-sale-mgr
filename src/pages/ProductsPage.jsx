import { useEffect, useMemo, useRef, useState } from 'react'
import { useBlocker } from 'react-router-dom'
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import { db } from '../config/firebase'
import { dbCollectionPath } from '../config/database'
import { colorBackground } from '../config/colors'
import Toast from '../components/Toast'
import { useTheme } from '../contexts/theme'
import { normalizeNumber } from '../lib/productFormat'

const inputClass =
  'w-full bg-transparent text-neutral-700 outline-none dark:text-neutral-100'

const inputAutoClass =
  'bg-transparent text-neutral-700 outline-none dark:text-neutral-100'

function SaveIcon() {
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
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </svg>
  )
}

function DeleteIcon() {
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
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  )
}

export default function ProductsPage() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [edits, setEdits] = useState({})
  const [form, setForm] = useState({
    name: '',
    category: '',
    price: '',
    stockInitial: '',
    minStock: '',
    stock: '',
    enable: false,
  })
  const [saving, setSaving] = useState(false)
  const [savingId, setSavingId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [togglingId, setTogglingId] = useState(null)
  const [toast, setToast] = useState(null)
  const [grouped, setGrouped] = useState(false)
  const toastTimer = useRef(null)

  useEffect(() => {
    let active = true
    const productsRef = collection(db, dbCollectionPath('products'))
    getDocs(productsRef)
      .then((snapshot) => {
        if (!active) return
        const items = snapshot.docs.map((item) => {
          const data = item.data()
          return {
            id: item.id,
            name: data.name,
            category: data.category,
            price: data.price == null ? '' : String(data.price),
            stockInitial: data.stockInitial == null ? '' : String(data.stockInitial),
            minStock: data.minStock == null ? '' : String(data.minStock),
            stock: data.stock == null ? '' : String(data.stock),
            enable: data.enable === true,
          }
        })
        setProducts(items)
        setEdits(
          Object.fromEntries(
            items.map((item) => [
              item.id,
              {
                name: item.name,
                category: item.category,
                price: item.price,
                stockInitial: item.stockInitial,
                minStock: item.minStock,
                stock: item.stock,
                enable: item.enable,
              },
            ]),
          ),
        )
      })
      .catch(() => {
        if (active) {
          setToast({ type: 'error', message: 'No se pudieron cargar los productos.' })
        }
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true
    const categoriesRef = collection(db, dbCollectionPath('categories'))
    getDocs(categoriesRef)
      .then((snapshot) => {
        if (!active) return
        const items = snapshot.docs
          .map((item) => ({
            name: String(item.data().name ?? '').toUpperCase(),
            color: item.data().color ?? '',
          }))
          .filter((item) => item.name !== '')
        setCategories(items)
      })
      .catch(() => {
        if (active) {
          setToast({ type: 'error', message: 'No se pudieron cargar las categorías.' })
        }
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    // Los errores quedan hasta que se los clickee: se van a leer cuando se los
    // clickee el operador, no a los 3,5 segundos.
    if (!toast || toast.type !== 'success') return
    toastTimer.current = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(toastTimer.current)
  }, [toast])

  const { isDirty, isRowDirty } = useMemo(() => {
    const isRowDirtyFn = (id) => {
      const draft = edits[id]
      if (!draft) return false
      const saved = products.find((product) => product.id === id)
      if (!saved) return true
      return (
        draft.name.trim() !== saved.name ||
        draft.category.trim() !== (saved.category ?? '') ||
        normalizeNumber(draft.price) !== normalizeNumber(saved.price) ||
        normalizeNumber(draft.stockInitial) !==
          normalizeNumber(saved.stockInitial) ||
        normalizeNumber(draft.minStock) !== normalizeNumber(saved.minStock) ||
        draft.enable !== saved.enable
      )
    }
    const edited = products.some((product) => isRowDirtyFn(product.id))
    const newRow =
      form.name.trim() !== '' ||
      form.category.trim() !== '' ||
      form.price !== '' ||
      form.stockInitial !== '' ||
      form.minStock !== '' ||
      form.stock !== '' ||
      form.enable
    return { isDirty: edited || newRow, isRowDirty: isRowDirtyFn }
  }, [products, edits, form])

  useEffect(() => {
    if (!isDirty) return
    const handler = (event) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  const blocker = useBlocker(isDirty)

  useEffect(() => {
    if (blocker.state !== 'blocked') return
    const leave = window.confirm(
      'Tiene cambios sin guardar. ¿Desea salir sin guardarlos?',
    )
    if (leave) blocker.proceed()
    else blocker.reset()
  }, [blocker])

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target
    const next = type === 'checkbox' ? checked : value.toUpperCase()
    setForm((prev) => ({
      ...prev,
      [name]: next,
    }))
  }

  const handleEditChange = (id, field, value) => {
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }))
  }

  const slugify = (name) => name.toLowerCase().replace(/\s+/g, '_')

  const rowBackground = (category, isDark) => {
    const match = categories.find(
      (item) => item.name === (category ?? '').trim().toUpperCase(),
    )
    return match ? colorBackground(match.color, isDark) : ''
  }

  const categoryOptions = (current) => {
    const names = categories.map((item) => item.name)
    if (current && !names.includes(current.toUpperCase())) {
      return [...names, current.toUpperCase()]
    }
    return names
  }

  const categorySelect = (value, onChange) => (
    <select
      value={(value ?? '').toUpperCase()}
      onChange={(event) => onChange(event.target.value)}
      className={inputAutoClass}
    >
      <option value="">Sin categoría</option>
      {categoryOptions(value).map((category) => (
        <option key={category} value={category}>
          {category}
        </option>
      ))}
    </select>
  )

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!form.name.trim()) {
      setToast({ type: 'error', message: 'El nombre del producto es obligatorio.' })
      return
    }
    if (form.price === '') {
      setToast({ type: 'error', message: 'El precio es obligatorio.' })
      return
    }
    setSaving(true)
    try {
      const productsRef = collection(db, dbCollectionPath('products'))
      // Se guardan en minusculas a proposito: es la forma canonica del dato, la que
      // se consulta, ordena y deduplica. Las mayusculas son solo presentacion y
      // las aplica la pantalla al leer. El input uppercasa mientras se escribe
      // (handleChange), asi que el operador nunca ve minusculas.
      const name = form.name.trim().toLowerCase()
      const category = form.category.trim().toLowerCase()
      const price = Number(form.price)
      const stockInitial = form.stockInitial === '' ? null : Number(form.stockInitial)
      const minStock = form.minStock === '' ? null : Number(form.minStock)
      const stock = form.stock === '' ? null : Number(form.stock)
      const enable = form.enable === true
      const id = slugify(name)

      if (
        products.some(
          (product) => product.name.toLowerCase() === name.toLowerCase(),
        )
      ) {
        setToast({ type: 'error', message: 'Ya existe un producto con ese nombre.' })
        return
      }
      if (products.some((product) => product.id === id)) {
        setToast({ type: 'error', message: 'Ya existe un producto con ese nombre.' })
        return
      }

      await setDoc(doc(productsRef, id), {
        id,
        name,
        category,
        price,
        stockInitial,
        minStock,
        stock,
        enable,
      })
      const saved = {
        id,
        name,
        category,
        price: String(price),
        stockInitial: stockInitial === null ? '' : String(stockInitial),
        minStock: minStock === null ? '' : String(minStock),
        stock: stock === null ? '' : String(stock),
        enable,
      }
      setProducts((prev) => [...prev, saved])
      setEdits((prev) => ({
        ...prev,
        [id]: {
          name,
          category,
          price: String(price),
          stockInitial: stockInitial === null ? '' : String(stockInitial),
          minStock: minStock === null ? '' : String(minStock),
          stock: stock === null ? '' : String(stock),
          enable,
        },
      }))
      setForm({ name: '', category: '', price: '', stockInitial: '', minStock: '', stock: '', enable: false })
      setToast({ type: 'success', message: 'Producto agregado correctamente.' })
    } catch {
      setToast({ type: 'error', message: 'No se pudo guardar el producto.' })
    } finally {
      setSaving(false)
    }
  }

  const handleSave = async (id) => {
    const draft = edits[id]
    // Ver handleSubmit: el dato se guarda en minusculas y la pantalla lo muestra
    // en mayusculas.
    const name = draft.name.trim().toLowerCase()
    if (!name) {
      setToast({ type: 'error', message: 'El nombre del producto es obligatorio.' })
      return
    }
    if (draft.price.trim() === '') {
      setToast({ type: 'error', message: 'El precio es obligatorio.' })
      return
    }
    const category = draft.category.trim().toLowerCase()
    const price = Number(draft.price)
    const stockInitial = draft.stockInitial === '' ? null : Number(draft.stockInitial)
    const minStock = draft.minStock === '' ? null : Number(draft.minStock)
    const enable = draft.enable === true

    if (
      products.some(
        (product) =>
          product.id !== id &&
          product.name.toLowerCase() === name.toLowerCase(),
      )
    ) {
      setToast({ type: 'error', message: 'Ya existe un producto con ese nombre.' })
      return
    }

    // El stock vigente, no el del borrador: en cuanto una caja veto algo
    // el borrador quedo viejo, y dejarlo en el estado local lo volveria a
    // mandar en el proximo guardado.
    const liveStock = products.find((product) => product.id === id)?.stock ?? ''

    setSavingId(id)
    try {
      const productsRef = collection(db, dbCollectionPath('products'))
      // El stock no se escribe al editar: lo mueven las cajas con increment()
      // al vender y esta pantalla solo lo monitorea. Mandar aca el valor del
      // borrador pisaria en silencio todas las ventas que ocurrieron desde que
      // se cargo la pagina.
      //
      // merge: true es obligatorio: setDoc sin merge reemplaza el documento
      // entero, asi que sin el, y con el stock fuera del payload, el campo
      // "stock" quedaria sin valor en vez de conservarse.
      await setDoc(
        doc(productsRef, id),
        {
          id,
          name,
          category,
          price,
          stockInitial,
          minStock,
          enable,
        },
        { merge: true },
      )
      setProducts((prev) =>
        prev.map((product) =>
          product.id === id
            ? {
                id,
                name,
                category,
                price: String(price),
                stockInitial: stockInitial === null ? '' : String(stockInitial),
                minStock: minStock === null ? '' : String(minStock),
                stock: liveStock,
                enable,
              }
            : product,
        ),
      )
      setEdits((prev) => ({
        ...prev,
        [id]: {
          name,
          category,
          price: String(price),
          stockInitial: stockInitial === null ? '' : String(stockInitial),
          minStock: minStock === null ? '' : String(minStock),
          stock: liveStock,
          enable,
        },
      }))
      setToast({ type: 'success', message: 'Producto actualizado correctamente.' })
    } catch {
      setToast({ type: 'error', message: 'No se pudo actualizar el producto.' })
    } finally {
      setSavingId(null)
    }
  }

  const handleToggleEnable = async (id, checked) => {
    const prevEnable = edits[id]?.enable === true
    setTogglingId(id)
    setProducts((prev) =>
      prev.map((product) =>
        product.id === id ? { ...product, enable: checked } : product,
      ),
    )
    setEdits((prev) => ({
      ...prev,
      [id]: { ...prev[id], enable: checked },
    }))
    try {
      const productsRef = collection(db, dbCollectionPath('products'))
      await updateDoc(doc(productsRef, id), { enable: checked })
      setToast({
        type: 'success',
        message: checked
          ? 'Producto habilitado correctamente.'
          : 'Producto deshabilitado correctamente.',
      })
    } catch {
      setProducts((prev) =>
        prev.map((product) =>
          product.id === id ? { ...product, enable: prevEnable } : product,
        ),
      )
      setEdits((prev) => ({
        ...prev,
        [id]: { ...prev[id], enable: prevEnable },
      }))
      setToast({ type: 'error', message: 'No se pudo actualizar el producto.' })
    } finally {
      setTogglingId(null)
    }
  }

  const handleDelete = async (id) => {
    if (
      !window.confirm(
        `¿Eliminar el producto "${edits[id]?.name?.trim() || id}"?`,
      )
    ) {
      return
    }
    setDeletingId(id)
    try {
      const productsRef = collection(db, dbCollectionPath('products'))
      await deleteDoc(doc(productsRef, id))
      setProducts((prev) => prev.filter((product) => product.id !== id))
      setEdits((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      setToast({ type: 'success', message: 'Producto eliminado correctamente.' })
    } catch {
      setToast({ type: 'error', message: 'No se pudo eliminar el producto.' })
    } finally {
      setDeletingId(null)
    }
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

  const editableRow = (id, draft) => (
    <>
      <td className="p-2">
        <div className="flex items-center gap-2">
          <input
            value={draft.name}
            onChange={(event) =>
              handleEditChange(id, 'name', event.target.value.toUpperCase())
            }
            className={inputAutoClass}
          />
          {isRowDirty(id) && (
            <span
              title="Cambios sin guardar"
              className="h-2 w-2 shrink-0 rounded-full bg-amber-500"
            />
          )}
        </div>
      </td>
      <td className="p-2">
        {categorySelect(draft.category, (value) =>
          handleEditChange(id, 'category', value),
        )}
      </td>
      <td className="p-2">
        <input
          type="number"
          value={draft.price}
          onChange={(event) =>
            handleEditChange(id, 'price', event.target.value)
          }
          className={inputClass}
        />
      </td>
      <td className="p-2">
        <input
          type="number"
          value={draft.stockInitial}
          onChange={(event) =>
            handleEditChange(id, 'stockInitial', event.target.value)
          }
          className={inputClass}
        />
      </td>
      <td className="p-2">
        <input
          type="number"
          value={draft.minStock}
          onChange={(event) =>
            handleEditChange(id, 'minStock', event.target.value)
          }
          className={inputClass}
        />
      </td>
      <td className="p-2">
        <input
          type="checkbox"
          checked={draft.enable === true}
          onChange={(event) =>
            handleToggleEnable(id, event.target.checked)
          }
          disabled={togglingId === id}
          className="h-4 w-4 accent-neutral-900 dark:accent-neutral-100"
        />
      </td>
      <td className="p-2">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => handleSave(id)}
            disabled={savingId === id || deletingId === id}
            aria-label="Guardar producto"
            className="text-neutral-900 transition-colors hover:text-green-600 dark:text-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {savingId === id ? '...' : <SaveIcon />}
          </button>
          <button
            type="button"
            onClick={() => handleDelete(id)}
            disabled={savingId === id || deletingId === id}
            aria-label="Eliminar producto"
            className="text-neutral-900 transition-colors hover:text-red-600 dark:text-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {deletingId === id ? '...' : <DeleteIcon />}
          </button>
        </div>
      </td>
    </>
  )

  return (
    <div className="p-6">
      <h1 className="mb-4 text-3xl font-bold text-neutral-900 dark:text-neutral-100">Productos</h1>
      <form onSubmit={handleSubmit}>
        <div className="overflow-x-auto">
        <table
          className="w-full border-collapse"
          style={{ tableLayout: 'auto' }}
        >
          <thead>
            <tr className="border-b border-neutral-300 bg-neutral-100 text-left dark:border-neutral-700 dark:bg-neutral-800">
              <th className="p-2 text-left">
                <button
                  type="button"
                  onClick={() => setGrouped(false)}
                  title="Ordenar alfabéticamente por producto"
                  className={`text-sm font-semibold uppercase tracking-wide ${
                    grouped ? 'text-neutral-900 dark:text-neutral-100' : 'text-green-600'
                  }`}
                >
                  Producto
                </button>
              </th>
              <th className="p-2 text-left">
                <button
                  type="button"
                  onClick={() => setGrouped((value) => !value)}
                  title="Agrupar por categoría"
                  className={`text-sm font-semibold uppercase tracking-wide ${
                    grouped ? 'text-green-600' : 'text-neutral-900 dark:text-neutral-100'
                  }`}
                >
                  Categoría{grouped ? ' ▾' : ''}
                </button>
              </th>
              <th className="p-2 text-sm font-semibold uppercase tracking-wide text-neutral-900 dark:text-neutral-100">
                Precio
              </th>
              <th className="p-2 text-sm font-semibold uppercase tracking-wide text-neutral-900 dark:text-neutral-100">
                Stock Inicial
              </th>
              <th className="p-2 text-sm font-semibold uppercase tracking-wide text-neutral-900 dark:text-neutral-100">
                Stock Mínimo
              </th>
              <th className="p-2 text-sm font-semibold uppercase tracking-wide text-neutral-900 dark:text-neutral-100">
                Habilitado
              </th>
              <th className="p-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((product) => {
              const draft = edits[product.id] ?? {
                name: product.name,
                category: product.category,
                price: product.price,
                stockInitial: product.stockInitial,
                minStock: product.minStock,
                enable: product.enable,
              }
              // El contorno de stock bajo se fue con la columna: esta pagina
              // carga una sola vez con getDocs, asi que el numero seria el de
              // cuando se abrio la pantalla. La pagina de Stock es la que
              // muestra el stock real, y ese lo tiene atualizado.
              const rowStyle = {}
              const bg = rowBackground(draft.category, isDark)
              if (bg) rowStyle.backgroundColor = bg
              return (
                <tr
                  key={product.id}
                  className="border-b border-neutral-200 dark:border-neutral-700"
                  style={rowStyle}
                >
                  {editableRow(product.id, draft)}
                </tr>
              )
            })}
            <tr
              className="border-b border-neutral-200 dark:border-neutral-700"
              style={
                rowBackground(form.category, isDark)
                  ? { backgroundColor: rowBackground(form.category, isDark) }
                  : undefined
              }
            >
              <td className="p-2">
                <input
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Nuevo producto"
                  className={inputAutoClass}
                />
              </td>
              <td className="p-2">
                {categorySelect(form.category, (value) =>
                  setForm((prev) => ({ ...prev, category: value })),
                )}
              </td>
              <td className="p-2">
                <input
                  name="price"
                  type="number"
                  value={form.price}
                  onChange={handleChange}
                  placeholder="Precio"
                  className={inputClass}
                />
              </td>
              <td className="p-2">
                <input
                  name="stockInitial"
                  type="number"
                  value={form.stockInitial}
                  onChange={handleChange}
                  placeholder="Inicial"
                  className={inputClass}
                />
              </td>
              <td className="p-2">
                <input
                  name="minStock"
                  type="number"
                  value={form.minStock}
                  onChange={handleChange}
                  placeholder="Mínimo"
                  className={inputClass}
                />
              </td>
              <td className="p-2">
                <input
                  name="stock"
                  type="number"
                  value={form.stock}
                  onChange={handleChange}
                  placeholder="Actual"
                  className={inputClass}
                />
              </td>
              <td className="p-2">
                <input
                  name="enable"
                  type="checkbox"
                  checked={form.enable === true}
                  onChange={handleChange}
                  className="h-4 w-4 accent-neutral-900 dark:accent-neutral-100"
                />
              </td>
              <td className="p-2">
                <button
                  type="submit"
                  disabled={saving}
                  aria-label="Guardar producto"
                  className="text-neutral-900 transition-colors hover:text-green-600 dark:text-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? '...' : <SaveIcon />}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      </form>
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}