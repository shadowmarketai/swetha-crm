/**
 * CRM Dashboard — Tendent CRM
 * Modern Linear/Vercel inspired overview
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { usePermissions } from '../../hooks/usePermissions';
import api, { analyticsAPI, leadsAPI } from '../../services/api';
import {
  Users, TrendingUp, IndianRupee, Target, Phone, Calendar,
  Mail, MoreHorizontal, ArrowUpRight, Plus, Sparkles, ChevronRight,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  Card, CardHeader, Stat, Button, Modal, Field, Input, Select,
  Avatar, StatusBadge, EmptyState, Segmented, Skeleton,
} from '../../components/ui/primitives';
import { useApp } from '../../layouts/DashboardLayout';

const formatCurrencyShort = (n) => {
  if (n == null) return '—';
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(1)}Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(1)}L`;
  if (n >= 1e3) return `₹${(n / 1e3).toFixed(1)}K`;
  return `₹${n}`;
};

const ChartTooltip = ({ active, payload, label, formatter }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl px-3 py-2 text-xs">
      <div className="font-medium text-slate-900 dark:text-white">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="text-slate-500 mt-0.5">
          {formatter ? formatter(p.value) : p.value}
        </div>
      ))}
    </div>
  );
};

const ActivityItem = ({ activity }) => {
  const iconMap = { call: Phone, email: Mail, meeting: Calendar };
  const Icon = iconMap[activity.type] || Phone;
  const tones = {
    call: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    email: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
    meeting: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  };
  return (
    <div className="flex items-start gap-3 py-3 first:pt-0 last:pb-0 border-b border-slate-100 dark:border-slate-800 last:border-0">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${tones[activity.type] || tones.call}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{activity.title}</p>
        <p className="text-xs text-slate-500 mt-0.5 truncate">{activity.contact} · {activity.time}</p>
      </div>
    </div>
  );
};

export default function CRMDashboard() {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const canCreate = can('crm', 'create');
  const canUpdate = can('crm', 'update');
  const appCtx = useApp();

  const [showAddModal, setShowAddModal] = useState(false);
  const [activeMenu, setActiveMenu] = useState(null);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', company: '', source: 'Website' });
  const [apiStats, setApiStats] = useState(null);
  const [apiLeads, setApiLeads] = useState(null);
  const [loading, setLoading] = useState(true);
  const [chartRange, setChartRange] = useState('6m');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.allSettled([
      analyticsAPI.getDashboard({ period: '30d' }).catch(() => null),
      leadsAPI.getAll({ limit: 5, sort: '-created_at' }),
      api.get('/api/v1/crm-leads', { params: { limit: 1 } }),
      api.get('/api/v1/crm-deals', { params: { limit: 100 } }),
    ]).then(([statsRes, leadsRes, leadCountRes, dealsRes]) => {
      if (cancelled) return;
      // Build stats from real data
      const realStats = {};
      if (statsRes.status === 'fulfilled' && statsRes.value?.data) Object.assign(realStats, statsRes.value.data);

      // Lead count from API
      if (leadCountRes.status === 'fulfilled') {
        const ldata = leadCountRes.value?.data;
        realStats.total_leads = ldata?.total || (Array.isArray(ldata) ? ldata.length : 0);
      }
      // Deal pipeline value
      if (dealsRes.status === 'fulfilled') {
        const deals = dealsRes.value?.data?.items || dealsRes.value?.data || [];
        if (Array.isArray(deals)) {
          const totalValue = deals.reduce((s, d) => s + (d.value || 0), 0);
          realStats.total_revenue = totalValue >= 1e7 ? `₹${(totalValue / 1e7).toFixed(1)}Cr` :
            totalValue >= 1e5 ? `₹${(totalValue / 1e5).toFixed(1)}L` : `₹${totalValue.toLocaleString()}`;
          realStats.qualified = deals.filter(d => d.stage === 'proposal' || d.stage === 'negotiation').length;
          const won = deals.filter(d => d.stage === 'closed_won').length;
          realStats.conversion_rate = deals.length > 0 ? `${Math.round((won / deals.length) * 100)}%` : '0%';
        }
      }
      setApiStats(realStats);

      // Recent leads
      if (leadsRes.status === 'fulfilled') {
        const data = leadsRes.value?.data;
        const items = Array.isArray(data) ? data : data?.items || data?.results;
        if (Array.isArray(items) && items.length > 0) setApiLeads(items);
      }
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const stats = [
    {
      label: 'Total Leads',
      value: apiStats?.total_leads?.toLocaleString() || '2,847',
      change: apiStats?.leads_change || '+12%',
      changeType: 'up',
      icon: Users,
      accent: '#6366f1',
      accentTo: '#8b5cf6',
    },
    {
      label: 'Qualified',
      value: apiStats?.qualified?.toLocaleString() || '892',
      change: apiStats?.qualified_change || '+8%',
      changeType: 'up',
      icon: Target,
      accent: '#10b981',
      accentTo: '#06b6d4',
    },
    {
      label: 'Pipeline Value',
      value: apiStats?.total_revenue || '₹24.5L',
      change: apiStats?.revenue_change || '+18%',
      changeType: 'up',
      icon: IndianRupee,
      accent: '#f59e0b',
      accentTo: '#f43f5e',
    },
    {
      label: 'Conversion Rate',
      value: apiStats?.conversion_rate || '31.3%',
      change: apiStats?.conversion_change || '+4%',
      changeType: apiStats?.conversion_change_type || 'up',
      icon: TrendingUp,
      accent: '#ec4899',
      accentTo: '#8b5cf6',
    },
  ];

  const revenueData = apiStats?.revenue_trend || [
    { month: 'Sep', revenue: 1450000 },
    { month: 'Oct', revenue: 1680000 },
    { month: 'Nov', revenue: 1920000 },
    { month: 'Dec', revenue: 2080000 },
    { month: 'Jan', revenue: 2280000 },
    { month: 'Feb', revenue: 2450000 },
  ];

  const leadsData = apiStats?.leads_trend || [
    { day: 'Mon', leads: 45 },
    { day: 'Tue', leads: 52 },
    { day: 'Wed', leads: 38 },
    { day: 'Thu', leads: 65 },
    { day: 'Fri', leads: 48 },
    { day: 'Sat', leads: 32 },
    { day: 'Sun', leads: 28 },
  ];

  const leads = apiLeads
    ? apiLeads.map((l) => ({
        name: l.name || l.full_name || 'Unknown',
        company: l.company || l.company_name || '',
        phone: l.phone || l.phone_number || '',
        status: l.status || 'new',
        source: l.source || l.lead_source || '',
        created: l.created_at ? new Date(l.created_at).toLocaleDateString() : '',
      }))
    : [
        { name: 'Rajesh Kumar', company: 'Tech Solutions Pvt', phone: '+91 98765 43210', status: 'qualified', source: 'Facebook', created: '2h ago' },
        { name: 'Priya Sharma', company: 'StartUp Inc', phone: '+91 87654 32109', status: 'new', source: 'IndiaMart', created: '3h ago' },
        { name: 'Vikram Patel', company: 'Global Corp', phone: '+91 76543 21098', status: 'contacted', source: 'Google Ads', created: '5h ago' },
        { name: 'Ananya Reddy', company: 'Digital Agency', phone: '+91 65432 10987', status: 'qualified', source: 'Website', created: '1d ago' },
        { name: 'Karthik Iyer', company: 'Finance Pro', phone: '+91 54321 09876', status: 'new', source: 'Referral', created: '1d ago' },
      ];

  const activities = [
    { type: 'call', title: 'Follow-up call with Rajesh', contact: 'Rajesh Kumar', time: '10:30 AM' },
    { type: 'email', title: 'Sent proposal', contact: 'Priya Sharma', time: '11:45 AM' },
    { type: 'meeting', title: 'Product demo', contact: 'Tech Solutions', time: '2:00 PM' },
    { type: 'call', title: 'Discovery call', contact: 'New Lead', time: '4:30 PM' },
  ];

  const [addingLead, setAddingLead] = useState(false);
  const handleAddLead = async () => {
    if (!formData.name || !formData.phone) {
      toast.error('Please fill in name and phone');
      return;
    }
    setAddingLead(true);
    try {
      const nameParts = formData.name.trim().split(/\s+/);
      await leadsAPI.create({
        first_name: nameParts[0],
        last_name: nameParts.slice(1).join(' ') || undefined,
        phone: formData.phone,
        email: formData.email || undefined,
        company: formData.company || undefined,
        source: formData.source || 'Website',
      });
      toast.success(`Lead "${formData.name}" added`);
      setFormData({ name: '', email: '', phone: '', company: '', source: 'Website' });
      setShowAddModal(false);
      // Refresh leads
      leadsAPI.getAll({ limit: 5, sort: '-created_at' }).then(res => {
        const items = Array.isArray(res.data) ? res.data : res.data?.items || [];
        if (items.length > 0) setApiLeads(items);
      }).catch(() => {});
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to add lead');
    } finally {
      setAddingLead(false);
    }
  };

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  })();

  return (
    <div className="space-y-8">
      {/* Hero Header */}
      <div
        className="relative overflow-hidden rounded-3xl border border-slate-200/70 dark:border-slate-800 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_16px_40px_-20px_rgba(15,23,42,0.15)]"
        style={{
          background: `
            linear-gradient(135deg,
              color-mix(in oklab, var(--brand-primary) 8%, white),
              white 40%,
              color-mix(in oklab, var(--brand-accent, #ec4899) 6%, white) 90%
            )
          `,
        }}
      >
        {/* Subtle accent corner */}
        <div
          className="absolute top-0 right-0 w-64 h-64 opacity-25 pointer-events-none"
          style={{
            background: 'radial-gradient(circle at top right, var(--brand-accent, #ec4899), transparent 70%)',
          }}
        />
        <div className="relative px-6 py-10 sm:px-10 sm:py-12 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div>
            <div
              className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.15em] mb-3 px-3 py-1.5 rounded-full ring-1"
              style={{
                background: 'color-mix(in oklab, var(--brand-primary) 10%, white)',
                color: 'var(--brand-primary)',
                borderColor: 'transparent',
                boxShadow: '0 1px 0 rgba(255,255,255,0.9) inset, 0 0 0 1px color-mix(in oklab, var(--brand-primary) 20%, transparent)',
              }}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Overview · Last 30 days
            </div>
            <h1 className="text-3xl sm:text-[40px] leading-tight font-bold tracking-tight text-slate-900 dark:text-white">
              {greeting},{' '}
              <span
                className="bg-clip-text text-transparent"
                style={{
                  backgroundImage:
                    'linear-gradient(135deg, var(--brand-primary), var(--brand-accent, #ec4899))',
                }}
              >
                {(appCtx?.user?.name || 'there').split(' ')[0]}
              </span>
              <span className="inline-block ml-2 animate-wave">👋</span>
            </h1>
            <p className="text-[15px] text-slate-600 dark:text-slate-400 mt-2 max-w-lg">
              Here's what's happening across your pipeline today.
            </p>
          </div>
          {canCreate && (
            <div className="flex items-center gap-2">
              <Button variant="secondary" leftIcon={Calendar} onClick={() => navigate('/crm/activities')}>
                Schedule
              </Button>
              <Button leftIcon={Plus} onClick={() => setShowAddModal(true)}>
                New Lead
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="p-5">
                <Skeleton className="w-10 h-10 rounded-xl" />
                <Skeleton className="w-24 h-7 mt-4" />
                <Skeleton className="w-16 h-3 mt-2" />
              </Card>
            ))
          : stats.map((s, i) => <Stat key={i} {...s} />)}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <Card className="lg:col-span-3">
          <CardHeader
            title="Revenue Trend"
            subtitle="Monthly recurring pipeline value"
            action={
              <Segmented
                value={chartRange}
                onChange={setChartRange}
                options={[
                  { label: '3M', value: '3m' },
                  { label: '6M', value: '6m' },
                  { label: '1Y', value: '1y' },
                ]}
              />
            }
          />
          <div className="px-2 pb-4 pt-2 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--brand-primary)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--brand-primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-200 dark:text-slate-800" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'currentColor' }} className="text-slate-400" axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'currentColor' }} className="text-slate-400" axisLine={false} tickLine={false} tickFormatter={(v) => formatCurrencyShort(v)} />
                <Tooltip content={<ChartTooltip formatter={(v) => formatCurrencyShort(v)} />} />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="var(--brand-primary)"
                  strokeWidth={2.5}
                  fill="url(#revGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Leads This Week" subtitle="Inbound by day" />
          <div className="px-2 pb-4 pt-2 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={leadsData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-200 dark:text-slate-800" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'currentColor' }} className="text-slate-400" axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'currentColor' }} className="text-slate-400" axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
                <Bar dataKey="leads" fill="var(--brand-primary)" radius={[6, 6, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Recent Leads + Activities */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Recent Leads"
            subtitle="Latest leads across all sources"
            action={
              <Link to="/crm/leads" className="inline-flex items-center gap-1 text-sm font-medium" style={{ color: 'var(--brand-primary)' }}>
                View all <ChevronRight className="w-4 h-4" />
              </Link>
            }
          />
          {leads.length === 0 ? (
            <EmptyState title="No leads yet" description="Start capturing leads to see them here." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800">
                    {['Lead', 'Phone', 'Status', 'Source', 'Created', ''].map((h) => (
                      <th key={h} className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-6 py-3 text-left">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead, i) => (
                    <tr
                      key={i}
                      className="border-b border-slate-50 dark:border-slate-800/60 last:border-0 hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-3">
                          <Avatar name={lead.name} size={36} />
                          <div className="min-w-0">
                            <div className="font-medium text-slate-900 dark:text-white truncate">{lead.name}</div>
                            <div className="text-xs text-slate-500 truncate">{lead.company}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-3.5 text-slate-600 dark:text-slate-400 font-mono text-xs">{lead.phone}</td>
                      <td className="px-6 py-3.5"><StatusBadge status={lead.status} /></td>
                      <td className="px-6 py-3.5 text-slate-600 dark:text-slate-400">{lead.source}</td>
                      <td className="px-6 py-3.5 text-slate-500 text-xs">{lead.created}</td>
                      <td className="px-6 py-3.5 text-right relative">
                        <button
                          onClick={() => setActiveMenu(activeMenu === lead.name ? null : lead.name)}
                          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
                        >
                          <MoreHorizontal className="w-4 h-4 text-slate-400" />
                        </button>
                        {activeMenu === lead.name && (
                          <div className="absolute right-4 top-12 z-10 w-40 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 py-1 text-left">
                            <button
                              className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                              onClick={() => { setActiveMenu(null); toast.success(`Viewing ${lead.name}`); }}
                            >
                              View details
                            </button>
                            {canUpdate && (
                              <button
                                className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                                onClick={() => { setActiveMenu(null); toast.success(`Editing ${lead.name}`); }}
                              >
                                Edit lead
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Today's Activities"
            subtitle="Your scheduled work"
            action={
              <Button variant="ghost" size="icon" onClick={() => toast('Activity logging coming soon', { icon: '📋' })}>
                <Plus className="w-4 h-4" />
              </Button>
            }
          />
          <div className="px-6 py-2">
            {activities.length === 0 ? (
              <EmptyState title="All clear" description="No scheduled activities for today." />
            ) : (
              activities.map((a, i) => <ActivityItem key={i} activity={a} />)
            )}
          </div>
        </Card>
      </div>

      {/* Add Lead Modal */}
      <Modal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="New Lead"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowAddModal(false)}>Cancel</Button>
            <Button onClick={handleAddLead}>Save Lead</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Full name" required>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Rajesh Kumar"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Email" required>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="name@company.com"
              />
            </Field>
            <Field label="Phone" required>
              <Input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+91 XXXXX XXXXX"
              />
            </Field>
          </div>
          <Field label="Company">
            <Input
              value={formData.company}
              onChange={(e) => setFormData({ ...formData, company: e.target.value })}
              placeholder="Company name"
            />
          </Field>
          <Field label="Source">
            <Select
              value={formData.source}
              onChange={(e) => setFormData({ ...formData, source: e.target.value })}
              className="w-full"
            >
              {['Website', 'Facebook', 'Google Ads', 'IndiaMart', 'LinkedIn', 'Referral'].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          </Field>
        </div>
      </Modal>
    </div>
  );
}

