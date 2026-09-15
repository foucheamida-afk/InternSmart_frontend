import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  ArrowRight,
  Building2,
  Check,
  ChevronLeft,
  LogOut,
  Phone,
  ShieldCheck,
  User as UserIcon,
} from 'lucide-react'
import logoImg from '../assets/images/logo.png'
import { useAuth } from '../context/AuthContext'
import { getStoredToken, getStoredUser, setStoredAuth, clearStoredAuth } from '../utils/storage'

// Profile onboarding for a supervisor account that was created on demand.
//
// The account is handed temporary credentials by the system (the admin assigning
// an academic supervisor, a CSV import, or a student submitting a professional
// supervisor's email). The holder changes that password, then lands here to
// complete and confirm their details before their dashboard opens up.
//
// The gate itself is enforced server-side (roleMiddleware refuses the supervisor
// surfaces with code ONBOARDING_REQUIRED) and mirrored by ProtectedRoute; this
// page is the only screen a gated account can reach besides change-password.
const roleHome = (role) => {
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

const roleLabel = (role) =>
  role === 'professional_supervisor' ? 'Professional Supervisor' : 'Academic Supervisor'

const Onboarding = () => {
  const navigate = useNavigate()
  const { logout, refreshUser } = useAuth()

  const [values, setValues] = useState({
    name: '',
    phone: '',
    organisation: '',
    jobTitle: '',
  })

  const [role, setRole] = useState('')
  const [email, setEmail] = useState('')
  const [step, setStep] = useState('form')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      const token = getStoredToken()
      if (!token) {
        navigate('/login')
        return
      }

      // Prefill from the account so the supervisor only fills in what is
      // genuinely missing, and to confirm this really is a supervisor account.
      const stored = getStoredUser()
      if (stored) {
        setRole(stored.role || '')
        setEmail(stored.email || '')
        setValues((prev) => ({ ...prev, name: stored.name || '' }))
      }

      try {
        const response = await fetch('http://localhost:3000/api/users/me', {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        })

        if (response.status === 401) {
          clearStoredAuth()
          navigate('/login')
          return
        }

        const data = await response.json()

        if (response.ok && data.user) {
          setRole(data.user.role || '')
          setEmail(data.user.email || '')
          setValues({
            name: data.user.name || '',
            phone: data.user.phone || '',
            organisation: data.user.organisation || '',
            jobTitle: data.user.jobTitle || '',
          })
        }
      } catch {
        // The stored values above are enough to render the form; a failed
        // refresh must not block a supervisor from completing onboarding.
        setError('Could not refresh your details from the server.')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [navigate])

  const handleChange = (event) => {
    const { name, value } = event.target
    setValues((prev) => ({ ...prev, [name]: value }))
    setError('')
  }

  const isComplete = ['name', 'phone', 'organisation', 'jobTitle'].every(
    (field) => values[field].trim().length > 0
  )

  const handleReview = (event) => {
    event.preventDefault()
    if (!isComplete) {
      setError('Please complete every field before continuing.')
      return
    }
    setError('')
    setStep('confirm')
  }

  const handleConfirm = async () => {
    setSaving(true)
    setError('')

    try {
      const token = getStoredToken()

      const response = await fetch('http://localhost:3000/api/users/me/onboarding', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: values.name.trim(),
          phone: values.phone.trim(),
          organisation: values.organisation.trim(),
          jobTitle: values.jobTitle.trim(),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.message || 'Unable to save your profile.')
        setStep('form')
        return
      }

      // Clear the gate locally so ProtectedRoute lets the dashboard through on
      // the very next navigation. `refreshUser` updates the AuthContext state as
      // well as storage - writing storage alone would leave the in-memory user
      // still flagged and ProtectedRoute would bounce straight back here.
      const stored = getStoredUser() || {}
      const updated = {
        ...stored,
        name: data.user?.name || values.name.trim(),
        requiresOnboarding: false,
      }
      setStoredAuth(updated, token)
      refreshUser(updated)

      navigate(roleHome(updated.role), { replace: true })
    } catch {
      setError('Unable to connect to the server.')
      setStep('form')
    } finally {
      setSaving(false)
    }
  }

  const handleSignOut = () => {
    logout()
    navigate('/login')
  }

  const field = (key, label, placeholder, Icon, type = 'text') => (
    <div>
      <label htmlFor={key} className="block text-sm font-semibold text-slate-700 mb-2">
        {label}
      </label>
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
          <Icon className="h-4 w-4" />
        </div>
        <input
          id={key}
          name={key}
          type={type}
          value={values[key]}
          onChange={handleChange}
          placeholder={placeholder}
          className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-[#0B1F33] focus:ring-2 focus:ring-[#F5A623]/20"
        />
      </div>
    </div>
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-[#EFF4FA] flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#F5A623] border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#EFF4FA] px-4 py-8 flex items-center justify-center">
      <div className="w-full max-w-md">
        <div className="rounded-[24px] border border-slate-200/80 bg-white/95 p-8 shadow-[0_20px_50px_rgba(0,0,0,0.06)]">
          <div className="flex items-center gap-3 mb-6">
            <img src={logoImg} alt="InternSmart logo" className="h-11 w-11 rounded-2xl bg-[#F5A623] shadow-sm" />
            <div>
              <p className="text-xl font-bold tracking-tight text-slate-950">InternSmart</p>
              <p className="text-xs text-slate-500">{roleLabel(role)} onboarding</p>
            </div>
          </div>

          <div className="flex items-center gap-2 mb-6">
            <span className={`h-1.5 flex-1 rounded-full ${step === 'form' ? 'bg-[#F5A623]' : 'bg-[#F5A623]'}`} />
            <span className={`h-1.5 flex-1 rounded-full ${step === 'confirm' ? 'bg-[#F5A623]' : 'bg-slate-200'}`} />
          </div>

          {error && (
            <div className="mb-5 flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          {step === 'form' ? (
            <>
              <div className="space-y-2 mb-6">
                <h1 className="text-2xl font-bold tracking-tight text-[#071A2D]">
                  Confirm your details
                </h1>
                <p className="text-sm text-slate-600">
                  Your account was created for you{email ? ` as ${email}` : ''}. Please complete
                  your profile so your students and the institution can identify you.
                </p>
              </div>

              <form onSubmit={handleReview} className="space-y-5">
                {field('name', 'Full name', 'e.g. Prof. Ada Lovelace', UserIcon)}
                {field('phone', 'Contact phone', 'e.g. +237 6 12 34 56 78', Phone, 'tel')}
                {field('organisation', 'Organisation or department', 'e.g. University of Buea — Computer Science', Building2)}
                {field('jobTitle', 'Job title / role', 'e.g. Senior Lecturer', ShieldCheck)}

                <button
                  type="submit"
                  disabled={!isComplete}
                  className="w-full rounded-2xl bg-[#F5A623] px-4 py-3.5 text-base font-semibold text-white transition hover:bg-[#e69d1b] shadow-[0_10px_25px_rgba(245,166,35,0.3)] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>Review</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="space-y-2 mb-6">
                <h1 className="text-2xl font-bold tracking-tight text-[#071A2D]">
                  Is this correct?
                </h1>
                <p className="text-sm text-slate-600">
                  These details appear to the students and supervisors you work with.
                </p>
              </div>

              <dl className="space-y-3 mb-6 rounded-2xl bg-slate-50 p-4">
                {[
                  ['Full name', values.name],
                  ['Contact phone', values.phone],
                  ['Organisation', values.organisation],
                  ['Job title', values.jobTitle],
                  ['Email', email],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-start justify-between gap-4">
                    <dt className="text-xs font-semibold text-slate-500">{label}</dt>
                    <dd className="text-sm text-slate-900 text-right break-words">{value}</dd>
                  </div>
                ))}
              </dl>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep('form')}
                  disabled={saving}
                  className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 cursor-pointer"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={saving}
                  className="flex-1 rounded-2xl bg-[#F5A623] px-4 py-3.5 text-base font-semibold text-white transition hover:bg-[#e69d1b] shadow-[0_10px_25px_rgba(245,166,35,0.3)] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      Confirm and continue
                    </>
                  )}
                </button>
              </div>
            </>
          )}

          <button
            type="button"
            onClick={handleSignOut}
            className="mt-6 w-full flex items-center justify-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-900 transition cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}

export default Onboarding
