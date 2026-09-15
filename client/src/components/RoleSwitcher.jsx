import { useLocation, useNavigate } from 'react-router-dom'
import { Users, GraduationCap } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

// One person can hold both supervisor roles at once: `User.email` is UNIQUE, so
// a lecturer who is the academic supervisor for one student and the professional
// supervisor for another has a single account, but the two dashboards are
// separate routes. This gives that account a way across; it renders nothing for
// the ordinary single-role user.
export default function RoleSwitcher() {
  const { user } = useAuth()
  const { pathname } = useLocation()
  const navigate = useNavigate()

  const roles = Array.isArray(user?.roles) && user.roles.length ? user.roles : [user?.role]

  const options = []

  if (roles.includes('professional_supervisor') && !pathname.startsWith('/professional-supervisor')) {
    options.push({ label: 'Professional Dashboard', path: '/professional-supervisor', icon: Users })
  }

  if (roles.includes('academic_supervisor') && !pathname.startsWith('/supervisor')) {
    options.push({ label: 'Academic Dashboard', path: '/supervisor', icon: GraduationCap })
  }

  if (options.length === 0) return null

  return (
    <>
      {options.map((option) => (
        <button
          key={option.path}
          type="button"
          className="sidebar-nav-item"
          onClick={() => navigate(option.path)}
        >
          <option.icon size={18} className="nav-icon" />
          <span className="nav-label">{option.label}</span>
        </button>
      ))}
    </>
  )
}
