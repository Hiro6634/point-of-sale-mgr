import { Link, Outlet, useNavigate } from 'react-router-dom'
import { DB_ENV } from '../config/database'
import { useAuth } from '../contexts/auth'

export default function HeaderLayout() {
  const { currentUser, signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
        <Link to="/" className="text-2xl font-bold tracking-wide text-neutral-900">
          AJB-POS
        </Link>
        <nav className="flex items-center gap-6">
          {currentUser ? (
            <>
              <Link
                to="/categories"
                className="text-sm font-semibold uppercase tracking-wide text-neutral-900"
              >
                Categorías
              </Link>
              <Link
                to="/help"
                className="text-sm font-semibold uppercase tracking-wide text-neutral-900"
              >
                Ayuda
              </Link>
              <button
                type="button"
                onClick={handleSignOut}
                className="text-sm font-semibold uppercase tracking-wide text-neutral-900"
              >
                Salir
              </button>
            </>
          ) : (
            <Link
              to="/login"
              className="text-sm font-semibold uppercase tracking-wide text-neutral-900"
            >
              Ingresar
            </Link>
          )}
        </nav>
      </header>
      <main className="flex flex-1 flex-col">
        <Outlet />
      </main>
      <footer className="px-4 py-2 text-center text-xs text-neutral-400">
        v{__APP_VERSION__} · {__BUILD_COMMIT__}
        {DB_ENV === 'dev' ? ` · ${DB_ENV}` : null}
      </footer>
    </div>
  )
}