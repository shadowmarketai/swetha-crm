/**
 * Super Admin Settings — Profile + platform configuration.
 * Upgraded to use design system primitives.
 * Auth context usage preserved exactly.
 */

import { Mail, Shield, User, Lock, Key, Bell, FileText } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import {
  Card, CardHeader, CardBody,
  PageHeader,
  Badge,
  Avatar,
} from '../../components/ui/primitives'

export default function SuperAdminSettingsPage() {
  const { user } = useAuth()

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      <PageHeader
        title="Settings"
        subtitle="Super admin profile and platform configuration"
      />

      {/* Profile card */}
      <Card>
        <CardHeader title="Profile" subtitle="Your super admin identity on this platform" />
        <CardBody className="space-y-0">

          {/* Avatar + identity summary */}
          <div className="flex items-center gap-4 pb-5 mb-5 border-b border-slate-100 dark:border-slate-800">
            <Avatar name={user?.name || 'Super Admin'} size={56} />
            <div>
              <p className="font-semibold text-slate-900 dark:text-white text-base">
                {user?.name}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">{user?.email}</p>
              <Badge tone="purple" className="mt-1.5">
                <Shield className="w-3 h-3 inline-block mr-0.5" />
                Super Admin
              </Badge>
            </div>
          </div>

          {/* Detail rows */}
          <dl className="space-y-0 divide-y divide-slate-100 dark:divide-slate-800">
            <ProfileField icon={User} label="Name" value={user?.name} />
            <ProfileField icon={Mail} label="Email" value={user?.email} />
            <ProfileField icon={Shield} label="Role" value="Platform Administrator" />
          </dl>
        </CardBody>
      </Card>

      {/* Coming soon placeholder */}
      <Card className="border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30">
        <CardBody>
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
            Coming soon
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              { icon: Lock, label: 'Change Password' },
              { icon: Shield, label: 'Two-Factor Auth' },
              { icon: Key, label: 'API Keys' },
              { icon: Bell, label: 'Notifications' },
              { icon: FileText, label: 'Audit Log Retention' },
            ].map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5"
              >
                <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                {label}
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

    </div>
  )
}

// ── Profile field row ─────────────────────────────────────────────────
function ProfileField({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3 py-3">
      <Icon className="w-4 h-4 text-slate-400 dark:text-slate-500 flex-shrink-0" />
      <span className="text-sm text-slate-500 dark:text-slate-400 w-20 flex-shrink-0">{label}</span>
      <span className="text-sm text-slate-900 dark:text-white font-medium">{value || '—'}</span>
    </div>
  )
}
