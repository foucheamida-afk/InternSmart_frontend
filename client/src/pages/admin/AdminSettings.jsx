import { useState } from 'react'
import { Globe, Bell } from 'lucide-react'

export default function AdminSettings() {
  const [settings, setSettings] = useState({
    platformName: 'InternSmart',
    supportEmail: 'support@internsmart.edu',
    enableNotifications: true,
    enableAI: true,
    allowRegistration: false,
  })
  const [saving, setSaving] = useState(false)

  const handleSave = (e) => {
    e.preventDefault()
    setSaving(true)
    setTimeout(() => {
      setSaving(false)
      alert('Settings saved successfully')
    }, 500)
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-semibold tracking-[-0.06em]" style={{ color: 'var(--text)' }}>Settings</h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
          Configure platform-wide settings.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <div className="rounded-2xl border p-6" style={{
          backgroundColor: 'var(--bg-panel)',
          borderColor: 'var(--line)'
        }}>
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border" style={{
              backgroundColor: 'rgba(255, 122, 0, 0.1)',
              borderColor: 'rgba(255, 122, 0, 0.25)',
              color: 'var(--orange-3)'
            }}>
              <Globe size={20} />
            </div>
            <div>
              <h3 className="text-base font-semibold" style={{ color: 'var(--text)' }}>General</h3>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Platform configuration</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-soft)' }}>Platform Name</label>
              <input
                value={settings.platformName}
                onChange={(e) => setSettings({ ...settings, platformName: e.target.value })}
                className="w-full rounded-xl border p-2.5 text-sm focus:outline-none"
                style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--line)', color: 'var(--text)' }}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-soft)' }}>Support Email</label>
              <input
                value={settings.supportEmail}
                onChange={(e) => setSettings({ ...settings, supportEmail: e.target.value })}
                className="w-full rounded-xl border p-2.5 text-sm focus:outline-none"
                style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--line)', color: 'var(--text)' }}
              />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border p-6" style={{
          backgroundColor: 'var(--bg-panel)',
          borderColor: 'var(--line)'
        }}>
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border" style={{
              backgroundColor: 'rgba(255, 122, 0, 0.1)',
              borderColor: 'rgba(255, 122, 0, 0.25)',
              color: 'var(--orange-3)'
            }}>
              <Bell size={20} />
            </div>
            <div>
              <h3 className="text-base font-semibold" style={{ color: 'var(--text)' }}>Features</h3>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Enable or disable platform features</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium" style={{ color: 'var(--text)' }}>Enable Notifications</div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Send notifications to users</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.enableNotifications}
                  onChange={(e) => setSettings({ ...settings, enableNotifications: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
              </label>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium" style={{ color: 'var(--text)' }}>Enable AI Analysis</div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Run AI analysis on submitted reports</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.enableAI}
                  onChange={(e) => setSettings({ ...settings, enableAI: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
              </label>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium" style={{ color: 'var(--text)' }}>Allow Public Registration</div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Allow users to register without admin approval</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.allowRegistration}
                  onChange={(e) => setSettings({ ...settings, allowRegistration: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
              </label>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 rounded-full font-semibold shadow-lg transition cursor-pointer disabled:opacity-50"
            style={{
              background: 'linear-gradient(135deg, var(--orange), var(--orange-3))',
              color: 'white'
            }}
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  )
}
