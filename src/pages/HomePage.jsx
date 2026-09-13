import { useAuth } from '../contexts/auth'

export default function HomePage() {
  const { currentUser } = useAuth()

  return (
    <div className="p-6">
      <h1 className="mb-2 text-3xl font-bold text-neutral-900">
        Bienvenido, {currentUser?.displayName}
      </h1>
      <p className="text-neutral-500">
        Esta es la pantalla de inicio. Aquí se integrará la funcionalidad del
        punto de venta.
      </p>
    </div>
  )
}