import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/auth'
import FloatingInput from '../components/FloatingInput'

const buttonStyles = {
  base: 'h-[50px] min-w-[165px] border-2 border-neutral-900 bg-neutral-900 px-4 text-sm font-bold uppercase tracking-wide text-white transition-all hover:bg-white hover:text-neutral-900',
}

const FIREBASE_ERRORS = {
  'auth/invalid-email': 'El email ingresado no es válido.',
  'auth/user-disabled': 'Esta cuenta fue deshabilitada.',
  'auth/user-not-found': 'No existe una cuenta con ese email.',
  'auth/wrong-password': 'La contraseña es incorrecta.',
  'auth/too-many-requests': 'Demasiados intentos. Intente nuevamente más tarde.',
  'auth/network-request-failed': 'Error de conexión. Verifique su internet.',
}

export default function LoginPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signIn(form.email, form.password)
      navigate('/', { replace: true })
    } catch (err) {
      setError(FIREBASE_ERRORS[err.code] || 'No se pudo iniciar sesión. Intente nuevamente.')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="flex w-[320px] flex-col items-stretch"
        noValidate
      >
        <h2 className="mb-6 text-xl font-medium text-neutral-900">
          Ingrese su email y password
        </h2>
        <FloatingInput
          label="Email"
          type="email"
          name="email"
          value={form.email}
          onChange={handleChange}
          required
          autoComplete="email"
        />
        <FloatingInput
          label="Password"
          type="password"
          name="password"
          value={form.password}
          onChange={handleChange}
          required
          autoComplete="current-password"
        />
        {error && (
          <p className="mb-4 text-sm font-semibold text-red-600">{error}</p>
        )}
        <button type="submit" className={buttonStyles.base} disabled={loading}>
          {loading ? 'Ingresando...' : 'Ingresar'}
        </button>
      </form>
    </div>
  )
}