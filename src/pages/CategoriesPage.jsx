import { useEffect, useState } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../config/firebase'
import { dbCollectionPath } from '../config/database'

export default function CategoriesPage() {
  const [categories, setCategories] = useState([])

  useEffect(() => {
    let active = true
    const categoriesRef = collection(db, dbCollectionPath('categories'))
    getDocs(categoriesRef).then((snapshot) => {
      if (!active) return
      const items = snapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data().name,
        color: doc.data().color,
        order: doc.data().order,
      }))
      setCategories(items)
    })
    return () => {
      active = false
    }
  }, [])

  const rows = [...categories].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

  return (
    <div className="p-6">
      <h1 className="mb-4 text-3xl font-bold text-neutral-900">Categorías</h1>
      <table className="w-full max-w-2xl border-collapse">
        <thead>
          <tr className="border-b border-neutral-300 bg-neutral-100 text-left">
            <th className="p-2 text-sm font-semibold uppercase tracking-wide text-neutral-900">
              Categoría
            </th>
            <th className="p-2 text-sm font-semibold uppercase tracking-wide text-neutral-900">
              Color
            </th>
            <th className="p-2 text-sm font-semibold uppercase tracking-wide text-neutral-900">
              Orden
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((category) => (
            <tr key={category.id} className="border-b border-neutral-200">
              <td className="p-2 text-neutral-700">{category.name}</td>
              <td className="p-2 text-neutral-700">{category.color}</td>
              <td className="p-2 text-neutral-700">{category.order}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}