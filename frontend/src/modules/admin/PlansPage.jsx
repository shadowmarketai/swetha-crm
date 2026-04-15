/**
 * Plans — Super Admin
 * Read-only view of subscription plans (backend GET-only currently).
 * Upgraded to use design system primitives.
 * All state and API calls preserved exactly.
 */

import { useState, useEffect } from 'react'
import { CreditCard, Check, Users, Clock } from 'lucide-react'
import { superAdminAPI } from '../../services/api'
import {
  Card, CardBody,
  PageHeader,
  Badge,
  EmptyState,
  Skeleton,
} from '../../components/ui/primitives'

// Map plan slug to a visual accent color pair
const PLAN_ACCENT = {
  enterprise: { from: '#7c3aed', to: '#4f46e5' },
  professional: { from: '#3b82f6', to: '#6366f1' },
  starter: { from: '#64748b', to: '#475569' },
}

export default function PlansPage() {
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    superAdminAPI.listPlans()
      .then((res) => setPlans(res.data || []))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="max-w-6xl mx-auto space-y-6">

      <PageHeader
        title="Subscription Plans"
        subtitle="Plans available to tenants on the platform"
      />

      {/* Loading skeleton */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-72 rounded-2xl" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && plans.length === 0 && (
        <Card>
          <EmptyState
            icon={CreditCard}
            title="No plans configured"
            description="Subscription plans will appear here once they are set up in the backend."
          />
        </Card>
      )}

      {/* Plan cards grid */}
      {!loading && plans.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {plans.map((plan) => {
            const popular = plan.slug === 'professional'
            const accent = PLAN_ACCENT[plan.slug] || PLAN_ACCENT.starter
            return (
              <div key={plan.id} className="relative">
                {/* Popular pill — sits above the card */}
                {popular && (
                  <div className="absolute -top-3 inset-x-0 flex justify-center z-10">
                    <Badge tone="purple" className="shadow-sm">Most Popular</Badge>
                  </div>
                )}
                <Card
                  hover
                  className={
                    popular
                      ? 'border-[color:var(--brand-primary)] ring-2 ring-[color:var(--brand-primary)]/20 overflow-hidden'
                      : 'overflow-hidden'
                  }
                >
                  {/* Accent top bar */}
                  <div
                    className="h-1 w-full"
                    style={{
                      background: `linear-gradient(90deg, ${accent.from}, ${accent.to})`,
                    }}
                  />

                  <CardBody className="space-y-5">
                    {/* Plan name + description */}
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                          {plan.name}
                        </h2>
                        <Badge tone={plan.is_active ? 'success' : 'default'} dot>
                          {plan.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      {plan.description && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                          {plan.description}
                        </p>
                      )}
                    </div>

                    {/* Pricing */}
                    <div className="flex items-baseline gap-1">
                      <span
                        className="text-4xl font-bold tracking-tight"
                        style={{ color: accent.from }}
                      >
                        ₹{(plan.price / 100).toLocaleString('en-IN')}
                      </span>
                      <span className="text-sm text-slate-500 dark:text-slate-400">
                        /{plan.interval}
                      </span>
                    </div>

                    {/* Feature list */}
                    <ul className="space-y-2.5">
                      <li className="flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-300">
                        <span
                          className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ background: `${accent.from}20`, color: accent.from }}
                        >
                          <Users className="w-3 h-3" />
                        </span>
                        Up to {plan.max_users} users
                      </li>
                      <li className="flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-300">
                        <span
                          className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ background: `${accent.from}20`, color: accent.from }}
                        >
                          <Check className="w-3 h-3" />
                        </span>
                        {plan.is_active ? 'Available to tenants' : 'Currently inactive'}
                      </li>
                      {plan.interval && (
                        <li className="flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-300">
                          <span
                            className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                            style={{ background: `${accent.from}20`, color: accent.from }}
                          >
                            <Clock className="w-3 h-3" />
                          </span>
                          Billed {plan.interval}
                        </li>
                      )}
                    </ul>

                    {/* Slug identifier */}
                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                        {plan.slug}
                      </p>
                    </div>
                  </CardBody>
                </Card>
              </div>
            )
          })}
        </div>
      )}

      <p className="text-xs text-slate-400 dark:text-slate-500 text-center">
        Plans are read-only. Edit functionality coming soon.
      </p>
    </div>
  )
}
