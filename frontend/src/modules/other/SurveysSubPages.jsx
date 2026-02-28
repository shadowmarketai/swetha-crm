import { useState } from 'react';
import toast from 'react-hot-toast';
import {
  FileText, Plus, Edit, Trash2, Copy, ChevronDown, ChevronUp, CheckCircle,
  Clock, Search
} from 'lucide-react';
import { usePermissions } from '../../hooks/usePermissions';

// ==================== FORMS PAGE ====================
export function FormsPage() {
  const { can } = usePermissions();
  const canCreate = can('surveys', 'create');
  const canUpdate = can('surveys', 'update');
  const canDelete = can('surveys', 'delete');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'feedback' });

  const forms = [
    { id: 1, name: 'Customer Satisfaction Survey', responses: 456, status: 'active', created: '2026-01-15', fields: 8 },
    { id: 2, name: 'Product Feedback Form', responses: 234, status: 'active', created: '2026-01-20', fields: 12 },
    { id: 3, name: 'Post-Call Survey', responses: 892, status: 'active', created: '2026-02-01', fields: 5 },
    { id: 4, name: 'Event Registration', responses: 67, status: 'draft', created: '2026-02-10', fields: 10 },
    { id: 5, name: 'NPS Survey', responses: 345, status: 'active', created: '2026-02-12', fields: 3 },
    { id: 6, name: 'Employee Feedback', responses: 0, status: 'draft', created: '2026-02-20', fields: 15 },
  ];

  const handleCreate = () => {
    if (!form.name.trim()) { toast.error('Form name required'); return; }
    toast.success(`Form "${form.name}" created`);
    setForm({ name: '', type: 'feedback' });
    setShowModal(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Survey Forms</h1>
          <p className="text-sm text-slate-500">Create and manage survey forms</p>
        </div>
        {canCreate && (
          <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
            <Plus className="w-4 h-4" /> Create Form
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {forms.map(f => (
          <div key={f.id} className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white">{f.name}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded ${f.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{f.status}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center mb-4">
              <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-2">
                <p className="text-lg font-bold text-slate-900 dark:text-white">{f.responses}</p>
                <p className="text-xs text-slate-500">Responses</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-2">
                <p className="text-lg font-bold text-slate-900 dark:text-white">{f.fields}</p>
                <p className="text-xs text-slate-500">Fields</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-2">
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{f.created}</p>
                <p className="text-xs text-slate-500">Created</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {canUpdate && (
                <button onClick={() => toast.success(`Editing "${f.name}"`)} className="flex-1 px-3 py-2 bg-indigo-100 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-200">Edit</button>
              )}
              <button onClick={() => toast.success(`Duplicated "${f.name}"`)} className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700"><Copy className="w-4 h-4 text-slate-500" /></button>
              {canDelete && (
                <button onClick={() => toast.success(`Deleted "${f.name}"`)} className="p-2 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4 text-red-400" /></button>
              )}
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Create Form</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Form Name</label>
                <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Customer Satisfaction" className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Type</label>
                <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white rounded-lg text-sm">
                  <option value="feedback">Feedback</option>
                  <option value="nps">NPS</option>
                  <option value="csat">CSAT</option>
                  <option value="registration">Registration</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-300">Cancel</button>
              <button onClick={handleCreate} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== RESPONSES PAGE ====================
export function ResponsesPage() {
  const [expandedRow, setExpandedRow] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const responses = [
    { id: 1, form: 'Customer Satisfaction Survey', respondent: 'Rajesh Kumar', date: '2026-02-25', score: 4.5, answers: { 'Overall satisfaction': '5/5', 'Would recommend': 'Yes', 'Feedback': 'Excellent service, very responsive team' } },
    { id: 2, form: 'Product Feedback Form', respondent: 'Priya Sharma', date: '2026-02-25', score: 3.8, answers: { 'Ease of use': '4/5', 'Features': '3/5', 'Support': '4/5', 'Feedback': 'Would love more integrations' } },
    { id: 3, form: 'Post-Call Survey', respondent: 'Vikram Patel', date: '2026-02-24', score: 5.0, answers: { 'Call quality': '5/5', 'Agent helpfulness': '5/5', 'Issue resolved': 'Yes' } },
    { id: 4, form: 'NPS Survey', respondent: 'Anita Desai', date: '2026-02-24', score: 9, answers: { 'NPS Score': '9/10', 'Reason': 'Great product, fast support' } },
    { id: 5, form: 'Customer Satisfaction Survey', respondent: 'Suresh Mehta', date: '2026-02-23', score: 3.0, answers: { 'Overall satisfaction': '3/5', 'Would recommend': 'Maybe', 'Feedback': 'Billing needs improvement' } },
    { id: 6, form: 'Product Feedback Form', respondent: 'Kavita Joshi', date: '2026-02-23', score: 4.2, answers: { 'Ease of use': '4/5', 'Features': '4/5', 'Support': '5/5', 'Feedback': 'Love the voice AI features' } },
  ];

  const filtered = responses.filter(r =>
    r.form.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.respondent.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Responses</h1>
        <p className="text-sm text-slate-500">View all survey submissions</p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search responses..." className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm dark:text-white" />
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-x-auto">
        <table className="w-full min-w-[600px]">
          <thead className="bg-slate-50 dark:bg-slate-800/50">
            <tr>
              <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase w-8"></th>
              <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">Form</th>
              <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">Respondent</th>
              <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">Date</th>
              <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">Score</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <>
                <tr key={r.id} onClick={() => setExpandedRow(expandedRow === r.id ? null : r.id)} className="border-t border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer">
                  <td className="py-3 px-4">
                    {expandedRow === r.id ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </td>
                  <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">{r.form}</td>
                  <td className="py-3 px-4 text-sm text-slate-600 dark:text-slate-400">{r.respondent}</td>
                  <td className="py-3 px-4 text-sm text-slate-500">{r.date}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${r.score >= 4 ? 'bg-emerald-100 text-emerald-700' : r.score >= 3 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                      {r.score}
                    </span>
                  </td>
                </tr>
                {expandedRow === r.id && (
                  <tr key={`${r.id}-detail`} className="bg-slate-50 dark:bg-slate-900/50">
                    <td colSpan={5} className="px-8 py-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {Object.entries(r.answers).map(([key, val]) => (
                          <div key={key} className="bg-white dark:bg-slate-800 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
                            <p className="text-xs font-medium text-slate-500 mb-1">{key}</p>
                            <p className="text-sm text-slate-900 dark:text-white">{val}</p>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
