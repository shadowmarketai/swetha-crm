/**
 * CRM Leads Page - Full leads management
 */

import React, { useState, useMemo, useRef } from 'react';
import toast from 'react-hot-toast';
import { usePermissions } from '../../hooks/usePermissions';
import {
  Plus, Search, Filter, Download, Upload, MoreVertical, Phone, Mail,
  MessageSquare, Calendar, Edit, Trash2, Eye, ChevronDown, Check,
  Users, TrendingUp, Target, Clock, X
} from 'lucide-react';

const StatCard = ({ label, value, icon: Icon, color }) => (
  <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
    <div className="flex items-center gap-3">
      <div className={`p-2 rounded-lg ${color}`}><Icon className="w-4 h-4" /></div>
      <div>
        <p className="text-xl font-bold text-slate-900 dark:text-white">{value}</p>
        <p className="text-xs text-slate-500">{label}</p>
      </div>
    </div>
  </div>
);

const LEADS_PER_PAGE = 5;

export default function LeadsPage() {
  const { can } = usePermissions();
  const canCreate = can('crm', 'create');
  const canUpdate = can('crm', 'update');
  const canDelete = can('crm', 'delete');
  const [selectedLeads, setSelectedLeads] = useState([]);
  const [viewMode, setViewMode] = useState('table');
  const [filterOpen, setFilterOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [sourceFilter, setSourceFilter] = useState('All Sources');
  const [ownerFilter, setOwnerFilter] = useState('All Owners');
  const [currentPage, setCurrentPage] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', company: '', source: 'Website', owner: 'Arun' });
  const [activeRowMenu, setActiveRowMenu] = useState(null);
  const [viewingLead, setViewingLead] = useState(null);
  const [editingLead, setEditingLead] = useState(null);
  const [deletedLead, setDeletedLead] = useState(null);
  const [schedulingLead, setSchedulingLead] = useState(null);
  const [scheduleData, setScheduleData] = useState({ date: '', time: '', type: 'call', notes: '' });
  const fileInputRef = useRef(null);

  const [leads, setLeads] = useState([
    { id: 1, name: 'Rajesh Kumar', email: 'rajesh@techsolutions.com', phone: '+91 98765 43210', company: 'Tech Solutions Pvt', status: 'qualified', source: 'Facebook', score: 85, owner: 'Arun', created: '2024-02-20', lastContact: '2h ago' },
    { id: 2, name: 'Priya Sharma', email: 'priya@startup.com', phone: '+91 87654 32109', company: 'StartUp Inc', status: 'new', source: 'IndiaMart', score: 65, owner: 'Meera', created: '2024-02-20', lastContact: '3h ago' },
    { id: 3, name: 'Vikram Patel', email: 'vikram@global.com', phone: '+91 76543 21098', company: 'Global Corp', status: 'contacted', source: 'Google Ads', score: 72, owner: 'Arun', created: '2024-02-19', lastContact: '5h ago' },
    { id: 4, name: 'Ananya Reddy', email: 'ananya@digital.com', phone: '+91 65432 10987', company: 'Digital Agency', status: 'qualified', source: 'Website', score: 90, owner: 'Kavya', created: '2024-02-19', lastContact: '1d ago' },
    { id: 5, name: 'Karthik Iyer', email: 'karthik@finance.com', phone: '+91 54321 09876', company: 'Finance Pro', status: 'new', source: 'Referral', score: 55, owner: 'Arun', created: '2024-02-18', lastContact: '1d ago' },
    { id: 6, name: 'Deepa Menon', email: 'deepa@health.com', phone: '+91 43210 98765', company: 'HealthCare Plus', status: 'nurturing', source: 'LinkedIn', score: 78, owner: 'Meera', created: '2024-02-18', lastContact: '2d ago' },
    { id: 7, name: 'Suresh Nair', email: 'suresh@retail.com', phone: '+91 32109 87654', company: 'Retail Kings', status: 'contacted', source: 'Facebook', score: 60, owner: 'Kavya', created: '2024-02-17', lastContact: '2d ago' },
    { id: 8, name: 'Lakshmi Bhat', email: 'lakshmi@edu.com', phone: '+91 21098 76543', company: 'EduTech Solutions', status: 'qualified', source: 'Website', score: 88, owner: 'Arun', created: '2024-02-17', lastContact: '3d ago' },
  ]);

  const stats = [
    { label: 'Total Leads', value: leads.length.toLocaleString(), icon: Users, color: 'bg-indigo-100 text-indigo-600' },
    { label: 'New Today', value: leads.filter(l => l.status === 'new').length.toString(), icon: TrendingUp, color: 'bg-emerald-100 text-emerald-600' },
    { label: 'Qualified', value: leads.filter(l => l.status === 'qualified').length.toString(), icon: Target, color: 'bg-purple-100 text-purple-600' },
    { label: 'Pending', value: leads.filter(l => l.status === 'contacted' || l.status === 'nurturing').length.toString(), icon: Clock, color: 'bg-amber-100 text-amber-600' },
  ];

  const statusColors = {
    new: 'bg-blue-100 text-blue-700',
    contacted: 'bg-amber-100 text-amber-700',
    qualified: 'bg-emerald-100 text-emerald-700',
    nurturing: 'bg-purple-100 text-purple-700',
    lost: 'bg-red-100 text-red-700',
  };

  // Filtered leads
  const filteredLeads = useMemo(() => {
    let result = [...leads];

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(l =>
        l.name.toLowerCase().includes(q) ||
        l.email.toLowerCase().includes(q) ||
        l.phone.includes(q) ||
        l.company.toLowerCase().includes(q)
      );
    }

    // Status filter
    if (statusFilter !== 'All Status') {
      result = result.filter(l => l.status.toLowerCase() === statusFilter.toLowerCase());
    }

    // Source filter
    if (sourceFilter !== 'All Sources') {
      result = result.filter(l => l.source === sourceFilter);
    }

    // Owner filter
    if (ownerFilter !== 'All Owners') {
      result = result.filter(l => l.owner === ownerFilter);
    }

    return result;
  }, [leads, searchQuery, statusFilter, sourceFilter, ownerFilter]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / LEADS_PER_PAGE));
  const paginatedLeads = filteredLeads.slice((currentPage - 1) * LEADS_PER_PAGE, currentPage * LEADS_PER_PAGE);

  // Reset to page 1 when filters change
  const handleFilterChange = (setter) => (value) => {
    setter(value);
    setCurrentPage(1);
    setSelectedLeads([]);
  };

  const toggleSelect = (id) => {
    setSelectedLeads(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    setSelectedLeads(prev =>
      prev.length === paginatedLeads.length ? [] : paginatedLeads.map(l => l.id)
    );
  };

  const handleAddLead = () => {
    if (!formData.name || !formData.email || !formData.phone) {
      toast.error('Please fill in name, email, and phone');
      return;
    }
    const newLead = {
      id: Math.max(...leads.map(l => l.id)) + 1,
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      company: formData.company || '-',
      status: 'new',
      source: formData.source,
      score: 50,
      owner: formData.owner,
      created: new Date().toISOString().split('T')[0],
      lastContact: 'Just now',
    };
    setLeads(prev => [newLead, ...prev]);
    toast.success(`Lead "${formData.name}" added successfully`);
    setFormData({ name: '', email: '', phone: '', company: '', source: 'Website', owner: 'Arun' });
    setShowAddModal(false);
  };

  const handleDeleteLead = (lead) => {
    setDeletedLead(lead);
    setLeads(prev => prev.filter(l => l.id !== lead.id));
    setSelectedLeads(prev => prev.filter(id => id !== lead.id));
    toast(
      (t) => (
        <div className="flex items-center gap-3">
          <span>{lead.name} deleted</span>
          <button
            onClick={() => {
              setLeads(prev => [...prev, lead].sort((a, b) => a.id - b.id));
              setDeletedLead(null);
              toast.dismiss(t.id);
              toast.success(`${lead.name} restored`);
            }}
            className="px-2 py-1 bg-indigo-600 text-white text-xs rounded font-medium hover:bg-indigo-700"
          >
            Undo
          </button>
        </div>
      ),
      { duration: 5000 }
    );
  };

  const handleBulkAction = (action) => {
    const count = selectedLeads.length;
    const selectedLeadObjects = leads.filter(l => selectedLeads.includes(l.id));
    switch (action) {
      case 'call':
        toast.success(`Initiating call to ${count} lead${count > 1 ? 's' : ''}`);
        break;
      case 'whatsapp':
        toast.success(`Opening WhatsApp for ${count} lead${count > 1 ? 's' : ''}`);
        break;
      case 'email':
        toast.success(`Composing email to ${count} lead${count > 1 ? 's' : ''}`);
        break;
      case 'delete':
        setLeads(prev => prev.filter(l => !selectedLeads.includes(l.id)));
        setSelectedLeads([]);
        toast(
          (t) => (
            <div className="flex items-center gap-3">
              <span>{count} lead{count > 1 ? 's' : ''} deleted</span>
              <button
                onClick={() => {
                  setLeads(prev => [...prev, ...selectedLeadObjects].sort((a, b) => a.id - b.id));
                  toast.dismiss(t.id);
                  toast.success(`${count} lead${count > 1 ? 's' : ''} restored`);
                }}
                className="px-2 py-1 bg-indigo-600 text-white text-xs rounded font-medium hover:bg-indigo-700"
              >
                Undo
              </button>
            </div>
          ),
          { duration: 5000 }
        );
        break;
    }
  };

  const handleRowAction = (action, lead) => {
    switch (action) {
      case 'call':
        window.open(`tel:${lead.phone.replace(/\s/g, '')}`, '_self');
        toast.success(`Calling ${lead.name} at ${lead.phone}`);
        break;
      case 'whatsapp':
        window.open(`https://wa.me/${lead.phone.replace(/[\s+]/g, '')}`, '_blank');
        toast.success(`Opening WhatsApp for ${lead.name}`);
        break;
      case 'view':
        setViewingLead(lead);
        break;
      case 'more':
        setActiveRowMenu(prev => prev === lead.id ? null : lead.id);
        break;
    }
  };

  const handleEditSave = () => {
    if (!editingLead.name || !editingLead.email || !editingLead.phone) {
      toast.error('Name, email, and phone are required');
      return;
    }
    setLeads(prev => prev.map(l => l.id === editingLead.id ? editingLead : l));
    toast.success(`Lead "${editingLead.name}" updated`);
    setEditingLead(null);
  };

  return (
    <div className="space-y-6">
      {/* Hidden file input for CSV import */}
      <input
        type="file"
        ref={fileInputRef}
        accept=".csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (evt) => {
            try {
              const text = evt.target.result;
              const lines = text.split('\n').filter(l => l.trim());
              if (lines.length < 2) { toast.error('No data rows found in CSV'); return; }
              const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
              const nameIdx = headers.findIndex(h => h.includes('name'));
              const emailIdx = headers.findIndex(h => h.includes('email'));
              const phoneIdx = headers.findIndex(h => h.includes('phone'));
              const companyIdx = headers.findIndex(h => h.includes('company'));
              const sourceIdx = headers.findIndex(h => h.includes('source'));
              if (nameIdx === -1) { toast.error('CSV must have a "Name" column'); return; }
              let imported = 0;
              const maxId = Math.max(0, ...leads.map(l => l.id));
              const newLeads = [];
              for (let i = 1; i < lines.length; i++) {
                const cols = lines[i].split(',').map(c => c.trim().replace(/"/g, ''));
                if (!cols[nameIdx]) continue;
                newLeads.push({
                  id: maxId + i,
                  name: cols[nameIdx] || '',
                  email: emailIdx >= 0 ? cols[emailIdx] : '-',
                  phone: phoneIdx >= 0 ? cols[phoneIdx] : '-',
                  company: companyIdx >= 0 ? cols[companyIdx] : '-',
                  status: 'new',
                  source: sourceIdx >= 0 ? cols[sourceIdx] : 'Import',
                  score: 50,
                  owner: 'Arun',
                  created: new Date().toISOString().split('T')[0],
                  lastContact: 'Just now',
                });
                imported++;
              }
              setLeads(prev => [...newLeads, ...prev]);
              toast.success(`Imported ${imported} lead${imported !== 1 ? 's' : ''} from CSV`);
            } catch (err) {
              toast.error('Failed to parse CSV file');
            }
          };
          reader.readAsText(file);
          e.target.value = '';
        }}
      />
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Leads</h1>
          <p className="text-sm text-slate-500">Manage and convert your leads</p>
        </div>
        <div className="flex items-center gap-2">
          {canCreate && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
            >
              <Upload className="w-4 h-4" /> Import
            </button>
          )}
          <button
            onClick={() => {
              const headers = ['Name','Email','Phone','Company','Status','Source','Score','Owner','Created','Last Contact'];
              const rows = filteredLeads.map(l => [l.name, l.email, l.phone, l.company, l.status, l.source, l.score, l.owner, l.created, l.lastContact]);
              const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `leads_${new Date().toISOString().split('T')[0]}.csv`;
              a.click();
              URL.revokeObjectURL(url);
              toast.success(`Exported ${filteredLeads.length} leads as CSV`);
            }}
            className="flex items-center gap-2 px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
          >
            <Download className="w-4 h-4" /> Export
          </button>
          {canCreate && (
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
            >
              <Plus className="w-4 h-4" /> Add Lead
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => <StatCard key={i} {...stat} />)}
      </div>

      {/* Filters & Search */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search leads..."
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); setSelectedLeads([]); }}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={e => handleFilterChange(setStatusFilter)(e.target.value)}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
            >
              <option>All Status</option>
              <option>New</option>
              <option>Contacted</option>
              <option>Qualified</option>
              <option>Nurturing</option>
            </select>
            <select
              value={sourceFilter}
              onChange={e => handleFilterChange(setSourceFilter)(e.target.value)}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
            >
              <option>All Sources</option>
              <option>Facebook</option>
              <option>Facebook Leads</option>
              <option>Google Ads</option>
              <option>IndiaMart</option>
              <option>JustDial</option>
              <option>Website</option>
              <option>LinkedIn</option>
              <option>Referral</option>
            </select>
            <select
              value={ownerFilter}
              onChange={e => handleFilterChange(setOwnerFilter)(e.target.value)}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
            >
              <option>All Owners</option>
              <option>Arun</option>
              <option>Meera</option>
              <option>Kavya</option>
            </select>
            <button
              onClick={() => setFilterOpen(!filterOpen)}
              className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm ${filterOpen ? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:border-indigo-600 dark:text-indigo-300' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'}`}
            >
              <Filter className="w-4 h-4" /> {filterOpen ? 'Hide Filters' : 'More Filters'}
            </button>
          </div>
        </div>

        {filterOpen && (
          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Min Score</label>
                <input type="number" min="0" max="100" placeholder="0" className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm" onChange={e => {
                  const val = parseInt(e.target.value) || 0;
                  setLeads(prev => prev);
                }} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Max Score</label>
                <input type="number" min="0" max="100" placeholder="100" className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Created After</label>
                <input type="date" className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Created Before</label>
                <input type="date" className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm" />
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <button onClick={() => { setStatusFilter('All Status'); setSourceFilter('All Sources'); setOwnerFilter('All Owners'); setSearchQuery(''); setFilterOpen(false); setCurrentPage(1); toast.success('All filters cleared'); }} className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg font-medium">
                Clear All Filters
              </button>
            </div>
          </div>
        )}

        {/* Bulk Actions */}
        {selectedLeads.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 flex items-center gap-2">
            <span className="text-sm text-slate-600 dark:text-slate-400">{selectedLeads.length} selected</span>
            <button
              onClick={() => handleBulkAction('call')}
              className="px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-200"
            >
              <Phone className="w-4 h-4 inline mr-1" /> Call
            </button>
            <button
              onClick={() => handleBulkAction('whatsapp')}
              className="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-sm font-medium hover:bg-emerald-200"
            >
              <MessageSquare className="w-4 h-4 inline mr-1" /> WhatsApp
            </button>
            <button
              onClick={() => handleBulkAction('email')}
              className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-200"
            >
              <Mail className="w-4 h-4 inline mr-1" /> Email
            </button>
            {canDelete && (
              <button
                onClick={() => handleBulkAction('delete')}
                className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200"
              >
                <Trash2 className="w-4 h-4 inline mr-1" /> Delete
              </button>
            )}
          </div>
        )}
      </div>

      {/* Leads Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr>
                <th className="py-3 px-4 text-left">
                  <input
                    type="checkbox"
                    checked={paginatedLeads.length > 0 && selectedLeads.length === paginatedLeads.length}
                    onChange={toggleSelectAll}
                    className="rounded text-indigo-600"
                  />
                </th>
                <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">Lead</th>
                <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">Contact</th>
                <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">Source</th>
                <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">Score</th>
                <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">Owner</th>
                <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">Last Contact</th>
                <th className="py-3 px-4 text-center text-xs font-medium text-slate-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedLeads.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    No leads found matching your filters.
                  </td>
                </tr>
              ) : (
                paginatedLeads.map(lead => (
                  <tr key={lead.id} className="border-t border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="py-3 px-4">
                      <input
                        type="checkbox"
                        checked={selectedLeads.includes(lead.id)}
                        onChange={() => toggleSelect(lead.id)}
                        className="rounded text-indigo-600"
                      />
                    </td>
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
                    <td className="py-3 px-4">
                      <p className="text-sm text-slate-600 dark:text-slate-400">{lead.phone}</p>
                      <p className="text-sm text-slate-500">{lead.email}</p>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[lead.status]}`}>
                        {lead.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-600 dark:text-slate-400">{lead.source}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-12 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${lead.score >= 80 ? 'bg-emerald-500' : lead.score >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
                            style={{ width: `${lead.score}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium">{lead.score}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-600 dark:text-slate-400">{lead.owner}</td>
                    <td className="py-3 px-4 text-sm text-slate-500">{lead.lastContact}</td>
                    <td className="py-3 px-4 relative">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleRowAction('call', lead)}
                          className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                          title="Call"
                        >
                          <Phone className="w-4 h-4 text-slate-400" />
                        </button>
                        <button
                          onClick={() => handleRowAction('whatsapp', lead)}
                          className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                          title="WhatsApp"
                        >
                          <MessageSquare className="w-4 h-4 text-slate-400" />
                        </button>
                        <button
                          onClick={() => handleRowAction('view', lead)}
                          className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                          title="View"
                        >
                          <Eye className="w-4 h-4 text-slate-400" />
                        </button>
                        <button
                          onClick={() => handleRowAction('more', lead)}
                          className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                        >
                          <MoreVertical className="w-4 h-4 text-slate-400" />
                        </button>
                      </div>
                      {activeRowMenu === lead.id && (
                        <div className="absolute right-4 top-12 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg z-20 w-40 py-1">
                          {canUpdate && (
                            <button
                              onClick={() => { setActiveRowMenu(null); setEditingLead({ ...lead }); }}
                              className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"
                            ><Edit className="w-4 h-4" /> Edit</button>
                          )}
                          <button
                            onClick={() => { setActiveRowMenu(null); window.open(`mailto:${lead.email}`, '_blank'); toast.success(`Opening email for ${lead.name}`); }}
                            className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"
                          ><Mail className="w-4 h-4" /> Send Email</button>
                          <button
                            onClick={() => { setActiveRowMenu(null); setSchedulingLead(lead); setScheduleData({ date: '', time: '', type: 'call', notes: '' }); }}
                            className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"
                          ><Calendar className="w-4 h-4" /> Schedule</button>
                          {canDelete && (
                            <button
                              onClick={() => { setActiveRowMenu(null); handleDeleteLead(lead); }}
                              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                            ><Trash2 className="w-4 h-4" /> Delete</button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-700">
          <p className="text-sm text-slate-500">
            Showing {filteredLeads.length === 0 ? 0 : (currentPage - 1) * LEADS_PER_PAGE + 1}-{Math.min(currentPage * LEADS_PER_PAGE, filteredLeads.length)} of {filteredLeads.length} leads
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className={`px-3 py-1 border border-slate-200 dark:border-slate-700 rounded text-sm ${currentPage === 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-50 dark:hover:bg-slate-700'}`}
            >Previous</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`px-3 py-1 rounded text-sm ${page === currentPage ? 'bg-indigo-600 text-white' : 'border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
              >{page}</button>
            ))}
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className={`px-3 py-1 border border-slate-200 dark:border-slate-700 rounded text-sm ${currentPage === totalPages ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-50 dark:hover:bg-slate-700'}`}
            >Next</button>
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
                <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Enter full name" className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email *</label>
                <input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="Enter email" className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Phone *</label>
                <input type="tel" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} placeholder="+91 XXXXX XXXXX" className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Company</label>
                <input type="text" value={formData.company} onChange={e => setFormData({ ...formData, company: e.target.value })} placeholder="Company name" className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Source</label>
                  <select value={formData.source} onChange={e => setFormData({ ...formData, source: e.target.value })} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm">
                    <option>Website</option><option>Facebook</option><option>Google Ads</option><option>IndiaMart</option><option>LinkedIn</option><option>Referral</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Owner</label>
                  <select value={formData.owner} onChange={e => setFormData({ ...formData, owner: e.target.value })} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm">
                    <option>Arun</option><option>Meera</option><option>Kavya</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowAddModal(false)} className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700">Cancel</button>
              <button onClick={handleAddLead} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">Save Lead</button>
            </div>
          </div>
        </div>
      )}

      {/* View Lead Detail Modal */}
      {viewingLead && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setViewingLead(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Lead Details</h2>
              <button onClick={() => setViewingLead(null)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center text-white text-xl font-bold">
                {viewingLead.name.charAt(0)}
              </div>
              <div>
                <h3 className="text-xl font-semibold text-slate-900 dark:text-white">{viewingLead.name}</h3>
                <p className="text-sm text-slate-500">{viewingLead.company}</p>
              </div>
              <span className={`ml-auto px-3 py-1 rounded-full text-xs font-medium ${statusColors[viewingLead.status]}`}>
                {viewingLead.status}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-3">
                <p className="text-xs text-slate-500 mb-1">Email</p>
                <p className="text-sm font-medium text-slate-900 dark:text-white">{viewingLead.email}</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-3">
                <p className="text-xs text-slate-500 mb-1">Phone</p>
                <p className="text-sm font-medium text-slate-900 dark:text-white">{viewingLead.phone}</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-3">
                <p className="text-xs text-slate-500 mb-1">Source</p>
                <p className="text-sm font-medium text-slate-900 dark:text-white">{viewingLead.source}</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-3">
                <p className="text-xs text-slate-500 mb-1">Owner</p>
                <p className="text-sm font-medium text-slate-900 dark:text-white">{viewingLead.owner}</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-3">
                <p className="text-xs text-slate-500 mb-1">Lead Score</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${viewingLead.score >= 80 ? 'bg-emerald-500' : viewingLead.score >= 60 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${viewingLead.score}%` }} />
                  </div>
                  <span className="text-sm font-bold text-slate-900 dark:text-white">{viewingLead.score}</span>
                </div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-3">
                <p className="text-xs text-slate-500 mb-1">Last Contact</p>
                <p className="text-sm font-medium text-slate-900 dark:text-white">{viewingLead.lastContact}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button onClick={() => { window.open(`tel:${viewingLead.phone.replace(/\s/g, '')}`, '_self'); toast.success(`Calling ${viewingLead.name}`); }} className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-emerald-100 text-emerald-700 rounded-lg text-sm font-medium hover:bg-emerald-200">
                <Phone className="w-4 h-4" /> Call
              </button>
              <button onClick={() => { window.open(`https://wa.me/${viewingLead.phone.replace(/[\s+]/g, '')}`, '_blank'); toast.success(`Opening WhatsApp`); }} className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-green-100 text-green-700 rounded-lg text-sm font-medium hover:bg-green-200">
                <MessageSquare className="w-4 h-4" /> WhatsApp
              </button>
              <button onClick={() => { window.open(`mailto:${viewingLead.email}`, '_blank'); toast.success(`Opening email`); }} className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-200">
                <Mail className="w-4 h-4" /> Email
              </button>
              {canUpdate && (
                <button onClick={() => { setViewingLead(null); setEditingLead({ ...viewingLead }); }} className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-indigo-100 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-200">
                  <Edit className="w-4 h-4" /> Edit
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Schedule Meeting Modal */}
      {schedulingLead && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSchedulingLead(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Schedule Activity</h2>
              <button onClick={() => setSchedulingLead(null)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="flex items-center gap-3 mb-5 p-3 bg-slate-50 dark:bg-slate-900 rounded-xl">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center text-white font-medium">
                {schedulingLead.name.charAt(0)}
              </div>
              <div>
                <p className="font-medium text-slate-900 dark:text-white">{schedulingLead.name}</p>
                <p className="text-sm text-slate-500">{schedulingLead.company}</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Activity Type</label>
                <select value={scheduleData.type} onChange={e => setScheduleData({ ...scheduleData, type: e.target.value })} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm">
                  <option value="call">Call</option>
                  <option value="meeting">Meeting</option>
                  <option value="demo">Demo</option>
                  <option value="follow-up">Follow-up</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Date *</label>
                  <input type="date" value={scheduleData.date} onChange={e => setScheduleData({ ...scheduleData, date: e.target.value })} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Time *</label>
                  <input type="time" value={scheduleData.time} onChange={e => setScheduleData({ ...scheduleData, time: e.target.value })} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Notes</label>
                <textarea value={scheduleData.notes} onChange={e => setScheduleData({ ...scheduleData, notes: e.target.value })} placeholder="Add any notes for this activity..." rows={3} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm resize-none" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setSchedulingLead(null)} className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700">Cancel</button>
              <button
                onClick={() => {
                  if (!scheduleData.date || !scheduleData.time) {
                    toast.error('Date and time are required');
                    return;
                  }
                  const typeLabel = scheduleData.type.charAt(0).toUpperCase() + scheduleData.type.slice(1);
                  toast.success(`${typeLabel} scheduled with ${schedulingLead.name} on ${scheduleData.date} at ${scheduleData.time}`);
                  setSchedulingLead(null);
                }}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
              >Schedule</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Lead Modal */}
      {editingLead && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setEditingLead(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Edit Lead</h2>
              <button onClick={() => setEditingLead(null)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Name *</label>
                <input type="text" value={editingLead.name} onChange={e => setEditingLead({ ...editingLead, name: e.target.value })} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email *</label>
                <input type="email" value={editingLead.email} onChange={e => setEditingLead({ ...editingLead, email: e.target.value })} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Phone *</label>
                <input type="tel" value={editingLead.phone} onChange={e => setEditingLead({ ...editingLead, phone: e.target.value })} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Company</label>
                <input type="text" value={editingLead.company} onChange={e => setEditingLead({ ...editingLead, company: e.target.value })} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Status</label>
                  <select value={editingLead.status} onChange={e => setEditingLead({ ...editingLead, status: e.target.value })} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm">
                    <option value="new">New</option><option value="contacted">Contacted</option><option value="qualified">Qualified</option><option value="nurturing">Nurturing</option><option value="lost">Lost</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Score</label>
                  <input type="number" min="0" max="100" value={editingLead.score} onChange={e => setEditingLead({ ...editingLead, score: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Source</label>
                  <select value={editingLead.source} onChange={e => setEditingLead({ ...editingLead, source: e.target.value })} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm">
                    <option>Website</option><option>Facebook</option><option>Google Ads</option><option>IndiaMart</option><option>LinkedIn</option><option>Referral</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Owner</label>
                  <select value={editingLead.owner} onChange={e => setEditingLead({ ...editingLead, owner: e.target.value })} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm">
                    <option>Arun</option><option>Meera</option><option>Kavya</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setEditingLead(null)} className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700">Cancel</button>
              <button onClick={handleEditSave} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
