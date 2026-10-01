import { Navigate, createBrowserRouter, RouterProvider } from 'react-router-dom'
import AuthProvider from './contexts/AuthProvider'
import ThemeProvider from './contexts/ThemeProvider'
import HeaderLayout from './layouts/HeaderLayout'
import LoginPage from './pages/LoginPage'
import HelpPage from './pages/HelpPage'
import CategoriesPage from './pages/CategoriesPage'
import LocalesPage from './pages/LocalesPage'
import ProductsPage from './pages/ProductsPage'
import StockPage from './pages/StockPage'
import ProtectedRoute from './routes/ProtectedRoute'

const router = createBrowserRouter([
  {
    element: <HeaderLayout />,
    children: [
      { path: '/login', element: <LoginPage /> },
      {
        element: <ProtectedRoute />,
        children: [
          {
            path: '/',
            element: <ProductsPage />,
          },
          {
            // Stock va aparte de Productos a proposito: esta pagina se
            // suscribe a Firestore y se actualiza sola con cada venta, y eso
            // solo es seguro si no hay campos de texto que un snapshot pueda
            // pisar mientras el operador escribe.
            path: '/stock',
            element: <StockPage />,
          },
          {
            path: '/help',
            element: <HelpPage />,
          },
          {
            path: '/categories',
            element: <CategoriesPage />,
          },
          {
            path: '/locales',
            element: <LocalesPage />,
          },
          {
            path: '/products',
            element: <Navigate to="/" replace />,
          },
        ],
      },
    ],
  },
])

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App