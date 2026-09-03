import { Navigate } from 'react-router-dom'

function ProtectedRoute({ children }) {
  const token = localStorage.getItem('token')
  const userStr = localStorage.getItem('user')
  
  if (!token || !userStr) {
    return <Navigate to="/login" replace />
  }
  
  try {
    const user = JSON.parse(userStr)
    if (user.role !== 'admin') {
      return <Navigate to="/" replace />
    }
  } catch {
    return <Navigate to="/login" replace />
  }
  
  return children
}

export default ProtectedRoute
