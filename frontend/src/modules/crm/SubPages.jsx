/**
 * CRM Sub-Pages - Companies, Contacts, Deals, Activities
 * Visual rewrite using design system primitives. All logic, state,
 * effects, API calls, permissions, handlers and data shapes preserved.
 *
 * CRUD operations call real backend APIs via companiesAPI, contactsAPI,
 * dealsAPI, activitiesAPI from services/api.
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import { companiesAPI, contactsAPI, dealsAPI, activitiesAPI } from '../../services/api';
import {
  Plus, Search, MoreVertical, Building2, Users, Phone, Mail,
  IndianRupee, Calendar, Clock, CheckCircle, Edit, Trash2,
  MapPin, Globe, TrendingUp, Target, Eye, Download, Upload,
  Briefcase, Activity as ActivityIcon, DollarSign, Award, Percent,
  Loader2,
} from 'lucide-react';
import { usePermissions } from '../../hooks/usePermissions';
import {
  Card, CardBody, Stat, Button, Input, Select, Field, Badge, StatusBadge,
  PageHeader, EmptyState, Modal, Avatar, SearchInput, Segmented,
} from '../../components/ui/primitives';

/** Skeleton rows shown while data loads */
function TableSkeleton({ rows = 5, cols = 4 }) {
  return (
    <div className="animate-pulse space-y-3 p-6">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4">
          {Array.from({ length: cols }).map((_, c) => (
            <div key={c} className="h-4 bg-slate-200 dark:bg-slate-700 rounded flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

function CardSkeleton({ count = 6 }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="p-5 animate-pulse">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-11 h-11 rounded-full bg-slate-200 dark:bg-slate-700" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
              <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            {[1,2,3,4].map(n => <div key={n} className="h-4 bg-slate-200 dark:bg-slate-700 rounded" />)}
          </div>
        </Card>
      ))}
    </div>
  );
}

// ==================== COMPANIES PAGE ====================
export function CompaniesPage() {
  const { can } = usePermissions();
  const canCreate = can('crm', 'create');
  const canUpdate = can('crm', 'update');
  const canDelete = can('crm', 'delete');
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [industryFilter, setIndustryFilter] = useState('All Industries');
  const [activeMenu, setActiveMenu] = useState(null);
  const [viewingCompany, setViewingCompany] = useState(null);
  const [editingCompany, setEditingCompany] = useState(null);
  const [formData, setFormData] = useState({ name: '', industry: 'Technology', employees: '10-50', revenue: '', website: '', location: '' });
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  const fetchCompanies = useCallback(async () => {
    try {
      setLoading(true);
      const res = await companiesAPI.getAll({ limit: 100 });
      const items = Array.isArray(res.data) ? res.data : res.data?.items || [];
      // Map API fields to the shape the UI expects
      const mapped = items.map(c => ({
        id: c.id,
        name: c.name || '',
        industry: c.industry || 'Technology',
        employees: c.employees || '10-50',
        revenue: c.revenue || '₹0',
        contacts: c.contacts ?? c.contact_count ?? 0,
        deals: c.deals ?? c.deal_count ?? 0,
        status: c.status || 'active',
        website: c.website || '-',
        location: c.city || c.location || '-',
        phone: c.phone || '',
      }));
      setCompanies(mapped);
    } catch {
      // API interceptor already shows toast for server errors
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCompanies(); }, [fetchCompanies]);

  const filteredCompanies = useMemo(() => {
    let result = [...companies];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(c => c.name.toLowerCase().includes(q) || c.industry.toLowerCase().includes(q) || c.location.toLowerCase().includes(q));
    }
    if (industryFilter !== 'All Industries') {
      result = result.filter(c => c.industry === industryFilter);
    }
    return result;
  }, [companies, searchQuery, industryFilter]);

  const totalContacts = useMemo(() => companies.reduce((s, c) => s + (c.contacts || 0), 0), [companies]);
  const totalDeals = useMemo(() => companies.reduce((s, c) => s + (c.deals || 0), 0), [companies]);
  const activeCount = useMemo(() => companies.filter(c => c.status === 'active').length, [companies]);

  const handleAddCompany = async () => {
    if (!formData.name) {
      toast.error('Company name is required');
      return;
    }
    try {
      setSaving(true);
      await companiesAPI.create({
        name: formData.name,
        industry: formData.industry,
        website: formData.website || undefined,
        city: formData.location || undefined,
        phone: undefined,
      });
      toast.success(`Company "${formData.name}" added successfully`);
      setFormData({ name: '', industry: 'Technology', employees: '10-50', revenue: '', website: '', location: '' });
      setShowAddModal(false);
      await fetchCompanies();
    } catch {
      // toast handled by interceptor
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEditCompany = async () => {
    if (!editingCompany.name) {
      toast.error('Company name is required');
      return;
    }
    try {
      setSaving(true);
      await companiesAPI.update(editingCompany.id, {
        name: editingCompany.name,
        industry: editingCompany.industry,
        website: editingCompany.website,
        city: editingCompany.location,
        phone: editingCompany.phone,
      });
      toast.success(`Company "${editingCompany.name}" updated`);
      setEditingCompany(null);
      await fetchCompanies();
    } catch {
      // toast handled by interceptor
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCompany = async (company) => {
    setActiveMenu(null);
    try {
      await companiesAPI.delete(company.id);
      toast.success(`Company "${company.name}" deleted`);
      await fetchCompanies();
    } catch {
      // toast handled by interceptor
    }
  };

  return (
    <div className="space-y-6">
      <input type="file" ref={fileInputRef} accept=".csv" className="hidden" onChange={(e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (evt) => {
          try {
            const text = evt.target.result;
            const lines = text.split('\n').filter(l => l.trim());
            if (lines.length < 2) { toast.error('No data rows found'); return; }
            const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
            const nameIdx = headers.findIndex(h => h.includes('name'));
            if (nameIdx === -1) { toast.error('CSV must have a "Name" column'); return; }
            const industryIdx = headers.findIndex(h => h.includes('industry'));
            const websiteIdx = headers.findIndex(h => h.includes('website'));
            const locationIdx = headers.findIndex(h => h.includes('location'));
            let imported = 0;
            for (let i = 1; i < lines.length; i++) {
              const cols = lines[i].split(',').map(c => c.trim().replace(/"/g, ''));
              if (!cols[nameIdx]) continue;
              try {
                await companiesAPI.create({
                  name: cols[nameIdx],
                  industry: industryIdx >= 0 ? cols[industryIdx] : undefined,
                  website: websiteIdx >= 0 ? cols[websiteIdx] : undefined,
                  city: locationIdx >= 0 ? cols[locationIdx] : undefined,
                });
                imported++;
              } catch { /* skip row on error */ }
            }
            toast.success(`Imported ${imported} companies from CSV`);
            await fetchCompanies();
          } catch { toast.error('Failed to parse CSV'); }
        };
        reader.readAsText(file);
        e.target.value = '';
      }} />

      <PageHeader
        title="Companies"
        subtitle="Manage company accounts"
        actions={
          <>
            <Button variant="secondary" leftIcon={Upload} onClick={() => fileInputRef.current?.click()}>Import</Button>
            <Button
              variant="secondary"
              leftIcon={Download}
              onClick={() => {
                const headers = ['Name','Industry','Employees','Revenue','Location','Website','Contacts','Deals','Status'];
                const rows = filteredCompanies.map(c => [c.name, c.industry, c.employees, c.revenue, c.location, c.website, c.contacts, c.deals, c.status]);
                const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
                const blob = new Blob([csv], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url; a.download = `companies_${new Date().toISOString().split('T')[0]}.csv`; a.click();
                URL.revokeObjectURL(url);
                toast.success(`Exported ${filteredCompanies.length} companies as CSV`);
              }}
            >Export</Button>
            {canCreate && (
              <Button leftIcon={Plus} onClick={() => setShowAddModal(true)}>Add Company</Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Total Companies" value={companies.length} icon={Building2} accent="#6366f1" accentTo="#8b5cf6" />
        <Stat label="Active" value={activeCount} icon={CheckCircle} accent="#10b981" accentTo="#06b6d4" />
        <Stat label="Total Contacts" value={totalContacts} icon={Users} accent="#f59e0b" accentTo="#f43f5e" />
        <Stat label="Open Deals" value={totalDeals} icon={Target} accent="#ec4899" accentTo="#8b5cf6" />
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="flex-1 max-w-md">
          <SearchInput
            placeholder="Search companies..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={industryFilter} onChange={e => setIndustryFilter(e.target.value)}>
          <option>All Industries</option>
          <option>Technology</option>
          <option>Healthcare</option>
          <option>Finance</option>
          <option>Retail</option>
          <option>Education</option>
        </Select>
      </div>

      {loading ? (
        <CardSkeleton />
      ) : filteredCompanies.length === 0 ? (
        <Card>
          <EmptyState
            icon={Building2}
            title="No companies found"
            description="Try adjusting your search or filters, or add a new company to get started."
            action={canCreate && <Button leftIcon={Plus} onClick={() => setShowAddModal(true)}>Add Company</Button>}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCompanies.map(company => (
            <Card key={company.id} hover className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar name={company.name} size={44} />
                  <div className="min-w-0">
                    <h3 className="font-semibold text-slate-900 dark:text-white truncate">{company.name}</h3>
                    <p className="text-sm text-slate-500 truncate">{company.industry}</p>
                  </div>
                </div>
                <StatusBadge status={company.status} />
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400"><Users className="w-4 h-4" /> {company.employees}</div>
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400"><IndianRupee className="w-4 h-4" /> {company.revenue}</div>
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 truncate"><MapPin className="w-4 h-4 flex-shrink-0" /> {company.location}</div>
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 truncate"><Globe className="w-4 h-4 flex-shrink-0" /> {company.website}</div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3 text-xs">
                  <Badge tone="info">{company.contacts} contacts</Badge>
                  <Badge tone="purple">{company.deals} deals</Badge>
                </div>
                <div className="relative">
                  <Button variant="ghost" size="icon" onClick={() => setActiveMenu(prev => prev === company.id ? null : company.id)}>
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                  {activeMenu === company.id && (
                    <div className="absolute right-0 top-10 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-20 w-40 py-1">
                      <button
                        onClick={() => { setActiveMenu(null); setViewingCompany(company); }}
                        className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"
                      ><Eye className="w-4 h-4" /> View</button>
                      {canUpdate && (
                        <button
                          onClick={() => { setActiveMenu(null); setEditingCompany({ ...company }); }}
                          className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"
                        ><Edit className="w-4 h-4" /> Edit</button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => handleDeleteCompany(company)}
                          className="w-full text-left px-4 py-2 text-sm text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 flex items-center gap-2"
                        ><Trash2 className="w-4 h-4" /> Delete</button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add Company Modal */}
      <Modal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add New Company"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowAddModal(false)}>Cancel</Button>
            <Button onClick={handleAddCompany} disabled={saving}>
              {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Saving...</> : 'Save Company'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Company Name" required>
            <Input
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter company name"
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Industry">
              <Select value={formData.industry} onChange={e => setFormData({ ...formData, industry: e.target.value })} className="w-full">
                <option>Technology</option>
                <option>Healthcare</option>
                <option>Finance</option>
                <option>Retail</option>
                <option>Education</option>
              </Select>
            </Field>
            <Field label="Employees">
              <Select value={formData.employees} onChange={e => setFormData({ ...formData, employees: e.target.value })} className="w-full">
                <option>1-10</option>
                <option>10-50</option>
                <option>50-100</option>
                <option>100-500</option>
                <option>500+</option>
              </Select>
            </Field>
          </div>
          <Field label="Revenue">
            <Input value={formData.revenue} onChange={e => setFormData({ ...formData, revenue: e.target.value })} placeholder="e.g. ₹5Cr+" />
          </Field>
          <Field label="Website">
            <Input value={formData.website} onChange={e => setFormData({ ...formData, website: e.target.value })} placeholder="e.g. example.com" />
          </Field>
          <Field label="Location">
            <Input value={formData.location} onChange={e => setFormData({ ...formData, location: e.target.value })} placeholder="e.g. Chennai" />
          </Field>
        </div>
      </Modal>

      {/* View Company Detail Modal */}
      <Modal
        open={!!viewingCompany}
        onClose={() => setViewingCompany(null)}
        title="Company Details"
        size="lg"
        footer={
          <>
            {canUpdate && (
              <Button leftIcon={Edit} onClick={() => { const c = viewingCompany; setViewingCompany(null); setEditingCompany({ ...c }); }}>Edit</Button>
            )}
            <Button variant="success" leftIcon={Phone} onClick={() => { window.open('tel:'); toast.success(`Calling ${viewingCompany?.name}`); }}>Call</Button>
            <Button variant="secondary" leftIcon={Mail} onClick={() => { window.open(`mailto:info@${viewingCompany?.website}`); }}>Email</Button>
          </>
        }
      >
        {viewingCompany && (
          <>
            <div className="flex items-center gap-4 mb-6">
              <Avatar name={viewingCompany.name} size={64} />
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">{viewingCompany.name}</h3>
                <div className="mt-1"><StatusBadge status={viewingCompany.status} /></div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                ['Industry', viewingCompany.industry],
                ['Employees', viewingCompany.employees],
                ['Revenue', viewingCompany.revenue],
                ['Location', viewingCompany.location],
                ['Website', viewingCompany.website],
                ['Status', viewingCompany.status],
                ['Contacts', viewingCompany.contacts],
                ['Deals', viewingCompany.deals],
              ].map(([k, v]) => (
                <div key={k}>
                  <p className="text-[11px] text-slate-500 uppercase font-semibold tracking-wider mb-1">{k}</p>
                  <p className="text-sm text-slate-900 dark:text-white font-medium capitalize">{v}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </Modal>

      {/* Edit Company Modal */}
      <Modal
        open={!!editingCompany}
        onClose={() => setEditingCompany(null)}
        title="Edit Company"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditingCompany(null)}>Cancel</Button>
            <Button onClick={handleSaveEditCompany} disabled={saving}>
              {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Saving...</> : 'Save Changes'}
            </Button>
          </>
        }
      >
        {editingCompany && (
          <div className="space-y-4">
            <Field label="Company Name" required>
              <Input value={editingCompany.name} onChange={e => setEditingCompany({ ...editingCompany, name: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Industry">
                <Select value={editingCompany.industry} onChange={e => setEditingCompany({ ...editingCompany, industry: e.target.value })} className="w-full">
                  <option>Technology</option>
                  <option>Healthcare</option>
                  <option>Finance</option>
                  <option>Retail</option>
                  <option>Education</option>
                </Select>
              </Field>
              <Field label="Employees">
                <Select value={editingCompany.employees} onChange={e => setEditingCompany({ ...editingCompany, employees: e.target.value })} className="w-full">
                  <option>1-10</option>
                  <option>10-50</option>
                  <option>50-100</option>
                  <option>100-500</option>
                  <option>500+</option>
                </Select>
              </Field>
            </div>
            <Field label="Revenue">
              <Input value={editingCompany.revenue} onChange={e => setEditingCompany({ ...editingCompany, revenue: e.target.value })} />
            </Field>
            <Field label="Website">
              <Input value={editingCompany.website} onChange={e => setEditingCompany({ ...editingCompany, website: e.target.value })} />
            </Field>
            <Field label="Location">
              <Input value={editingCompany.location} onChange={e => setEditingCompany({ ...editingCompany, location: e.target.value })} />
            </Field>
            <Field label="Status">
              <Select value={editingCompany.status} onChange={e => setEditingCompany({ ...editingCompany, status: e.target.value })} className="w-full">
                <option value="active">Active</option>
                <option value="prospect">Prospect</option>
              </Select>
            </Field>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ==================== CONTACTS PAGE ====================
export function ContactsPage() {
  const { can } = usePermissions();
  const canCreate = can('crm', 'create');
  const canUpdate = can('crm', 'update');
  const canDelete = can('crm', 'delete');
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMenu, setActiveMenu] = useState(null);
  const [viewingContact, setViewingContact] = useState(null);
  const [editingContact, setEditingContact] = useState(null);
  const [formData, setFormData] = useState({ first_name: '', last_name: '', email: '', phone: '', company: '', company_id: '', role: '' });
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  const fetchContacts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await contactsAPI.getAll({ limit: 100 });
      const items = Array.isArray(res.data) ? res.data : res.data?.items || [];
      const mapped = items.map(c => ({
        id: c.id,
        name: [c.first_name, c.last_name].filter(Boolean).join(' ') || c.name || 'Unknown',
        first_name: c.first_name || '',
        last_name: c.last_name || '',
        email: c.email || '-',
        phone: c.phone || '-',
        company: c.company_name || c.company || '-',
        company_id: c.company_id || '',
        role: c.designation || c.role || '-',
        lastContact: c.updated_at ? new Date(c.updated_at).toLocaleDateString() : '-',
      }));
      setContacts(mapped);
    } catch {
      // API interceptor handles error toasts
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  const filteredContacts = useMemo(() => {
    if (!searchQuery.trim()) return contacts;
    const q = searchQuery.toLowerCase();
    return contacts.filter(c =>
      c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) ||
      c.company.toLowerCase().includes(q) || c.role.toLowerCase().includes(q)
    );
  }, [contacts, searchQuery]);

  const uniqueCompanies = useMemo(() => new Set(contacts.map(c => c.company)).size, [contacts]);
  const recentContacts = useMemo(() => contacts.filter(c => /h ago|d ago|Just now/.test(c.lastContact || '')).length, [contacts]);

  const handleAddContact = async () => {
    if (!formData.first_name || !formData.email) {
      toast.error('First name and email are required');
      return;
    }
    try {
      setSaving(true);
      await contactsAPI.create({
        first_name: formData.first_name,
        last_name: formData.last_name || undefined,
        email: formData.email,
        phone: formData.phone || undefined,
        company_id: formData.company_id || undefined,
        designation: formData.role || undefined,
      });
      toast.success(`Contact "${formData.first_name} ${formData.last_name}" added successfully`);
      setFormData({ first_name: '', last_name: '', email: '', phone: '', company: '', company_id: '', role: '' });
      setShowAddModal(false);
      await fetchContacts();
    } catch {
      // toast handled by interceptor
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEditContact = async () => {
    if (!editingContact.name && !editingContact.first_name) {
      toast.error('Name is required');
      return;
    }
    try {
      setSaving(true);
      // Parse name into first/last if needed
      let firstName = editingContact.first_name;
      let lastName = editingContact.last_name;
      if (!firstName && editingContact.name) {
        const parts = editingContact.name.split(' ');
        firstName = parts[0];
        lastName = parts.slice(1).join(' ');
      }
      await contactsAPI.update(editingContact.id, {
        first_name: firstName,
        last_name: lastName || undefined,
        email: editingContact.email !== '-' ? editingContact.email : undefined,
        phone: editingContact.phone !== '-' ? editingContact.phone : undefined,
        company_id: editingContact.company_id || undefined,
        designation: editingContact.role !== '-' ? editingContact.role : undefined,
      });
      toast.success(`Contact "${editingContact.name}" updated`);
      setEditingContact(null);
      await fetchContacts();
    } catch {
      // toast handled by interceptor
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteContact = async (contact) => {
    setActiveMenu(null);
    try {
      await contactsAPI.delete(contact.id);
      toast.success(`Contact "${contact.name}" deleted`);
      await fetchContacts();
    } catch {
      // toast handled by interceptor
    }
  };

  return (
    <div className="space-y-6">
      <input type="file" ref={fileInputRef} accept=".csv" className="hidden" onChange={(e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (evt) => {
          try {
            const text = evt.target.result;
            const lines = text.split('\n').filter(l => l.trim());
            if (lines.length < 2) { toast.error('No data rows found'); return; }
            const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
            const nameIdx = headers.findIndex(h => h.includes('name'));
            const emailIdx = headers.findIndex(h => h.includes('email'));
            const phoneIdx = headers.findIndex(h => h.includes('phone'));
            if (nameIdx === -1) { toast.error('CSV must have a "Name" column'); return; }
            let imported = 0;
            for (let i = 1; i < lines.length; i++) {
              const cols = lines[i].split(',').map(c => c.trim().replace(/"/g, ''));
              if (!cols[nameIdx]) continue;
              const parts = cols[nameIdx].split(' ');
              try {
                await contactsAPI.create({
                  first_name: parts[0],
                  last_name: parts.slice(1).join(' ') || undefined,
                  email: emailIdx >= 0 ? cols[emailIdx] : undefined,
                  phone: phoneIdx >= 0 ? cols[phoneIdx] : undefined,
                });
                imported++;
              } catch { /* skip row */ }
            }
            toast.success(`Imported ${imported} contacts from CSV`);
            await fetchContacts();
          } catch { toast.error('Failed to parse CSV'); }
        };
        reader.readAsText(file);
        e.target.value = '';
      }} />

      <PageHeader
        title="Contacts"
        subtitle="Your business contacts"
        actions={
          <>
            <Button variant="secondary" leftIcon={Upload} onClick={() => fileInputRef.current?.click()}>Import</Button>
            <Button
              variant="secondary"
              leftIcon={Download}
              onClick={() => {
                const headers = ['Name','Email','Phone','Company','Role','Last Contact'];
                const rows = filteredContacts.map(c => [c.name, c.email, c.phone, c.company, c.role, c.lastContact]);
                const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
                const blob = new Blob([csv], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url; a.download = `contacts_${new Date().toISOString().split('T')[0]}.csv`; a.click();
                URL.revokeObjectURL(url);
                toast.success(`Exported ${filteredContacts.length} contacts as CSV`);
              }}
            >Export</Button>
            {canCreate && (
              <Button leftIcon={Plus} onClick={() => setShowAddModal(true)}>Add Contact</Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Total Contacts" value={contacts.length} icon={Users} accent="#6366f1" accentTo="#8b5cf6" />
        <Stat label="Companies" value={uniqueCompanies} icon={Building2} accent="#10b981" accentTo="#06b6d4" />
        <Stat label="Recent" value={recentContacts} icon={Clock} accent="#f59e0b" accentTo="#f43f5e" />
        <Stat label="Filtered" value={filteredContacts.length} icon={TrendingUp} accent="#ec4899" accentTo="#8b5cf6" />
      </div>

      <div className="max-w-md">
        <SearchInput
          placeholder="Search contacts..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
      </div>

      <Card>
        {loading ? (
          <TableSkeleton rows={5} cols={5} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800">
                  <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-6 py-3 text-left">Contact</th>
                  <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-6 py-3 text-left">Company</th>
                  <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-6 py-3 text-left">Role</th>
                  <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-6 py-3 text-left">Last Contact</th>
                  <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-6 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredContacts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-500">No contacts found.</td>
                  </tr>
                ) : (
                  filteredContacts.map(contact => (
                    <tr key={contact.id} className="border-b border-slate-50 dark:border-slate-800/60 last:border-0 hover:bg-white/70 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-3">
                          <Avatar name={contact.name} size={40} />
                          <div>
                            <p className="font-medium text-slate-900 dark:text-white">{contact.name}</p>
                            <p className="text-xs text-slate-500">{contact.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-3.5 text-slate-700 dark:text-slate-300">{contact.company}</td>
                      <td className="px-6 py-3.5 text-slate-700 dark:text-slate-300">{contact.role}</td>
                      <td className="px-6 py-3.5 text-slate-500">{contact.lastContact}</td>
                      <td className="px-6 py-3.5 relative">
                        <div className="flex items-center justify-center gap-1">
                          <Button variant="ghost" size="icon" onClick={() => window.open('tel:' + (contact.phone || '').replace(/\s/g, ''))} title="Call">
                            <Phone className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => window.open('mailto:' + contact.email)} title="Email">
                            <Mail className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setActiveMenu(prev => prev === contact.id ? null : contact.id)}>
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </div>
                        {activeMenu === contact.id && (
                          <div className="absolute right-4 top-12 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-20 w-40 py-1">
                            <button
                              onClick={() => { setActiveMenu(null); setViewingContact(contact); }}
                              className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"
                            ><Eye className="w-4 h-4" /> View</button>
                            {canUpdate && (
                              <button
                                onClick={() => { setActiveMenu(null); setEditingContact({ ...contact }); }}
                                className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"
                              ><Edit className="w-4 h-4" /> Edit</button>
                            )}
                            {canDelete && (
                              <button
                                onClick={() => handleDeleteContact(contact)}
                                className="w-full text-left px-4 py-2 text-sm text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 flex items-center gap-2"
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
        )}
      </Card>

      {/* Add Contact Modal */}
      <Modal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add New Contact"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowAddModal(false)}>Cancel</Button>
            <Button onClick={handleAddContact} disabled={saving}>
              {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Saving...</> : 'Save Contact'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="First Name" required>
              <Input value={formData.first_name} onChange={e => setFormData({ ...formData, first_name: e.target.value })} placeholder="First name" />
            </Field>
            <Field label="Last Name">
              <Input value={formData.last_name} onChange={e => setFormData({ ...formData, last_name: e.target.value })} placeholder="Last name" />
            </Field>
          </div>
          <Field label="Email" required>
            <Input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="Enter email" />
          </Field>
          <Field label="Phone">
            <Input type="tel" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} placeholder="+91 XXXXX XXXXX" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Company">
              <Input value={formData.company} onChange={e => setFormData({ ...formData, company: e.target.value })} placeholder="Company name" />
            </Field>
            <Field label="Role / Designation">
              <Input value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })} placeholder="e.g. CEO" />
            </Field>
          </div>
        </div>
      </Modal>

      {/* View Contact Detail Modal */}
      <Modal
        open={!!viewingContact}
        onClose={() => setViewingContact(null)}
        title="Contact Details"
        size="lg"
        footer={
          <>
            <Button variant="success" leftIcon={Phone} onClick={() => window.open('tel:' + (viewingContact?.phone || '').replace(/\s/g, ''))}>Call</Button>
            <Button variant="secondary" leftIcon={Mail} onClick={() => window.open('mailto:' + viewingContact?.email)}>Email</Button>
            {canUpdate && (
              <Button leftIcon={Edit} onClick={() => { const c = viewingContact; setViewingContact(null); setEditingContact({ ...c }); }}>Edit</Button>
            )}
          </>
        }
      >
        {viewingContact && (
          <>
            <div className="flex items-center gap-4 mb-6">
              <Avatar name={viewingContact.name} size={64} />
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">{viewingContact.name}</h3>
                <p className="text-sm text-slate-500">{viewingContact.role} at {viewingContact.company}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                ['Email', viewingContact.email],
                ['Phone', viewingContact.phone],
                ['Company', viewingContact.company],
                ['Role', viewingContact.role],
                ['Last Contact', viewingContact.lastContact],
              ].map(([k, v]) => (
                <div key={k}>
                  <p className="text-[11px] text-slate-500 uppercase font-semibold tracking-wider mb-1">{k}</p>
                  <p className="text-sm text-slate-900 dark:text-white font-medium">{v}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </Modal>

      {/* Edit Contact Modal */}
      <Modal
        open={!!editingContact}
        onClose={() => setEditingContact(null)}
        title="Edit Contact"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditingContact(null)}>Cancel</Button>
            <Button onClick={handleSaveEditContact} disabled={saving}>
              {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Saving...</> : 'Save Changes'}
            </Button>
          </>
        }
      >
        {editingContact && (
          <div className="space-y-4">
            <Field label="Name" required>
              <Input value={editingContact.name} onChange={e => setEditingContact({ ...editingContact, name: e.target.value })} />
            </Field>
            <Field label="Email" required>
              <Input type="email" value={editingContact.email} onChange={e => setEditingContact({ ...editingContact, email: e.target.value })} />
            </Field>
            <Field label="Phone">
              <Input type="tel" value={editingContact.phone} onChange={e => setEditingContact({ ...editingContact, phone: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Company">
                <Input value={editingContact.company} onChange={e => setEditingContact({ ...editingContact, company: e.target.value })} />
              </Field>
              <Field label="Role">
                <Input value={editingContact.role} onChange={e => setEditingContact({ ...editingContact, role: e.target.value })} />
              </Field>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ==================== DEALS PAGE ====================
export function DealsPage() {
  const { can } = usePermissions();
  const canCreate = can('crm', 'create');
  const canUpdate = can('crm', 'update');
  const canDelete = can('crm', 'delete');
  const [showAddModal, setShowAddModal] = useState(false);
  const [activeMenu, setActiveMenu] = useState(null);
  const [viewingDeal, setViewingDeal] = useState(null);
  const [editingDeal, setEditingDeal] = useState(null);
  const [dragOverStage, setDragOverStage] = useState(null);
  const [formData, setFormData] = useState({ name: '', value: '', company: '', probability: '20', owner: 'Arun', stage: 'discovery' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Stage definitions for the kanban board
  const stageDefinitions = [
    { id: 'discovery', name: 'Discovery', color: 'bg-slate-400' },
    { id: 'proposal', name: 'Proposal', color: 'bg-blue-500' },
    { id: 'negotiation', name: 'Negotiation', color: 'bg-amber-500' },
    { id: 'closed_won', name: 'Closed Won', color: 'bg-emerald-500' },
    { id: 'closed_lost', name: 'Closed Lost', color: 'bg-rose-500' },
  ];

  const [stages, setStages] = useState(stageDefinitions.map(s => ({ ...s, deals: [] })));

  const stageGradients = {
    discovery: ['#94a3b8', '#64748b'],
    proposal: ['#3b82f6', '#6366f1'],
    negotiation: ['#f59e0b', '#f43f5e'],
    closed_won: ['#10b981', '#06b6d4'],
    closed_lost: ['#f43f5e', '#dc2626'],
  };

  const fetchDeals = useCallback(async () => {
    try {
      setLoading(true);
      const res = await dealsAPI.getAll({ limit: 100 });
      const items = Array.isArray(res.data) ? res.data : res.data?.items || [];
      // Group deals by stage
      const grouped = {};
      stageDefinitions.forEach(s => { grouped[s.id] = []; });
      items.forEach(d => {
        const stageId = d.stage || 'discovery';
        if (!grouped[stageId]) grouped[stageId] = [];
        grouped[stageId].push({
          id: d.id,
          name: d.title || d.name || 'Untitled Deal',
          value: d.value != null ? `₹${Number(d.value).toLocaleString('en-IN')}` : '₹0',
          rawValue: d.value,
          company: d.company || d.lead_name || '-',
          lead_id: d.lead_id || '',
          probability: d.probability ?? 20,
          owner: d.owner || d.assigned_to || '-',
        });
      });
      setStages(stageDefinitions.map(s => ({
        ...s,
        deals: grouped[s.id] || [],
      })));
    } catch {
      // API interceptor handles error toasts
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDeals(); }, [fetchDeals]);

  // Compute pipeline stats from actual data
  const pipelineStats = useMemo(() => {
    const allDeals = stages.flatMap(s => s.deals);
    const totalValue = allDeals.reduce((s, d) => s + (d.rawValue || 0), 0);
    const weightedValue = allDeals.reduce((s, d) => s + ((d.rawValue || 0) * (d.probability || 0) / 100), 0);
    const wonStage = stages.find(s => s.id === 'closed_won');
    const wonValue = (wonStage?.deals || []).reduce((s, d) => s + (d.rawValue || 0), 0);
    const wonCount = wonStage?.deals?.length || 0;
    const totalCount = allDeals.length;
    const winRate = totalCount > 0 ? Math.round((wonCount / totalCount) * 100) : 0;
    const fmt = (v) => {
      if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
      if (v >= 1000) return `₹${(v / 1000).toFixed(1)}K`;
      return `₹${v}`;
    };
    return {
      total: fmt(totalValue),
      weighted: fmt(weightedValue),
      won: fmt(wonValue),
      winRate: `${winRate}%`,
    };
  }, [stages]);

  const handleAddDeal = async (targetStage) => {
    if (!formData.name || !formData.value) {
      toast.error('Deal name and value are required');
      return;
    }
    const stageId = targetStage || formData.stage;
    try {
      setSaving(true);
      // Parse value: strip currency symbols and letters, keep number
      const numericValue = parseFloat(formData.value.replace(/[^0-9.]/g, '')) || 0;
      await dealsAPI.create({
        title: formData.name,
        value: numericValue,
        stage: stageId,
        probability: parseInt(formData.probability) || 20,
        lead_id: formData.lead_id || undefined,
      });
      toast.success(`Deal "${formData.name}" added to ${stageDefinitions.find(s => s.id === stageId)?.name}`);
      setFormData({ name: '', value: '', company: '', probability: '20', owner: 'Arun', stage: 'discovery' });
      setShowAddModal(false);
      await fetchDeals();
    } catch {
      // toast handled by interceptor
    } finally {
      setSaving(false);
    }
  };

  const handleDealClick = (deal, stageId) => {
    setViewingDeal({ ...deal, stageId });
  };

  const handleDealMenuAction = async (action, deal, stageId) => {
    setActiveMenu(null);
    switch (action) {
      case 'view':
        setViewingDeal({ ...deal, stageId });
        break;
      case 'edit':
        setEditingDeal({ ...deal, stageId });
        break;
      case 'delete': {
        try {
          await dealsAPI.delete(deal.id);
          toast.success(`Deal "${deal.name}" deleted`);
          await fetchDeals();
        } catch {
          // toast handled by interceptor
        }
        break;
      }
    }
  };

  const handleSaveEditDeal = async () => {
    if (!editingDeal.name || !editingDeal.value) {
      toast.error('Deal name and value are required');
      return;
    }
    try {
      setSaving(true);
      const numericValue = typeof editingDeal.value === 'string'
        ? parseFloat(editingDeal.value.replace(/[^0-9.]/g, '')) || 0
        : editingDeal.value;
      await dealsAPI.update(editingDeal.id, {
        title: editingDeal.name,
        value: numericValue,
        stage: editingDeal.stageId,
        probability: parseInt(editingDeal.probability) || 20,
        lead_id: editingDeal.lead_id || undefined,
      });
      toast.success(`Deal "${editingDeal.name}" updated`);
      setEditingDeal(null);
      await fetchDeals();
    } catch {
      // toast handled by interceptor
    } finally {
      setSaving(false);
    }
  };

  const handleAddDealToStage = (stageId) => {
    setFormData(prev => ({ ...prev, stage: stageId }));
    setShowAddModal(true);
  };

  // Drag and Drop Handlers
  const handleDragStart = (e, deal, fromStageId) => {
    e.dataTransfer.setData('dealId', deal.id.toString());
    e.dataTransfer.setData('fromStage', fromStageId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnter = (e, stageId) => {
    e.preventDefault();
    setDragOverStage(stageId);
  };

  const handleDragLeave = (e, stageId) => {
    const relatedTarget = e.relatedTarget;
    if (relatedTarget && e.currentTarget.contains(relatedTarget)) return;
    if (dragOverStage === stageId) {
      setDragOverStage(null);
    }
  };

  const handleDrop = async (e, toStageId) => {
    e.preventDefault();
    setDragOverStage(null);
    const dealId = e.dataTransfer.getData('dealId');
    const fromStageId = e.dataTransfer.getData('fromStage');

    if (fromStageId === toStageId) return;

    // Optimistic UI update
    let movedDeal = null;
    setStages(prev => {
      const updated = prev.map(s => {
        if (s.id === fromStageId) {
          movedDeal = s.deals.find(d => String(d.id) === String(dealId));
          return { ...s, deals: s.deals.filter(d => String(d.id) !== String(dealId)) };
        }
        return s;
      });
      if (!movedDeal) return prev;
      return updated.map(s =>
        s.id === toStageId ? { ...s, deals: [...s.deals, movedDeal] } : s
      );
    });

    const fromName = stages.find(s => s.id === fromStageId)?.name;
    const toName = stages.find(s => s.id === toStageId)?.name;

    try {
      await dealsAPI.update(dealId, { stage: toStageId });
      toast.success(`Deal moved from ${fromName} to ${toName}`);
    } catch {
      // Revert on failure
      await fetchDeals();
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Deals Pipeline"
        subtitle="Track your sales opportunities"
        actions={
          <>
            <Button
              variant="secondary"
              leftIcon={Download}
              onClick={() => {
                const allDeals = stages.flatMap(s => s.deals.map(d => ({ ...d, stage: s.name })));
                const headers = ['Name','Value','Company','Probability','Owner','Stage'];
                const rows = allDeals.map(d => [d.name, d.value, d.company, d.probability, d.owner, d.stage]);
                const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
                const blob = new Blob([csv], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url; a.download = `deals_${new Date().toISOString().split('T')[0]}.csv`; a.click();
                URL.revokeObjectURL(url);
                toast.success(`Exported ${allDeals.length} deals as CSV`);
              }}
            >Export</Button>
            {canCreate && (
              <Button leftIcon={Plus} onClick={() => setShowAddModal(true)}>Add Deal</Button>
            )}
          </>
        }
      />

      {/* Pipeline Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Total Pipeline" value={pipelineStats.total} icon={DollarSign} accent="#6366f1" accentTo="#8b5cf6" />
        <Stat label="Weighted Value" value={pipelineStats.weighted} icon={TrendingUp} accent="#10b981" accentTo="#06b6d4" />
        <Stat label="Won This Month" value={pipelineStats.won} icon={Award} accent="#f59e0b" accentTo="#f43f5e" />
        <Stat label="Win Rate" value={pipelineStats.winRate} icon={Percent} accent="#ec4899" accentTo="#8b5cf6" />
      </div>

      {/* Kanban Board */}
      {loading ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {stageDefinitions.map(s => (
            <div key={s.id} className="flex-shrink-0 w-80">
              <Card className="animate-pulse">
                <div className="h-14 rounded-t-2xl bg-slate-200 dark:bg-slate-700" />
                <div className="p-3 space-y-3">
                  {[1,2].map(n => <div key={n} className="h-28 bg-slate-100 dark:bg-slate-800 rounded-xl" />)}
                </div>
              </Card>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {stages.map(stage => {
            const [g1, g2] = stageGradients[stage.id] || ['#6366f1', '#8b5cf6'];
            const isOver = dragOverStage === stage.id;
            return (
              <div
                key={stage.id}
                className={`flex-shrink-0 w-80 transition-all ${isOver ? 'scale-[1.01]' : ''}`}
                onDragOver={handleDragOver}
                onDragEnter={(e) => handleDragEnter(e, stage.id)}
                onDragLeave={(e) => handleDragLeave(e, stage.id)}
                onDrop={(e) => handleDrop(e, stage.id)}
              >
                <Card className={isOver ? 'ring-2 ring-offset-2 ring-offset-transparent' : ''} style={isOver ? { boxShadow: `0 0 0 2px ${g1}` } : undefined}>
                  {/* Gradient stage header */}
                  <div
                    className="px-5 py-4 rounded-t-2xl"
                    style={{ background: `linear-gradient(135deg, ${g1}, ${g2})` }}
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-white tracking-tight">{stage.name}</h3>
                      <span className="text-xs font-semibold bg-white/30 text-white px-2 py-0.5 rounded-full">
                        {stage.deals.length}
                      </span>
                    </div>
                  </div>
                  <div className="p-3 space-y-3">
                    {stage.deals.map(deal => (
                      <div
                        key={deal.id}
                        draggable="true"
                        onDragStart={(e) => handleDragStart(e, deal, stage.id)}
                        onClick={() => handleDealClick(deal, stage.id)}
                        className="bg-white dark:bg-slate-900/60 rounded-xl p-4 border border-slate-100 dark:border-slate-800 hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-grab active:cursor-grabbing"
                      >
                        <h4 className="font-semibold text-slate-900 dark:text-white text-sm">{deal.name}</h4>
                        <p className="text-xs text-slate-500 mt-1">{deal.company}</p>
                        <div className="flex items-center justify-between mt-3">
                          <span
                            className="text-lg font-bold tabular-nums"
                            style={{ background: `linear-gradient(135deg, ${g1}, ${g2})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
                          >
                            {deal.value}
                          </span>
                          <Badge tone="default">{deal.probability}%</Badge>
                        </div>
                        <div className="mt-3 h-1 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${deal.probability}%`, background: `linear-gradient(90deg, ${g1}, ${g2})` }}
                          />
                        </div>
                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                          <div className="flex items-center gap-1.5">
                            <Avatar name={deal.owner} size={20} />
                            <span className="text-xs text-slate-500">{deal.owner}</span>
                          </div>
                          <div className="relative">
                            <button
                              onClick={e => { e.stopPropagation(); setActiveMenu(prev => prev === deal.id ? null : deal.id); }}
                              className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
                            >
                              <MoreVertical className="w-4 h-4 text-slate-400" />
                            </button>
                            {activeMenu === deal.id && (
                              <div className="absolute right-0 top-8 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-20 w-36 py-1">
                                <button
                                  onClick={e => { e.stopPropagation(); handleDealMenuAction('view', deal, stage.id); }}
                                  className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"
                                ><Eye className="w-4 h-4" /> View</button>
                                {canUpdate && (
                                  <button
                                    onClick={e => { e.stopPropagation(); handleDealMenuAction('edit', deal, stage.id); }}
                                    className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"
                                  ><Edit className="w-4 h-4" /> Edit</button>
                                )}
                                {canDelete && (
                                  <button
                                    onClick={e => { e.stopPropagation(); handleDealMenuAction('delete', deal, stage.id); }}
                                    className="w-full text-left px-4 py-2 text-sm text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 flex items-center gap-2"
                                  ><Trash2 className="w-4 h-4" /> Delete</button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    {canCreate && (
                      <button
                        onClick={() => handleAddDealToStage(stage.id)}
                        className="w-full py-2.5 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                      >
                        + Add Deal
                      </button>
                    )}
                  </div>
                </Card>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Deal Modal */}
      <Modal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add New Deal"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowAddModal(false)}>Cancel</Button>
            <Button onClick={() => handleAddDeal()} disabled={saving}>
              {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Saving...</> : 'Save Deal'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Deal Name" required>
            <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Enter deal name" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Value" required>
              <Input value={formData.value} onChange={e => setFormData({ ...formData, value: e.target.value })} placeholder="e.g. 350000" />
            </Field>
            <Field label="Probability %">
              <Input type="number" min="0" max="100" value={formData.probability} onChange={e => setFormData({ ...formData, probability: e.target.value })} />
            </Field>
          </div>
          <Field label="Company">
            <Input value={formData.company} onChange={e => setFormData({ ...formData, company: e.target.value })} placeholder="Company name" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Stage">
              <Select value={formData.stage} onChange={e => setFormData({ ...formData, stage: e.target.value })} className="w-full">
                <option value="discovery">Discovery</option>
                <option value="proposal">Proposal</option>
                <option value="negotiation">Negotiation</option>
                <option value="closed_won">Closed Won</option>
                <option value="closed_lost">Closed Lost</option>
              </Select>
            </Field>
            <Field label="Owner">
              <Select value={formData.owner} onChange={e => setFormData({ ...formData, owner: e.target.value })} className="w-full">
                <option>Arun</option>
                <option>Meera</option>
                <option>Kavya</option>
              </Select>
            </Field>
          </div>
        </div>
      </Modal>

      {/* View Deal Detail Modal */}
      <Modal
        open={!!viewingDeal}
        onClose={() => setViewingDeal(null)}
        title="Deal Details"
        size="lg"
        footer={
          <>
            <Button leftIcon={Edit} onClick={() => { const d = { ...viewingDeal }; setViewingDeal(null); setEditingDeal(d); }}>Edit Deal</Button>
            <Button variant="secondary" onClick={() => setViewingDeal(null)}>Close</Button>
          </>
        }
      >
        {viewingDeal && (
          <>
            <div className="mb-6">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">{viewingDeal.name}</h3>
              <p className="text-sm text-slate-500 mt-1">{viewingDeal.company}</p>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-2">
              <div>
                <p className="text-[11px] text-slate-500 uppercase font-semibold tracking-wider mb-1">Value</p>
                <p className="text-lg font-bold" style={{ color: 'var(--brand-primary)' }}>{viewingDeal.value}</p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500 uppercase font-semibold tracking-wider mb-1">Probability</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                    <div className="h-2 rounded-full" style={{ width: `${viewingDeal.probability}%`, background: 'linear-gradient(90deg, var(--brand-primary), var(--brand-accent, var(--brand-primary)))' }} />
                  </div>
                  <span className="text-sm font-medium text-slate-900 dark:text-white">{viewingDeal.probability}%</span>
                </div>
              </div>
              <div>
                <p className="text-[11px] text-slate-500 uppercase font-semibold tracking-wider mb-1">Company</p>
                <p className="text-sm text-slate-900 dark:text-white font-medium">{viewingDeal.company}</p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500 uppercase font-semibold tracking-wider mb-1">Owner</p>
                <p className="text-sm text-slate-900 dark:text-white font-medium">{viewingDeal.owner}</p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500 uppercase font-semibold tracking-wider mb-1">Stage</p>
                <p className="text-sm text-slate-900 dark:text-white font-medium capitalize">
                  {stages.find(s => s.id === viewingDeal.stageId)?.name || viewingDeal.stageId}
                </p>
              </div>
            </div>
          </>
        )}
      </Modal>

      {/* Edit Deal Modal */}
      <Modal
        open={!!editingDeal}
        onClose={() => setEditingDeal(null)}
        title="Edit Deal"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditingDeal(null)}>Cancel</Button>
            <Button onClick={handleSaveEditDeal} disabled={saving}>
              {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Saving...</> : 'Save Changes'}
            </Button>
          </>
        }
      >
        {editingDeal && (
          <div className="space-y-4">
            <Field label="Deal Name" required>
              <Input value={editingDeal.name} onChange={e => setEditingDeal({ ...editingDeal, name: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Value" required>
                <Input value={editingDeal.value} onChange={e => setEditingDeal({ ...editingDeal, value: e.target.value })} />
              </Field>
              <Field label="Probability %">
                <Input type="number" min="0" max="100" value={editingDeal.probability} onChange={e => setEditingDeal({ ...editingDeal, probability: parseInt(e.target.value) || 0 })} />
              </Field>
            </div>
            <Field label="Company">
              <Input value={editingDeal.company} onChange={e => setEditingDeal({ ...editingDeal, company: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Stage">
                <Select value={editingDeal.stageId} onChange={e => setEditingDeal({ ...editingDeal, stageId: e.target.value })} className="w-full">
                  <option value="discovery">Discovery</option>
                  <option value="proposal">Proposal</option>
                  <option value="negotiation">Negotiation</option>
                  <option value="closed_won">Closed Won</option>
                  <option value="closed_lost">Closed Lost</option>
                </Select>
              </Field>
              <Field label="Owner">
                <Select value={editingDeal.owner} onChange={e => setEditingDeal({ ...editingDeal, owner: e.target.value })} className="w-full">
                  <option>Arun</option>
                  <option>Meera</option>
                  <option>Kavya</option>
                </Select>
              </Field>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ==================== ACTIVITIES PAGE ====================
export function ActivitiesPage() {
  const { can } = usePermissions();
  const canCreate = can('crm', 'create');
  const canUpdate = can('crm', 'update');
  const canDelete = can('crm', 'delete');
  const [filter, setFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [activeMenu, setActiveMenu] = useState(null);
  const [editingActivity, setEditingActivity] = useState(null);
  const [reschedulingActivity, setReschedulingActivity] = useState(null);
  const [formData, setFormData] = useState({ type: 'call', title: '', contact: '', company: '', time: '', date: 'Today', description: '' });
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const typeIcons = { call: Phone, meeting: Calendar, email: Mail, task: CheckCircle, note: Edit };
  const typeGradients = {
    call: ['#10b981', '#06b6d4'],
    meeting: ['#8b5cf6', '#ec4899'],
    email: ['#3b82f6', '#6366f1'],
    task: ['#f59e0b', '#f43f5e'],
    note: ['#94a3b8', '#64748b'],
  };

  const fetchActivities = useCallback(async () => {
    try {
      setLoading(true);
      const res = await activitiesAPI.getAll({ limit: 100 });
      const items = Array.isArray(res.data) ? res.data : res.data?.items || [];
      const mapped = items.map(a => ({
        id: a.id,
        type: a.activity_type || a.type || 'call',
        title: a.subject || a.title || '',
        contact: a.contact_name || a.contact || '-',
        company: a.company || '-',
        time: a.scheduled_time
          ? new Date(a.scheduled_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : a.time || '-',
        date: a.scheduled_date || a.date || (a.created_at ? new Date(a.created_at).toLocaleDateString() : '-'),
        status: a.status || 'scheduled',
        duration: a.duration || undefined,
        description: a.description || '',
        lead_id: a.lead_id || '',
      }));
      setActivities(mapped);
    } catch {
      // API interceptor handles error toasts
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchActivities(); }, [fetchActivities]);

  const filteredActivities = useMemo(() => {
    if (filter === 'all') return activities;
    const typeMap = { calls: 'call', meetings: 'meeting', emails: 'email', tasks: 'task' };
    return activities.filter(a => a.type === (typeMap[filter] || filter));
  }, [activities, filter]);

  const completedCount = useMemo(() => activities.filter(a => a.status === 'completed').length, [activities]);
  const scheduledCount = useMemo(() => activities.filter(a => a.status === 'scheduled').length, [activities]);
  const pendingCount = useMemo(() => activities.filter(a => a.status === 'pending').length, [activities]);

  const handleLogActivity = async () => {
    if (!formData.title) {
      toast.error('Title is required');
      return;
    }
    try {
      setSaving(true);
      await activitiesAPI.create({
        activity_type: formData.type,
        subject: formData.title,
        description: formData.description || formData.title,
        lead_id: formData.lead_id || undefined,
      });
      toast.success(`Activity "${formData.title}" logged successfully`);
      setFormData({ type: 'call', title: '', contact: '', company: '', time: '', date: 'Today', description: '' });
      setShowAddModal(false);
      await fetchActivities();
    } catch {
      // toast handled by interceptor
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEditActivity = () => {
    if (!editingActivity.title || !editingActivity.contact) {
      toast.error('Title and contact are required');
      return;
    }
    // Activities API does not have PUT; update locally
    setActivities(prev => prev.map(a => a.id === editingActivity.id ? { ...editingActivity } : a));
    toast.success(`Activity "${editingActivity.title}" updated`);
    setEditingActivity(null);
  };

  const handleSaveReschedule = () => {
    setActivities(prev => prev.map(a =>
      a.id === reschedulingActivity.id
        ? { ...a, time: reschedulingActivity.time, date: reschedulingActivity.date }
        : a
    ));
    toast.success(`"${reschedulingActivity.title}" rescheduled to ${reschedulingActivity.date} at ${reschedulingActivity.time}`);
    setReschedulingActivity(null);
  };

  const handleDeleteActivity = (activity) => {
    setActiveMenu(null);
    // Activities API has no DELETE endpoint; remove locally
    setActivities(prev => prev.filter(a => a.id !== activity.id));
    toast((t) => (
      <div className="flex items-center gap-3">
        <span>{activity.title} deleted</span>
        <button
          onClick={() => {
            setActivities(prev => [...prev, activity].sort((a, b) => a.id - b.id));
            toast.dismiss(t.id);
            toast.success('Restored');
          }}
          className="px-2 py-1 bg-indigo-600 text-white text-xs rounded font-medium hover:bg-indigo-700"
        >
          Undo
        </button>
      </div>
    ), { duration: 5000 });
  };

  const handleMenuAction = (action, activity) => {
    setActiveMenu(null);
    switch (action) {
      case 'complete':
        setActivities(prev => prev.map(a => a.id === activity.id ? { ...a, status: 'completed' } : a));
        toast.success(`"${activity.title}" marked as completed`);
        break;
      case 'reschedule':
        setReschedulingActivity({ ...activity });
        break;
      case 'edit':
        setEditingActivity({ ...activity });
        break;
      case 'delete':
        handleDeleteActivity(activity);
        break;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activities"
        subtitle="Calls, meetings, tasks & emails"
        actions={
          <>
            <Button
              variant="secondary"
              leftIcon={Download}
              onClick={() => {
                const headers = ['Type','Title','Contact','Company','Time','Date','Status'];
                const rows = filteredActivities.map(a => [a.type, a.title, a.contact, a.company, a.time, a.date, a.status]);
                const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
                const blob = new Blob([csv], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url; a.download = `activities_${new Date().toISOString().split('T')[0]}.csv`; a.click();
                URL.revokeObjectURL(url);
                toast.success(`Exported ${filteredActivities.length} activities as CSV`);
              }}
            >Export</Button>
            {canCreate && (
              <Button leftIcon={Plus} onClick={() => setShowAddModal(true)}>Log Activity</Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Total Activities" value={activities.length} icon={ActivityIcon} accent="#6366f1" accentTo="#8b5cf6" />
        <Stat label="Completed" value={completedCount} icon={CheckCircle} accent="#10b981" accentTo="#06b6d4" />
        <Stat label="Scheduled" value={scheduledCount} icon={Calendar} accent="#f59e0b" accentTo="#f43f5e" />
        <Stat label="Pending" value={pendingCount} icon={Clock} accent="#ec4899" accentTo="#8b5cf6" />
      </div>

      {/* Filter Tabs */}
      <Segmented
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'all', label: 'All' },
          { value: 'calls', label: 'Calls' },
          { value: 'meetings', label: 'Meetings' },
          { value: 'emails', label: 'Emails' },
          { value: 'tasks', label: 'Tasks' },
        ]}
      />

      {/* Activities List */}
      <Card>
        {loading ? (
          <TableSkeleton rows={5} cols={4} />
        ) : filteredActivities.length === 0 ? (
          <EmptyState
            icon={ActivityIcon}
            title="No activities found"
            description="Try a different filter or log a new activity."
            action={canCreate && <Button leftIcon={Plus} onClick={() => setShowAddModal(true)}>Log Activity</Button>}
          />
        ) : (
          filteredActivities.map((activity, i) => {
            const Icon = typeIcons[activity.type] || ActivityIcon;
            const [g1, g2] = typeGradients[activity.type] || ['#6366f1', '#8b5cf6'];
            return (
              <div key={activity.id} className={`flex items-center gap-4 p-4 ${i > 0 ? 'border-t border-slate-100 dark:border-slate-800' : ''} hover:bg-white/70 dark:hover:bg-slate-800/30 transition-colors`}>
                <div
                  className="w-11 h-11 rounded-2xl flex items-center justify-center text-white shadow-md flex-shrink-0"
                  style={{ background: `linear-gradient(135deg, ${g1}, ${g2})`, boxShadow: `0 6px 16px -6px ${g1}80` }}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-slate-900 dark:text-white truncate">{activity.title}</h3>
                    {activity.status === 'completed' && <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />}
                  </div>
                  <p className="text-sm text-slate-500 truncate">{activity.contact} {activity.company !== '-' ? `• ${activity.company}` : ''}</p>
                </div>
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white tabular-nums">{activity.time}</p>
                  <p className="text-xs text-slate-500">{activity.date}</p>
                </div>
                <StatusBadge status={activity.status} />
                <div className="relative">
                  <Button variant="ghost" size="icon" onClick={() => setActiveMenu(prev => prev === activity.id ? null : activity.id)}>
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                  {activeMenu === activity.id && (
                    <div className="absolute right-0 top-10 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-20 w-44 py-1">
                      {activity.status !== 'completed' && (
                        <button
                          onClick={() => handleMenuAction('complete', activity)}
                          className="w-full text-left px-4 py-2 text-sm text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 flex items-center gap-2"
                        ><CheckCircle className="w-4 h-4" /> Mark Complete</button>
                      )}
                      {canUpdate && (
                        <button
                          onClick={() => handleMenuAction('reschedule', activity)}
                          className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"
                        ><Clock className="w-4 h-4" /> Reschedule</button>
                      )}
                      {canUpdate && (
                        <button
                          onClick={() => handleMenuAction('edit', activity)}
                          className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"
                        ><Edit className="w-4 h-4" /> Edit</button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => handleMenuAction('delete', activity)}
                          className="w-full text-left px-4 py-2 text-sm text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 flex items-center gap-2"
                        ><Trash2 className="w-4 h-4" /> Delete</button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </Card>

      {/* Log Activity Modal */}
      <Modal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Log Activity"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowAddModal(false)}>Cancel</Button>
            <Button onClick={handleLogActivity} disabled={saving}>
              {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Saving...</> : 'Log Activity'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Type">
            <Select value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })} className="w-full">
              <option value="call">Call</option>
              <option value="meeting">Meeting</option>
              <option value="email">Email</option>
              <option value="note">Note</option>
            </Select>
          </Field>
          <Field label="Title / Subject" required>
            <Input value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} placeholder="e.g. Follow-up call with client" />
          </Field>
          <Field label="Description">
            <Input value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="Details..." />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Contact">
              <Input value={formData.contact} onChange={e => setFormData({ ...formData, contact: e.target.value })} placeholder="Contact name" />
            </Field>
            <Field label="Company">
              <Input value={formData.company} onChange={e => setFormData({ ...formData, company: e.target.value })} placeholder="Company name" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Time">
              <Input type="time" value={formData.time} onChange={e => setFormData({ ...formData, time: e.target.value })} />
            </Field>
            <Field label="Date">
              <Select value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} className="w-full">
                <option>Today</option>
                <option>Tomorrow</option>
                <option>This Week</option>
                <option>Next Week</option>
              </Select>
            </Field>
          </div>
        </div>
      </Modal>

      {/* Edit Activity Modal */}
      <Modal
        open={!!editingActivity}
        onClose={() => setEditingActivity(null)}
        title="Edit Activity"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditingActivity(null)}>Cancel</Button>
            <Button onClick={handleSaveEditActivity}>Save Changes</Button>
          </>
        }
      >
        {editingActivity && (
          <div className="space-y-4">
            <Field label="Type">
              <Select value={editingActivity.type} onChange={e => setEditingActivity({ ...editingActivity, type: e.target.value })} className="w-full">
                <option value="call">Call</option>
                <option value="meeting">Meeting</option>
                <option value="email">Email</option>
                <option value="note">Note</option>
              </Select>
            </Field>
            <Field label="Title" required>
              <Input value={editingActivity.title} onChange={e => setEditingActivity({ ...editingActivity, title: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Contact" required>
                <Input value={editingActivity.contact} onChange={e => setEditingActivity({ ...editingActivity, contact: e.target.value })} />
              </Field>
              <Field label="Company">
                <Input value={editingActivity.company} onChange={e => setEditingActivity({ ...editingActivity, company: e.target.value })} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Time">
                <Input value={editingActivity.time} onChange={e => setEditingActivity({ ...editingActivity, time: e.target.value })} placeholder="e.g. 2:00 PM" />
              </Field>
              <Field label="Date">
                <Select value={editingActivity.date} onChange={e => setEditingActivity({ ...editingActivity, date: e.target.value })} className="w-full">
                  <option>Today</option>
                  <option>Tomorrow</option>
                  <option>This Week</option>
                  <option>Next Week</option>
                </Select>
              </Field>
            </div>
          </div>
        )}
      </Modal>

      {/* Reschedule Activity Modal */}
      <Modal
        open={!!reschedulingActivity}
        onClose={() => setReschedulingActivity(null)}
        title="Reschedule"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setReschedulingActivity(null)}>Cancel</Button>
            <Button onClick={handleSaveReschedule}>Reschedule</Button>
          </>
        }
      >
        {reschedulingActivity && (
          <>
            <p className="text-sm text-slate-500 mb-4">Reschedule "{reschedulingActivity.title}"</p>
            <div className="space-y-4">
              <Field label="New Time">
                <Input value={reschedulingActivity.time} onChange={e => setReschedulingActivity({ ...reschedulingActivity, time: e.target.value })} placeholder="e.g. 3:00 PM" />
              </Field>
              <Field label="New Date">
                <Select value={reschedulingActivity.date} onChange={e => setReschedulingActivity({ ...reschedulingActivity, date: e.target.value })} className="w-full">
                  <option>Today</option>
                  <option>Tomorrow</option>
                  <option>This Week</option>
                  <option>Next Week</option>
                </Select>
              </Field>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
