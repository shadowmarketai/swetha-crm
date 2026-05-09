import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Spinner } from './common'

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <Spinner size="xl" />
        <p className="mt-4 text-gray-500">Loading...</p>
      </div>
    </div>
  )
}

/**
 * ProtectedRoute — base auth guard.
 * Requires the user to be logged in. Used for any authenticated page.
 */
export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" replace />
  return children
}
