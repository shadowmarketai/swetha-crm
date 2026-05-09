/**
 * CRM Leads Page — Tendent
 * Full leads management with premium design system
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { leadsAPI } from '../../services/api';
import { usePermissions } from '../../hooks/usePermissions';
import {
  Plus, Search, Filter, Download, Upload, MoreHorizontal, Phone, Mail,
  MessageSquare, Calendar, Edit, Trash2, Eye, Users, TrendingUp, Target,
  Clock, FileText, ChevronLeft, ChevronRight,
} from 'lucide-react';
import {
  Card, CardHeader, Stat, Button, Modal, Field, Input, Select, Textarea,
  PageHeader, Avatar, StatusBadge, EmptyState, SearchInput, Skeleton,
} from '../../components/ui/primitives';

const LEADS_PER_PAGE = 10;

export default function LeadsPage() {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const canCreate = can('crm', 'create');
  const canUpdate = can('crm', 'update');
  const canDelete = can('crm', 'delete');

  const [selectedLeads, setSelectedLeads] = useState([]);
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
  const [schedulingLead, setSchedulingLead] = useState(null);
  const [scheduleData, setScheduleData] = useState({ date: '', time: '', type: 'call', notes: '' });
  const fileInputRef = useRef(null);

  const mockLeads = [
    { id: 1, name: 'Rajesh Kumar', email: 'rajesh@techsolutions.com', phone: '+91 98765 43210', company: 'Tech Solutions Pvt', status: 'qualified', source: 'Facebook', score: 85, owner: 'Arun', created: '2024-02-20', lastContact: '2h ago' },
    { id: 2, name: 'Priya Sharma', email: 'priya@startup.com', phone: '+91 87654 32109', company: 'StartUp Inc', status: 'new', source: 'IndiaMart', score: 65, owner: 'Meera', created: '2024-02-20', lastContact: '3h ago' },
    { id: 3, name: 'Vikram Patel', email: 'vikram@global.com', phone: '+91 76543 21098', company: 'Global Corp', status: 'contacted', source: 'Google Ads', score: 72, owner: 'Arun', created: '2024-02-19', lastContact: '5h ago' },
    { id: 4, name: 'Ananya Reddy', email: 'ananya@digital.com', phone: '+91 65432 10987', company: 'Digital Agency', status: 'qualified', source: 'Website', score: 90, owner: 'Kavya', created: '2024-02-19', lastContact: '1d ago' },
    { id: 5, name: 'Karthik Iyer', email: 'karthik@finance.com', phone: '+91 54321 09876', company: 'Finance Pro', status: 'new', source: 'Referral', score: 55, owner: 'Arun', created: '2024-02-18', lastContact: '1d ago' },
    { id: 6, name: 'Deepa Menon', email: 'deepa@health.com', phone: '+91 43210 98765', company: 'HealthCare Plus', status: 'nurturing', source: 'LinkedIn', score: 78, owner: 'Meera', created: '2024-02-18', lastContact: '2d ago' },
    { id: 7, name: 'Suresh Nair', email: 'suresh@retail.com', phone: '+91 32109 87654', company: 'Retail Kings', status: 'contacted', source: 'Facebook', score: 60, owner: 'Kavya', created: '2024-02-17', lastContact: '2d ago' },
    { id: 8, name: 'Lakshmi Bhat', email: 'lakshmi@edu.com', phone: '+91 21098 76543', company: 'EduTech Solutions', status: 'qualified', source: 'Website', score: 88, owner: 'Arun', created: '2024-02-17', lastContact: '3d ago' },
  ];

  const [leads, setLeads] = useState([]);
  const [loadingLeads, setLoadingLeads] = useState(true);

  const fetchLeads = () => {
    setLoadingLeads(true);
    leadsAPI.getAll({ limit: 100 }).then((res) => {
      const data = Array.isArray(res.data) ? res.data : res.data?.items || res.data?.leads || [];
      const mapped = data.map((l, i) => ({
        id: l.id || 1000 + i,
        name: l.name || l.full_name || [l.first_name, l.last_name].filter(Boolean).join(' ') || 'Unknown',
        email: l.email || '-',
        phone: l.phone || l.phone_number || '-',
        company: l.company || l.company_name || '-',
        status: l.status || 'new',
        source: l.source || l.lead_source || 'Manual',
        score: l.score || l.lead_score || 0,
        owner: l.owner || l.assigned_to || 'Unassigned',
        created: l.created_at ? l.created_at.split('T')[0] : '-',
        lastContact: l.last_contact || l.updated_at || '-',
      }));
      setLeads(mapped.length > 0 ? mapped : mockLeads);
    }).catch(() => {
      setLeads(mockLeads);
    }).finally(() => setLoadingLeads(false));
  };

  useEffect(() => { fetchLeads(); }, []);

  const stats = [
    { label: 'Total Leads', value: leads.length.toLocaleString(), icon: Users, accent: '#6366f1', accentTo: '#8b5cf6' },
    { label: 'New Today', value: leads.filter((l) => l.status === 'new').length.toString(), icon: TrendingUp, accent: '#10b981', accentTo: '#06b6d4' },
    { label: 'Qualified', value: leads.filter((l) => l.status === 'qualified').length.toString(), icon: Target, accent: '#f59e0b', accentTo: '#f43f5e' },
    { label: 'In Progress', value: leads.filter((l) => l.status === 'contacted' || l.status === 'nurturing').length.toString(), icon: Clock, accent: '#ec4899', accentTo: '#8b5cf6' },
  ];

  const filteredLeads = useMemo(() => {
    let result = [...leads];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((l) =>
        l.name.toLowerCase().includes(q) ||
        l.email.toLowerCase().includes(q) ||
        l.phone.includes(q) ||
        l.company.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== 'All Status') {
      result = result.filter((l) => l.status.toLowerCase() === statusFilter.toLowerCase());
    }
    if (sourceFilter !== 'All Sources') {
      result = result.filter((l) => l.source === sourceFilter);
    }
    if (ownerFilter !== 'All Owners') {
      result = result.filter((l) => l.owner === ownerFilter);
    }
    return result;
  }, [leads, searchQuery, statusFilter, sourceFilter, ownerFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / LEADS_PER_PAGE));
  const paginatedLeads = filteredLeads.slice((currentPage - 1) * LEADS_PER_PAGE, currentPage * LEADS_PER_PAGE);

  const handleFilterChange = (setter) => (value) => {
    setter(value);
    setCurrentPage(1);
    setSelectedLeads([]);
  };

  const toggleSelect = (id) => {
    setSelectedLeads((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    setSelectedLeads((prev) => prev.length === paginatedLeads.length ? [] : paginatedLeads.map((l) => l.id));
  };

  const [addingLead, setAddingLead] = useState(false);

  const handleAddLead = async () => {
    if (!formData.name || !formData.phone) {
      toast.error('Please fill in name and phone');
      return;
    }
    setAddingLead(true);
    try {
      const nameParts = formData.name.trim().split(/\s+/);
      const payload = {
        first_name: nameParts[0],
        last_name: nameParts.slice(1).join(' ') || undefined,
        phone: formData.phone,
        email: formData.email || undefined,
        company: formData.company || undefined,
        source: formData.source || 'Manual',
        status: 'new',
      };
      await leadsAPI.create(payload);
      toast.success(`Lead "${formData.name}" added`);
      setFormData({ name: '', email: '', phone: '', company: '', source: 'Website', owner: 'Arun' });
      setShowAddModal(false);
      fetchLeads(); // Refresh from API
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to add lead');
    } finally {
      setAddingLead(false);
    }
  };

  const handleDeleteLead = async (lead) => {
    try {
      await leadsAPI.delete(lead.id);
      setLeads((prev) => prev.filter((l) => l.id !== lead.id));
      setSelectedLeads((prev) => prev.filter((id) => id !== lead.id));
      toast.success(`${lead.name} deleted`);
    } catch {
      // Fallback: remove locally if API fails (mock data)
      setLeads((prev) => prev.filter((l) => l.id !== lead.id));
      toast.success(`${lead.name} removed`);
    }
  };

  const handleBulkAction = (action) => {
    const count = selectedLeads.length;
    const selectedLeadObjects = leads.filter((l) => selectedLeads.includes(l.id));
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
        setLeads((prev) => prev.filter((l) => !selectedLeads.includes(l.id)));
        setSelectedLeads([]);
        toast(
          (t) => (
            <div className="flex items-center gap-3">
              <span>{count} lead{count > 1 ? 's' : ''} deleted</span>
              <button
                onClick={() => {
                  setLeads((prev) => [...prev, ...selectedLeadObjects].sort((a, b) => a.id - b.id));
                  toast.dismiss(t.id);
                  toast.success(`${count} restored`);
                }}
                className="px-2 py-1 text-white text-xs rounded font-semibold"
                style={{ background: 'linear-gradient(135deg, var(--brand-primary), var(--brand-accent))' }}
              >
                Undo
              </button>
            </div>
          ),
          { duration: 5000 }
        );
        break;
      default:
        break;
    }
  };

  const handleEditSave = () => {
    if (!editingLead.name || !editingLead.email || !editingLead.phone) {
      toast.error('Name, email, and phone are required');
      return;
    }
    setLeads((prev) => prev.map((l) => (l.id === editingLead.id ? editingLead : l)));
    toast.success(`Lead "${editingLead.name}" updated`);
    setEditingLead(null);
  };

  const handleExport = () => {
    const headers = ['Name', 'Email', 'Phone', 'Company', 'Status', 'Source', 'Score', 'Owner', 'Created', 'Last Contact'];
    const rows = filteredLeads.map((l) => [l.name, l.email, l.phone, l.company, l.status, l.source, l.score, l.owner, l.created, l.lastContact]);
    const csv = [headers.join(','), ...rows.map((r) => r.map((v) => `"${v}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filteredLeads.length} leads`);
  };

  const handleCsvImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      // Try API upload first
      const res = await leadsAPI.import(file);
      const count = res.data?.imported || res.data?.count || 0;
      toast.success(`Imported ${count} lead${count !== 1 ? 's' : ''} via API`);
      fetchLeads(); // Refresh from API
    } catch {
      // Fallback: parse CSV locally and create leads one by one
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const text = evt.target.result;
          const lines = text.split('\n').filter((l) => l.trim());
          if (lines.length < 2) { toast.error('No data rows in CSV'); return; }
          const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/"/g, ''));
          const nameIdx = headers.findIndex((h) => h.includes('name'));
          const emailIdx = headers.findIndex((h) => h.includes('email'));
          const phoneIdx = headers.findIndex((h) => h.includes('phone'));
          const companyIdx = headers.findIndex((h) => h.includes('company'));
          const sourceIdx = headers.findIndex((h) => h.includes('source'));
          if (nameIdx === -1) { toast.error('CSV must have a "Name" column'); return; }
          let imported = 0;
          for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(',').map((c) => c.trim().replace(/"/g, ''));
            if (!cols[nameIdx]) continue;
            const nameParts = cols[nameIdx].trim().split(/\s+/);
            try {
              await leadsAPI.create({
                first_name: nameParts[0],
                last_name: nameParts.slice(1).join(' ') || undefined,
                phone: phoneIdx >= 0 ? cols[phoneIdx] : '0000000000',
                email: emailIdx >= 0 ? cols[emailIdx] : undefined,
                company: companyIdx >= 0 ? cols[companyIdx] : undefined,
                source: sourceIdx >= 0 ? cols[sourceIdx] : 'CSV Import',
              });
              imported++;
            } catch { /* skip duplicate or invalid */ }
          }
          toast.success(`Imported ${imported} lead${imported !== 1 ? 's' : ''}`);
          fetchLeads();
        } catch {
          toast.error('Failed to parse CSV');
        }
      };
      reader.readAsText(file);
    }
    e.target.value = '';
  };

  return (
    <div className="space-y-6">
      <input type="file" ref={fileInputRef} accept=".csv" className="hidden" onChange={handleCsvImport} />

      <PageHeader
        title="Leads"
        subtitle="Capture, qualify, and convert your sales pipeline"
        actions={
          <>
            {canCreate && (
              <Button variant="secondary" leftIcon={Upload} onClick={() => fileInputRef.current?.click()}>
                Import
              </Button>
            )}
            <Button variant="secondary" leftIcon={Download} onClick={handleExport}>
              Export
            </Button>
            {canCreate && (
              <Button leftIcon={Plus} onClick={() => setShowAddModal(true)}>
                New Lead
              </Button>
            )}
          </>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, i) => <Stat key={i} {...s} />)}
      </div>

      {/* Filter bar */}
      <Card className="p-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="flex-1">
            <SearchInput
              placeholder="Search name, email, phone, company..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); setSelectedLeads([]); }}
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={statusFilter} onChange={(e) => handleFilterChange(setStatusFilter)(e.target.value)}>
              <option>All Status</option>
              <option>New</option>
              <option>Contacted</option>
              <option>Qualified</option>
              <option>Nurturing</option>
              <option>Lost</option>
            </Select>
            <Select value={sourceFilter} onChange={(e) => handleFilterChange(setSourceFilter)(e.target.value)}>
              <option>All Sources</option>
              <option>Facebook</option>
              <option>Google Ads</option>
              <option>IndiaMart</option>
              <option>JustDial</option>
              <option>Website</option>
              <option>LinkedIn</option>
              <option>Referral</option>
            </Select>
            <Select value={ownerFilter} onChange={(e) => handleFilterChange(setOwnerFilter)(e.target.value)}>
              <option>All Owners</option>
              <option>Arun</option>
              <option>Meera</option>
              <option>Kavya</option>
            </Select>
            <Button
              variant={filterOpen ? 'primary' : 'secondary'}
              leftIcon={Filter}
              onClick={() => setFilterOpen(!filterOpen)}
            >
              {filterOpen ? 'Hide' : 'More'}
            </Button>
          </div>
        </div>

        {filterOpen && (
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Field label="Min Score"><Input type="number" min="0" max="100" placeholder="0" /></Field>
            <Field label="Max Score"><Input type="number" min="0" max="100" placeholder="100" /></Field>
            <Field label="Created After"><Input type="date" /></Field>
            <Field label="Created Before"><Input type="date" /></Field>
          </div>
        )}

        {selectedLeads.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 flex-wrap">
            <span
              className="text-xs font-bold px-2.5 py-1 rounded-full text-white"
              style={{ background: 'linear-gradient(135deg, var(--brand-primary), var(--brand-accent))' }}
            >
              {selectedLeads.length} selected
            </span>
            <Button variant="secondary" size="sm" leftIcon={Phone} onClick={() => handleBulkAction('call')}>Call</Button>
            <Button variant="secondary" size="sm" leftIcon={MessageSquare} onClick={() => handleBulkAction('whatsapp')}>WhatsApp</Button>
            <Button variant="secondary" size="sm" leftIcon={Mail} onClick={() => handleBulkAction('email')}>Email</Button>
            {canDelete && (
              <Button variant="danger" size="sm" leftIcon={Trash2} onClick={() => handleBulkAction('delete')}>Delete</Button>
            )}
          </div>
        )}
      </Card>

      {/* Leads Table */}
      <Card>
        {paginatedLeads.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No leads found"
            description="Try adjusting your filters or import leads from a CSV."
            action={canCreate && <Button leftIcon={Plus} onClick={() => setShowAddModal(true)}>Add your first lead</Button>}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800">
                    <th className="px-6 py-3 text-left w-10">
                      <input
                        type="checkbox"
                        checked={paginatedLeads.length > 0 && selectedLeads.length === paginatedLeads.length}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 rounded accent-[var(--brand-primary)]"
                      />
                    </th>
                    {['Lead', 'Contact', 'Status', 'Source', 'Score', 'Owner', 'Last Contact', ''].map((h) => (
                      <th key={h} className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-6 py-3 text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginatedLeads.map((lead) => (
                    <tr
                      key={lead.id}
                      className="border-b border-slate-50 dark:border-slate-800/60 last:border-0 hover:bg-white/70 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="px-6 py-3.5">
                        <input
                          type="checkbox"
                          checked={selectedLeads.includes(lead.id)}
                          onChange={() => toggleSelect(lead.id)}
                          className="w-4 h-4 rounded accent-[var(--brand-primary)]"
                        />
                      </td>
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-3">
                          <Avatar name={lead.name} size={38} />
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-900 dark:text-white truncate">{lead.name}</div>
                            <div className="text-xs text-slate-500 truncate">{lead.company}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-3.5">
                        <div className="text-slate-700 dark:text-slate-300 font-mono text-xs">{lead.phone}</div>
                        <div className="text-xs text-slate-500 truncate max-w-[180px]">{lead.email}</div>
                      </td>
                      <td className="px-6 py-3.5"><StatusBadge status={lead.status} /></td>
                      <td className="px-6 py-3.5 text-slate-600 dark:text-slate-400">{lead.source}</td>
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="w-14 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${lead.score}%`,
                                background:
                                  lead.score >= 80
                                    ? 'linear-gradient(90deg,#10b981,#06b6d4)'
                                    : lead.score >= 60
                                      ? 'linear-gradient(90deg,#f59e0b,#f43f5e)'
                                      : 'linear-gradient(90deg,#94a3b8,#64748b)',
                              }}
                            />
                          </div>
                          <span className="text-xs font-bold tabular-nums">{lead.score}</span>
                        </div>
                      </td>
                      <td className="px-6 py-3.5 text-slate-600 dark:text-slate-400">{lead.owner}</td>
                      <td className="px-6 py-3.5 text-xs text-slate-500">{lead.lastContact}</td>
                      <td className="px-6 py-3.5 relative">
                        <div className="flex items-center justify-end gap-0.5">
                          <button
                            onClick={() => { window.open(`tel:${lead.phone.replace(/\s/g, '')}`, '_self'); toast.success(`Calling ${lead.name}`); }}
                            className="p-1.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-slate-400 hover:text-emerald-600"
                            title="Call"
                          >
                            <Phone className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => { window.open(`https://wa.me/${lead.phone.replace(/[\s+]/g, '')}`, '_blank'); toast.success(`WhatsApp`); }}
                            className="p-1.5 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 text-slate-400 hover:text-green-600"
                            title="WhatsApp"
                          >
                            <MessageSquare className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setViewingLead(lead)}
                            className="p-1.5 rounded-lg hover:bg-sky-50 dark:hover:bg-sky-900/20 text-slate-400 hover:text-sky-600"
                            title="View"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setActiveRowMenu(activeRowMenu === lead.id ? null : lead.id)}
                            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                        </div>
                        {activeRowMenu === lead.id && (
                          <div className="absolute right-4 top-12 z-20 w-48 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 py-1">
                            {canUpdate && (
                              <button
                                onClick={() => { setActiveRowMenu(null); setEditingLead({ ...lead }); }}
                                className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2"
                              >
                                <Edit className="w-4 h-4" /> Edit lead
                              </button>
                            )}
                            <button
                              onClick={() => { setActiveRowMenu(null); window.open(`mailto:${lead.email}`, '_blank'); }}
                              className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2"
                            >
                              <Mail className="w-4 h-4" /> Send email
                            </button>
                            <button
                              onClick={() => { setActiveRowMenu(null); navigate(`/quotation/new?leadId=${lead.id}`); }}
                              className="w-full text-left px-3 py-2 text-sm text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 flex items-center gap-2"
                            >
                              <FileText className="w-4 h-4" /> Create quotation
                            </button>
                            <button
                              onClick={() => { setActiveRowMenu(null); setSchedulingLead(lead); setScheduleData({ date: '', time: '', type: 'call', notes: '' }); }}
                              className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2"
                            >
                              <Calendar className="w-4 h-4" /> Schedule activity
                            </button>
                            {canDelete && (
                              <button
                                onClick={() => { setActiveRowMenu(null); handleDeleteLead(lead); }}
                                className="w-full text-left px-3 py-2 text-sm text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 flex items-center gap-2"
                              >
                                <Trash2 className="w-4 h-4" /> Delete
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

            {/* Pagination */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 dark:border-slate-800">
              <p className="text-sm text-slate-500">
                Showing <span className="font-semibold text-slate-700 dark:text-slate-300">{(currentPage - 1) * LEADS_PER_PAGE + 1}</span>
                {' – '}
                <span className="font-semibold text-slate-700 dark:text-slate-300">{Math.min(currentPage * LEADS_PER_PAGE, filteredLeads.length)}</span>
                {' of '}
                <span className="font-semibold text-slate-700 dark:text-slate-300">{filteredLeads.length}</span>
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={ChevronLeft}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Prev
                </Button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => Math.abs(p - currentPage) <= 2 || p === 1 || p === totalPages)
                  .map((page, idx, arr) => (
                    <React.Fragment key={page}>
                      {idx > 0 && page - arr[idx - 1] > 1 && <span className="px-1 text-slate-400">…</span>}
                      <button
                        onClick={() => setCurrentPage(page)}
                        className={
                          page === currentPage
                            ? 'min-w-[36px] h-9 rounded-lg text-sm font-bold text-white shadow-md'
                            : 'min-w-[36px] h-9 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                        }
                        style={
                          page === currentPage
                            ? { background: 'linear-gradient(135deg, var(--brand-primary), var(--brand-accent))' }
                            : undefined
                        }
                      >
                        {page}
                      </button>
                    </React.Fragment>
                  ))}
                <Button
                  variant="secondary"
                  size="sm"
                  rightIcon={ChevronRight}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>

      {/* Add Lead Modal */}
      <Modal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="New Lead"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowAddModal(false)}>Cancel</Button>
            <Button onClick={handleAddLead}>Save Lead</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Full name" required>
            <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Rajesh Kumar" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Email" required>
              <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="name@company.com" />
            </Field>
            <Field label="Phone" required>
              <Input type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="+91 XXXXX XXXXX" />
            </Field>
          </div>
          <Field label="Company">
            <Input value={formData.company} onChange={(e) => setFormData({ ...formData, company: e.target.value })} placeholder="Company name" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Source">
              <Select className="w-full" value={formData.source} onChange={(e) => setFormData({ ...formData, source: e.target.value })}>
                <option>Website</option><option>Facebook</option><option>Google Ads</option><option>IndiaMart</option><option>LinkedIn</option><option>Referral</option>
              </Select>
            </Field>
            <Field label="Owner">
              <Select className="w-full" value={formData.owner} onChange={(e) => setFormData({ ...formData, owner: e.target.value })}>
                <option>Arun</option><option>Meera</option><option>Kavya</option>
              </Select>
            </Field>
          </div>
        </div>
      </Modal>

      {/* View Lead Modal */}
      <Modal
        open={!!viewingLead}
        onClose={() => setViewingLead(null)}
        title="Lead Details"
        size="lg"
      >
        {viewingLead && (
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <Avatar name={viewingLead.name} size={60} />
              <div className="flex-1 min-w-0">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">{viewingLead.name}</h3>
                <p className="text-sm text-slate-500">{viewingLead.company}</p>
              </div>
              <StatusBadge status={viewingLead.status} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Email', value: viewingLead.email },
                { label: 'Phone', value: viewingLead.phone },
                { label: 'Source', value: viewingLead.source },
                { label: 'Owner', value: viewingLead.owner },
                { label: 'Last Contact', value: viewingLead.lastContact },
                { label: 'Created', value: viewingLead.created },
              ].map((f) => (
                <div key={f.label} className="rounded-xl p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                  <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-1">{f.label}</div>
                  <div className="text-sm font-medium text-slate-900 dark:text-white truncate">{f.value}</div>
                </div>
              ))}
              <div className="col-span-2 rounded-xl p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-2">Lead Score</div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${viewingLead.score}%`,
                        background:
                          viewingLead.score >= 80
                            ? 'linear-gradient(90deg,#10b981,#06b6d4)'
                            : viewingLead.score >= 60
                              ? 'linear-gradient(90deg,#f59e0b,#f43f5e)'
                              : 'linear-gradient(90deg,#94a3b8,#64748b)',
                      }}
                    />
                  </div>
                  <span className="text-base font-bold tabular-nums">{viewingLead.score}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              <Button variant="success" leftIcon={Phone} onClick={() => { window.open(`tel:${viewingLead.phone.replace(/\s/g, '')}`, '_self'); toast.success(`Calling`); }}>Call</Button>
              <Button leftIcon={MessageSquare} onClick={() => { window.open(`https://wa.me/${viewingLead.phone.replace(/[\s+]/g, '')}`, '_blank'); }}>WhatsApp</Button>
              <Button variant="secondary" leftIcon={Mail} onClick={() => { window.open(`mailto:${viewingLead.email}`, '_blank'); }}>Email</Button>
              {canUpdate && <Button variant="secondary" leftIcon={Edit} onClick={() => { setEditingLead({ ...viewingLead }); setViewingLead(null); }}>Edit</Button>}
            </div>
          </div>
        )}
      </Modal>

      {/* Edit Lead Modal */}
      <Modal
        open={!!editingLead}
        onClose={() => setEditingLead(null)}
        title="Edit Lead"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditingLead(null)}>Cancel</Button>
            <Button onClick={handleEditSave}>Save Changes</Button>
          </>
        }
      >
        {editingLead && (
          <div className="space-y-4">
            <Field label="Name" required>
              <Input value={editingLead.name} onChange={(e) => setEditingLead({ ...editingLead, name: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Email" required>
                <Input type="email" value={editingLead.email} onChange={(e) => setEditingLead({ ...editingLead, email: e.target.value })} />
              </Field>
              <Field label="Phone" required>
                <Input type="tel" value={editingLead.phone} onChange={(e) => setEditingLead({ ...editingLead, phone: e.target.value })} />
              </Field>
            </div>
            <Field label="Company">
              <Input value={editingLead.company} onChange={(e) => setEditingLead({ ...editingLead, company: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Status">
                <Select className="w-full" value={editingLead.status} onChange={(e) => setEditingLead({ ...editingLead, status: e.target.value })}>
                  <option value="new">New</option>
                  <option value="contacted">Contacted</option>
                  <option value="qualified">Qualified</option>
                  <option value="nurturing">Nurturing</option>
                  <option value="lost">Lost</option>
                </Select>
              </Field>
              <Field label="Score">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={editingLead.score}
                  onChange={(e) => setEditingLead({ ...editingLead, score: parseInt(e.target.value, 10) || 0 })}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Source">
                <Select className="w-full" value={editingLead.source} onChange={(e) => setEditingLead({ ...editingLead, source: e.target.value })}>
                  <option>Website</option><option>Facebook</option><option>Google Ads</option><option>IndiaMart</option><option>LinkedIn</option><option>Referral</option>
                </Select>
              </Field>
              <Field label="Owner">
                <Select className="w-full" value={editingLead.owner} onChange={(e) => setEditingLead({ ...editingLead, owner: e.target.value })}>
                  <option>Arun</option><option>Meera</option><option>Kavya</option>
                </Select>
              </Field>
            </div>
          </div>
        )}
      </Modal>

      {/* Schedule Modal */}
      <Modal
        open={!!schedulingLead}
        onClose={() => setSchedulingLead(null)}
        title="Schedule Activity"
        footer={
          <>
            <Button variant="secondary" onClick={() => setSchedulingLead(null)}>Cancel</Button>
            <Button
              onClick={() => {
                if (!scheduleData.date || !scheduleData.time) { toast.error('Date and time required'); return; }
                toast.success(`${scheduleData.type} scheduled with ${schedulingLead.name}`);
                setSchedulingLead(null);
              }}
            >
              Schedule
            </Button>
          </>
        }
      >
        {schedulingLead && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
              <Avatar name={schedulingLead.name} size={40} />
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">{schedulingLead.name}</p>
                <p className="text-xs text-slate-500">{schedulingLead.company}</p>
              </div>
            </div>
            <Field label="Activity Type">
              <Select className="w-full" value={scheduleData.type} onChange={(e) => setScheduleData({ ...scheduleData, type: e.target.value })}>
                <option value="call">Call</option>
                <option value="meeting">Meeting</option>
                <option value="demo">Demo</option>
                <option value="follow-up">Follow-up</option>
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date" required>
                <Input type="date" value={scheduleData.date} onChange={(e) => setScheduleData({ ...scheduleData, date: e.target.value })} />
              </Field>
              <Field label="Time" required>
                <Input type="time" value={scheduleData.time} onChange={(e) => setScheduleData({ ...scheduleData, time: e.target.value })} />
              </Field>
            </div>
            <Field label="Notes">
              <Textarea rows={3} value={scheduleData.notes} onChange={(e) => setScheduleData({ ...scheduleData, notes: e.target.value })} placeholder="Any notes for this activity..." />
            </Field>
          </div>
        )}
      </Modal>
    </div>
  );
}
