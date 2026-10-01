import { useEffect, useMemo, useRef, useState } from 'react'
import { useBlocker } from 'react-router-dom'
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
} from 'firebase/firestore'
import { db } from '../config/firebase'
import { dbCollectionPath } from '../config/database'
import { normalizeNumber } from '../lib/productFormat'
import Toast from '../components/Toast'

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

// El id del documento de locales se construye a partir del nombre en minusculas
// para mantener la misma convencion que Categorias (clave canonica sin espacios).
// La pantalla muestra el nombre en MAYUSCULAS y las comparaciones son
// case-insensitive para evitar duplicados por mayusculas/minusculas.
const slugifyLocal = (name) => name.trim().toLowerCase().replace(/\s+/g, '_')

export default function LocalesPage() {
  const [locales, setLocales] = useState([])
  const [edits, setEdits] = useState({})
  const [form, setForm] = useState({ name: '', address: '', order: '' })
  const [saving, setSaving] = useState(false)
  const [savingId, setSavingId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [toast, setToast] = useState(null)
  const toastTimer = useRef(null)

  useEffect(() => {
    let active = true
    const localesRef = collection(db, dbCollectionPath('locales'))
    getDocs(localesRef)
      .then((snapshot) => {
        if (!active) return
        const items = snapshot.docs.map((item) => {
          const data = item.data()
          const orderVal = data.order
          return {
            id: item.id,
            name: String(data.name ?? '').toUpperCase(),
            address: String(data.address ?? ''),
            order: orderVal,
          }
        })
        setLocales(items)
        setEdits(
          Object.fromEntries(
            items.map((item) => [
              item.id,
              { ...item, order: item.order ?? '' },
            ]),
          ),
        )
      })
      .catch(() => {
        if (active) {
          setToast({
            type: 'error',
            message: 'No se pudo cargar los locales.',
          })
        }
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!toast || toast.type !== 'success') return
    toastTimer.current = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(toastTimer.current)
  }, [toast])

  const { isDirty, isRowDirty } = useMemo(() => {
    const isRowDirtyFn = (id) => {
      const draft = edits[id]
      if (!draft) return false
      const saved = locales.find((local) => local.id === id)
      if (!saved) return true
      return (
        draft.name.trim() !== saved.name ||
        draft.address.trim() !== (saved.address ?? '') ||
        normalizeNumber(draft.order) !== (saved.order ?? null)
      )
    }
    const edited = locales.some((local) => isRowDirtyFn(local.id))
    const newRow =
      form.name.trim() !== '' ||
      form.address.trim() !== '' ||
      form.order !== ''
    return { isDirty: edited || newRow, isRowDirty: isRowDirtyFn }
  }, [locales, edits, form])

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
    if (name === 'name') {
      setForm((prev) => ({ ...prev, name: value.toUpperCase() }))
      return
    }
    setForm((prev) => ({ ...prev, [name]: value }))
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

  const handleDismissToast = () => setToast(null)

  const handleSubmit = async (event) => {
    event.preventDefault()
    const trimmedName = form.name.trim()
    if (!trimmedName) {
      setToast({
        type: 'error',
        message: 'El nombre del local es obligatorio.',
      })
      return
    }
    const id = slugifyLocal(trimmedName)
    const nameLower = trimmedName.toLowerCase()
    const address = form.address.trim()
    const order = normalizeNumber(form.order)

    if (
      locales.some(
        (local) => local.id === id || local.name.toLowerCase() === nameLower,
      )
    ) {
      setToast({ type: 'error', message: 'Ya existe un local con ese nombre.' })
      return
    }

    setSaving(true)
    try {
      const localesRef = collection(db, dbCollectionPath('locales'))
      await setDoc(doc(localesRef, id), {
        name: nameLower,
        address,
        order,
      })
      setLocales((prev) => [
        ...prev,
        { id, name: trimmedName.toUpperCase(), address, order },
      ])
      setEdits((prev) => ({
        ...prev,
        [id]: {
          id,
          name: trimmedName.toUpperCase(),
          address,
          order: order ?? '',
        },
      }))
      setForm({ name: '', address: '', order: '' })
      setToast({
        type: 'success',
        message: 'Local agregado correctamente.',
      })
    } catch {
      setToast({ type: 'error', message: 'No se pudo guardar el local.' })
    } finally {
      setSaving(false)
    }
  }

  const handleSave = async (id) => {
    const draft = edits[id]
    if (!draft) return
    const trimmedName = draft.name.trim()
    if (!trimmedName) {
      setToast({
        type: 'error',
        message: 'El nombre del local es obligatorio.',
      })
      return
    }
    const newId = slugifyLocal(trimmedName)
    const nameLower = trimmedName.toLowerCase()
    const address = draft.address.trim()
    const order = normalizeNumber(draft.order)

    if (
      locales.some(
        (local) =>
          local.id !== id &&
          (local.id === newId || local.name.toLowerCase() === nameLower),
      )
    ) {
      setToast({ type: 'error', message: 'Ya existe un local con ese nombre.' })
      return
    }

    setSavingId(id)
    try {
      const localesRef = collection(db, dbCollectionPath('locales'))
      if (newId === id) {
        await setDoc(doc(localesRef, id), {
          name: nameLower,
          address,
          order,
        })
        setLocales((prev) =>
          prev.map((local) =>
            local.id === id
              ? {
                  id,
                  name: trimmedName.toUpperCase(),
                  address,
                  order,
                }
              : local,
          ),
        )
        setEdits((prev) => ({
          ...prev,
          [id]: {
            id,
            name: trimmedName.toUpperCase(),
            address,
            order: order ?? '',
          },
        }))
        setToast({
          type: 'success',
          message: 'Local actualizado correctamente.',
        })
      } else {
        await deleteDoc(doc(localesRef, id))
        await setDoc(doc(localesRef, newId), {
          name: nameLower,
          address,
          order,
        })
        setLocales((prev) =>
          prev
            .filter((local) => local.id !== id)
            .concat([
              {
                id: newId,
                name: trimmedName.toUpperCase(),
                address,
                order,
              },
            ]),
        )
        setEdits((prev) => {
          const next = { ...prev }
          delete next[id]
          return {
            ...next,
            [newId]: {
              id: newId,
              name: trimmedName.toUpperCase(),
              address,
              order: order ?? '',
            },
          }
        })
        setToast({
          type: 'success',
          message: 'Local actualizado correctamente.',
        })
      }
    } catch {
      setToast({ type: 'error', message: 'No se pudo actualizar el local.' })
    } finally {
      setSavingId(null)
    }
  }

  const handleDelete = async (id) => {
    const draft = edits[id]
    const displayName = draft?.name?.trim() || locales.find((l) => l.id === id)?.name || id
    if (
      !window.confirm(
        `¿Eliminar el local "${displayName}"?`,
      )
    ) {
      return
    }
    setDeletingId(id)
    try {
      const localesRef = collection(db, dbCollectionPath('locales'))
      await deleteDoc(doc(localesRef, id))
      setLocales((prev) => prev.filter((local) => local.id !== id))
      setEdits((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      setToast({
        type: 'success',
        message: 'Local eliminado correctamente.',
      })
    } catch {
      setToast({ type: 'error', message: 'No se pudo eliminar el local.' })
    } finally {
      setDeletingId(null)
    }
  }

  const rows = [...locales].sort((a, b) => {
    const oa = normalizeNumber(a.order) ?? 0
    const ob = normalizeNumber(b.order) ?? 0
    if (oa !== ob) return oa - ob
    const na = a.name.toLowerCase()
    const nb = b.name.toLowerCase()
    if (na < nb) return -1
    if (na > nb) return 1
    return 0
  })

  return (
    <div className="p-6">
      <h1 className="mb-4 text-3xl font-bold text-neutral-900 dark:text-neutral-100">
        Locales
      </h1>
      <form onSubmit={handleSubmit}>
        <table className="w-full max-w-3xl border-collapse">
          <thead>
            <tr className="border-b border-neutral-300 bg-neutral-100 text-left dark:border-neutral-700 dark:bg-neutral-800">
              <th className="p-2 text-sm font-semibold uppercase tracking-wide text-neutral-900 dark:text-neutral-100">
                Local
              </th>
              <th className="p-2 text-sm font-semibold uppercase tracking-wide text-neutral-900 dark:text-neutral-100">
                Dirección
              </th>
              <th className="p-2 text-sm font-semibold uppercase tracking-wide text-neutral-900 dark:text-neutral-100">
                Orden
              </th>
              <th className="p-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((local) => {
              const draft = edits[local.id] ?? local
              return (
                <tr
                  key={local.id}
                  className="border-b border-neutral-200 dark:border-neutral-700"
                >
                  <td className="p-2">
                    <div className="flex items-center gap-2">
                      <input
                        value={draft.name}
                        onChange={(event) =>
                          handleEditChange(local.id, 'name', event.target.value)
                        }
                        className={inputClass}
                      />
                      {isRowDirty(local.id) && (
                        <span
                          title="Cambios sin guardar"
                          className="h-2 w-2 shrink-0 rounded-full bg-amber-500"
                        />
                      )}
                    </div>
                  </td>
                  <td className="p-2">
                    <input
                      value={draft.address}
                      onChange={(event) =>
                        handleEditChange(
                          local.id,
                          'address',
                          event.target.value,
                        )
                      }
                      placeholder="Dirección"
                      className={inputClass}
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      value={draft.order}
                      onChange={(event) =>
                        handleEditChange(local.id, 'order', event.target.value)
                      }
                      className={inputClass}
                    />
                  </td>
                  <td className="p-2">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleSave(local.id)}
                        disabled={
                          savingId === local.id || deletingId === local.id
                        }
                        aria-label="Guardar local"
                        className="text-neutral-900 transition-colors hover:text-green-600 dark:text-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {savingId === local.id ? '...' : <SaveIcon />}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(local.id)}
                        disabled={
                          savingId === local.id || deletingId === local.id
                        }
                        aria-label="Eliminar local"
                        className="text-neutral-900 transition-colors hover:text-red-600 dark:text-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {deletingId === local.id ? '...' : <DeleteIcon />}
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
            <tr className="border-b border-neutral-200 dark:border-neutral-700">
              <td className="p-2">
                <input
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Nuevo local"
                  className={inputClass}
                />
              </td>
              <td className="p-2">
                <input
                  name="address"
                  value={form.address}
                  onChange={handleChange}
                  placeholder="Dirección"
                  className={inputClass}
                />
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
                  aria-label="Guardar local"
                  className="text-neutral-900 transition-colors hover:text-green-600 dark:text-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? '...' : <SaveIcon />}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </form>
      <Toast toast={toast} onDismiss={handleDismissToast} />
    </div>
  )
}
