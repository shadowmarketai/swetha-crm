/**
 * Marketing Module - Dashboard, Funnels, Landing Pages, Email, WhatsApp, SMS, Forms
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Megaphone, TrendingUp, TrendingDown, Users, Eye, MousePointer, Mail,
  MessageSquare, FileText, Plus, Search, Filter, Edit, Trash2, Copy,
  ExternalLink, MoreVertical, Play, Pause, BarChart3, Globe, Zap,
  ArrowRight, ArrowDown, CheckCircle, Target, ChevronRight, Settings
} from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { usePermissions } from '../../hooks/usePermissions';

// ==================== MARKETING DASHBOARD ====================
export function MarketingDashboard() {
  const { can } = usePermissions();
  const canCreate = can('marketing', 'create');

  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [campaignForm, setCampaignForm] = useState({ name: '', type: 'email', audience: '' });

  const stats = [
    { label: 'Total Visitors', value: '45,892', change: '+18%', changeType: 'up', icon: Eye, color: 'bg-indigo-100 text-indigo-600' },
    { label: 'Leads Captured', value: '2,847', change: '+12%', changeType: 'up', icon: Users, color: 'bg-emerald-100 text-emerald-600' },
    { label: 'Conversion Rate', value: '6.2%', change: '+0.8%', changeType: 'up', icon: Target, color: 'bg-purple-100 text-purple-600' },
    { label: 'Active Campaigns', value: '12', icon: Megaphone, color: 'bg-amber-100 text-amber-600' },
  ];

  const trafficData = [
    { day: 'Mon', visitors: 1245, leads: 78 }, { day: 'Tue', visitors: 1456, leads: 92 },
    { day: 'Wed', visitors: 1189, leads: 65 }, { day: 'Thu', visitors: 1567, leads: 98 },
    { day: 'Fri', visitors: 1678, leads: 112 }, { day: 'Sat', visitors: 890, leads: 45 },
    { day: 'Sun', visitors: 756, leads: 38 },
  ];

  const funnels = [
    { name: 'Real Estate Lead Funnel', visitors: 12400, leads: 892, conversion: 7.2 },
    { name: 'Product Launch Funnel', visitors: 8500, leads: 425, conversion: 5.0 },
  ];

  const campaigns = [
    { name: 'February Newsletter', type: 'email', status: 'active', sent: 24500, opened: 8750, clicked: 2340 },
    { name: 'New Product Alert', type: 'whatsapp', status: 'active', sent: 8200, opened: 6890, clicked: 3450 },
    { name: 'Weekend Offer', type: 'sms', status: 'completed', sent: 5000, opened: 4200, clicked: 1680 },
  ];

  const handleCreateCampaign = () => {
    if (!campaignForm.name.trim()) {
      toast.error('Campaign name is required');
      return;
    }
    toast.success(`Campaign "${campaignForm.name}" created successfully`);
    setCampaignForm({ name: '', type: 'email', audience: '' });
    setShowCampaignModal(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Marketing Dashboard</h1>
          <p className="text-sm text-slate-500">Funnels, campaigns, and lead generation</p>
        </div>
        {canCreate && (
        <button onClick={() => setShowCampaignModal(true)} className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
          <Plus className="w-4 h-4" /> New Campaign
        </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <div className={`p-2 rounded-lg ${stat.color}`}><stat.icon className="w-5 h-5" /></div>
              {stat.change && (
                <span className={`text-sm font-medium ${stat.changeType === 'up' ? 'text-emerald-600' : 'text-red-500'}`}>
                  {stat.change}
                </span>
              )}
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-4">{stat.value}</p>
            <p className="text-sm text-slate-500 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Traffic Chart & Funnels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Traffic & Leads</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trafficData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Area type="monotone" dataKey="visitors" stroke="#6366f1" fill="#6366f1" fillOpacity={0.2} />
                <Area type="monotone" dataKey="leads" stroke="#22c55e" fill="#22c55e" fillOpacity={0.3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900 dark:text-white">Active Funnels</h3>
            <button onClick={() => toast('Navigating to all funnels', { icon: '>' })} className="text-sm text-indigo-600 font-medium hover:text-indigo-700">View All</button>
          </div>
          <div className="space-y-4">
            {funnels.map((funnel, i) => (
              <div key={i} className="p-4 border border-slate-200 dark:border-slate-700 rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-slate-900 dark:text-white">{funnel.name}</h4>
                  <span className="text-emerald-600 font-semibold">{funnel.conversion}%</span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-slate-500">{funnel.visitors.toLocaleString()} visitors</span>
                  <ArrowRight className="w-4 h-4 text-slate-300" />
                  <span className="text-slate-500">{funnel.leads.toLocaleString()} leads</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Campaigns */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-x-auto">
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 min-w-[600px]">
          <h3 className="font-semibold text-slate-900 dark:text-white">Recent Campaigns</h3>
          <button onClick={() => toast('Navigating to all campaigns', { icon: '>' })} className="text-sm text-indigo-600 font-medium hover:text-indigo-700">View All</button>
        </div>
        <table className="w-full min-w-[600px]">
          <thead className="bg-slate-50 dark:bg-slate-800/50">
            <tr>
              <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">Campaign</th>
              <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">Type</th>
              <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">Sent</th>
              <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">Opened</th>
              <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">Clicked</th>
              <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((campaign, i) => (
              <tr key={i} className="border-t border-slate-100 dark:border-slate-700">
                <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">{campaign.name}</td>
                <td className="py-3 px-4">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    campaign.type === 'email' ? 'bg-blue-100 text-blue-700' :
                    campaign.type === 'whatsapp' ? 'bg-emerald-100 text-emerald-700' :
                    'bg-purple-100 text-purple-700'
                  }`}>
                    {campaign.type}
                  </span>
                </td>
                <td className="py-3 px-4 text-sm text-slate-600">{campaign.sent.toLocaleString()}</td>
                <td className="py-3 px-4 text-sm text-slate-600">{campaign.opened.toLocaleString()}</td>
                <td className="py-3 px-4 text-sm text-slate-600">{campaign.clicked.toLocaleString()}</td>
                <td className="py-3 px-4">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${campaign.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                    {campaign.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create Campaign Modal */}
      {showCampaignModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowCampaignModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Create New Campaign</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Campaign Name</label>
                <input type="text" value={campaignForm.name} onChange={e => setCampaignForm({ ...campaignForm, name: e.target.value })} placeholder="e.g. March Newsletter" className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Type</label>
                <select value={campaignForm.type} onChange={e => setCampaignForm({ ...campaignForm, type: e.target.value })} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white rounded-lg text-sm">
                  <option value="email">Email</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="sms">SMS</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Target Audience</label>
                <input type="text" value={campaignForm.audience} onChange={e => setCampaignForm({ ...campaignForm, audience: e.target.value })} placeholder="e.g. All active leads" className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white rounded-lg text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowCampaignModal(false)} className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-300">Cancel</button>
              <button onClick={handleCreateCampaign} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">Create Campaign</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== FUNNELS PAGE ====================
export function FunnelsPage() {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const canCreate = can('marketing', 'create');
  const canUpdate = can('marketing', 'update');
  const canDelete = can('marketing', 'delete');

  const [showModal, setShowModal] = useState(false);
  const [funnelForm, setFunnelForm] = useState({ name: '', type: 'lead-capture' });
  const [searchQuery, setSearchQuery] = useState('');

  const allFunnels = [
    { id: 1, name: 'Real Estate Lead Funnel', steps: 4, visitors: 12400, leads: 892, conversion: 7.2, status: 'active' },
    { id: 2, name: 'Product Launch Funnel', steps: 5, visitors: 8500, leads: 425, conversion: 5.0, status: 'active' },
    { id: 3, name: 'Webinar Registration', steps: 3, visitors: 3200, leads: 456, conversion: 14.2, status: 'active' },
    { id: 4, name: 'Free Trial Signup', steps: 2, visitors: 5600, leads: 892, conversion: 15.9, status: 'draft' },
  ];

  const funnels = allFunnels.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const handleCreateFunnel = () => {
    if (!funnelForm.name.trim()) {
      toast.error('Funnel name is required');
      return;
    }
    toast.success(`Funnel "${funnelForm.name}" created successfully`);
    setFunnelForm({ name: '', type: 'lead-capture' });
    setShowModal(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Funnels</h1>
          <p className="text-sm text-slate-500">Build and manage sales funnels</p>
        </div>
        {canCreate && (
        <button onClick={() => navigate('/marketing/funnels/builder')} className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
          <Plus className="w-4 h-4" /> Create Funnel
        </button>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search funnels..." className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm dark:text-white" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {funnels.map(funnel => (
          <div key={funnel.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden hover:shadow-md transition-shadow">
            <div className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white">{funnel.name}</h3>
                  <p className="text-sm text-slate-500">{funnel.steps} steps</p>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-medium ${funnel.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                  {funnel.status}
                </span>
              </div>

              <div className="flex items-center justify-center gap-1 mb-4">
                {Array(funnel.steps).fill(0).map((_, i) => (
                  <React.Fragment key={i}>
                    <div className="w-8 h-8 bg-indigo-100 rounded flex items-center justify-center text-xs font-medium text-indigo-600">
                      {i + 1}
                    </div>
                    {i < funnel.steps - 1 && <ArrowRight className="w-4 h-4 text-slate-300" />}
                  </React.Fragment>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-2">
                  <p className="text-lg font-bold text-slate-900 dark:text-white">{(funnel.visitors / 1000).toFixed(1)}K</p>
                  <p className="text-xs text-slate-500">Visitors</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-2">
                  <p className="text-lg font-bold text-emerald-600">{funnel.leads}</p>
                  <p className="text-xs text-slate-500">Leads</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-2">
                  <p className="text-lg font-bold text-indigo-600">{funnel.conversion}%</p>
                  <p className="text-xs text-slate-500">Conv.</p>
                </div>
              </div>
            </div>

            <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
              {canUpdate && (
              <button onClick={() => navigate(`/marketing/funnels/builder/${funnel.id}`)} className="text-sm text-indigo-600 font-medium flex items-center gap-1 hover:text-indigo-700">
                <Edit className="w-3 h-3" /> Edit
              </button>
              )}
              <button onClick={() => toast.success(`Archived "${funnel.name}"`)} className="text-sm text-slate-500 flex items-center gap-1 hover:text-slate-700">
                <BarChart3 className="w-3 h-3" /> Analytics
              </button>
              {canDelete && (
              <button onClick={() => toast.success(`Deleted "${funnel.name}"`)} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-600 rounded">
                <Trash2 className="w-4 h-4 text-slate-400" />
              </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {funnels.length === 0 && (
        <div className="text-center py-12 text-slate-500">No funnels match your search.</div>
      )}

      {/* Create Funnel Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Create New Funnel</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Funnel Name</label>
                <input type="text" value={funnelForm.name} onChange={e => setFunnelForm({ ...funnelForm, name: e.target.value })} placeholder="e.g. Lead Capture Funnel" className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Funnel Type</label>
                <select value={funnelForm.type} onChange={e => setFunnelForm({ ...funnelForm, type: e.target.value })} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white rounded-lg text-sm">
                  <option value="lead-capture">Lead Capture</option>
                  <option value="sales">Sales Funnel</option>
                  <option value="webinar">Webinar Registration</option>
                  <option value="product-launch">Product Launch</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-300">Cancel</button>
              <button onClick={handleCreateFunnel} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== LANDING PAGES ====================
export function LandingPagesPage() {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const canCreate = can('marketing', 'create');
  const canUpdate = can('marketing', 'update');

  const [showModal, setShowModal] = useState(false);
  const [pageForm, setPageForm] = useState({ name: '', template: 'blank' });

  const pages = [
    { id: 1, name: 'Property Investment', url: '/property-investment', views: 8500, conversions: 425, rate: 5.0, status: 'published' },
    { id: 2, name: 'Free Consultation', url: '/free-consultation', views: 6200, conversions: 558, rate: 9.0, status: 'published' },
    { id: 3, name: 'Product Demo', url: '/demo', views: 4100, conversions: 287, rate: 7.0, status: 'published' },
    { id: 4, name: 'Webinar Registration', url: '/webinar', views: 2800, conversions: 392, rate: 14.0, status: 'draft' },
  ];

  const handleCreatePage = () => {
    if (!pageForm.name.trim()) {
      toast.error('Page name is required');
      return;
    }
    toast.success(`Landing page "${pageForm.name}" created successfully`);
    setPageForm({ name: '', template: 'blank' });
    setShowModal(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Landing Pages</h1>
          <p className="text-sm text-slate-500">Create high-converting landing pages</p>
        </div>
        {canCreate && (
        <button onClick={() => navigate('/marketing/landing-pages/builder')} className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
          <Plus className="w-4 h-4" /> Create Page
        </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {pages.map(page => (
          <div key={page.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="h-40 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center">
              <Globe className="w-12 h-12 text-slate-300" />
            </div>
            <div className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white">{page.name}</h3>
                  <p className="text-sm text-slate-500">{page.url}</p>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-medium ${page.status === 'published' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  {page.status}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center mb-4">
                <div>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">{(page.views / 1000).toFixed(1)}K</p>
                  <p className="text-xs text-slate-500">Views</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-emerald-600">{page.conversions}</p>
                  <p className="text-xs text-slate-500">Conv.</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-indigo-600">{page.rate}%</p>
                  <p className="text-xs text-slate-500">Rate</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {canUpdate && (
                <button onClick={() => navigate(`/marketing/landing-pages/builder/${page.id}`)} className="flex-1 px-3 py-2 bg-indigo-100 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-200">
                  <Edit className="w-3 h-3 inline mr-1" /> Edit
                </button>
                )}
                <button onClick={() => toast.success(`Opening preview for "${page.name}"`)} className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700">
                  <ExternalLink className="w-4 h-4 text-slate-500" />
                </button>
                <button onClick={() => { if (page.status === 'draft') { toast.success(`"${page.name}" published`); } else { toast('Page already published', { icon: 'i' }); } }} className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700">
                  <Copy className="w-4 h-4 text-slate-500" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Create Page Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Create Landing Page</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Page Name</label>
                <input type="text" value={pageForm.name} onChange={e => setPageForm({ ...pageForm, name: e.target.value })} placeholder="e.g. Product Launch" className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Template</label>
                <select value={pageForm.template} onChange={e => setPageForm({ ...pageForm, template: e.target.value })} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white rounded-lg text-sm">
                  <option value="blank">Blank Page</option>
                  <option value="lead-capture">Lead Capture</option>
                  <option value="product-launch">Product Launch</option>
                  <option value="webinar">Webinar Registration</option>
                  <option value="real-estate">Real Estate</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-300">Cancel</button>
              <button onClick={handleCreatePage} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== EMAIL CAMPAIGNS ====================
export function EmailCampaignsPage() {
  const { can } = usePermissions();
  const canCreate = can('marketing', 'create');
  const canUpdate = can('marketing', 'update');
  const canDelete = can('marketing', 'delete');
  const [showModal, setShowModal] = useState(false);
  const [emailForm, setEmailForm] = useState({ name: '', subject: '', from: '' });
  const [searchQuery, setSearchQuery] = useState('');

  const allCampaigns = [
    { id: 1, name: 'February Newsletter', subject: 'Exciting Updates This Month!', sent: 24500, opened: 8750, clicked: 2340, status: 'sent', sentAt: '2024-02-15' },
    { id: 2, name: 'Product Announcement', subject: 'Introducing Our New Feature', sent: 18200, opened: 7280, clicked: 1820, status: 'sent', sentAt: '2024-02-10' },
    { id: 3, name: 'Welcome Series - Day 1', subject: 'Welcome to VoiceFlow!', sent: 5600, opened: 3920, clicked: 1680, status: 'active', sentAt: 'Automated' },
    { id: 4, name: 'March Campaign', subject: 'Draft...', sent: 0, opened: 0, clicked: 0, status: 'draft', sentAt: '-' },
  ];

  const campaigns = allCampaigns.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.subject.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateEmail = () => {
    if (!emailForm.name.trim()) {
      toast.error('Campaign name is required');
      return;
    }
    if (!emailForm.subject.trim()) {
      toast.error('Subject line is required');
      return;
    }
    toast.success(`Email campaign "${emailForm.name}" created`);
    setEmailForm({ name: '', subject: '', from: '' });
    setShowModal(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Email Campaigns</h1>
          <p className="text-sm text-slate-500">Create and manage email marketing</p>
        </div>
        {canCreate && (
        <button onClick={() => setShowModal(true)} className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
          <Plus className="w-4 h-4" /> New Campaign
        </button>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search campaigns..." className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm dark:text-white" />
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead className="bg-slate-50 dark:bg-slate-800/50">
            <tr>
              <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">Campaign</th>
              <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">Sent</th>
              <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">Opened</th>
              <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">Clicked</th>
              <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
              <th className="py-3 px-4 text-center text-xs font-medium text-slate-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map(campaign => (
              <tr key={campaign.id} className="border-t border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <td className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Mail className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900 dark:text-white">{campaign.name}</p>
                      <p className="text-sm text-slate-500 truncate max-w-[200px]">{campaign.subject}</p>
                    </div>
                  </div>
                </td>
                <td className="py-3 px-4 text-sm text-slate-600 dark:text-slate-400">{campaign.sent.toLocaleString()}</td>
                <td className="py-3 px-4">
                  <span className="text-sm text-slate-600 dark:text-slate-400">{campaign.opened.toLocaleString()}</span>
                  {campaign.sent > 0 && <span className="text-xs text-slate-400 ml-1">({Math.round(campaign.opened / campaign.sent * 100)}%)</span>}
                </td>
                <td className="py-3 px-4">
                  <span className="text-sm text-slate-600 dark:text-slate-400">{campaign.clicked.toLocaleString()}</span>
                  {campaign.sent > 0 && <span className="text-xs text-slate-400 ml-1">({Math.round(campaign.clicked / campaign.sent * 100)}%)</span>}
                </td>
                <td className="py-3 px-4">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    campaign.status === 'sent' ? 'bg-emerald-100 text-emerald-700' :
                    campaign.status === 'active' ? 'bg-blue-100 text-blue-700' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    {campaign.status}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center justify-center gap-1">
                    {campaign.status === 'draft' && (
                      <button onClick={() => toast.success(`Sending "${campaign.name}"...`)} className="p-1.5 hover:bg-emerald-100 rounded-lg" title="Send">
                        <Play className="w-4 h-4 text-emerald-500" />
                      </button>
                    )}
                    {campaign.status === 'draft' && (
                      <button onClick={() => toast.success(`"${campaign.name}" scheduled`)} className="p-1.5 hover:bg-blue-100 rounded-lg" title="Schedule">
                        <Settings className="w-4 h-4 text-blue-400" />
                      </button>
                    )}
                    {canUpdate && (
                    <button onClick={() => toast.success(`Editing "${campaign.name}"`)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg" title="Edit"><Edit className="w-4 h-4 text-slate-400" /></button>
                    )}
                    <button onClick={() => toast.success(`"${campaign.name}" duplicated`)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg" title="Duplicate"><Copy className="w-4 h-4 text-slate-400" /></button>
                    {canDelete && (
                    <button onClick={() => toast.success(`"${campaign.name}" deleted`)} className="p-1.5 hover:bg-red-100 rounded-lg" title="Delete"><Trash2 className="w-4 h-4 text-red-400" /></button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {campaigns.length === 0 && (
          <div className="text-center py-8 text-slate-500">No campaigns match your search.</div>
        )}
      </div>

      {/* Create Email Campaign Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">New Email Campaign</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Campaign Name</label>
                <input type="text" value={emailForm.name} onChange={e => setEmailForm({ ...emailForm, name: e.target.value })} placeholder="e.g. March Newsletter" className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Subject Line</label>
                <input type="text" value={emailForm.subject} onChange={e => setEmailForm({ ...emailForm, subject: e.target.value })} placeholder="e.g. Exciting updates this month!" className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">From Name</label>
                <input type="text" value={emailForm.from} onChange={e => setEmailForm({ ...emailForm, from: e.target.value })} placeholder="e.g. VoiceFlow Team" className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white rounded-lg text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-300">Cancel</button>
              <button onClick={handleCreateEmail} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== WHATSAPP PAGE ====================
export function WhatsAppPage() {
  const { can } = usePermissions();
  const canCreate = can('marketing', 'create');
  const canUpdate = can('marketing', 'update');
  const canDelete = can('marketing', 'delete');

  const [showModal, setShowModal] = useState(false);
  const [templateForm, setTemplateForm] = useState({ name: '', category: 'marketing', body: '' });

  const templates = ['Welcome Message', 'Appointment Reminder', 'Payment Confirmation', 'Order Update'];

  const handleCreateTemplate = () => {
    if (!templateForm.name.trim()) {
      toast.error('Template name is required');
      return;
    }
    toast.success(`Template "${templateForm.name}" created`);
    setTemplateForm({ name: '', category: 'marketing', body: '' });
    setShowModal(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">WhatsApp Marketing</h1>
          <p className="text-sm text-slate-500">Broadcast messages and automation</p>
        </div>
        {canCreate && (
        <button onClick={() => setShowModal(true)} className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700">
          <Plus className="w-4 h-4" /> New Template
        </button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Messages Sent', value: '24.5K', color: 'text-emerald-600' },
          { label: 'Delivered', value: '98.2%', color: 'text-blue-600' },
          { label: 'Read', value: '84.5%', color: 'text-purple-600' },
          { label: 'Replied', value: '32.1%', color: 'text-amber-600' },
        ].map((stat, i) => (
          <div key={i} className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-sm text-slate-500">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700">
        <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Message Templates</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template, i) => (
            <div key={i} className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 hover:border-emerald-400 cursor-pointer">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-emerald-600" />
                </div>
                <h4 className="font-medium text-slate-900 dark:text-white">{template}</h4>
              </div>
              <p className="text-sm text-slate-500 mb-3">Approved template for WhatsApp Business</p>
              <div className="flex items-center gap-2">
                <button onClick={() => toast.success(`Sending "${template}" broadcast`)} className="flex-1 px-3 py-2 bg-emerald-100 text-emerald-700 rounded-lg text-sm font-medium hover:bg-emerald-200">Send</button>
                {canUpdate && (
                <button onClick={() => toast.success(`Editing "${template}"`)} className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700">
                  <Edit className="w-4 h-4 text-slate-500" />
                </button>
                )}
                {canDelete && (
                <button onClick={() => toast.success(`"${template}" deleted`)} className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-red-50">
                  <Trash2 className="w-4 h-4 text-red-400" />
                </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* New Template Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">New WhatsApp Template</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Template Name</label>
                <input type="text" value={templateForm.name} onChange={e => setTemplateForm({ ...templateForm, name: e.target.value })} placeholder="e.g. Order Shipped" className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Category</label>
                <select value={templateForm.category} onChange={e => setTemplateForm({ ...templateForm, category: e.target.value })} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white rounded-lg text-sm">
                  <option value="marketing">Marketing</option>
                  <option value="utility">Utility</option>
                  <option value="authentication">Authentication</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Message Body</label>
                <textarea value={templateForm.body} onChange={e => setTemplateForm({ ...templateForm, body: e.target.value })} rows={3} placeholder="Type your template message..." className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white rounded-lg text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-300">Cancel</button>
              <button onClick={handleCreateTemplate} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== SMS PAGE ====================
export function SMSPage() {
  const { can } = usePermissions();
  const canCreate = can('marketing', 'create');

  const [showModal, setShowModal] = useState(false);
  const [smsForm, setSmsForm] = useState({ name: '', recipients: '', message: '' });
  const [quickMessage, setQuickMessage] = useState('');
  const [quickRecipients, setQuickRecipients] = useState('');

  const handleCreateCampaign = () => {
    if (!smsForm.name.trim()) {
      toast.error('Campaign name is required');
      return;
    }
    toast.success(`SMS campaign "${smsForm.name}" created`);
    setSmsForm({ name: '', recipients: '', message: '' });
    setShowModal(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">SMS Campaigns</h1>
          <p className="text-sm text-slate-500">Bulk SMS and text marketing</p>
        </div>
        {canCreate && (
        <button onClick={() => setShowModal(true)} className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700">
          <Plus className="w-4 h-4" /> New SMS Campaign
        </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'SMS Sent Today', value: '1,234' },
          { label: 'Delivery Rate', value: '97.8%' },
          { label: 'Credits Remaining', value: '45,600' },
        ].map((stat, i) => (
          <div key={i} className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700">
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{stat.value}</p>
            <p className="text-sm text-slate-500">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700">
        <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Quick Send</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Recipients</label>
            <select value={quickRecipients} onChange={e => setQuickRecipients(e.target.value)} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white rounded-lg">
              <option value="">Select contact list...</option>
              <option value="feb-leads">February Leads (2,456 contacts)</option>
              <option value="active-customers">Active Customers (1,234 contacts)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Message</label>
            <textarea rows={3} value={quickMessage} onChange={e => setQuickMessage(e.target.value)} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white rounded-lg" placeholder="Type your message..." />
            <p className="text-xs text-slate-400 mt-1">{quickMessage.length}/160 characters</p>
          </div>
          <button onClick={() => {
            if (!quickRecipients) { toast.error('Select a recipient list'); return; }
            if (!quickMessage.trim()) { toast.error('Message cannot be empty'); return; }
            toast.success('SMS sent successfully');
            setQuickMessage('');
            setQuickRecipients('');
          }} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700">Send SMS</button>
        </div>
      </div>

      {/* New SMS Campaign Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">New SMS Campaign</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Campaign Name</label>
                <input type="text" value={smsForm.name} onChange={e => setSmsForm({ ...smsForm, name: e.target.value })} placeholder="e.g. Flash Sale Alert" className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Recipient List</label>
                <select value={smsForm.recipients} onChange={e => setSmsForm({ ...smsForm, recipients: e.target.value })} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white rounded-lg text-sm">
                  <option value="">Select list...</option>
                  <option value="all-leads">All Leads</option>
                  <option value="active">Active Customers</option>
                  <option value="feb-leads">February Leads</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Message</label>
                <textarea value={smsForm.message} onChange={e => setSmsForm({ ...smsForm, message: e.target.value })} rows={3} placeholder="Type your SMS..." className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white rounded-lg text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-300">Cancel</button>
              <button onClick={handleCreateCampaign} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== FORMS PAGE ====================
export function FormsPage() {
  const { can } = usePermissions();
  const canCreate = can('marketing', 'create');
  const canUpdate = can('marketing', 'update');
  const canDelete = can('marketing', 'delete');

  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ name: '', type: 'contact' });
  const [searchQuery, setSearchQuery] = useState('');

  const allForms = [
    { id: 1, name: 'Contact Us Form', submissions: 456, views: 2340, rate: 19.5, status: 'active' },
    { id: 2, name: 'Newsletter Signup', submissions: 892, views: 5600, rate: 15.9, status: 'active' },
    { id: 3, name: 'Demo Request', submissions: 234, views: 1200, rate: 19.5, status: 'active' },
    { id: 4, name: 'Feedback Survey', submissions: 156, views: 890, rate: 17.5, status: 'draft' },
  ];

  const forms = allForms.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const handleCreateForm = () => {
    if (!formData.name.trim()) {
      toast.error('Form name is required');
      return;
    }
    toast.success(`Form "${formData.name}" created successfully`);
    setFormData({ name: '', type: 'contact' });
    setShowModal(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Lead Forms</h1>
          <p className="text-sm text-slate-500">Create embeddable lead capture forms</p>
        </div>
        {canCreate && (
        <button onClick={() => setShowModal(true)} className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
          <Plus className="w-4 h-4" /> Create Form
        </button>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search forms..." className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm dark:text-white" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {forms.map(form => (
          <div key={form.id} className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white">{form.name}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded ${form.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                    {form.status}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center mb-4">
              <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-2">
                <p className="text-lg font-bold text-slate-900 dark:text-white">{form.submissions}</p>
                <p className="text-xs text-slate-500">Submissions</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-2">
                <p className="text-lg font-bold text-slate-900 dark:text-white">{form.views}</p>
                <p className="text-xs text-slate-500">Views</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-2">
                <p className="text-lg font-bold text-emerald-600">{form.rate}%</p>
                <p className="text-xs text-slate-500">Conv.</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {canUpdate && (
              <button onClick={() => toast.success(`Editing "${form.name}"`)} className="flex-1 px-3 py-2 bg-indigo-100 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-200">Edit</button>
              )}
              <button onClick={() => { navigator.clipboard.writeText(`<iframe src="/forms/${form.id}"></iframe>`).catch(() => {}); toast.success(`Embed code for "${form.name}" copied`); }} className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700" title="Copy embed code">
                <Copy className="w-4 h-4 text-slate-500" />
              </button>
              {canDelete && (
              <button onClick={() => toast.success(`"${form.name}" deleted`)} className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-red-50" title="Delete">
                <Trash2 className="w-4 h-4 text-red-400" />
              </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {forms.length === 0 && (
        <div className="text-center py-12 text-slate-500">No forms match your search.</div>
      )}

      {/* Create Form Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Create New Form</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Form Name</label>
                <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Contact Us" className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Form Type</label>
                <select value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white rounded-lg text-sm">
                  <option value="contact">Contact Form</option>
                  <option value="newsletter">Newsletter Signup</option>
                  <option value="demo">Demo Request</option>
                  <option value="feedback">Feedback</option>
                  <option value="survey">Survey</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-300">Cancel</button>
              <button onClick={handleCreateForm} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
