import React, { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Search, Plus, Trash2, UserRound, Edit, UserCheck, UserX, Mail } from 'lucide-react'
import { adminApi } from '../../services/adminService'

const EmptyState = ({ icon: Icon, title, description }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border" style={{
      backgroundColor: 'rgba(255, 122, 0, 0.08)',
      borderColor: 'rgba(255, 122, 0, 0.25)',
      color: 'var(--orange-3)'
    }}>
      <Icon size={28} />
    </div>
    <h3 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>{title}</h3>
    <p className="mt-2 max-w-sm text-sm" style={{ color: 'var(--text-muted)' }}>{description}</p>
  </div>
)

export default function AdminUsers() {
  const location = useLocation()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [newUser, setNewUser] = useState({ name: '', email: '', role: 'student', matricule: '', class: '' })
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [createSuccess, setCreateSuccess] = useState('')
  const [resendingId, setResendingId] = useState(null)
  const [editingUser, setEditingUser] = useState(null)
  const [editForm, setEditForm] = useState({ name: '', email: '', role: 'student', matricule: '', class: '', academicSupervisorId: '', professionalSupervisorId: '', company: '' })
  const [editing, setEditing] = useState(false)

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const params = { page, limit: 20 }
      if (search) params.search = search
      if (roleFilter) params.role = roleFilter
      const data = await adminApi.getUsers(params)
      setUsers(data.users || [])
      setTotalPages(data.totalPages || 1)
    } catch {
      setUsers([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [page, search, roleFilter, location.pathname])

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!newUser.name.trim() || !newUser.email.trim()) return
    if (newUser.role === 'student' && (!newUser.matricule.trim() || !newUser.class.trim())) return
    setCreating(true)
    setCreateError('')
    setCreateSuccess('')
    try {
      const result = await adminApi.createUser(newUser)
      setNewUser({ name: '', email: '', role: 'student', matricule: '', class: '' })
      setIsCreateOpen(false)
      fetchUsers()
      setCreateSuccess(result.emailSent === false
        ? 'User created successfully, but the account email was not sent. Use Resend email in the user actions.'
        : 'User created successfully and the account email was sent.')
    } catch (error) {
      setCreateError(error.response?.data?.message || 'Unable to create user.')
    } finally {
      setCreating(false)
    }
  }

  const handleResendEmail = async (user) => {
    setResendingId(user.id)
    setCreateError('')
    setCreateSuccess('')
    try {
      const result = await adminApi.resendUserAccountEmail(user.id)
      setCreateSuccess(result.message || `Account email sent successfully to ${user.email}.`)
    } catch (error) {
      setCreateError(error.response?.data?.message || 'Unable to send the account email.')
    } finally {
      setResendingId(null)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this user?')) return
    try {
      await adminApi.deleteUser(id)
      setUsers(prev => prev.filter(u => u.id !== id))
    } catch {
      // error
    }
  }

  const handleToggleStatus = async (user) => {
    const action = user.active ? 'deactivate' : 'activate'
    if (!window.confirm(`Are you sure you want to ${action} this account?`)) return

    try {
      const data = await adminApi.toggleUserStatus(user.id)
      setUsers(prev => prev.map(item => item.id === user.id ? { ...item, active: data.user.active } : item))
    } catch {
      // error handled by the API layer
    }
  }

  const openEditModal = (user) => {
    setEditingUser(user)
    setEditForm({
      name: user.name || '',
      email: user.email || '',
      role: user.role || 'student',
      matricule: user.student?.matricule || '',
      class: user.student?.class || '',
      academicSupervisorId: user.student?.internship?.academicSupervisorId || '',
      professionalSupervisorId: user.student?.internship?.professionalSupervisorId || '',
      company: user.student?.internship?.company || '',
    })
  }

  const handleUpdate = async (e) => {
    e.preventDefault()
    if (!editForm.name.trim() || !editForm.email.trim()) return
    setEditing(true)
    try {
      await adminApi.updateUser(editingUser.id, editForm)
      setEditingUser(null)
      fetchUsers()
    } catch {
      // error handled by service
    } finally {
      setEditing(false)
    }
  }

  const getRoleBadge = (role) => {
    const styles = {
      student: { bg: 'rgba(255, 122, 0, 0.12)', color: 'var(--orange-3)', border: 'rgba(255, 122, 0, 0.3)' },
      academic_supervisor: { bg: 'rgba(99, 102, 241, 0.12)', color: '#a5b4fc', border: 'rgba(99, 102, 241, 0.3)' },
      professional_supervisor: { bg: 'rgba(16, 185, 129, 0.12)', color: '#6ee7b7', border: 'rgba(16, 185, 129, 0.3)' },
      admin: { bg: 'rgba(239, 68, 68, 0.12)', color: '#fca5a5', border: 'rgba(239, 68, 68, 0.3)' },
    }
    const labels = {
      student: 'STUDENT',
      academic_supervisor: 'ACADEMIC SUPERVISOR',
      professional_supervisor: 'PROFESSIONAL SUPERVISOR',
      admin: 'ADMIN',
    }
    const s = styles[role] || styles.student
    const label = labels[role] || role?.toUpperCase() || 'UNKNOWN'
    return (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border" style={{
        backgroundColor: s.bg,
        color: s.color,
        borderColor: s.border
      }}>
        {label}
      </span>
    )
  }

  return (
    <div>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-[-0.06em]" style={{ color: 'var(--text)' }}>Users</h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
            Manage all platform user accounts.
          </p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium shadow-lg transition cursor-pointer"
          style={{
            background: 'linear-gradient(135deg, var(--orange), var(--orange-3))',
            color: 'white'
          }}
        >
          <Plus size={16} /> Create User
        </button>
      </div>

      <div className="rounded-2xl border" style={{
        backgroundColor: 'var(--bg-panel)',
        borderColor: 'var(--line)'
      }}>
        <div className="flex flex-col sm:flex-row gap-3 p-4 border-b" style={{ borderColor: 'var(--line)' }}>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2" size={14} style={{ color: 'var(--text-muted)' }} />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              placeholder="Search by name or email..."
              className="w-full rounded-xl border pl-9 pr-3 py-2 text-sm focus:outline-none"
              style={{
                backgroundColor: 'var(--bg)',
                borderColor: 'var(--line)',
                color: 'var(--text)'
              }}
            />
          </div>
           <select
             value={roleFilter}
             onChange={(e) => { setRoleFilter(e.target.value); setPage(1) }}
             className="rounded-xl border px-3 py-2 text-sm focus:outline-none"
             style={{
               backgroundColor: 'var(--bg)',
               borderColor: 'var(--line)',
               color: 'var(--text)'
             }}
            >
             <option value="">All Roles</option>
             <option value="student">Student</option>
             <option value="academic_supervisor">Academic Supervisor</option>
             <option value="professional_supervisor">Professional Supervisor</option>
             <option value="admin">Admin</option>
           </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-500 border-t-transparent" />
          </div>
        ) : users.length === 0 ? (
          <div className="p-6">
              <EmptyState
                icon={UserRound}
                title="No users found"
                description="No users match your search criteria. Create a new user to get started."
              />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs" style={{ color: 'var(--text-soft)' }}>
              <thead>
                <tr className="border-b text-[11px] uppercase tracking-wider" style={{ borderColor: 'var(--line)', color: 'var(--text-muted)' }}>
                  <th className="pb-3 font-semibold px-4">User</th>
                  <th className="pb-3 font-semibold px-4">Email</th>
                  <th className="pb-3 font-semibold px-4">Role</th>
                  <th className="pb-3 font-semibold px-4">Status</th>
                  <th className="pb-3 font-semibold px-4">Created</th>
                  <th className="pb-3 font-semibold px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--line)' }}>
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-white/[0.02] transition" style={{ backgroundColor: 'rgba(255,255,255,0.01)' }}>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold" style={{ color: 'var(--text)' }}>{u.name}</div>
                    </td>
                    <td className="py-3.5 px-4" style={{ color: 'var(--text-soft)' }}>{u.email}</td>
                    <td className="py-3.5 px-4">{getRoleBadge(u.role)}</td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border" style={{
                        backgroundColor: u.active ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        color: u.active ? '#6ee7b7' : '#fca5a5',
                        borderColor: u.active ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'
                      }}>
                        {u.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4" style={{ color: 'var(--text-soft)' }}>
                      {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => openEditModal(u)}
                        className="p-1.5 rounded-lg transition cursor-pointer mr-1"
                        style={{ color: 'var(--text-muted)' }}
                        onMouseEnter={(e) => e.target.style.color = '#60a5fa'}
                        onMouseLeave={(e) => e.target.style.color = 'var(--text-muted)'}
                        title="Edit user"
                      >
                        <Edit size={14} />
                      </button>
                      <button
                        onClick={() => handleToggleStatus(u)}
                        className="p-1.5 rounded-lg transition cursor-pointer mr-1"
                        style={{ color: 'var(--text-muted)' }}
                        onMouseEnter={(e) => e.target.style.color = u.active ? '#f87171' : '#6ee7b7'}
                        onMouseLeave={(e) => e.target.style.color = 'var(--text-muted)'}
                        title={u.active ? 'Deactivate user' : 'Activate user'}
                      >
                        {u.active ? <UserX size={14} /> : <UserCheck size={14} />}
                      </button>
                      <button
                        onClick={() => handleResendEmail(u)}
                        disabled={resendingId === u.id || u.role === 'admin'}
                        className="p-1.5 rounded-lg transition cursor-pointer mr-1 disabled:opacity-40"
                        style={{ color: 'var(--text-muted)' }}
                        title="Resend account email and reset temporary password"
                      >
                        <Mail size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(u.id)}
                        className="p-1.5 rounded-lg transition cursor-pointer"
                        style={{ color: 'var(--text-muted)' }}
                        onMouseEnter={(e) => e.target.style.color = '#f87171'}
                        onMouseLeave={(e) => e.target.style.color = 'var(--text-muted)'}
                        title="Delete user"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t" style={{ borderColor: 'var(--line)' }}>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 rounded-lg border text-xs disabled:opacity-40 cursor-pointer"
              style={{ borderColor: 'var(--line)', color: 'var(--text)' }}
            >
              Previous
            </button>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 rounded-lg border text-xs disabled:opacity-40 cursor-pointer"
              style={{ borderColor: 'var(--line)', color: 'var(--text)' }}
            >
              Next
            </button>
          </div>
        )}
      </div>

      {createError && (
        <div className="mb-4 rounded-xl border px-4 py-3 text-sm" style={{ borderColor: 'rgba(239,68,68,.35)', backgroundColor: 'rgba(239,68,68,.1)', color: '#fca5a5' }}>
          {createError}
        </div>
      )}
      {createSuccess && (
        <div className="mb-4 rounded-xl border px-4 py-3 text-sm" style={{ borderColor: 'rgba(16,185,129,.35)', backgroundColor: 'rgba(16,185,129,.1)', color: '#6ee7b7' }}>
          {createSuccess}
        </div>
      )}

      {/* Create User Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border p-6 shadow-2xl" style={{
            backgroundColor: 'var(--bg-panel)',
            borderColor: 'var(--line)',
            color: 'var(--text)'
          }}>
            <div className="flex items-center justify-between border-b pb-3 mb-4" style={{ borderColor: 'var(--line)' }}>
              <div>
                <h3 className="text-base font-bold">Create User Account</h3>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Provision a new user account</p>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="rounded-full p-1 transition cursor-pointer"
                style={{ color: 'var(--text-muted)' }}
              >
                <Trash2 size={18} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold mb-1" style={{ color: 'var(--text-soft)' }}>Full Name</label>
                <input
                  required
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  placeholder="e.g. John Doe"
                  className="w-full rounded-xl border p-2.5 text-xs focus:outline-none"
                  style={{
                    backgroundColor: 'var(--bg)',
                    borderColor: 'var(--line)',
                    color: 'var(--text)'
                  }}
                />
              </div>

              <div>
                <label className="block font-semibold mb-1" style={{ color: 'var(--text-soft)' }}>Email</label>
                <input
                  required
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  placeholder="e.g. john@example.com"
                  className="w-full rounded-xl border p-2.5 text-xs focus:outline-none"
                  style={{
                    backgroundColor: 'var(--bg)',
                    borderColor: 'var(--line)',
                    color: 'var(--text)'
                  }}
                />
              </div>

              <div>
                <label className="block font-semibold mb-1" style={{ color: 'var(--text-soft)' }}>Role</label>
                 <select
                   value={newUser.role}
                   onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                   className="w-full rounded-xl border p-2.5 text-xs focus:outline-none"
                   style={{
                     backgroundColor: 'var(--bg)',
                     borderColor: 'var(--line)',
                     color: 'var(--text)'
                   }}
                  >
                   <option value="student">Student</option>
                   <option value="academic_supervisor">Academic Supervisor</option>
                   <option value="professional_supervisor">Professional Supervisor</option>
                   <option value="admin">Admin</option>
                 </select>
              </div>

              {newUser.role === 'student' && (
                <>
                  <div>
                    <label className="block font-semibold mb-1" style={{ color: 'var(--text-soft)' }}>Matricule</label>
                    <input
                      required
                      value={newUser.matricule}
                      onChange={(e) => setNewUser({ ...newUser, matricule: e.target.value })}
                      placeholder="e.g. SE2026001"
                      className="w-full rounded-xl border p-2.5 text-xs focus:outline-none"
                      style={{
                        backgroundColor: 'var(--bg)',
                        borderColor: 'var(--line)',
                        color: 'var(--text)'
                      }}
                    />
                  </div>

                  <div>
                    <label className="block font-semibold mb-1" style={{ color: 'var(--text-soft)' }}>Class</label>
                    <input
                      required
                      value={newUser.class}
                      onChange={(e) => setNewUser({ ...newUser, class: e.target.value })}
                      placeholder="e.g. Software Engineering 2"
                      className="w-full rounded-xl border p-2.5 text-xs focus:outline-none"
                      style={{
                        backgroundColor: 'var(--bg)',
                        borderColor: 'var(--line)',
                        color: 'var(--text)'
                      }}
                    />
                  </div>
                </>
              )}

               <div className="pt-3 border-t flex justify-end gap-2" style={{ borderColor: 'var(--line)' }}>
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 rounded-xl transition cursor-pointer"
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    color: 'var(--text)'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 rounded-xl font-semibold shadow-lg transition cursor-pointer disabled:opacity-50"
                  style={{
                    background: 'linear-gradient(135deg, var(--orange), var(--orange-3))',
                    color: 'white'
                  }}
                >
                  {creating ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border p-6 shadow-2xl" style={{
            backgroundColor: 'var(--bg-panel)',
            borderColor: 'var(--line)',
            color: 'var(--text)'
          }}>
            <div className="flex items-center justify-between border-b pb-3 mb-4" style={{ borderColor: 'var(--line)' }}>
              <div>
                <h3 className="text-base font-bold">Edit User</h3>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Update user information</p>
              </div>
              <button
                onClick={() => setEditingUser(null)}
                className="rounded-full p-1 transition cursor-pointer"
                style={{ color: 'var(--text-muted)' }}
              >
                <Trash2 size={18} />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold mb-1" style={{ color: 'var(--text-soft)' }}>Full Name</label>
                <input
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full rounded-xl border p-2.5 text-xs focus:outline-none"
                  style={{
                    backgroundColor: 'var(--bg)',
                    borderColor: 'var(--line)',
                    color: 'var(--text)'
                  }}
                />
              </div>

              <div>
                <label className="block font-semibold mb-1" style={{ color: 'var(--text-soft)' }}>Email</label>
                <input
                  required
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full rounded-xl border p-2.5 text-xs focus:outline-none"
                  style={{
                    backgroundColor: 'var(--bg)',
                    borderColor: 'var(--line)',
                    color: 'var(--text)'
                  }}
                />
              </div>

              <div>
                <label className="block font-semibold mb-1" style={{ color: 'var(--text-soft)' }}>Role</label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                  className="w-full rounded-xl border p-2.5 text-xs focus:outline-none"
                  style={{
                    backgroundColor: 'var(--bg)',
                    borderColor: 'var(--line)',
                    color: 'var(--text)'
                  }}
                >
                  <option value="student">Student</option>
                  <option value="academic_supervisor">Academic Supervisor</option>
                  <option value="professional_supervisor">Professional Supervisor</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              {editForm.role === 'student' && (
                <>
                  <div>
                    <label className="block font-semibold mb-1" style={{ color: 'var(--text-soft)' }}>Matricule</label>
                    <input
                      value={editForm.matricule}
                      onChange={(e) => setEditForm({ ...editForm, matricule: e.target.value })}
                      className="w-full rounded-xl border p-2.5 text-xs focus:outline-none"
                      style={{
                        backgroundColor: 'var(--bg)',
                        borderColor: 'var(--line)',
                        color: 'var(--text)'
                      }}
                    />
                  </div>

                  <div>
                    <label className="block font-semibold mb-1" style={{ color: 'var(--text-soft)' }}>Class</label>
                    <input
                      value={editForm.class}
                      onChange={(e) => setEditForm({ ...editForm, class: e.target.value })}
                      className="w-full rounded-xl border p-2.5 text-xs focus:outline-none"
                      style={{
                        backgroundColor: 'var(--bg)',
                        borderColor: 'var(--line)',
                        color: 'var(--text)'
                      }}
                    />
                  </div>

                  <div>
                    <label className="block font-semibold mb-1" style={{ color: 'var(--text-soft)' }}>Company</label>
                    <input
                      value={editForm.company}
                      onChange={(e) => setEditForm({ ...editForm, company: e.target.value })}
                      placeholder="e.g. TechCorp Solutions"
                      className="w-full rounded-xl border p-2.5 text-xs focus:outline-none"
                      style={{
                        backgroundColor: 'var(--bg)',
                        borderColor: 'var(--line)',
                        color: 'var(--text)'
                      }}
                    />
                  </div>
                </>
              )}

              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                A temporary password will be generated and sent to the user by email.
              </p>

              <div className="pt-3 border-t flex justify-end gap-2" style={{ borderColor: 'var(--line)' }}>
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 rounded-xl transition cursor-pointer"
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    color: 'var(--text)'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editing}
                  className="px-4 py-2 rounded-xl font-semibold shadow-lg transition cursor-pointer disabled:opacity-50"
                  style={{
                    background: 'linear-gradient(135deg, var(--orange), var(--orange-3))',
                    color: 'white'
                  }}
                >
                  {editing ? 'Updating...' : 'Update User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
