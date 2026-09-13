import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import AuthProvider from './contexts/AuthProvider'
import HeaderLayout from './layouts/HeaderLayout'
import LoginPage from './pages/LoginPage'
import HomePage from './pages/HomePage'
import HelpPage from './pages/HelpPage'
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
            element: <HomePage />,
          },
          {
            path: '/help',
            element: <HelpPage />,
          },
        ],
      },
    ],
  },
])

function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  )
}

export default App