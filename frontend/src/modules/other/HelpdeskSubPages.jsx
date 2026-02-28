import { useState } from 'react';
import toast from 'react-hot-toast';
import {
  Search, Plus, Edit, Trash2, MoreVertical, Clock, CheckCircle,
  AlertTriangle, Headphones, BookOpen, Star, Circle, User
} from 'lucide-react';
import { usePermissions } from '../../hooks/usePermissions';

// ==================== TICKETS PAGE ====================
export function TicketsPage() {
  const { can } = usePermissions();
  const canCreate = can('helpdesk', 'create');
  const canUpdate = can('helpdesk', 'update');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ subject: '', customer: '', priority: 'medium', description: '' });
  const [filter, setFilter] = useState('all');

  const tickets = [
    { id: 'TKT-001', subject: 'Voice AI not recognizing Hindi', customer: 'Rajesh Kumar', priority: 'high', status: 'open', assignee: 'Amit Singh', sla: '1h 30m', created: '30 min ago' },
    { id: 'TKT-002', subject: 'Billing discrepancy on invoice #456', customer: 'Priya Sharma', priority: 'high', status: 'in-progress', assignee: 'Neha Patel', sla: '45m', created: '2h ago' },
    { id: 'TKT-003', subject: 'CRM sync failing with HubSpot', customer: 'Tech Solutions', priority: 'medium', status: 'open', assignee: 'Unassigned', sla: '3h', created: '3h ago' },
    { id: 'TKT-004', subject: 'Cannot export call recordings', customer: 'Vikram Patel', priority: 'medium', status: 'in-progress', assignee: 'Ravi Kumar', sla: '2h 15m', created: '5h ago' },
    { id: 'TKT-005', subject: 'Feature request: WhatsApp templates', customer: 'Anita Desai', priority: 'low', status: 'open', assignee: 'Unassigned', sla: '24h', created: '1d ago' },
    { id: 'TKT-006', subject: 'Login issue on mobile app', customer: 'Suresh Mehta', priority: 'high', status: 'resolved', assignee: 'Amit Singh', sla: 'Resolved', created: '2d ago' },
  ];

  const priorityColors = { high: 'bg-red-100 text-red-700', medium: 'bg-amber-100 text-amber-700', low: 'bg-slate-100 text-slate-600' };
  const statusColors = { open: 'bg-blue-100 text-blue-700', 'in-progress': 'bg-amber-100 text-amber-700', resolved: 'bg-emerald-100 text-emerald-700' };

  const filtered = filter === 'all' ? tickets : tickets.filter(t => t.status === filter);

  const handleCreate = () => {
    if (!form.subject.trim() || !form.customer.trim()) { toast.error('Subject and customer required'); return; }
    toast.success(`Ticket "${form.subject}" created`);
    setForm({ subject: '', customer: '', priority: 'medium', description: '' });
    setShowModal(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Tickets</h1>
          <p className="text-sm text-slate-500">Manage support tickets with SLA tracking</p>
        </div>
        {canCreate && (
          <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
            <Plus className="w-4 h-4" /> New Ticket
          </button>
        )}
      </div>

      <div className="flex gap-2 flex-wrap">
        {['all', 'open', 'in-progress', 'resolved'].map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize ${filter === f ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'}`}>
            {f === 'all' ? 'All' : f}
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead className="bg-slate-50 dark:bg-slate-800/50">
            <tr>
              <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">Ticket</th>
              <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">Customer</th>
              <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">Priority</th>
              <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
              <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">Assignee</th>
              <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">SLA</th>
              <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">Created</th>
              <th className="py-3 px-4 text-center text-xs font-medium text-slate-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(t => (
              <tr key={t.id} className="border-t border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <td className="py-3 px-4">
                  <p className="font-medium text-slate-900 dark:text-white">{t.id}</p>
                  <p className="text-sm text-slate-500 truncate max-w-[200px]">{t.subject}</p>
                </td>
                <td className="py-3 px-4 text-sm text-slate-600 dark:text-slate-400">{t.customer}</td>
                <td className="py-3 px-4"><span className={`px-2 py-1 rounded text-xs font-medium ${priorityColors[t.priority]}`}>{t.priority}</span></td>
                <td className="py-3 px-4"><span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[t.status]}`}>{t.status}</span></td>
                <td className="py-3 px-4 text-sm text-slate-600 dark:text-slate-400">{t.assignee}</td>
                <td className="py-3 px-4">
                  <span className={`flex items-center gap-1 text-sm font-medium ${t.priority === 'high' && t.status !== 'resolved' ? 'text-red-600' : 'text-slate-600 dark:text-slate-400'}`}>
                    <Clock className="w-3 h-3" /> {t.sla}
                  </span>
                </td>
                <td className="py-3 px-4 text-sm text-slate-500">{t.created}</td>
                <td className="py-3 px-4 text-center">
                  {canUpdate && (
                    <button onClick={() => toast.success(`Opening ticket ${t.id}`)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                      <MoreVertical className="w-4 h-4 text-slate-400" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">New Ticket</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Subject</label>
                <input type="text" value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} placeholder="Describe the issue" className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Customer</label>
                <input type="text" value={form.customer} onChange={e => setForm({ ...form, customer: e.target.value })} placeholder="Customer name" className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Priority</label>
                <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white rounded-lg text-sm">
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-300">Cancel</button>
              <button onClick={handleCreate} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== HELPDESK AGENTS PAGE ====================
export function HelpdeskAgentsPage() {
  const agents = [
    { id: 1, name: 'Amit Singh', role: 'Senior Agent', status: 'online', activeTickets: 5, rating: 4.8, resolved: 234, avatar: '#6366f1' },
    { id: 2, name: 'Neha Patel', role: 'Agent', status: 'online', activeTickets: 3, rating: 4.6, resolved: 189, avatar: '#10b981' },
    { id: 3, name: 'Ravi Kumar', role: 'Agent', status: 'online', activeTickets: 4, rating: 4.4, resolved: 156, avatar: '#f59e0b' },
    { id: 4, name: 'Deepika Reddy', role: 'Junior Agent', status: 'offline', activeTickets: 0, rating: 4.2, resolved: 67, avatar: '#ec4899' },
    { id: 5, name: 'Arjun Verma', role: 'Agent', status: 'away', activeTickets: 2, rating: 4.5, resolved: 198, avatar: '#8b5cf6' },
    { id: 6, name: 'Meera Iyer', role: 'Team Lead', status: 'online', activeTickets: 2, rating: 4.9, resolved: 312, avatar: '#ef4444' },
  ];

  const statusColors = { online: 'bg-emerald-500', offline: 'bg-slate-400', away: 'bg-amber-500' };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Support Agents</h1>
        <p className="text-sm text-slate-500">Manage your helpdesk team</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {agents.map(a => (
          <div key={a.id} className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-4">
              <div className="relative">
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg" style={{ backgroundColor: a.avatar }}>
                  {a.name.charAt(0)}
                </div>
                <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-slate-800 ${statusColors[a.status]}`} />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white">{a.name}</h3>
                <p className="text-sm text-slate-500">{a.role}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center mb-4">
              <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-2">
                <p className="text-lg font-bold text-slate-900 dark:text-white">{a.activeTickets}</p>
                <p className="text-xs text-slate-500">Active</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-2">
                <p className="text-lg font-bold text-emerald-600">{a.resolved}</p>
                <p className="text-xs text-slate-500">Resolved</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-2">
                <p className="text-lg font-bold text-amber-600 flex items-center justify-center gap-0.5"><Star className="w-3 h-3" />{a.rating}</p>
                <p className="text-xs text-slate-500">Rating</p>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className={`px-2 py-1 rounded text-xs font-medium capitalize ${
                a.status === 'online' ? 'bg-emerald-100 text-emerald-700' :
                a.status === 'away' ? 'bg-amber-100 text-amber-700' :
                'bg-slate-100 text-slate-600'
              }`}>{a.status}</span>
              <button onClick={() => toast.success(`Viewing profile: ${a.name}`)} className="text-sm text-indigo-600 font-medium hover:text-indigo-700">View Profile</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ==================== KNOWLEDGE BASE PAGE ====================
export function KnowledgeBasePage() {
  const { can } = usePermissions();
  const canCreate = can('helpdesk', 'create');
  const [searchQuery, setSearchQuery] = useState('');

  const categories = [
    {
      name: 'Getting Started',
      articles: [
        { id: 1, title: 'Quick Start Guide', views: 1234, updated: '2026-02-20' },
        { id: 2, title: 'Setting Up Voice AI', views: 890, updated: '2026-02-18' },
        { id: 3, title: 'CRM Integration Basics', views: 567, updated: '2026-02-15' },
      ]
    },
    {
      name: 'Voice AI',
      articles: [
        { id: 4, title: 'Configuring AI Agents', views: 456, updated: '2026-02-22' },
        { id: 5, title: 'Regional Language Support', views: 789, updated: '2026-02-19' },
        { id: 6, title: 'Call Recording & Transcription', views: 345, updated: '2026-02-14' },
      ]
    },
    {
      name: 'Billing & Plans',
      articles: [
        { id: 7, title: 'Pricing Plans Overview', views: 2345, updated: '2026-02-21' },
        { id: 8, title: 'How to Upgrade Your Plan', views: 678, updated: '2026-02-17' },
        { id: 9, title: 'Razorpay Payment Issues', views: 234, updated: '2026-02-10' },
      ]
    },
    {
      name: 'Troubleshooting',
      articles: [
        { id: 10, title: 'Common API Errors', views: 567, updated: '2026-02-23' },
        { id: 11, title: 'WhatsApp Connection Issues', views: 890, updated: '2026-02-16' },
        { id: 12, title: 'Audio Quality Problems', views: 123, updated: '2026-02-12' },
      ]
    },
  ];

  const allArticles = categories.flatMap(c => c.articles.map(a => ({ ...a, category: c.name })));
  const filteredArticles = searchQuery
    ? allArticles.filter(a => a.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Knowledge Base</h1>
          <p className="text-sm text-slate-500">Help articles and documentation</p>
        </div>
        {canCreate && (
          <button onClick={() => toast.success('New article editor opened')} className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
            <Plus className="w-4 h-4" /> New Article
          </button>
        )}
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search articles..." className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm dark:text-white" />
      </div>

      {filteredArticles ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
          {filteredArticles.length === 0 ? (
            <div className="p-8 text-center text-slate-500">No articles found.</div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {filteredArticles.map(a => (
                <div key={a.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer" onClick={() => toast.success(`Opening "${a.title}"`)}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-slate-900 dark:text-white">{a.title}</h4>
                      <p className="text-sm text-slate-500">{a.category}</p>
                    </div>
                    <div className="text-right text-sm text-slate-400">
                      <p>{a.views} views</p>
                      <p>{a.updated}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {categories.map(cat => (
            <div key={cat.name}>
              <div className="flex items-center gap-2 mb-3">
                <BookOpen className="w-5 h-5 text-indigo-600" />
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{cat.name}</h2>
                <span className="text-sm text-slate-400">({cat.articles.length})</span>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700">
                {cat.articles.map(a => (
                  <div key={a.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer flex items-center justify-between" onClick={() => toast.success(`Opening "${a.title}"`)}>
                    <h4 className="font-medium text-slate-900 dark:text-white">{a.title}</h4>
                    <div className="flex items-center gap-4 text-sm text-slate-400">
                      <span>{a.views} views</span>
                      <span>{a.updated}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
