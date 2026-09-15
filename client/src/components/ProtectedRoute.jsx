import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function getRoleHome(role) {
  switch (role) {
    case 'student':
      return '/student/dashboard'
    case 'academic_supervisor':
      return '/supervisor'
    case 'professional_supervisor':
      return '/professional-supervisor'
    case 'admin':
      return '/admin'
    default:
      return '/login'
  }
}

function ProtectedRoute({ children, allowedRoles }) {
  const { user, token } = useAuth()
  const { pathname } = useLocation()

  if (!token || !user) {
    return <Navigate to="/login" replace />
  }

  const primaryRole = user?.role || user?.student?.role

  // A supervisor account provisioned on demand confirms its profile before it
  // reaches any dashboard. Enforced here as well as on the server, so the holder
  // is guided to the form rather than shown a 403-shaped empty page.
  //
  // /change-password is exempt and must stay exempt: a brand-new supervisor needs
  // BOTH gates, and the login flow sends them to the password change first.
  // Redirecting that path to /onboarding would skip the temporary-password change
  // entirely.
  const ONBOARDING_EXEMPT_PATHS = ['/onboarding', '/change-password']

  if (user?.requiresOnboarding === true && !ONBOARDING_EXEMPT_PATHS.includes(pathname)) {
    return <Navigate to="/onboarding" replace />
  }

  // `role` is the account's primary role and decides where it lands; `roles` is
  // everything it may act as. A lecturer can be the academic supervisor for one
  // student and the professional supervisor for another, so admission is granted
  // when any effective role is allowed rather than only the primary one.
  const roles =
    Array.isArray(user?.roles) && user.roles.length > 0 ? user.roles : [primaryRole]

  if (allowedRoles && !allowedRoles.some((role) => roles.includes(role))) {
    return <Navigate to={getRoleHome(primaryRole)} replace />
  }

  return children
}

export default ProtectedRoute
