/**
 * White Label Management Page
 * Tabs: Branding, Clients, Commissions
 */

import { useState } from 'react';
import toast from 'react-hot-toast';
import {
  Palette, Globe, Users, DollarSign, Plus, Trash2, X,
  Ban, CheckCircle, Building2, Mail, Tag, Link2,
  CreditCard, Wallet, IndianRupee, ArrowUpRight, MoreVertical
} from 'lucide-react';

const tabs = ['Branding', 'Clients', 'Commissions'];

const initialClients = [
  { id: 1, name: 'Apex Realty Solutions', domain: 'apex.crm-whitelabel.com', plan: 'Enterprise', users: 48, status: 'active', createdAt: '2025-08-12' },
  { id: 2, name: 'MedCare Connect', domain: 'medcare.crm-whitelabel.com', plan: 'Growth', users: 22, status: 'active', createdAt: '2025-09-05' },
  { id: 3, name: 'LearnPro Academy', domain: 'learnpro.crm-whitelabel.com', plan: 'Starter', users: 8, status: 'active', createdAt: '2025-10-18' },
  { id: 4, name: 'QuickServe Foods', domain: 'quickserve.crm-whitelabel.com', plan: 'Growth', users: 15, status: 'suspended', createdAt: '2025-11-02' },
  { id: 5, name: 'TravelEase India', domain: 'travelease.crm-whitelabel.com', plan: 'Enterprise', users: 35, status: 'active', createdAt: '2025-12-20' },
];

const initialPayouts = [
  { id: 1, date: '2026-02-15', amount: 42500, clients: 5, status: 'paid' },
  { id: 2, date: '2026-01-15', amount: 38200, clients: 5, status: 'paid' },
  { id: 3, date: '2025-12-15', amount: 35800, clients: 4, status: 'paid' },
  { id: 4, date: '2026-03-15', amount: 45100, clients: 5, status: 'pending' },
];

export default function WhiteLabelPage() {
  const [activeTab, setActiveTab] = useState('Branding');

  // Branding state
  const [branding, setBranding] = useState({
    companyName: 'ShadowMarket',
    tagline: 'AI-Powered Business Growth Platform',
    supportEmail: 'sales@shadowmarket.ai',
    logoUrl: '',
    primaryColor: '#6366f1',
    domain: 'app.shadowmarket.ai',
  });

  // Clients state
  const [clients, setClients] = useState(initialClients);
  const [showAddClient, setShowAddClient] = useState(false);
  const [clientForm, setClientForm] = useState({ name: '', domain: '', plan: 'Starter', adminEmail: '' });

  // Commissions state
  const [commissionRate, setCommissionRate] = useState('20');
  const [payoutMethod, setPayoutMethod] = useState('Bank Transfer');
  const [minPayout, setMinPayout] = useState('5000');
  const [payouts] = useState(initialPayouts);

  // Branding handlers
  const handleSaveBranding = () => {
    if (!branding.companyName.trim()) {
      toast.error('Company name is required');
      return;
    }
    if (!branding.supportEmail.trim()) {
      toast.error('Support email is required');
      return;
    }
    toast.success('Branding settings saved successfully');
  };

  // Client handlers
  const handleAddClient = () => {
    if (!clientForm.name.trim()) {
      toast.error('Client name is required');
      return;
    }
    if (!clientForm.domain.trim()) {
      toast.error('Domain is required');
      return;
    }
    if (!clientForm.adminEmail.trim()) {
      toast.error('Admin email is required');
      return;
    }
    const newClient = {
      id: Date.now(),
      name: clientForm.name,
      domain: clientForm.domain,
      plan: clientForm.plan,
      users: 0,
      status: 'active',
      createdAt: new Date().toISOString().split('T')[0],
    };
    setClients(prev => [...prev, newClient]);
    toast.success(`Client "${clientForm.name}" added successfully`);
    setClientForm({ name: '', domain: '', plan: 'Starter', adminEmail: '' });
    setShowAddClient(false);
  };

  const toggleClientStatus = (id) => {
    setClients(prev => prev.map(c => {
      if (c.id === id) {
        const newStatus = c.status === 'active' ? 'suspended' : 'active';
        toast.success(`${c.name} ${newStatus === 'active' ? 'activated' : 'suspended'}`);
        return { ...c, status: newStatus };
      }
      return c;
    }));
  };

  const deleteClient = (id) => {
    const client = clients.find(c => c.id === id);
    setClients(prev => prev.filter(c => c.id !== id));
    toast.success(`${client?.name} removed`);
  };

  // Commission handlers
  const handleRequestPayout = () => {
    const pending = payouts.filter(p => p.status === 'pending');
    if (pending.length === 0) {
      toast.error('No pending payouts to request');
      return;
    }
    toast.success('Payout request submitted successfully');
  };

  // Stats
  const activeClients = clients.filter(c => c.status === 'active').length;
  const totalUsers = clients.reduce((sum, c) => sum + c.users, 0);
  const avgUsers = clients.length > 0 ? Math.round(totalUsers / clients.length) : 0;
  const mrr = clients.reduce((sum, c) => {
    if (c.status !== 'active') return sum;
    const planPrices = { Starter: 4999, Growth: 14999, Enterprise: 39999 };
    return sum + (planPrices[c.plan] || 0);
  }, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">White Label</h1>
        <p className="text-sm text-slate-500">Manage your white-label branding, clients, and commissions</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2">
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Branding Tab */}
      {activeTab === 'Branding' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">Brand Identity</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Company Name */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Building2 className="w-4 h-4" /> Company Name
                  </div>
                </label>
                <input
                  type="text"
                  value={branding.companyName}
                  onChange={e => setBranding({ ...branding, companyName: e.target.value })}
                  placeholder="Your company name"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
                />
              </div>

              {/* Tagline */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Tag className="w-4 h-4" /> Tagline
                  </div>
                </label>
                <input
                  type="text"
                  value={branding.tagline}
                  onChange={e => setBranding({ ...branding, tagline: e.target.value })}
                  placeholder="Your brand tagline"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
                />
              </div>

              {/* Support Email */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Mail className="w-4 h-4" /> Support Email
                  </div>
                </label>
                <input
                  type="email"
                  value={branding.supportEmail}
                  onChange={e => setBranding({ ...branding, supportEmail: e.target.value })}
                  placeholder="support@yourdomain.com"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
                />
              </div>

              {/* Logo URL */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Link2 className="w-4 h-4" /> Logo URL
                  </div>
                </label>
                <input
                  type="url"
                  value={branding.logoUrl}
                  onChange={e => setBranding({ ...branding, logoUrl: e.target.value })}
                  placeholder="https://yourdomain.com/logo.png"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
                />
              </div>

              {/* Primary Color */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Palette className="w-4 h-4" /> Primary Color
                  </div>
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={branding.primaryColor}
                    onChange={e => setBranding({ ...branding, primaryColor: e.target.value })}
                    placeholder="#6366f1"
                    className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
                  />
                  <div
                    className="w-10 h-10 rounded-lg border border-slate-300 dark:border-slate-600 shrink-0"
                    style={{ backgroundColor: branding.primaryColor }}
                  />
                </div>
              </div>

              {/* Domain / Subdomain */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Globe className="w-4 h-4" /> Domain / Subdomain
                  </div>
                </label>
                <input
                  type="text"
                  value={branding.domain}
                  onChange={e => setBranding({ ...branding, domain: e.target.value })}
                  placeholder="app.yourdomain.com"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={handleSaveBranding}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
              >
                <CheckCircle className="w-4 h-4" /> Save Branding
              </button>
            </div>
          </div>

          {/* Preview */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Preview</h3>
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-6 bg-slate-50 dark:bg-slate-900">
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-lg"
                  style={{ backgroundColor: branding.primaryColor }}
                >
                  {branding.companyName.charAt(0) || 'S'}
                </div>
                <div>
                  <p className="font-bold text-slate-900 dark:text-white">{branding.companyName || 'Company Name'}</p>
                  <p className="text-xs text-slate-500">{branding.tagline || 'Your tagline here'}</p>
                </div>
              </div>
              <p className="text-xs text-slate-400">{branding.domain || 'app.yourdomain.com'} | {branding.supportEmail || 'support@yourdomain.com'}</p>
            </div>
          </div>
        </div>
      )}

      {/* Clients Tab */}
      {activeTab === 'Clients' && (
        <div className="space-y-6">
          {/* Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Clients', value: clients.length, icon: Users, color: 'bg-indigo-100 text-indigo-600' },
              { label: 'Active', value: activeClients, icon: CheckCircle, color: 'bg-emerald-100 text-emerald-600' },
              { label: 'MRR', value: `₹${(mrr / 1000).toFixed(1)}K`, icon: DollarSign, color: 'bg-blue-100 text-blue-600' },
              { label: 'Avg Users/Client', value: avgUsers, icon: Users, color: 'bg-purple-100 text-purple-600' },
            ].map((stat, i) => (
              <div key={i} className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${stat.color}`}>
                    <stat.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xl font-bold text-slate-900 dark:text-white">{stat.value}</p>
                    <p className="text-xs text-slate-500">{stat.label}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Clients Table */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <h3 className="font-semibold text-slate-900 dark:text-white">White-Label Clients</h3>
              <button
                onClick={() => setShowAddClient(true)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
              >
                <Plus className="w-4 h-4" /> Add Client
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-800/50">
                  <tr>
                    <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">Client</th>
                    <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">Domain</th>
                    <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">Plan</th>
                    <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">Users</th>
                    <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                    <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">Created</th>
                    <th className="py-3 px-4 text-center text-xs font-medium text-slate-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map(client => (
                    <tr key={client.id} className="border-t border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="py-3 px-4">
                        <p className="font-medium text-slate-900 dark:text-white">{client.name}</p>
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-600 dark:text-slate-400">{client.domain}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          client.plan === 'Enterprise' ? 'bg-purple-100 text-purple-700' :
                          client.plan === 'Growth' ? 'bg-blue-100 text-blue-700' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {client.plan}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-900 dark:text-white font-medium">{client.users}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          client.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {client.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-500">{client.createdAt}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => toggleClientStatus(client.id)}
                            className={`p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700`}
                            title={client.status === 'active' ? 'Suspend' : 'Activate'}
                          >
                            {client.status === 'active' ? (
                              <Ban className="w-4 h-4 text-amber-500" />
                            ) : (
                              <CheckCircle className="w-4 h-4 text-emerald-500" />
                            )}
                          </button>
                          <button
                            onClick={() => deleteClient(client.id)}
                            className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Add Client Modal */}
          {showAddClient && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowAddClient(false)}>
              <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">Add Client</h2>
                  <button onClick={() => setShowAddClient(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Client Name</label>
                    <input
                      type="text"
                      value={clientForm.name}
                      onChange={e => setClientForm({ ...clientForm, name: e.target.value })}
                      placeholder="e.g. Acme Corp"
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Domain</label>
                    <input
                      type="text"
                      value={clientForm.domain}
                      onChange={e => setClientForm({ ...clientForm, domain: e.target.value })}
                      placeholder="e.g. acme.crm-whitelabel.com"
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Plan</label>
                    <select
                      value={clientForm.plan}
                      onChange={e => setClientForm({ ...clientForm, plan: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
                    >
                      <option value="Starter">Starter</option>
                      <option value="Growth">Growth</option>
                      <option value="Enterprise">Enterprise</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Admin Email</label>
                    <input
                      type="email"
                      value={clientForm.adminEmail}
                      onChange={e => setClientForm({ ...clientForm, adminEmail: e.target.value })}
                      placeholder="admin@acmecorp.com"
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                  <button
                    onClick={() => setShowAddClient(false)}
                    className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddClient}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
                  >
                    <Plus className="w-4 h-4" /> Add Client
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Commissions Tab */}
      {activeTab === 'Commissions' && (
        <div className="space-y-6">
          {/* Commission Settings */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">Commission Settings</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Commission Rate */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  <div className="flex items-center gap-2 mb-1">
                    <ArrowUpRight className="w-4 h-4" /> Commission Rate
                  </div>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={commissionRate}
                    onChange={e => setCommissionRate(e.target.value)}
                    min="0"
                    max="100"
                    placeholder="20"
                    className="w-full px-3 py-2 pr-8 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">%</span>
                </div>
              </div>

              {/* Payout Method */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Wallet className="w-4 h-4" /> Payout Method
                  </div>
                </label>
                <select
                  value={payoutMethod}
                  onChange={e => setPayoutMethod(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
                >
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="UPI">UPI</option>
                  <option value="PayPal">PayPal</option>
                </select>
              </div>

              {/* Min Payout Threshold */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  <div className="flex items-center gap-2 mb-1">
                    <IndianRupee className="w-4 h-4" /> Min Payout Threshold
                  </div>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">&#8377;</span>
                  <input
                    type="number"
                    value={minPayout}
                    onChange={e => setMinPayout(e.target.value)}
                    min="0"
                    placeholder="5000"
                    className="w-full pl-7 pr-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => toast.success('Commission settings saved')}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
              >
                <CheckCircle className="w-4 h-4" /> Save Settings
              </button>
            </div>
          </div>

          {/* Recent Payouts */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <h3 className="font-semibold text-slate-900 dark:text-white">Recent Payouts</h3>
              <button
                onClick={handleRequestPayout}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
              >
                <CreditCard className="w-4 h-4" /> Request Payout
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-800/50">
                  <tr>
                    <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">Date</th>
                    <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">Amount</th>
                    <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">Clients</th>
                    <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {payouts.map(payout => (
                    <tr key={payout.id} className="border-t border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="py-3 px-4 text-sm text-slate-900 dark:text-white">{payout.date}</td>
                      <td className="py-3 px-4 text-sm font-medium text-slate-900 dark:text-white">
                        &#8377;{payout.amount.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-600 dark:text-slate-400">{payout.clients} clients</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          payout.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {payout.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Commission Summary */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Commission Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                  &#8377;{((mrr * parseInt(commissionRate || '0')) / 100).toLocaleString('en-IN')}
                </p>
                <p className="text-sm text-slate-500 mt-1">Monthly Commission</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-emerald-600">
                  &#8377;{payouts.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0).toLocaleString('en-IN')}
                </p>
                <p className="text-sm text-slate-500 mt-1">Total Paid Out</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-amber-600">
                  &#8377;{payouts.filter(p => p.status === 'pending').reduce((s, p) => s + p.amount, 0).toLocaleString('en-IN')}
                </p>
                <p className="text-sm text-slate-500 mt-1">Pending Payout</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}