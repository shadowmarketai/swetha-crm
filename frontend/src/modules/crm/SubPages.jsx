/**
 * CRM Sub-Pages - Companies, Contacts, Deals, Activities
 */

import React, { useState, useMemo, useRef } from 'react';
import toast from 'react-hot-toast';
import {
  Plus, Search, Filter, MoreVertical, Building2, Users, Phone, Mail,
  IndianRupee, Calendar, Clock, CheckCircle, XCircle, Edit, Trash2,
  MapPin, Globe, TrendingUp, Target, ArrowRight, Eye, X, Download, Upload
} from 'lucide-react';
import { usePermissions } from '../../hooks/usePermissions';

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
  const fileInputRef = useRef(null);

  const [companies, setCompanies] = useState([
    { id: 1, name: 'Tech Solutions Pvt Ltd', industry: 'Technology', employees: '50-100', revenue: '₹5Cr+', contacts: 5, deals: 3, status: 'active', website: 'techsolutions.com', location: 'Chennai' },
    { id: 2, name: 'Global Retail Corp', industry: 'Retail', employees: '100-500', revenue: '₹10Cr+', contacts: 8, deals: 2, status: 'active', website: 'globalretail.com', location: 'Mumbai' },
    { id: 3, name: 'HealthCare Plus', industry: 'Healthcare', employees: '10-50', revenue: '₹2Cr+', contacts: 3, deals: 1, status: 'prospect', website: 'healthcareplus.in', location: 'Bangalore' },
    { id: 4, name: 'Finance Pro Services', industry: 'Finance', employees: '50-100', revenue: '₹8Cr+', contacts: 4, deals: 2, status: 'active', website: 'financepro.com', location: 'Delhi' },
    { id: 5, name: 'EduTech Solutions', industry: 'Education', employees: '10-50', revenue: '₹1Cr+', contacts: 2, deals: 0, status: 'prospect', website: 'edutech.in', location: 'Hyderabad' },
  ]);

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

  const handleAddCompany = () => {
    if (!formData.name) {
      toast.error('Company name is required');
      return;
    }
    const newCompany = {
      id: Math.max(...companies.map(c => c.id), 0) + 1,
      name: formData.name,
      industry: formData.industry,
      employees: formData.employees,
      revenue: formData.revenue || '₹0',
      contacts: 0,
      deals: 0,
      status: 'prospect',
      website: formData.website || '-',
      location: formData.location || '-',
    };
    setCompanies(prev => [newCompany, ...prev]);
    toast.success(`Company "${formData.name}" added successfully`);
    setFormData({ name: '', industry: 'Technology', employees: '10-50', revenue: '', website: '', location: '' });
    setShowAddModal(false);
  };

  const handleSaveEditCompany = () => {
    if (!editingCompany.name) {
      toast.error('Company name is required');
      return;
    }
    setCompanies(prev => prev.map(c => c.id === editingCompany.id ? { ...editingCompany } : c));
    toast.success(`Company "${editingCompany.name}" updated`);
    setEditingCompany(null);
  };

  const handleDeleteCompany = (company) => {
    setActiveMenu(null);
    setCompanies(prev => prev.filter(c => c.id !== company.id));
    toast((t) => (
      <div className="flex items-center gap-3">
        <span>{company.name} deleted</span>
        <button
          onClick={() => {
            setCompanies(prev => [...prev, company].sort((a, b) => a.id - b.id));
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

  return (
    <div className="space-y-6">
      <input type="file" ref={fileInputRef} accept=".csv" className="hidden" onChange={(e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
          try {
            const text = evt.target.result;
            const lines = text.split('\n').filter(l => l.trim());
            if (lines.length < 2) { toast.error('No data rows found'); return; }
            const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
            const nameIdx = headers.findIndex(h => h.includes('name'));
            if (nameIdx === -1) { toast.error('CSV must have a "Name" column'); return; }
            const industryIdx = headers.findIndex(h => h.includes('industry'));
            const employeesIdx = headers.findIndex(h => h.includes('employee'));
            const revenueIdx = headers.findIndex(h => h.includes('revenue'));
            const locationIdx = headers.findIndex(h => h.includes('location'));
            const websiteIdx = headers.findIndex(h => h.includes('website'));
            let imported = 0;
            const maxId = Math.max(0, ...companies.map(c => c.id));
            const newItems = [];
            for (let i = 1; i < lines.length; i++) {
              const cols = lines[i].split(',').map(c => c.trim().replace(/"/g, ''));
              if (!cols[nameIdx]) continue;
              newItems.push({ id: maxId + i, name: cols[nameIdx], industry: industryIdx >= 0 ? cols[industryIdx] : 'Technology', employees: employeesIdx >= 0 ? cols[employeesIdx] : '10-50', revenue: revenueIdx >= 0 ? cols[revenueIdx] : '₹0', contacts: 0, deals: 0, status: 'prospect', website: websiteIdx >= 0 ? cols[websiteIdx] : '-', location: locationIdx >= 0 ? cols[locationIdx] : '-' });
              imported++;
            }
            setCompanies(prev => [...newItems, ...prev]);
            toast.success(`Imported ${imported} companies from CSV`);
          } catch { toast.error('Failed to parse CSV'); }
        };
        reader.readAsText(file);
        e.target.value = '';
      }} />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Companies</h1>
          <p className="text-sm text-slate-500">Manage company accounts</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300">
            <Upload className="w-4 h-4" /> Import
          </button>
          <button
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
            className="flex items-center gap-2 px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
          >
            <Download className="w-4 h-4" /> Export
          </button>
          {canCreate && (
          <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
            <Plus className="w-4 h-4" /> Add Company
          </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search companies..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
          />
        </div>
        <select
          value={industryFilter}
          onChange={e => setIndustryFilter(e.target.value)}
          className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
        >
          <option>All Industries</option>
          <option>Technology</option>
          <option>Healthcare</option>
          <option>Finance</option>
          <option>Retail</option>
          <option>Education</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCompanies.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-500">No companies found.</div>
        ) : (
          filteredCompanies.map(company => (
            <div key={company.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-white">{company.name}</h3>
                    <p className="text-sm text-slate-500">{company.industry}</p>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-medium ${company.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                  {company.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400"><Users className="w-4 h-4" /> {company.employees}</div>
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400"><IndianRupee className="w-4 h-4" /> {company.revenue}</div>
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400"><MapPin className="w-4 h-4" /> {company.location}</div>
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400"><Globe className="w-4 h-4" /> {company.website}</div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-700">
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-slate-500">{company.contacts} contacts</span>
                  <span className="text-slate-500">{company.deals} deals</span>
                </div>
                <div className="relative">
                  <button
                    onClick={() => setActiveMenu(prev => prev === company.id ? null : company.id)}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                  >
                    <MoreVertical className="w-4 h-4 text-slate-400" />
                  </button>
                  {activeMenu === company.id && (
                    <div className="absolute right-0 top-10 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg z-20 w-40 py-1">
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
                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                      ><Trash2 className="w-4 h-4" /> Delete</button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Company Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowAddModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Add New Company</h2>
              <button onClick={() => setShowAddModal(false)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Company Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter company name"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Industry</label>
                  <select
                    value={formData.industry}
                    onChange={e => setFormData({ ...formData, industry: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                  >
                    <option>Technology</option>
                    <option>Healthcare</option>
                    <option>Finance</option>
                    <option>Retail</option>
                    <option>Education</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Employees</label>
                  <select
                    value={formData.employees}
                    onChange={e => setFormData({ ...formData, employees: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                  >
                    <option>1-10</option>
                    <option>10-50</option>
                    <option>50-100</option>
                    <option>100-500</option>
                    <option>500+</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Revenue</label>
                <input
                  type="text"
                  value={formData.revenue}
                  onChange={e => setFormData({ ...formData, revenue: e.target.value })}
                  placeholder="e.g. ₹5Cr+"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Website</label>
                <input
                  type="text"
                  value={formData.website}
                  onChange={e => setFormData({ ...formData, website: e.target.value })}
                  placeholder="e.g. example.com"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Location</label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={e => setFormData({ ...formData, location: e.target.value })}
                  placeholder="e.g. Chennai"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
              >Cancel</button>
              <button
                onClick={handleAddCompany}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
              >Save Company</button>
            </div>
          </div>
        </div>
      )}

      {/* View Company Detail Modal */}
      {viewingCompany && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setViewingCompany(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Company Details</h2>
              <button onClick={() => setViewingCompany(null)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center">
                <Building2 className="w-8 h-8 text-indigo-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">{viewingCompany.name}</h3>
                <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium ${viewingCompany.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                  {viewingCompany.status}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <p className="text-xs text-slate-500 uppercase font-medium mb-1">Industry</p>
                <p className="text-sm text-slate-900 dark:text-white font-medium">{viewingCompany.industry}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase font-medium mb-1">Employees</p>
                <p className="text-sm text-slate-900 dark:text-white font-medium">{viewingCompany.employees}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase font-medium mb-1">Revenue</p>
                <p className="text-sm text-slate-900 dark:text-white font-medium">{viewingCompany.revenue}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase font-medium mb-1">Location</p>
                <p className="text-sm text-slate-900 dark:text-white font-medium">{viewingCompany.location}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase font-medium mb-1">Website</p>
                <p className="text-sm text-slate-900 dark:text-white font-medium">{viewingCompany.website}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase font-medium mb-1">Status</p>
                <p className="text-sm text-slate-900 dark:text-white font-medium capitalize">{viewingCompany.status}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase font-medium mb-1">Contacts</p>
                <p className="text-sm text-slate-900 dark:text-white font-medium">{viewingCompany.contacts}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase font-medium mb-1">Deals</p>
                <p className="text-sm text-slate-900 dark:text-white font-medium">{viewingCompany.deals}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 pt-4 border-t border-slate-100 dark:border-slate-700">
              {canUpdate && (
              <button
                onClick={() => { setViewingCompany(null); setEditingCompany({ ...viewingCompany }); }}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
              >
                <Edit className="w-4 h-4" /> Edit
              </button>
              )}
              <button
                onClick={() => { window.open('tel:'); toast.success(`Calling ${viewingCompany.name}`); }}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700"
              >
                <Phone className="w-4 h-4" /> Call
              </button>
              <button
                onClick={() => { window.open(`mailto:info@${viewingCompany.website}`); }}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
              >
                <Mail className="w-4 h-4" /> Email
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Company Modal */}
      {editingCompany && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setEditingCompany(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Edit Company</h2>
              <button onClick={() => setEditingCompany(null)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Company Name *</label>
                <input
                  type="text"
                  value={editingCompany.name}
                  onChange={e => setEditingCompany({ ...editingCompany, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Industry</label>
                  <select
                    value={editingCompany.industry}
                    onChange={e => setEditingCompany({ ...editingCompany, industry: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                  >
                    <option>Technology</option>
                    <option>Healthcare</option>
                    <option>Finance</option>
                    <option>Retail</option>
                    <option>Education</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Employees</label>
                  <select
                    value={editingCompany.employees}
                    onChange={e => setEditingCompany({ ...editingCompany, employees: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                  >
                    <option>1-10</option>
                    <option>10-50</option>
                    <option>50-100</option>
                    <option>100-500</option>
                    <option>500+</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Revenue</label>
                <input
                  type="text"
                  value={editingCompany.revenue}
                  onChange={e => setEditingCompany({ ...editingCompany, revenue: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Website</label>
                <input
                  type="text"
                  value={editingCompany.website}
                  onChange={e => setEditingCompany({ ...editingCompany, website: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Location</label>
                <input
                  type="text"
                  value={editingCompany.location}
                  onChange={e => setEditingCompany({ ...editingCompany, location: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Status</label>
                <select
                  value={editingCompany.status}
                  onChange={e => setEditingCompany({ ...editingCompany, status: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                >
                  <option value="active">Active</option>
                  <option value="prospect">Prospect</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setEditingCompany(null)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
              >Cancel</button>
              <button
                onClick={handleSaveEditCompany}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
              >Save Changes</button>
            </div>
          </div>
        </div>
      )}
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
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', company: '', role: '' });
  const fileInputRef = useRef(null);

  const [contacts, setContacts] = useState([
    { id: 1, name: 'Rajesh Kumar', email: 'rajesh@techsolutions.com', phone: '+91 98765 43210', company: 'Tech Solutions', role: 'CEO', lastContact: '2h ago' },
    { id: 2, name: 'Priya Sharma', email: 'priya@startup.com', phone: '+91 87654 32109', company: 'StartUp Inc', role: 'Marketing Head', lastContact: '1d ago' },
    { id: 3, name: 'Vikram Patel', email: 'vikram@global.com', phone: '+91 76543 21098', company: 'Global Corp', role: 'CTO', lastContact: '3d ago' },
    { id: 4, name: 'Ananya Reddy', email: 'ananya@digital.com', phone: '+91 65432 10987', company: 'Digital Agency', role: 'Director', lastContact: '1w ago' },
    { id: 5, name: 'Karthik Iyer', email: 'karthik@finance.com', phone: '+91 54321 09876', company: 'Finance Pro', role: 'CFO', lastContact: '2w ago' },
  ]);

  const filteredContacts = useMemo(() => {
    if (!searchQuery.trim()) return contacts;
    const q = searchQuery.toLowerCase();
    return contacts.filter(c =>
      c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) ||
      c.company.toLowerCase().includes(q) || c.role.toLowerCase().includes(q)
    );
  }, [contacts, searchQuery]);

  const handleAddContact = () => {
    if (!formData.name || !formData.email) {
      toast.error('Name and email are required');
      return;
    }
    const newContact = {
      id: Math.max(...contacts.map(c => c.id), 0) + 1,
      name: formData.name,
      email: formData.email,
      phone: formData.phone || '-',
      company: formData.company || '-',
      role: formData.role || '-',
      lastContact: 'Just now',
    };
    setContacts(prev => [newContact, ...prev]);
    toast.success(`Contact "${formData.name}" added successfully`);
    setFormData({ name: '', email: '', phone: '', company: '', role: '' });
    setShowAddModal(false);
  };

  const handleSaveEditContact = () => {
    if (!editingContact.name || !editingContact.email) {
      toast.error('Name and email are required');
      return;
    }
    setContacts(prev => prev.map(c => c.id === editingContact.id ? { ...editingContact } : c));
    toast.success(`Contact "${editingContact.name}" updated`);
    setEditingContact(null);
  };

  const handleDeleteContact = (contact) => {
    setActiveMenu(null);
    setContacts(prev => prev.filter(c => c.id !== contact.id));
    toast((t) => (
      <div className="flex items-center gap-3">
        <span>{contact.name} deleted</span>
        <button
          onClick={() => {
            setContacts(prev => [...prev, contact].sort((a, b) => a.id - b.id));
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

  return (
    <div className="space-y-6">
      <input type="file" ref={fileInputRef} accept=".csv" className="hidden" onChange={(e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
          try {
            const text = evt.target.result;
            const lines = text.split('\n').filter(l => l.trim());
            if (lines.length < 2) { toast.error('No data rows found'); return; }
            const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
            const nameIdx = headers.findIndex(h => h.includes('name'));
            const emailIdx = headers.findIndex(h => h.includes('email'));
            const phoneIdx = headers.findIndex(h => h.includes('phone'));
            const companyIdx = headers.findIndex(h => h.includes('company'));
            const roleIdx = headers.findIndex(h => h.includes('role'));
            if (nameIdx === -1) { toast.error('CSV must have a "Name" column'); return; }
            let imported = 0;
            const maxId = Math.max(0, ...contacts.map(c => c.id));
            const newItems = [];
            for (let i = 1; i < lines.length; i++) {
              const cols = lines[i].split(',').map(c => c.trim().replace(/"/g, ''));
              if (!cols[nameIdx]) continue;
              newItems.push({ id: maxId + i, name: cols[nameIdx], email: emailIdx >= 0 ? cols[emailIdx] : '-', phone: phoneIdx >= 0 ? cols[phoneIdx] : '-', company: companyIdx >= 0 ? cols[companyIdx] : '-', role: roleIdx >= 0 ? cols[roleIdx] : '-', lastContact: 'Just now' });
              imported++;
            }
            setContacts(prev => [...newItems, ...prev]);
            toast.success(`Imported ${imported} contacts from CSV`);
          } catch { toast.error('Failed to parse CSV'); }
        };
        reader.readAsText(file);
        e.target.value = '';
      }} />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Contacts</h1>
          <p className="text-sm text-slate-500">Your business contacts</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300">
            <Upload className="w-4 h-4" /> Import
          </button>
          <button
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
            className="flex items-center gap-2 px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
          >
            <Download className="w-4 h-4" /> Export
          </button>
          {canCreate && (
          <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
            <Plus className="w-4 h-4" /> Add Contact
          </button>
          )}
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search contacts..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
        />
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 dark:bg-slate-800/50">
            <tr>
              <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">Contact</th>
              <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">Company</th>
              <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">Role</th>
              <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">Last Contact</th>
              <th className="py-3 px-4 text-center text-xs font-medium text-slate-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredContacts.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-slate-500">No contacts found.</td>
              </tr>
            ) : (
              filteredContacts.map(contact => (
                <tr key={contact.id} className="border-t border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center text-white font-medium">
                        {contact.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900 dark:text-white">{contact.name}</p>
                        <p className="text-sm text-slate-500">{contact.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-sm text-slate-600 dark:text-slate-400">{contact.company}</td>
                  <td className="py-3 px-4 text-sm text-slate-600 dark:text-slate-400">{contact.role}</td>
                  <td className="py-3 px-4 text-sm text-slate-500">{contact.lastContact}</td>
                  <td className="py-3 px-4 relative">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => window.open('tel:' + contact.phone.replace(/\s/g, ''))}
                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                        title="Call"
                      >
                        <Phone className="w-4 h-4 text-slate-400" />
                      </button>
                      <button
                        onClick={() => window.open('mailto:' + contact.email)}
                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                        title="Email"
                      >
                        <Mail className="w-4 h-4 text-slate-400" />
                      </button>
                      <button
                        onClick={() => setActiveMenu(prev => prev === contact.id ? null : contact.id)}
                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                      >
                        <MoreVertical className="w-4 h-4 text-slate-400" />
                      </button>
                    </div>
                    {activeMenu === contact.id && (
                      <div className="absolute right-4 top-12 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg z-20 w-40 py-1">
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

      {/* Add Contact Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowAddModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Add New Contact</h2>
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
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Phone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+91 XXXXX XXXXX"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
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
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Role</label>
                  <input
                    type="text"
                    value={formData.role}
                    onChange={e => setFormData({ ...formData, role: e.target.value })}
                    placeholder="e.g. CEO"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
              >Cancel</button>
              <button
                onClick={handleAddContact}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
              >Save Contact</button>
            </div>
          </div>
        </div>
      )}

      {/* View Contact Detail Modal */}
      {viewingContact && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setViewingContact(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Contact Details</h2>
              <button onClick={() => setViewingContact(null)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                {viewingContact.name.charAt(0)}
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">{viewingContact.name}</h3>
                <p className="text-sm text-slate-500">{viewingContact.role} at {viewingContact.company}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <p className="text-xs text-slate-500 uppercase font-medium mb-1">Email</p>
                <p className="text-sm text-slate-900 dark:text-white font-medium">{viewingContact.email}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase font-medium mb-1">Phone</p>
                <p className="text-sm text-slate-900 dark:text-white font-medium">{viewingContact.phone}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase font-medium mb-1">Company</p>
                <p className="text-sm text-slate-900 dark:text-white font-medium">{viewingContact.company}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase font-medium mb-1">Role</p>
                <p className="text-sm text-slate-900 dark:text-white font-medium">{viewingContact.role}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase font-medium mb-1">Last Contact</p>
                <p className="text-sm text-slate-900 dark:text-white font-medium">{viewingContact.lastContact}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 pt-4 border-t border-slate-100 dark:border-slate-700">
              <button
                onClick={() => window.open('tel:' + viewingContact.phone.replace(/\s/g, ''))}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700"
              >
                <Phone className="w-4 h-4" /> Call
              </button>
              <button
                onClick={() => window.open('mailto:' + viewingContact.email)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
              >
                <Mail className="w-4 h-4" /> Email
              </button>
              {canUpdate && (
              <button
                onClick={() => { setViewingContact(null); setEditingContact({ ...viewingContact }); }}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
              >
                <Edit className="w-4 h-4" /> Edit
              </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Contact Modal */}
      {editingContact && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setEditingContact(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Edit Contact</h2>
              <button onClick={() => setEditingContact(null)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Name *</label>
                <input
                  type="text"
                  value={editingContact.name}
                  onChange={e => setEditingContact({ ...editingContact, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email *</label>
                <input
                  type="email"
                  value={editingContact.email}
                  onChange={e => setEditingContact({ ...editingContact, email: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Phone</label>
                <input
                  type="tel"
                  value={editingContact.phone}
                  onChange={e => setEditingContact({ ...editingContact, phone: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Company</label>
                  <input
                    type="text"
                    value={editingContact.company}
                    onChange={e => setEditingContact({ ...editingContact, company: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Role</label>
                  <input
                    type="text"
                    value={editingContact.role}
                    onChange={e => setEditingContact({ ...editingContact, role: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setEditingContact(null)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
              >Cancel</button>
              <button
                onClick={handleSaveEditContact}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
              >Save Changes</button>
            </div>
          </div>
        </div>
      )}
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
  const [formData, setFormData] = useState({ name: '', value: '', company: '', probability: '20', owner: 'Arun', stage: 'qualification' });

  const [stages, setStages] = useState([
    { id: 'qualification', name: 'Qualification', color: 'bg-slate-400', deals: [
      { id: 1, name: 'Tech Solutions CRM', value: '₹2.5L', company: 'Tech Solutions', probability: 20, owner: 'Arun' },
      { id: 2, name: 'Retail POS System', value: '₹1.8L', company: 'Global Retail', probability: 15, owner: 'Meera' },
    ]},
    { id: 'proposal', name: 'Proposal', color: 'bg-blue-500', deals: [
      { id: 3, name: 'Healthcare Platform', value: '₹4.2L', company: 'HealthCare Plus', probability: 40, owner: 'Kavya' },
    ]},
    { id: 'negotiation', name: 'Negotiation', color: 'bg-amber-500', deals: [
      { id: 4, name: 'Finance Dashboard', value: '₹3.5L', company: 'Finance Pro', probability: 60, owner: 'Arun' },
      { id: 5, name: 'EduTech LMS', value: '₹2.1L', company: 'EduTech Solutions', probability: 55, owner: 'Meera' },
    ]},
    { id: 'closed', name: 'Closed Won', color: 'bg-emerald-500', deals: [
      { id: 6, name: 'Marketing Automation', value: '₹5.2L', company: 'Digital Agency', probability: 100, owner: 'Kavya' },
    ]},
  ]);

  const handleAddDeal = (targetStage) => {
    if (!formData.name || !formData.value) {
      toast.error('Deal name and value are required');
      return;
    }
    const stageId = targetStage || formData.stage;
    const allDealIds = stages.flatMap(s => s.deals.map(d => d.id));
    const newDeal = {
      id: Math.max(0, ...allDealIds) + 1,
      name: formData.name,
      value: formData.value,
      company: formData.company || '-',
      probability: parseInt(formData.probability) || 20,
      owner: formData.owner,
    };
    setStages(prev => prev.map(s =>
      s.id === stageId ? { ...s, deals: [...s.deals, newDeal] } : s
    ));
    toast.success(`Deal "${formData.name}" added to ${stages.find(s => s.id === stageId)?.name}`);
    setFormData({ name: '', value: '', company: '', probability: '20', owner: 'Arun', stage: 'qualification' });
    setShowAddModal(false);
  };

  const handleDealClick = (deal, stageId) => {
    setViewingDeal({ ...deal, stageId });
  };

  const handleDealMenuAction = (action, deal, stageId) => {
    setActiveMenu(null);
    switch (action) {
      case 'view':
        setViewingDeal({ ...deal, stageId });
        break;
      case 'edit':
        setEditingDeal({ ...deal, stageId });
        break;
      case 'delete': {
        setStages(prev => prev.map(s =>
          s.id === stageId ? { ...s, deals: s.deals.filter(d => d.id !== deal.id) } : s
        ));
        toast((t) => (
          <div className="flex items-center gap-3">
            <span>{deal.name} deleted</span>
            <button
              onClick={() => {
                setStages(prev => prev.map(s =>
                  s.id === stageId ? { ...s, deals: [...s.deals, deal].sort((a, b) => a.id - b.id) } : s
                ));
                toast.dismiss(t.id);
                toast.success('Restored');
              }}
              className="px-2 py-1 bg-indigo-600 text-white text-xs rounded font-medium hover:bg-indigo-700"
            >
              Undo
            </button>
          </div>
        ), { duration: 5000 });
        break;
      }
    }
  };

  const handleSaveEditDeal = () => {
    if (!editingDeal.name || !editingDeal.value) {
      toast.error('Deal name and value are required');
      return;
    }
    const { stageId: newStageId, ...dealData } = editingDeal;
    // Find which stage currently holds this deal
    let oldStageId = null;
    stages.forEach(s => {
      if (s.deals.some(d => d.id === dealData.id)) {
        oldStageId = s.id;
      }
    });

    if (oldStageId && oldStageId !== newStageId) {
      // Deal moved to a different stage
      setStages(prev => prev.map(s => {
        if (s.id === oldStageId) {
          return { ...s, deals: s.deals.filter(d => d.id !== dealData.id) };
        }
        if (s.id === newStageId) {
          return { ...s, deals: [...s.deals, dealData] };
        }
        return s;
      }));
    } else {
      // Same stage, just update the deal
      setStages(prev => prev.map(s =>
        s.id === (oldStageId || newStageId)
          ? { ...s, deals: s.deals.map(d => d.id === dealData.id ? dealData : d) }
          : s
      ));
    }
    toast.success(`Deal "${editingDeal.name}" updated`);
    setEditingDeal(null);
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
    // Only clear if we're leaving the column entirely (not entering a child)
    const relatedTarget = e.relatedTarget;
    if (relatedTarget && e.currentTarget.contains(relatedTarget)) return;
    if (dragOverStage === stageId) {
      setDragOverStage(null);
    }
  };

  const handleDrop = (e, toStageId) => {
    e.preventDefault();
    setDragOverStage(null);
    const dealId = parseInt(e.dataTransfer.getData('dealId'));
    const fromStageId = e.dataTransfer.getData('fromStage');

    if (fromStageId === toStageId) return;

    let movedDeal = null;
    setStages(prev => {
      const updated = prev.map(s => {
        if (s.id === fromStageId) {
          movedDeal = s.deals.find(d => d.id === dealId);
          return { ...s, deals: s.deals.filter(d => d.id !== dealId) };
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
    // Use setTimeout to ensure movedDeal is captured
    setTimeout(() => {
      toast.success(`Deal moved from ${fromName} to ${toName}`);
    }, 0);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Deals Pipeline</h1>
          <p className="text-sm text-slate-500">Track your sales opportunities</p>
        </div>
        <div className="flex items-center gap-2">
          <button
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
            className="flex items-center gap-2 px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
          >
            <Download className="w-4 h-4" /> Export
          </button>
          {canCreate && (
          <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
            <Plus className="w-4 h-4" /> Add Deal
          </button>
          )}
        </div>
      </div>

      {/* Pipeline Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
          <p className="text-sm text-slate-500">Total Pipeline</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">₹19.3L</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
          <p className="text-sm text-slate-500">Weighted Value</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">₹8.7L</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
          <p className="text-sm text-slate-500">Won This Month</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">₹5.2L</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
          <p className="text-sm text-slate-500">Win Rate</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">32%</p>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {stages.map(stage => (
          <div
            key={stage.id}
            className={`flex-shrink-0 w-72 rounded-xl p-2 transition-colors ${dragOverStage === stage.id ? 'border-2 border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-2 border-transparent'}`}
            onDragOver={handleDragOver}
            onDragEnter={(e) => handleDragEnter(e, stage.id)}
            onDragLeave={(e) => handleDragLeave(e, stage.id)}
            onDrop={(e) => handleDrop(e, stage.id)}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${stage.color}`} />
                <h3 className="font-semibold text-slate-900 dark:text-white">{stage.name}</h3>
                <span className="text-sm text-slate-500">({stage.deals.length})</span>
              </div>
            </div>
            <div className="space-y-3">
              {stage.deals.map(deal => (
                <div
                  key={deal.id}
                  draggable="true"
                  onDragStart={(e) => handleDragStart(e, deal, stage.id)}
                  className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing"
                  onClick={() => handleDealClick(deal, stage.id)}
                >
                  <h4 className="font-medium text-slate-900 dark:text-white">{deal.name}</h4>
                  <p className="text-sm text-slate-500 mt-1">{deal.company}</p>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-lg font-bold text-indigo-600">{deal.value}</span>
                    <span className="text-sm text-slate-500">{deal.probability}%</span>
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                    <span className="text-xs text-slate-500">Owner: {deal.owner}</span>
                    <div className="relative">
                      <button
                        onClick={e => { e.stopPropagation(); setActiveMenu(prev => prev === deal.id ? null : deal.id); }}
                        className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
                      >
                        <MoreVertical className="w-4 h-4 text-slate-400" />
                      </button>
                      {activeMenu === deal.id && (
                        <div className="absolute right-0 top-8 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg z-20 w-36 py-1">
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
                            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
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
                className="w-full py-2 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors"
              >
                + Add Deal
              </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add Deal Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowAddModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Add New Deal</h2>
              <button onClick={() => setShowAddModal(false)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Deal Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter deal name"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Value *</label>
                  <input
                    type="text"
                    value={formData.value}
                    onChange={e => setFormData({ ...formData, value: e.target.value })}
                    placeholder="e.g. ₹3.5L"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Probability %</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.probability}
                    onChange={e => setFormData({ ...formData, probability: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                  />
                </div>
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Stage</label>
                  <select
                    value={formData.stage}
                    onChange={e => setFormData({ ...formData, stage: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                  >
                    <option value="qualification">Qualification</option>
                    <option value="proposal">Proposal</option>
                    <option value="negotiation">Negotiation</option>
                    <option value="closed">Closed Won</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Owner</label>
                  <select
                    value={formData.owner}
                    onChange={e => setFormData({ ...formData, owner: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                  >
                    <option>Arun</option>
                    <option>Meera</option>
                    <option>Kavya</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
              >Cancel</button>
              <button
                onClick={() => handleAddDeal()}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
              >Save Deal</button>
            </div>
          </div>
        </div>
      )}

      {/* View Deal Detail Modal */}
      {viewingDeal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setViewingDeal(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Deal Details</h2>
              <button onClick={() => setViewingDeal(null)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="mb-6">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">{viewingDeal.name}</h3>
              <p className="text-sm text-slate-500 mt-1">{viewingDeal.company}</p>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <p className="text-xs text-slate-500 uppercase font-medium mb-1">Value</p>
                <p className="text-lg font-bold text-indigo-600">{viewingDeal.value}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase font-medium mb-1">Probability</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                    <div className="bg-indigo-600 h-2 rounded-full" style={{ width: `${viewingDeal.probability}%` }} />
                  </div>
                  <span className="text-sm font-medium text-slate-900 dark:text-white">{viewingDeal.probability}%</span>
                </div>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase font-medium mb-1">Company</p>
                <p className="text-sm text-slate-900 dark:text-white font-medium">{viewingDeal.company}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase font-medium mb-1">Owner</p>
                <p className="text-sm text-slate-900 dark:text-white font-medium">{viewingDeal.owner}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase font-medium mb-1">Stage</p>
                <p className="text-sm text-slate-900 dark:text-white font-medium capitalize">
                  {stages.find(s => s.id === viewingDeal.stageId)?.name || viewingDeal.stageId}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 pt-4 border-t border-slate-100 dark:border-slate-700">
              <button
                onClick={() => { const d = { ...viewingDeal }; setViewingDeal(null); setEditingDeal(d); }}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
              >
                <Edit className="w-4 h-4" /> Edit Deal
              </button>
              <button
                onClick={() => setViewingDeal(null)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
              >Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Deal Modal */}
      {editingDeal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setEditingDeal(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Edit Deal</h2>
              <button onClick={() => setEditingDeal(null)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Deal Name *</label>
                <input
                  type="text"
                  value={editingDeal.name}
                  onChange={e => setEditingDeal({ ...editingDeal, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Value *</label>
                  <input
                    type="text"
                    value={editingDeal.value}
                    onChange={e => setEditingDeal({ ...editingDeal, value: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Probability %</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={editingDeal.probability}
                    onChange={e => setEditingDeal({ ...editingDeal, probability: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Company</label>
                <input
                  type="text"
                  value={editingDeal.company}
                  onChange={e => setEditingDeal({ ...editingDeal, company: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Stage</label>
                  <select
                    value={editingDeal.stageId}
                    onChange={e => setEditingDeal({ ...editingDeal, stageId: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                  >
                    <option value="qualification">Qualification</option>
                    <option value="proposal">Proposal</option>
                    <option value="negotiation">Negotiation</option>
                    <option value="closed">Closed Won</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Owner</label>
                  <select
                    value={editingDeal.owner}
                    onChange={e => setEditingDeal({ ...editingDeal, owner: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                  >
                    <option>Arun</option>
                    <option>Meera</option>
                    <option>Kavya</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setEditingDeal(null)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
              >Cancel</button>
              <button
                onClick={handleSaveEditDeal}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
              >Save Changes</button>
            </div>
          </div>
        </div>
      )}
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
  const [formData, setFormData] = useState({ type: 'call', title: '', contact: '', company: '', time: '', date: 'Today' });

  const [activities, setActivities] = useState([
    { id: 1, type: 'call', title: 'Follow-up call with Rajesh Kumar', contact: 'Rajesh Kumar', company: 'Tech Solutions', time: '10:30 AM', date: 'Today', status: 'completed', duration: '15 min' },
    { id: 2, type: 'meeting', title: 'Product demo', contact: 'Priya Sharma', company: 'StartUp Inc', time: '2:00 PM', date: 'Today', status: 'scheduled' },
    { id: 3, type: 'email', title: 'Sent proposal', contact: 'Vikram Patel', company: 'Global Corp', time: '11:45 AM', date: 'Today', status: 'completed' },
    { id: 4, type: 'task', title: 'Prepare presentation', contact: 'Internal', company: '-', time: '4:00 PM', date: 'Today', status: 'pending' },
    { id: 5, type: 'call', title: 'Discovery call', contact: 'Ananya Reddy', company: 'Digital Agency', time: '9:00 AM', date: 'Tomorrow', status: 'scheduled' },
  ]);

  const typeIcons = { call: Phone, meeting: Calendar, email: Mail, task: CheckCircle };
  const typeColors = {
    call: 'bg-emerald-100 text-emerald-600',
    meeting: 'bg-purple-100 text-purple-600',
    email: 'bg-blue-100 text-blue-600',
    task: 'bg-amber-100 text-amber-600',
  };

  const filteredActivities = useMemo(() => {
    if (filter === 'all') return activities;
    const typeMap = { calls: 'call', meetings: 'meeting', emails: 'email', tasks: 'task' };
    return activities.filter(a => a.type === (typeMap[filter] || filter));
  }, [activities, filter]);

  const handleLogActivity = () => {
    if (!formData.title || !formData.contact) {
      toast.error('Title and contact are required');
      return;
    }
    const newActivity = {
      id: Math.max(...activities.map(a => a.id), 0) + 1,
      type: formData.type,
      title: formData.title,
      contact: formData.contact,
      company: formData.company || '-',
      time: formData.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      date: formData.date,
      status: 'scheduled',
    };
    setActivities(prev => [newActivity, ...prev]);
    toast.success(`Activity "${formData.title}" logged successfully`);
    setFormData({ type: 'call', title: '', contact: '', company: '', time: '', date: 'Today' });
    setShowAddModal(false);
  };

  const handleSaveEditActivity = () => {
    if (!editingActivity.title || !editingActivity.contact) {
      toast.error('Title and contact are required');
      return;
    }
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Activities</h1>
          <p className="text-sm text-slate-500">Calls, meetings, tasks & emails</p>
        </div>
        <div className="flex items-center gap-2">
          <button
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
            className="flex items-center gap-2 px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
          >
            <Download className="w-4 h-4" /> Export
          </button>
          {canCreate && (
          <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
            <Plus className="w-4 h-4" /> Log Activity
          </button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2">
        {['all', 'calls', 'meetings', 'emails', 'tasks'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize ${filter === f ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 dark:text-slate-400'}`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Activities List */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
        {filteredActivities.length === 0 ? (
          <div className="py-12 text-center text-slate-500">No activities found for this filter.</div>
        ) : (
          filteredActivities.map((activity, i) => {
            const Icon = typeIcons[activity.type];
            return (
              <div key={activity.id} className={`flex items-center gap-4 p-4 ${i > 0 ? 'border-t border-slate-100 dark:border-slate-700' : ''} hover:bg-slate-50 dark:hover:bg-slate-800/50`}>
                <div className={`p-2.5 rounded-xl ${typeColors[activity.type]}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-slate-900 dark:text-white">{activity.title}</h3>
                    {activity.status === 'completed' && <CheckCircle className="w-4 h-4 text-emerald-500" />}
                  </div>
                  <p className="text-sm text-slate-500">{activity.contact} {activity.company !== '-' ? `• ${activity.company}` : ''}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-slate-900 dark:text-white">{activity.time}</p>
                  <p className="text-xs text-slate-500">{activity.date}</p>
                </div>
                <div className="relative">
                  <button
                    onClick={() => setActiveMenu(prev => prev === activity.id ? null : activity.id)}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                  >
                    <MoreVertical className="w-4 h-4 text-slate-400" />
                  </button>
                  {activeMenu === activity.id && (
                    <div className="absolute right-0 top-10 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg z-20 w-44 py-1">
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
                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                      ><Trash2 className="w-4 h-4" /> Delete</button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Log Activity Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowAddModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Log Activity</h2>
              <button onClick={() => setShowAddModal(false)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Type</label>
                <select
                  value={formData.type}
                  onChange={e => setFormData({ ...formData, type: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                >
                  <option value="call">Call</option>
                  <option value="meeting">Meeting</option>
                  <option value="email">Email</option>
                  <option value="task">Task</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Title *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Follow-up call with client"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Contact *</label>
                  <input
                    type="text"
                    value={formData.contact}
                    onChange={e => setFormData({ ...formData, contact: e.target.value })}
                    placeholder="Contact name"
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
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Time</label>
                  <input
                    type="time"
                    value={formData.time}
                    onChange={e => setFormData({ ...formData, time: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Date</label>
                  <select
                    value={formData.date}
                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                  >
                    <option>Today</option>
                    <option>Tomorrow</option>
                    <option>This Week</option>
                    <option>Next Week</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
              >Cancel</button>
              <button
                onClick={handleLogActivity}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
              >Log Activity</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Activity Modal */}
      {editingActivity && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setEditingActivity(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Edit Activity</h2>
              <button onClick={() => setEditingActivity(null)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Type</label>
                <select
                  value={editingActivity.type}
                  onChange={e => setEditingActivity({ ...editingActivity, type: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                >
                  <option value="call">Call</option>
                  <option value="meeting">Meeting</option>
                  <option value="email">Email</option>
                  <option value="task">Task</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Title *</label>
                <input
                  type="text"
                  value={editingActivity.title}
                  onChange={e => setEditingActivity({ ...editingActivity, title: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Contact *</label>
                  <input
                    type="text"
                    value={editingActivity.contact}
                    onChange={e => setEditingActivity({ ...editingActivity, contact: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Company</label>
                  <input
                    type="text"
                    value={editingActivity.company}
                    onChange={e => setEditingActivity({ ...editingActivity, company: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Time</label>
                  <input
                    type="text"
                    value={editingActivity.time}
                    onChange={e => setEditingActivity({ ...editingActivity, time: e.target.value })}
                    placeholder="e.g. 2:00 PM"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Date</label>
                  <select
                    value={editingActivity.date}
                    onChange={e => setEditingActivity({ ...editingActivity, date: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                  >
                    <option>Today</option>
                    <option>Tomorrow</option>
                    <option>This Week</option>
                    <option>Next Week</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setEditingActivity(null)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
              >Cancel</button>
              <button
                onClick={handleSaveEditActivity}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
              >Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Reschedule Activity Modal */}
      {reschedulingActivity && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setReschedulingActivity(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Reschedule</h2>
              <button onClick={() => setReschedulingActivity(null)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <p className="text-sm text-slate-500 mb-4">Reschedule "{reschedulingActivity.title}"</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">New Time</label>
                <input
                  type="text"
                  value={reschedulingActivity.time}
                  onChange={e => setReschedulingActivity({ ...reschedulingActivity, time: e.target.value })}
                  placeholder="e.g. 3:00 PM"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">New Date</label>
                <select
                  value={reschedulingActivity.date}
                  onChange={e => setReschedulingActivity({ ...reschedulingActivity, date: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                >
                  <option>Today</option>
                  <option>Tomorrow</option>
                  <option>This Week</option>
                  <option>Next Week</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setReschedulingActivity(null)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
              >Cancel</button>
              <button
                onClick={handleSaveReschedule}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
              >Reschedule</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
