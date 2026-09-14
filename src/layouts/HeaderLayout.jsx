import { Link, Outlet, useNavigate } from 'react-router-dom'
import { DB_ENV } from '../config/database'
import { APP_VERSION, BUILD_COMMIT } from '../config/version'
import { useAuth } from '../contexts/auth'
import { useTheme } from '../contexts/theme'
import ajbLogo from '../assets/ajb.svg'

function MoonIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}

function SunIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  )
}

export default function HeaderLayout() {
  const { currentUser, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-700">
        <Link to="/" className="block">
          <img
            src={ajbLogo}
            alt="AJB-POS"
            className="h-10 w-auto"
          />
        </Link>
        <nav className="flex items-center gap-6">
          {currentUser ? (
            <>
              <Link
                to="/"
                className="text-sm font-semibold uppercase tracking-wide text-neutral-900 dark:text-neutral-100"
              >
                Productos
              </Link>
              <Link
                to="/categories"
                className="text-sm font-semibold uppercase tracking-wide text-neutral-900 dark:text-neutral-100"
              >
                Categorías
              </Link>
              <Link
                to="/help"
                className="text-sm font-semibold uppercase tracking-wide text-neutral-900 dark:text-neutral-100"
              >
                Ayuda
              </Link>
              <button
                type="button"
                onClick={handleSignOut}
                className="text-sm font-semibold uppercase tracking-wide text-neutral-900 dark:text-neutral-100"
              >
                Salir
              </button>
            </>
          ) : (
            <Link
              to="/login"
              className="text-sm font-semibold uppercase tracking-wide text-neutral-900 dark:text-neutral-100"
            >
              Ingresar
            </Link>
          )}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            className="text-neutral-900 transition-colors hover:text-neutral-500 dark:text-neutral-100 dark:hover:text-neutral-400"
          >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
        </nav>
      </header>
      <main className="flex flex-1 flex-col">
        <Outlet />
      </main>
      <footer className="px-4 py-2 text-center text-xs text-neutral-400 dark:text-neutral-500">
        v{APP_VERSION}
        {BUILD_COMMIT ? ` · ${BUILD_COMMIT}` : ''}
        {DB_ENV === 'dev' ? ` · ${DB_ENV}` : ''}
      </footer>
    </div>
  )
}