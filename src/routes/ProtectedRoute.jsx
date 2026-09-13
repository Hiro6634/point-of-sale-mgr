import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/auth'

export default function ProtectedRoute() {
  const { currentUser, initializing } = useAuth()
  const location = useLocation()

  if (initializing) {
    return null
  }

  if (!currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <Outlet />
}