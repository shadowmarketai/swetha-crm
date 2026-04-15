/**
 * CRM Sub-Pages 2 - Tasks, Notes
 * Wired to real backend APIs via /api/v1/crm-activities.
 * Visual rewrite using design system primitives.
 * Functionality, state, handlers, permissions, and data shapes preserved.
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import {
  Plus, Search, Filter, MoreVertical, CheckCircle, Clock, AlertTriangle,
  Calendar, Phone, Mail, Video, Edit, Trash2, Pin, PinOff, FileText,
  Package, Tag, IndianRupee, Star, Building2, Users, TrendingUp, X,
  ListChecks, StickyNote, ShoppingCart, Truck, Eye, RotateCcw, Download, Upload,
  CheckSquare, AlertCircle, DollarSign, Award
} from 'lucide-react';
import { usePermissions } from '../../hooks/usePermissions';
import {
  Card, CardHeader, CardBody, Stat, Button, Input, Select, Textarea, Field,
  Badge, StatusBadge, PageHeader, EmptyState, Modal, Avatar, SearchInput, Skeleton
} from '../../components/ui/primitives';

/* ────────────────────────────────────────────────────────────
 * Helpers: map backend activity → frontend shape and back
 * ──────────────────────────────────────────────────────────── */

function activityToTask(a) {
  return {
    id: a.id,
    title: a.subject || '',
    assignee: a.assigned_to_name || a.assignee || 'Unassigned',
    dueDate: a.due_date ? a.due_date.split('T')[0] : '',
    priority: a.priority || 'Medium',
    status: a.status || 'pending',
    relatedTo: a.lead_name || a.related_to || '-',
    type: a.activity_type === 'task' ? (a.description_type || 'follow-up') : a.activity_type || 'follow-up',
    description: a.description || '',
    lead_id: a.lead_id,
  };
}

function activityToNote(a) {
  return {
    id: a.id,
    title: a.subject || '',
    content: a.description || '',
    relatedTo: a.lead_name || a.related_to || '-',
    relatedType: a.related_type || 'lead',
    author: a.created_by_name || a.author || 'You',
    createdAt: a.created_at
      ? new Date(a.created_at).toLocaleString('sv-SE', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
      : '',
    pinned: a.pinned || false,
    lead_id: a.lead_id,
  };
}

// ==================== TASKS PAGE ====================
export function TasksPage() {
  const { can } = usePermissions();
  const canCreate = can('crm', 'create');
  const canUpdate = can('crm', 'update');
  const canDelete = can('crm', 'delete');
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [formData, setFormData] = useState({ title: '', assignee: '', priority: 'Medium', dueDate: '', type: 'call' });
  const [editingTask, setEditingTask] = useState(null);
  const [viewingTask, setViewingTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef(null);

  const [tasks, setTasks] = useState([]);

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/v1/crm-activities', { params: { limit: 100, activity_type: 'task' } });
      const data = Array.isArray(res.data) ? res.data : (res.data?.items || res.data?.data || []);
      setTasks(data.map(activityToTask));
    } catch (err) {
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const priorityTones = { High: 'danger', Medium: 'warning', Low: 'success' };
  const typeIcons = { call: Phone, 'follow-up': Clock, meeting: Video, email: Mail };

  const filteredTasks = useMemo(() => {
    let result = [...tasks];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(t => t.title.toLowerCase().includes(q) || t.assignee.toLowerCase().includes(q) || t.relatedTo.toLowerCase().includes(q));
    }
    if (statusFilter !== 'All') {
      result = result.filter(t => t.status === statusFilter);
    }
    return result;
  }, [tasks, searchQuery, statusFilter]);

  const today = new Date().toISOString().split('T')[0];
  const stats = useMemo(() => ({
    total: tasks.length,
    overdue: tasks.filter(t => t.status !== 'completed' && t.dueDate && t.dueDate < today).length,
    dueToday: tasks.filter(t => t.dueDate === today && t.status !== 'completed').length,
    completed: tasks.filter(t => t.status === 'completed').length,
  }), [tasks, today]);

  const handleAddTask = async () => {
    if (!formData.title) {
      toast.error('Task title is required');
      return;
    }
    try {
      await api.post('/api/v1/crm-activities', {
        activity_type: 'task',
        subject: formData.title,
        description: '',
        due_date: formData.dueDate || today,
        priority: formData.priority,
        status: 'pending',
      });
      toast.success(`Task "${formData.title}" created`);
      setFormData({ title: '', assignee: '', priority: 'Medium', dueDate: '', type: 'call' });
      setShowAddModal(false);
      fetchTasks();
    } catch (err) {
      toast.error('Failed to create task');
    }
  };

  const handleMarkComplete = async (task) => {
    try {
      await api.put(`/api/v1/crm-activities/${task.id}`, { status: 'completed' });
      toast.success(`"${task.title}" marked as completed`);
      fetchTasks();
    } catch (err) {
      toast.error('Failed to update task');
    }
  };

  const handleDeleteTask = async (task) => {
    try {
      await api.delete(`/api/v1/crm-activities/${task.id}`);
      toast.success('Task deleted');
      fetchTasks();
    } catch (err) {
      toast.error('Failed to delete task');
    }
  };

  const handleEditTask = async () => {
    if (!editingTask.title) {
      toast.error('Task title is required');
      return;
    }
    try {
      await api.put(`/api/v1/crm-activities/${editingTask.id}`, {
        subject: editingTask.title,
        due_date: editingTask.dueDate,
        priority: editingTask.priority,
        status: editingTask.status,
      });
      toast.success(`Task "${editingTask.title}" updated`);
      setEditingTask(null);
      fetchTasks();
    } catch (err) {
      toast.error('Failed to update task');
    }
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
            const titleIdx = headers.findIndex(h => h.includes('title'));
            if (titleIdx === -1) { toast.error('CSV must have a "Title" column'); return; }
            const dueDateIdx = headers.findIndex(h => h.includes('due'));
            const priorityIdx = headers.findIndex(h => h.includes('priority'));
            let imported = 0;
            const promises = [];
            for (let i = 1; i < lines.length; i++) {
              const cols = lines[i].split(',').map(c => c.trim().replace(/"/g, ''));
              if (!cols[titleIdx]) continue;
              promises.push(api.post('/api/v1/crm-activities', {
                activity_type: 'task',
                subject: cols[titleIdx],
                due_date: dueDateIdx >= 0 ? cols[dueDateIdx] : new Date().toISOString().split('T')[0],
                priority: priorityIdx >= 0 ? cols[priorityIdx] : 'Medium',
                status: 'pending',
              }));
              imported++;
            }
            Promise.all(promises).then(() => {
              toast.success(`Imported ${imported} tasks from CSV`);
              fetchTasks();
            }).catch(() => toast.error('Some tasks failed to import'));
          } catch { toast.error('Failed to parse CSV'); }
        };
        reader.readAsText(file);
        e.target.value = '';
      }} />

      <PageHeader
        title="Tasks"
        subtitle="Manage and track your tasks"
        actions={<>
          <Button variant="secondary" leftIcon={Upload} onClick={() => fileInputRef.current?.click()}>Import</Button>
          <Button
            variant="secondary"
            leftIcon={Download}
            onClick={() => {
              const headers = ['Title','Assignee','Due Date','Priority','Status','Related To','Type'];
              const rows = filteredTasks.map(t => [t.title, t.assignee, t.dueDate, t.priority, t.status, t.relatedTo, t.type]);
              const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a'); a.href = url; a.download = `tasks_${new Date().toISOString().split('T')[0]}.csv`; a.click();
              URL.revokeObjectURL(url);
              toast.success(`Exported ${filteredTasks.length} tasks as CSV`);
            }}
          >Export</Button>
          {canCreate && (
            <Button leftIcon={Plus} onClick={() => setShowAddModal(true)}>Add Task</Button>
          )}
        </>}
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Total Tasks" value={stats.total} icon={ListChecks} accent="#6366f1" accentTo="#8b5cf6" />
        <Stat label="Overdue" value={stats.overdue} icon={AlertTriangle} accent="#10b981" accentTo="#06b6d4" />
        <Stat label="Due Today" value={stats.dueToday} icon={Clock} accent="#f59e0b" accentTo="#f43f5e" />
        <Stat label="Completed" value={stats.completed} icon={CheckCircle} accent="#ec4899" accentTo="#8b5cf6" />
      </div>

      {/* Search & Filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[220px] max-w-md">
          <SearchInput
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option>All</option>
          <option value="pending">Pending</option>
          <option value="in-progress">In Progress</option>
          <option value="completed">Completed</option>
        </Select>
      </div>

      {/* Tasks Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-6 py-3 text-left">Task</th>
                <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-6 py-3 text-left">Assignee</th>
                <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-6 py-3 text-left">Due Date</th>
                <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-6 py-3 text-left">Priority</th>
                <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-6 py-3 text-left">Status</th>
                <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-6 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-slate-50 dark:border-slate-800/60">
                    <td className="px-6 py-3.5"><Skeleton className="h-5 w-48" /></td>
                    <td className="px-6 py-3.5"><Skeleton className="h-5 w-20" /></td>
                    <td className="px-6 py-3.5"><Skeleton className="h-5 w-24" /></td>
                    <td className="px-6 py-3.5"><Skeleton className="h-5 w-16" /></td>
                    <td className="px-6 py-3.5"><Skeleton className="h-5 w-20" /></td>
                    <td className="px-6 py-3.5"><Skeleton className="h-5 w-24 mx-auto" /></td>
                  </tr>
                ))
              ) : filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12">
                    <EmptyState icon={ListChecks} title="No tasks found" description="Try adjusting filters or create a new task." />
                  </td>
                </tr>
              ) : (
                filteredTasks.map(task => {
                  const TypeIcon = typeIcons[task.type] || ListChecks;
                  const isOverdue = task.status !== 'completed' && task.dueDate < today;
                  return (
                    <tr key={task.id} className="border-b border-slate-50 dark:border-slate-800/60 last:border-0 hover:bg-white/70 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-sm flex-shrink-0"
                            style={{ background: 'linear-gradient(135deg, var(--brand-primary), var(--brand-accent, var(--brand-primary)))' }}
                          >
                            <TypeIcon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className={`font-medium ${task.status === 'completed' ? 'line-through text-slate-400' : 'text-slate-900 dark:text-white'}`}>{task.title}</p>
                            <p className="text-xs text-slate-500">{task.relatedTo}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-3.5 text-slate-600 dark:text-slate-400">{task.assignee}</td>
                      <td className="px-6 py-3.5">
                        <span className={isOverdue ? 'text-rose-600 font-medium inline-flex items-center gap-1' : 'text-slate-600 dark:text-slate-400'}>
                          {task.dueDate}
                          {isOverdue && <AlertTriangle className="w-3 h-3" />}
                        </span>
                      </td>
                      <td className="px-6 py-3.5">
                        <Badge tone={priorityTones[task.priority]}>{task.priority}</Badge>
                      </td>
                      <td className="px-6 py-3.5">
                        <StatusBadge status={task.status} />
                      </td>
                      <td className="px-6 py-3.5">
                        <div className="flex items-center justify-center gap-1">
                          <Button variant="ghost" size="icon" onClick={() => setViewingTask(task)} title="View">
                            <Eye className="w-4 h-4" />
                          </Button>
                          {canUpdate && (
                            <Button variant="ghost" size="icon" onClick={() => setEditingTask({ ...task })} title="Edit">
                              <Edit className="w-4 h-4 text-blue-500" />
                            </Button>
                          )}
                          {canUpdate && task.status !== 'completed' && (
                            <Button variant="ghost" size="icon" onClick={() => handleMarkComplete(task)} title="Mark Complete">
                              <CheckCircle className="w-4 h-4 text-emerald-500" />
                            </Button>
                          )}
                          {canDelete && (
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteTask(task)} title="Delete">
                              <Trash2 className="w-4 h-4 text-rose-500" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add Task Modal */}
      <Modal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add New Task"
        footer={<>
          <Button variant="secondary" onClick={() => setShowAddModal(false)}>Cancel</Button>
          <Button onClick={handleAddTask}>Save Task</Button>
        </>}
      >
        <div className="space-y-4">
          <Field label="Title" required>
            <Input
              type="text"
              value={formData.title}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
              placeholder="Enter task title"
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Assignee">
              <Input
                type="text"
                value={formData.assignee}
                onChange={e => setFormData({ ...formData, assignee: e.target.value })}
                placeholder="Assignee name"
              />
            </Field>
            <Field label="Priority">
              <Select
                className="w-full"
                value={formData.priority}
                onChange={e => setFormData({ ...formData, priority: e.target.value })}
              >
                <option>High</option>
                <option>Medium</option>
                <option>Low</option>
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Due Date">
              <Input
                type="date"
                value={formData.dueDate}
                onChange={e => setFormData({ ...formData, dueDate: e.target.value })}
              />
            </Field>
            <Field label="Type">
              <Select
                className="w-full"
                value={formData.type}
                onChange={e => setFormData({ ...formData, type: e.target.value })}
              >
                <option value="call">Call</option>
                <option value="follow-up">Follow-up</option>
                <option value="meeting">Meeting</option>
                <option value="email">Email</option>
              </Select>
            </Field>
          </div>
        </div>
      </Modal>

      {/* View Task Modal */}
      <Modal
        open={!!viewingTask}
        onClose={() => setViewingTask(null)}
        title="Task Details"
        footer={<Button variant="secondary" onClick={() => setViewingTask(null)}>Close</Button>}
      >
        {viewingTask && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-1">Title</label>
              <p className="text-sm text-slate-900 dark:text-white font-medium">{viewingTask.title}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-1">Assignee</label>
                <p className="text-sm text-slate-900 dark:text-white">{viewingTask.assignee}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-1">Due Date</label>
                <p className="text-sm text-slate-900 dark:text-white">{viewingTask.dueDate}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-1">Priority</label>
                <Badge tone={priorityTones[viewingTask.priority]}>{viewingTask.priority}</Badge>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-1">Status</label>
                <StatusBadge status={viewingTask.status} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-1">Related To</label>
                <p className="text-sm text-slate-900 dark:text-white">{viewingTask.relatedTo}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-1">Type</label>
                <p className="text-sm text-slate-900 dark:text-white capitalize">{viewingTask.type.replace('-', ' ')}</p>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Edit Task Modal */}
      <Modal
        open={!!editingTask}
        onClose={() => setEditingTask(null)}
        title="Edit Task"
        footer={<>
          <Button variant="secondary" onClick={() => setEditingTask(null)}>Cancel</Button>
          <Button onClick={handleEditTask}>Save Changes</Button>
        </>}
      >
        {editingTask && (
          <div className="space-y-4">
            <Field label="Title" required>
              <Input
                type="text"
                value={editingTask.title}
                onChange={e => setEditingTask({ ...editingTask, title: e.target.value })}
                placeholder="Enter task title"
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Assignee">
                <Input
                  type="text"
                  value={editingTask.assignee}
                  onChange={e => setEditingTask({ ...editingTask, assignee: e.target.value })}
                  placeholder="Assignee name"
                />
              </Field>
              <Field label="Priority">
                <Select
                  className="w-full"
                  value={editingTask.priority}
                  onChange={e => setEditingTask({ ...editingTask, priority: e.target.value })}
                >
                  <option>High</option>
                  <option>Medium</option>
                  <option>Low</option>
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Due Date">
                <Input
                  type="date"
                  value={editingTask.dueDate}
                  onChange={e => setEditingTask({ ...editingTask, dueDate: e.target.value })}
                />
              </Field>
              <Field label="Type">
                <Select
                  className="w-full"
                  value={editingTask.type}
                  onChange={e => setEditingTask({ ...editingTask, type: e.target.value })}
                >
                  <option value="call">Call</option>
                  <option value="follow-up">Follow-up</option>
                  <option value="meeting">Meeting</option>
                  <option value="email">Email</option>
                </Select>
              </Field>
            </div>
            <Field label="Status">
              <Select
                className="w-full"
                value={editingTask.status}
                onChange={e => setEditingTask({ ...editingTask, status: e.target.value })}
              >
                <option value="pending">Pending</option>
                <option value="in-progress">In Progress</option>
                <option value="completed">Completed</option>
              </Select>
            </Field>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ==================== NOTES PAGE ====================
export function NotesPage() {
  const { can } = usePermissions();
  const canCreate = can('crm', 'create');
  const canUpdate = can('crm', 'update');
  const canDelete = can('crm', 'delete');
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState({ title: '', content: '', relatedTo: '', relatedType: 'lead' });
  const [editingNote, setEditingNote] = useState(null);
  const [viewingNote, setViewingNote] = useState(null);
  const [loading, setLoading] = useState(true);

  const [notes, setNotes] = useState([]);

  const fetchNotes = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/v1/crm-activities', { params: { limit: 100, activity_type: 'note' } });
      const data = Array.isArray(res.data) ? res.data : (res.data?.items || res.data?.data || []);
      setNotes(data.map(activityToNote));
    } catch (err) {
      toast.error('Failed to load notes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchNotes(); }, [fetchNotes]);

  const relatedTypeTones = { lead: 'info', deal: 'purple', contact: 'success' };

  const filteredNotes = useMemo(() => {
    if (!searchQuery.trim()) return notes;
    const q = searchQuery.toLowerCase();
    return notes.filter(n => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q) || n.relatedTo.toLowerCase().includes(q));
  }, [notes, searchQuery]);

  const sortedNotes = useMemo(() => {
    return [...filteredNotes].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
  }, [filteredNotes]);

  const handleAddNote = async () => {
    if (!formData.title || !formData.content) {
      toast.error('Title and content are required');
      return;
    }
    try {
      await api.post('/api/v1/crm-activities', {
        activity_type: 'note',
        subject: formData.title,
        description: formData.content,
      });
      toast.success(`Note "${formData.title}" created`);
      setFormData({ title: '', content: '', relatedTo: '', relatedType: 'lead' });
      setShowAddModal(false);
      fetchNotes();
    } catch (err) {
      toast.error('Failed to create note');
    }
  };

  const handleTogglePin = async (note) => {
    try {
      await api.put(`/api/v1/crm-activities/${note.id}`, { pinned: !note.pinned });
      toast.success(note.pinned ? 'Note unpinned' : 'Note pinned');
      fetchNotes();
    } catch (err) {
      // If backend doesn't support pinned field, toggle locally
      setNotes(prev => prev.map(n => n.id === note.id ? { ...n, pinned: !n.pinned } : n));
      toast.success(note.pinned ? 'Note unpinned' : 'Note pinned');
    }
  };

  const handleDeleteNote = async (note) => {
    try {
      await api.delete(`/api/v1/crm-activities/${note.id}`);
      toast.success('Note deleted');
      fetchNotes();
    } catch (err) {
      toast.error('Failed to delete note');
    }
  };

  const handleEditNote = async () => {
    if (!editingNote.title || !editingNote.content) {
      toast.error('Title and content are required');
      return;
    }
    try {
      await api.put(`/api/v1/crm-activities/${editingNote.id}`, {
        subject: editingNote.title,
        description: editingNote.content,
      });
      toast.success(`Note "${editingNote.title}" updated`);
      setEditingNote(null);
      fetchNotes();
    } catch (err) {
      toast.error('Failed to update note');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notes"
        subtitle="Quick notes linked to leads, deals & contacts"
        actions={<>
          <Button
            variant="secondary"
            leftIcon={Download}
            onClick={() => {
              const headers = ['Title','Content','Related To','Related Type','Author','Created At','Pinned'];
              const rows = notes.map(n => [n.title, n.content, n.relatedTo, n.relatedType, n.author, n.createdAt, n.pinned]);
              const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n');
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a'); a.href = url; a.download = `notes_${new Date().toISOString().split('T')[0]}.csv`; a.click();
              URL.revokeObjectURL(url);
              toast.success(`Exported ${notes.length} notes as CSV`);
            }}
          >Export</Button>
          {canCreate && (
            <Button leftIcon={Plus} onClick={() => setShowAddModal(true)}>Add Note</Button>
          )}
        </>}
      />

      {/* Search */}
      <div className="max-w-md">
        <SearchInput
          placeholder="Search notes by title or content..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Notes Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="p-5">
              <Skeleton className="h-5 w-3/4 mb-3" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-2/3 mb-3" />
              <Skeleton className="h-4 w-1/3" />
            </Card>
          ))}
        </div>
      ) : sortedNotes.length === 0 ? (
        <Card>
          <EmptyState icon={StickyNote} title="No notes found" description="Create your first note to get started." />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedNotes.map(note => (
            <Card key={note.id} hover className="p-5">
              {note.pinned && (
                <div
                  className="absolute top-0 left-5 right-5 h-px"
                  style={{ background: 'linear-gradient(90deg, transparent, var(--brand-primary), transparent)' }}
                />
              )}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {note.pinned && <Pin className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--brand-primary)' }} />}
                  <h3 className="font-semibold text-slate-900 dark:text-white truncate">{note.title}</h3>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                  {canUpdate && (
                    <Button variant="ghost" size="icon" onClick={() => setEditingNote({ ...note })} title="Edit">
                      <Edit className="w-4 h-4 text-blue-500" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" onClick={() => handleTogglePin(note)} title={note.pinned ? 'Unpin' : 'Pin'}>
                    {note.pinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                  </Button>
                  {canDelete && (
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteNote(note)} title="Delete">
                      <Trash2 className="w-4 h-4 text-rose-500" />
                    </Button>
                  )}
                </div>
              </div>
              <div className="cursor-pointer" onClick={() => setViewingNote(note)}>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-3 line-clamp-3">{note.content}</p>
              </div>
              <div className="flex items-center gap-2 mb-3">
                <Badge tone={relatedTypeTones[note.relatedType]}>{note.relatedType}</Badge>
                <span className="text-xs text-slate-500 truncate">{note.relatedTo}</span>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Avatar name={note.author} size={22} />
                  <span className="text-xs text-slate-500">{note.author}</span>
                </div>
                <span className="text-xs text-slate-400">{note.createdAt}</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add Note Modal */}
      <Modal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add New Note"
        footer={<>
          <Button variant="secondary" onClick={() => setShowAddModal(false)}>Cancel</Button>
          <Button onClick={handleAddNote}>Save Note</Button>
        </>}
      >
        <div className="space-y-4">
          <Field label="Title" required>
            <Input
              type="text"
              value={formData.title}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
              placeholder="Enter note title"
            />
          </Field>
          <Field label="Content" required>
            <Textarea
              value={formData.content}
              onChange={e => setFormData({ ...formData, content: e.target.value })}
              placeholder="Write your note..."
              rows={4}
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Related To">
              <Input
                type="text"
                value={formData.relatedTo}
                onChange={e => setFormData({ ...formData, relatedTo: e.target.value })}
                placeholder="e.g. Tech Solutions"
              />
            </Field>
            <Field label="Related Type">
              <Select
                className="w-full"
                value={formData.relatedType}
                onChange={e => setFormData({ ...formData, relatedType: e.target.value })}
              >
                <option value="lead">Lead</option>
                <option value="deal">Deal</option>
                <option value="contact">Contact</option>
              </Select>
            </Field>
          </div>
        </div>
      </Modal>

      {/* View Note Modal */}
      <Modal
        open={!!viewingNote}
        onClose={() => setViewingNote(null)}
        title="View Note"
        footer={<Button variant="secondary" onClick={() => setViewingNote(null)}>Close</Button>}
      >
        {viewingNote && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-1">Title</label>
              <p className="text-sm text-slate-900 dark:text-white font-medium">{viewingNote.title}</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-1">Content</label>
              <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{viewingNote.content}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-1">Related To</label>
                <p className="text-sm text-slate-900 dark:text-white">{viewingNote.relatedTo}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-1">Related Type</label>
                <Badge tone={relatedTypeTones[viewingNote.relatedType]}>{viewingNote.relatedType}</Badge>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-1">Author</label>
                <p className="text-sm text-slate-900 dark:text-white">{viewingNote.author}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-1">Created At</label>
                <p className="text-sm text-slate-900 dark:text-white">{viewingNote.createdAt}</p>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Edit Note Modal */}
      <Modal
        open={!!editingNote}
        onClose={() => setEditingNote(null)}
        title="Edit Note"
        footer={<>
          <Button variant="secondary" onClick={() => setEditingNote(null)}>Cancel</Button>
          <Button onClick={handleEditNote}>Save Changes</Button>
        </>}
      >
        {editingNote && (
          <div className="space-y-4">
            <Field label="Title" required>
              <Input
                type="text"
                value={editingNote.title}
                onChange={e => setEditingNote({ ...editingNote, title: e.target.value })}
                placeholder="Enter note title"
              />
            </Field>
            <Field label="Content" required>
              <Textarea
                value={editingNote.content}
                onChange={e => setEditingNote({ ...editingNote, content: e.target.value })}
                placeholder="Write your note..."
                rows={4}
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Related To">
                <Input
                  type="text"
                  value={editingNote.relatedTo}
                  onChange={e => setEditingNote({ ...editingNote, relatedTo: e.target.value })}
                  placeholder="e.g. Tech Solutions"
                />
              </Field>
              <Field label="Related Type">
                <Select
                  className="w-full"
                  value={editingNote.relatedType}
                  onChange={e => setEditingNote({ ...editingNote, relatedType: e.target.value })}
                >
                  <option value="lead">Lead</option>
                  <option value="deal">Deal</option>
                  <option value="contact">Contact</option>
                </Select>
              </Field>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
