import { Navigate, createBrowserRouter, RouterProvider } from 'react-router-dom'
import AuthProvider from './contexts/AuthProvider'
import ThemeProvider from './contexts/ThemeProvider'
import HeaderLayout from './layouts/HeaderLayout'
import LoginPage from './pages/LoginPage'
import HelpPage from './pages/HelpPage'
import CategoriesPage from './pages/CategoriesPage'
import ProductsPage from './pages/ProductsPage'
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
            path: '/help',
            element: <HelpPage />,
          },
          {
            path: '/categories',
            element: <CategoriesPage />,
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