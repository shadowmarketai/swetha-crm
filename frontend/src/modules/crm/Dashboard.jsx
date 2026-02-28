/**
 * CRM Dashboard - Overview of leads, deals, and activities
 */

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { usePermissions } from '../../hooks/usePermissions';
import {
  Users, TrendingUp, TrendingDown, IndianRupee, Target, Phone, Calendar,
  Mail, Clock, MoreVertical, ChevronRight, ArrowUpRight, Filter, Plus, X
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

const StatCard = ({ label, value, change, changeType, icon: Icon, color }) => (
  <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700">
    <div className="flex items-center justify-between">
      <div className={`p-2.5 rounded-xl ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      {change && (
        <span className={`flex items-center gap-1 text-sm font-medium ${changeType === 'up' ? 'text-emerald-600' : 'text-red-500'}`}>
          {changeType === 'up' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          {change}
        </span>
      )}
    </div>
    <p className="text-2xl font-bold text-slate-900 dark:text-white mt-4">{value}</p>
    <p className="text-sm text-slate-500 mt-1">{label}</p>
  </div>
);

const LeadRow = ({ lead, onMenuToggle, activeMenu, canUpdate, canDelete }) => {
  const statusColors = {
    new: 'bg-blue-100 text-blue-700',
    contacted: 'bg-amber-100 text-amber-700',
    qualified: 'bg-emerald-100 text-emerald-700',
    lost: 'bg-red-100 text-red-700',
  };

  return (
    <tr className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50">
      <td className="py-3 px-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
            {lead.name.charAt(0)}
          </div>
          <div>
            <p className="font-medium text-slate-900 dark:text-white">{lead.name}</p>
            <p className="text-sm text-slate-500">{lead.company}</p>
          </div>
        </div>
      </td>
      <td className="py-3 px-4 text-sm text-slate-600 dark:text-slate-400">{lead.phone}</td>
      <td className="py-3 px-4">
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[lead.status]}`}>
          {lead.status}
        </span>
      </td>
      <td className="py-3 px-4 text-sm text-slate-600 dark:text-slate-400">{lead.source}</td>
      <td className="py-3 px-4 text-sm text-slate-500">{lead.created}</td>
      <td className="py-3 px-4 relative">
        <button
          onClick={() => onMenuToggle(lead.name)}
          className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
        >
          <MoreVertical className="w-4 h-4 text-slate-400" />
        </button>
        {activeMenu === lead.name && (
          <div className="absolute right-4 top-10 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg z-20 w-36 py-1">
            <button
              onClick={() => { onMenuToggle(null); toast.success(`Viewing ${lead.name}`); }}
              className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
            >View Details</button>
            {canUpdate && (
              <button
                onClick={() => { onMenuToggle(null); toast.success(`Editing ${lead.name}`); }}
                className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
              >Edit Lead</button>
            )}
            {canDelete && (
              <button
                onClick={() => { onMenuToggle(null); toast.success(`${lead.name} deleted`); }}
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
              >Delete</button>
            )}
          </div>
        )}
      </td>
    </tr>
  );
};

const ActivityItem = ({ activity }) => {
  const icons = { call: Phone, email: Mail, meeting: Calendar };
  const Icon = icons[activity.type] || Phone;

  return (
    <div className="flex items-start gap-3 py-3 border-b border-slate-100 dark:border-slate-700 last:border-0">
      <div className={`p-2 rounded-lg ${
        activity.type === 'call' ? 'bg-emerald-100 text-emerald-600' :
        activity.type === 'email' ? 'bg-blue-100 text-blue-600' :
        'bg-purple-100 text-purple-600'
      }`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-slate-900 dark:text-white">{activity.title}</p>
        <p className="text-xs text-slate-500">{activity.contact} • {activity.time}</p>
      </div>
    </div>
  );
};

export default function CRMDashboard() {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const canCreate = can('crm', 'create');
  const canUpdate = can('crm', 'update');
  const canDelete = can('crm', 'delete');
  const [showAddModal, setShowAddModal] = useState(false);
  const [activeMenu, setActiveMenu] = useState(null);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', company: '', source: 'Website' });

  const stats = [
    { label: 'Total Leads', value: '2,847', change: '+12%', changeType: 'up', icon: Users, color: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600' },
    { label: 'Qualified', value: '892', change: '+8%', changeType: 'up', icon: Target, color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600' },
    { label: 'Total Revenue', value: '₹24.5L', change: '+18%', changeType: 'up', icon: IndianRupee, color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600' },
    { label: 'Conversion Rate', value: '31.3%', change: '-2%', changeType: 'down', icon: TrendingUp, color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600' },
  ];

  const revenueData = [
    { month: 'Sep', revenue: 1450000 }, { month: 'Oct', revenue: 1680000 },
    { month: 'Nov', revenue: 1920000 }, { month: 'Dec', revenue: 2080000 },
    { month: 'Jan', revenue: 2280000 }, { month: 'Feb', revenue: 2450000 },
  ];

  const leadsData = [
    { day: 'Mon', leads: 45 }, { day: 'Tue', leads: 52 }, { day: 'Wed', leads: 38 },
    { day: 'Thu', leads: 65 }, { day: 'Fri', leads: 48 }, { day: 'Sat', leads: 32 }, { day: 'Sun', leads: 28 },
  ];

  const leads = [
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

  const handleAddLead = () => {
    if (!formData.name || !formData.email || !formData.phone) {
      toast.error('Please fill in name, email, and phone');
      return;
    }
    toast.success(`Lead "${formData.name}" added successfully`);
    setFormData({ name: '', email: '', phone: '', company: '', source: 'Website' });
    setShowAddModal(false);
  };

  const handleMenuToggle = (name) => {
    setActiveMenu(prev => prev === name ? null : name);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">CRM Dashboard</h1>
          <p className="text-sm text-slate-500">Manage your leads and deals</p>
        </div>
        {canCreate && (
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
          >
            <Plus className="w-4 h-4" /> Add Lead
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => <StatCard key={i} {...stat} />)}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Revenue Trend</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `₹${v/100000}L`} />
                <Tooltip formatter={(v) => [`₹${(v/100000).toFixed(1)}L`, 'Revenue']} />
                <Area type="monotone" dataKey="revenue" stroke="#6366f1" fill="#6366f1" fillOpacity={0.2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Leads This Week</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={leadsData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="leads" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Leads Table & Activities */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
            <h3 className="font-semibold text-slate-900 dark:text-white">Recent Leads</h3>
            <Link to="/crm/leads" className="text-sm text-indigo-600 font-medium flex items-center gap-1 hover:text-indigo-700">
              View All <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase">Lead</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase">Phone</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase">Status</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase">Source</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase">Created</th>
                  <th className="py-3 px-4"></th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead, i) => (
                  <LeadRow
                    key={i}
                    lead={lead}
                    activeMenu={activeMenu}
                    onMenuToggle={handleMenuToggle}
                    canUpdate={canUpdate}
                    canDelete={canDelete}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
            <h3 className="font-semibold text-slate-900 dark:text-white">Today's Activities</h3>
            <button
              onClick={() => toast('Activity logging coming soon', { icon: '📋' })}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
            >
              <Plus className="w-4 h-4 text-slate-400" />
            </button>
          </div>
          <div className="p-4">
            {activities.map((activity, i) => <ActivityItem key={i} activity={activity} />)}
          </div>
        </div>
      </div>

      {/* Add Lead Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowAddModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Add New Lead</h2>
              <button onClick={() => setShowAddModal(false)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter full name"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  placeholder="Enter email"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Phone *</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+91 XXXXX XXXXX"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Company</label>
                <input
                  type="text"
                  value={formData.company}
                  onChange={e => setFormData({ ...formData, company: e.target.value })}
                  placeholder="Company name"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Source</label>
                <select
                  value={formData.source}
                  onChange={e => setFormData({ ...formData, source: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                >
                  <option>Website</option>
                  <option>Facebook</option>
                  <option>Google Ads</option>
                  <option>IndiaMart</option>
                  <option>LinkedIn</option>
                  <option>Referral</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
              >Cancel</button>
              <button
                onClick={handleAddLead}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
              >Save Lead</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
