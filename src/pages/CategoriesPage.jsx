import { useEffect, useMemo, useRef, useState } from 'react'
import { useBlocker } from 'react-router-dom'
import {
  collection,
  doc,
  getDocs,
  setDoc,
  writeBatch,
} from 'firebase/firestore'
import { db } from '../config/firebase'
import { dbCollectionPath } from '../config/database'
import { COLORS, colorBackground } from '../config/colors'
import { useTheme } from '../contexts/theme'

const inputClass =
  'w-full bg-transparent text-neutral-700 outline-none dark:text-neutral-100'

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

function Toast({ toast }) {
  if (!toast) return null
  const isSuccess = toast.type === 'success'
  return (
    <div
      className={`fixed bottom-16 left-1/2 z-50 -translate-x-1/2 rounded-md px-4 py-2 text-sm font-medium text-white shadow-lg ${
        isSuccess ? 'bg-green-600' : 'bg-red-600'
      }`}
    >
      {toast.message}
    </div>
  )
}

export default function CategoriesPage() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [categories, setCategories] = useState([])
  const [edits, setEdits] = useState({})
  const [form, setForm] = useState({ name: '', color: '', order: '' })
  const [saving, setSaving] = useState(false)
  const [savingId, setSavingId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [toast, setToast] = useState(null)
  const toastTimer = useRef(null)

  useEffect(() => {
    let active = true
    const categoriesRef = collection(db, dbCollectionPath('categories'))
    getDocs(categoriesRef)
      .then((snapshot) => {
        if (!active) return
        const items = snapshot.docs.map((item) => ({
          id: item.id,
          name: String(item.data().name ?? '').toUpperCase(),
          color: item.data().color,
          order: item.data().order,
        }))
        setCategories(items)
        setEdits(
          Object.fromEntries(
            items.map((item) => [item.id, { ...item, order: item.order ?? '' }]),
          ),
        )
      })
      .catch(() => {
        if (active) {
          setToast({ type: 'error', message: 'No se pudo cargar las categorías.' })
        }
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!toast) return
    toastTimer.current = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(toastTimer.current)
  }, [toast])

  const { isDirty, isRowDirty } = useMemo(() => {
    const normalizeOrder = (value) =>
      value === '' || value == null ? null : Number(value)
    const isRowDirtyFn = (id) => {
      const draft = edits[id]
      if (!draft) return false
      const saved = categories.find((category) => category.id === id)
      if (!saved) return true
      return (
        draft.name.trim() !== saved.name ||
        draft.color.trim() !== (saved.color ?? '') ||
        normalizeOrder(draft.order) !== (saved.order ?? null)
      )
    }
    const edited = categories.some((category) => isRowDirtyFn(category.id))
    const newRow =
      form.name.trim() !== '' || form.color !== '' || form.order !== ''
    return { isDirty: edited || newRow, isRowDirty: isRowDirtyFn }
  }, [categories, edits, form])

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
    const { name, value } = event.target
    setForm((prev) => ({
      ...prev,
      [name]: name === 'name' ? value.toUpperCase() : value,
    }))
  }

  const handleEditChange = (id, field, value) => {
    setEdits((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: field === 'name' ? value.toUpperCase() : value,
      },
    }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!form.name.trim()) {
      setToast({ type: 'error', message: 'El nombre de la categoría es obligatorio.' })
      return
    }
    setSaving(true)
    try {
      const categoriesRef = collection(db, dbCollectionPath('categories'))
      const name = form.name.trim().toUpperCase()
      const color = form.color.trim()
      const order = form.order === '' ? null : Number(form.order)

      if (
        categories.some(
          (category) => category.name.toLowerCase() === name.toLowerCase(),
        )
      ) {
        setToast({ type: 'error', message: 'Ya existe una categoría con ese nombre.' })
        return
      }

      await setDoc(doc(categoriesRef, name), { name, color, order })
      setCategories((prev) => [...prev, { id: name, name, color, order }])
      setEdits((prev) => ({ ...prev, [name]: { name, color, order: order ?? '' } }))
      setForm({ name: '', color: '', order: '' })
      setToast({ type: 'success', message: 'Categoría agregada correctamente.' })
    } catch {
      setToast({ type: 'error', message: 'No se pudo guardar la categoría.' })
    } finally {
      setSaving(false)
    }
  }

  const handleSave = async (id) => {
    const draft = edits[id]
    const name = draft.name.trim().toUpperCase()
    if (!name) {
      setToast({ type: 'error', message: 'El nombre de la categoría es obligatorio.' })
      return
    }
    const color = draft.color.trim()
    const order = draft.order === '' ? null : Number(draft.order)

    if (
      categories.some(
        (category) => category.id !== id &&
          category.name.toLowerCase() === name.toLowerCase(),
      )
    ) {
      setToast({ type: 'error', message: 'Ya existe una categoría con ese nombre.' })
      return
    }

    setSavingId(id)
    try {
      const categoriesRef = collection(db, dbCollectionPath('categories'))
      if (name === id) {
        await setDoc(doc(categoriesRef, id), { name, color, order })
        setToast({ type: 'success', message: 'Categoría actualizada correctamente.' })
      } else {
        const productsRef = collection(db, dbCollectionPath('products'))
        const productsSnapshot = await getDocs(productsRef)
        const linkedProducts = productsSnapshot.docs.filter(
          (item) =>
            String(item.data().category ?? '').toLowerCase() ===
            id.toLowerCase(),
        )
        const batch = writeBatch(db)
        batch.delete(doc(categoriesRef, id))
        batch.set(doc(categoriesRef, name), { name, color, order })
        linkedProducts.forEach((item) =>
          batch.update(doc(productsRef, item.id), {
            category: name.toUpperCase(),
          }),
        )
        await batch.commit()
        setToast({
          type: 'success',
          message:
            linkedProducts.length > 0
              ? `Categoría renombrada. ${linkedProducts.length} producto${
                  linkedProducts.length === 1 ? '' : 's'
                } actualizado${linkedProducts.length === 1 ? '' : 's'}.`
              : 'Categoría actualizada correctamente.',
        })
      }
      setCategories((prev) =>
        prev
          .filter((category) => category.id !== id)
          .concat([{ id: name, name, color, order }]),
      )
      setEdits((prev) => {
        const next = { ...prev }
        delete next[id]
        return { ...next, [name]: { name, color, order: order ?? '' } }
      })
    } catch {
      setToast({ type: 'error', message: 'No se pudo actualizar la categoría.' })
    } finally {
      setSavingId(null)
    }
  }

  const handleDelete = async (id) => {
    if (
      !window.confirm(
        `¿Eliminar la categoría "${edits[id]?.name?.trim() || id}"?`,
      )
    ) {
      return
    }
    setDeletingId(id)
    try {
      const name = edits[id]?.name?.trim() || id
      const categoriesRef = collection(db, dbCollectionPath('categories'))
      const productsRef = collection(db, dbCollectionPath('products'))
      const productsSnapshot = await getDocs(productsRef)
      const linkedProducts = productsSnapshot.docs.filter(
        (item) =>
          String(item.data().category ?? '').toLowerCase() ===
          name.toLowerCase(),
      )
      const batch = writeBatch(db)
      batch.delete(doc(categoriesRef, id))
      linkedProducts.forEach((item) =>
        batch.update(doc(productsRef, item.id), { category: '' }),
      )
      await batch.commit()
      setCategories((prev) => prev.filter((category) => category.id !== id))
      setEdits((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      setToast({
        type: 'success',
        message:
          linkedProducts.length > 0
            ? `Categoría eliminada. ${linkedProducts.length} producto${
                linkedProducts.length === 1 ? '' : 's'
              } pasaron a SIN CATEGORÍA.`
            : 'Categoría eliminada correctamente.',
      })
    } catch {
      setToast({ type: 'error', message: 'No se pudo eliminar la categoría.' })
    } finally {
      setDeletingId(null)
    }
  }

  const rows = [...categories].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

  return (
    <div className="p-6">
      <h1 className="mb-4 text-3xl font-bold text-neutral-900 dark:text-neutral-100">Categorías</h1>
      <form onSubmit={handleSubmit}>
        <table className="w-full max-w-2xl border-collapse">
          <thead>
            <tr className="border-b border-neutral-300 bg-neutral-100 text-left dark:border-neutral-700 dark:bg-neutral-800">
              <th className="p-2 text-sm font-semibold uppercase tracking-wide text-neutral-900 dark:text-neutral-100">
                Categoría
              </th>
              <th className="p-2 text-sm font-semibold uppercase tracking-wide text-neutral-900 dark:text-neutral-100">
                Color
              </th>
              <th className="p-2 text-sm font-semibold uppercase tracking-wide text-neutral-900 dark:text-neutral-100">
                Orden
              </th>
              <th className="p-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((category) => {
              const draft = edits[category.id] ?? category
              const bg = colorBackground(draft.color, isDark)
              return (
                <tr
                  key={category.id}
                  className="border-b border-neutral-200 dark:border-neutral-700"
                  style={bg ? { backgroundColor: bg } : undefined}
                >
                  <td className="p-2">
                    <div className="flex items-center gap-2">
                      <input
                        value={draft.name}
                        onChange={(event) =>
                          handleEditChange(category.id, 'name', event.target.value)
                        }
                        className={inputClass}
                      />
                      {isRowDirty(category.id) && (
                        <span
                          title="Cambios sin guardar"
                          className="h-2 w-2 shrink-0 rounded-full bg-amber-500"
                        />
                      )}
                    </div>
                  </td>
                  <td className="p-2">
                    <select
                      value={draft.color}
                      onChange={(event) =>
                        handleEditChange(category.id, 'color', event.target.value)
                      }
                      className={inputClass}
                    >
                      <option value="">Sin color</option>
                      {COLORS.map((color) => (
                        <option key={color.name} value={color.name}>
                          {color.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      value={draft.order}
                      onChange={(event) =>
                        handleEditChange(category.id, 'order', event.target.value)
                      }
                      className={inputClass}
                    />
                  </td>
                  <td className="p-2">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleSave(category.id)}
                        disabled={savingId === category.id || deletingId === category.id}
                        aria-label="Guardar categoría"
                        className="text-neutral-900 transition-colors hover:text-green-600 dark:text-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {savingId === category.id ? '...' : <SaveIcon />}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(category.id)}
                        disabled={savingId === category.id || deletingId === category.id}
                        aria-label="Eliminar categoría"
                        className="text-neutral-900 transition-colors hover:text-red-600 dark:text-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {deletingId === category.id ? '...' : <DeleteIcon />}
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
            <tr
              className="border-b border-neutral-200 dark:border-neutral-700"
              style={
                colorBackground(form.color, isDark)
                  ? { backgroundColor: colorBackground(form.color, isDark) }
                  : undefined
              }
            >
              <td className="p-2">
                <input
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Nueva categoría"
                  className={inputClass}
                />
              </td>
              <td className="p-2">
                <select
                  name="color"
                  value={form.color}
                  onChange={handleChange}
                  className={inputClass}
                >
                  <option value="">Sin color</option>
                  {COLORS.map((color) => (
                    <option key={color.name} value={color.name}>
                      {color.name}
                    </option>
                  ))}
                </select>
              </td>
              <td className="p-2">
                <input
                  name="order"
                  type="number"
                  value={form.order}
                  onChange={handleChange}
                  placeholder="Orden"
                  className={inputClass}
                />
              </td>
              <td className="p-2">
                <button
                  type="submit"
                  disabled={saving}
                  aria-label="Guardar categoría"
                  className="text-neutral-900 transition-colors hover:text-green-600 dark:text-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? '...' : <SaveIcon />}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </form>
      <Toast toast={toast} />
    </div>
  )
}