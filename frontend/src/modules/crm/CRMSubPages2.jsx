/**
 * CRM Sub-Pages 2 - Tasks, Notes, Products, Vendors
 */

import React, { useState, useMemo, useRef } from 'react';
import toast from 'react-hot-toast';
import {
  Plus, Search, Filter, MoreVertical, CheckCircle, Clock, AlertTriangle,
  Calendar, Phone, Mail, Video, Edit, Trash2, Pin, PinOff, FileText,
  Package, Tag, IndianRupee, Star, Building2, Users, TrendingUp, X,
  ListChecks, StickyNote, ShoppingCart, Truck, Eye, RotateCcw, Download, Upload
} from 'lucide-react';
import { usePermissions } from '../../hooks/usePermissions';

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
  const fileInputRef = useRef(null);

  const [tasks, setTasks] = useState([
    { id: 1, title: 'Follow up with Rajesh Kumar on proposal', assignee: 'Arun', dueDate: '2026-02-21', priority: 'High', status: 'pending', relatedTo: 'Tech Solutions Deal', type: 'follow-up' },
    { id: 2, title: 'Schedule demo for Global Retail', assignee: 'Meera', dueDate: '2026-02-22', priority: 'High', status: 'in-progress', relatedTo: 'Global Retail Corp', type: 'meeting' },
    { id: 3, title: 'Send updated pricing to Priya Sharma', assignee: 'Kavya', dueDate: '2026-02-20', priority: 'Medium', status: 'completed', relatedTo: 'StartUp Inc Deal', type: 'email' },
    { id: 4, title: 'Call HealthCare Plus for feedback', assignee: 'Arun', dueDate: '2026-02-23', priority: 'Low', status: 'pending', relatedTo: 'HealthCare Plus', type: 'call' },
    { id: 5, title: 'Prepare quarterly sales report', assignee: 'Meera', dueDate: '2026-02-19', priority: 'Medium', status: 'in-progress', relatedTo: 'Internal', type: 'follow-up' },
    { id: 6, title: 'Review contract terms with Finance Pro', assignee: 'Kavya', dueDate: '2026-02-24', priority: 'High', status: 'pending', relatedTo: 'Finance Pro Deal', type: 'meeting' },
  ]);

  const priorityColors = { High: 'bg-red-100 text-red-700', Medium: 'bg-amber-100 text-amber-700', Low: 'bg-green-100 text-green-700' };
  const statusColors = { pending: 'bg-slate-100 text-slate-600', 'in-progress': 'bg-blue-100 text-blue-700', completed: 'bg-emerald-100 text-emerald-700' };
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

  const today = '2026-02-21';
  const stats = useMemo(() => ({
    total: tasks.length,
    overdue: tasks.filter(t => t.status !== 'completed' && t.dueDate < today).length,
    dueToday: tasks.filter(t => t.dueDate === today && t.status !== 'completed').length,
    completed: tasks.filter(t => t.status === 'completed').length,
  }), [tasks]);

  const handleAddTask = () => {
    if (!formData.title) {
      toast.error('Task title is required');
      return;
    }
    const newTask = {
      id: Math.max(...tasks.map(t => t.id)) + 1,
      title: formData.title,
      assignee: formData.assignee || 'Unassigned',
      dueDate: formData.dueDate || today,
      priority: formData.priority,
      status: 'pending',
      relatedTo: '-',
      type: formData.type,
    };
    setTasks(prev => [newTask, ...prev]);
    toast.success(`Task "${formData.title}" created`);
    setFormData({ title: '', assignee: '', priority: 'Medium', dueDate: '', type: 'call' });
    setShowAddModal(false);
  };

  const handleMarkComplete = (task) => {
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'completed' } : t));
    toast.success(`"${task.title}" marked as completed`);
  };

  const handleDeleteTask = (task) => {
    setTasks(prev => prev.filter(t => t.id !== task.id));
    toast((t) => (
      <div className="flex items-center gap-3">
        <span>Task deleted</span>
        <button onClick={() => { setTasks(prev => [...prev, task].sort((a, b) => a.id - b.id)); toast.dismiss(t.id); toast.success('Restored'); }} className="px-2 py-1 bg-indigo-600 text-white text-xs rounded font-medium hover:bg-indigo-700">Undo</button>
      </div>
    ), { duration: 5000 });
  };

  const handleEditTask = () => {
    if (!editingTask.title) {
      toast.error('Task title is required');
      return;
    }
    setTasks(prev => prev.map(t => t.id === editingTask.id ? { ...editingTask } : t));
    toast.success(`Task "${editingTask.title}" updated`);
    setEditingTask(null);
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
            const assigneeIdx = headers.findIndex(h => h.includes('assignee'));
            const dueDateIdx = headers.findIndex(h => h.includes('due'));
            const priorityIdx = headers.findIndex(h => h.includes('priority'));
            let imported = 0;
            const maxId = Math.max(0, ...tasks.map(t => t.id));
            const newItems = [];
            for (let i = 1; i < lines.length; i++) {
              const cols = lines[i].split(',').map(c => c.trim().replace(/"/g, ''));
              if (!cols[titleIdx]) continue;
              newItems.push({ id: maxId + i, title: cols[titleIdx], assignee: assigneeIdx >= 0 ? cols[assigneeIdx] : 'Unassigned', dueDate: dueDateIdx >= 0 ? cols[dueDateIdx] : new Date().toISOString().split('T')[0], priority: priorityIdx >= 0 ? cols[priorityIdx] : 'Medium', status: 'pending', relatedTo: '-', type: 'follow-up' });
              imported++;
            }
            setTasks(prev => [...newItems, ...prev]);
            toast.success(`Imported ${imported} tasks from CSV`);
          } catch { toast.error('Failed to parse CSV'); }
        };
        reader.readAsText(file);
        e.target.value = '';
      }} />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Tasks</h1>
          <p className="text-sm text-slate-500">Manage and track your tasks</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300">
            <Upload className="w-4 h-4" /> Import
          </button>
          <button
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
            className="flex items-center gap-2 px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
          >
            <Download className="w-4 h-4" /> Export
          </button>
          {canCreate && (
          <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
            <Plus className="w-4 h-4" /> Add Task
          </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
          <p className="text-sm text-slate-500">Total Tasks</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{stats.total}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
          <p className="text-sm text-slate-500">Overdue</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{stats.overdue}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
          <p className="text-sm text-slate-500">Due Today</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{stats.dueToday}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
          <p className="text-sm text-slate-500">Completed</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{stats.completed}</p>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
        >
          <option>All</option>
          <option value="pending">Pending</option>
          <option value="in-progress">In Progress</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      {/* Tasks Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 dark:bg-slate-800/50">
            <tr>
              <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">Task</th>
              <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">Assignee</th>
              <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">Due Date</th>
              <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">Priority</th>
              <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
              <th className="py-3 px-4 text-center text-xs font-medium text-slate-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredTasks.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-500">No tasks found.</td>
              </tr>
            ) : (
              filteredTasks.map(task => {
                const TypeIcon = typeIcons[task.type] || ListChecks;
                const isOverdue = task.status !== 'completed' && task.dueDate < today;
                return (
                  <tr key={task.id} className="border-t border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center">
                          <TypeIcon className="w-4 h-4 text-indigo-600" />
                        </div>
                        <div>
                          <p className={`font-medium ${task.status === 'completed' ? 'line-through text-slate-400' : 'text-slate-900 dark:text-white'}`}>{task.title}</p>
                          <p className="text-xs text-slate-500">{task.relatedTo}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-600 dark:text-slate-400">{task.assignee}</td>
                    <td className="py-3 px-4">
                      <span className={`text-sm ${isOverdue ? 'text-red-600 font-medium' : 'text-slate-600 dark:text-slate-400'}`}>
                        {task.dueDate}
                        {isOverdue && <AlertTriangle className="w-3 h-3 inline ml-1" />}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${priorityColors[task.priority]}`}>
                        {task.priority}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium capitalize ${statusColors[task.status]}`}>
                        {task.status.replace('-', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setViewingTask(task)}
                          className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                          title="View"
                        >
                          <Eye className="w-4 h-4 text-slate-500" />
                        </button>
                        {canUpdate && (
                        <button
                          onClick={() => setEditingTask({ ...task })}
                          className="p-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4 text-blue-500" />
                        </button>
                        )}
                        {canUpdate && task.status !== 'completed' && (
                          <button
                            onClick={() => handleMarkComplete(task)}
                            className="p-1.5 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg"
                            title="Mark Complete"
                          >
                            <CheckCircle className="w-4 h-4 text-emerald-500" />
                          </button>
                        )}
                        {canDelete && (
                        <button
                          onClick={() => handleDeleteTask(task)}
                          className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
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

      {/* Add Task Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowAddModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Add New Task</h2>
              <button onClick={() => setShowAddModal(false)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Title *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Enter task title"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Assignee</label>
                  <input
                    type="text"
                    value={formData.assignee}
                    onChange={e => setFormData({ ...formData, assignee: e.target.value })}
                    placeholder="Assignee name"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Priority</label>
                  <select
                    value={formData.priority}
                    onChange={e => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
                  >
                    <option>High</option>
                    <option>Medium</option>
                    <option>Low</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={formData.dueDate}
                    onChange={e => setFormData({ ...formData, dueDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Type</label>
                  <select
                    value={formData.type}
                    onChange={e => setFormData({ ...formData, type: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
                  >
                    <option value="call">Call</option>
                    <option value="follow-up">Follow-up</option>
                    <option value="meeting">Meeting</option>
                    <option value="email">Email</option>
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
                onClick={handleAddTask}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
              >Save Task</button>
            </div>
          </div>
        </div>
      )}

      {/* View Task Modal */}
      {viewingTask && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setViewingTask(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Task Details</h2>
              <button onClick={() => setViewingTask(null)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
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
                  <span className={`px-2 py-1 rounded text-xs font-medium ${priorityColors[viewingTask.priority]}`}>{viewingTask.priority}</span>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-1">Status</label>
                  <span className={`px-2 py-1 rounded text-xs font-medium capitalize ${statusColors[viewingTask.status]}`}>{viewingTask.status.replace('-', ' ')}</span>
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
            <div className="flex justify-end mt-6">
              <button
                onClick={() => setViewingTask(null)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
              >Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Task Modal */}
      {editingTask && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setEditingTask(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Edit Task</h2>
              <button onClick={() => setEditingTask(null)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Title *</label>
                <input
                  type="text"
                  value={editingTask.title}
                  onChange={e => setEditingTask({ ...editingTask, title: e.target.value })}
                  placeholder="Enter task title"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Assignee</label>
                  <input
                    type="text"
                    value={editingTask.assignee}
                    onChange={e => setEditingTask({ ...editingTask, assignee: e.target.value })}
                    placeholder="Assignee name"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Priority</label>
                  <select
                    value={editingTask.priority}
                    onChange={e => setEditingTask({ ...editingTask, priority: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
                  >
                    <option>High</option>
                    <option>Medium</option>
                    <option>Low</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={editingTask.dueDate}
                    onChange={e => setEditingTask({ ...editingTask, dueDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Type</label>
                  <select
                    value={editingTask.type}
                    onChange={e => setEditingTask({ ...editingTask, type: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
                  >
                    <option value="call">Call</option>
                    <option value="follow-up">Follow-up</option>
                    <option value="meeting">Meeting</option>
                    <option value="email">Email</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Status</label>
                <select
                  value={editingTask.status}
                  onChange={e => setEditingTask({ ...editingTask, status: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
                >
                  <option value="pending">Pending</option>
                  <option value="in-progress">In Progress</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setEditingTask(null)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
              >Cancel</button>
              <button
                onClick={handleEditTask}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
              >Save Changes</button>
            </div>
          </div>
        </div>
      )}
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

  const [notes, setNotes] = useState([
    { id: 1, title: 'Meeting notes - Tech Solutions', content: 'Discussed CRM requirements. Need custom dashboard and API integration. Budget approved for Q1.', relatedTo: 'Tech Solutions Deal', relatedType: 'deal', author: 'Arun', createdAt: '2026-02-21 10:30', pinned: true },
    { id: 2, title: 'Rajesh Kumar preferences', content: 'Prefers email communication. Available Mon-Wed after 3 PM. Decision maker for tech purchases.', relatedTo: 'Rajesh Kumar', relatedType: 'contact', author: 'Meera', createdAt: '2026-02-20 14:15', pinned: true },
    { id: 3, title: 'Competitor analysis - Retail segment', content: 'Main competitors: RetailPro, ShopManager. Our advantage is AI-powered analytics and lower pricing.', relatedTo: 'Global Retail Corp', relatedType: 'lead', author: 'Kavya', createdAt: '2026-02-19 09:00', pinned: false },
    { id: 4, title: 'Pricing discussion with Priya', content: 'Offered 15% discount for annual plan. Waiting for approval from their finance team.', relatedTo: 'StartUp Inc Deal', relatedType: 'deal', author: 'Arun', createdAt: '2026-02-18 16:45', pinned: false },
    { id: 5, title: 'Product feedback from Vikram', content: 'Requested dark mode support and export to PDF feature. Logged in feature tracker.', relatedTo: 'Vikram Patel', relatedType: 'contact', author: 'Meera', createdAt: '2026-02-17 11:20', pinned: false },
    { id: 6, title: 'Onboarding checklist - HealthCare Plus', content: 'Step 1: Data migration. Step 2: User training. Step 3: Go-live support. Timeline: 2 weeks.', relatedTo: 'HealthCare Plus', relatedType: 'lead', author: 'Kavya', createdAt: '2026-02-16 13:00', pinned: true },
    { id: 7, title: 'Follow-up strategy for Q1 leads', content: 'Prioritize leads with >50% probability. Schedule weekly check-ins. Use email sequences for nurturing.', relatedTo: 'Internal', relatedType: 'lead', author: 'Arun', createdAt: '2026-02-15 10:00', pinned: false },
    { id: 8, title: 'Demo feedback - EduTech Solutions', content: 'Impressed with AI features. Concerns about data privacy and compliance. Need to share security docs.', relatedTo: 'EduTech Solutions', relatedType: 'deal', author: 'Meera', createdAt: '2026-02-14 15:30', pinned: false },
  ]);

  const relatedTypeColors = { lead: 'bg-blue-100 text-blue-700', deal: 'bg-purple-100 text-purple-700', contact: 'bg-emerald-100 text-emerald-700' };

  const filteredNotes = useMemo(() => {
    if (!searchQuery.trim()) return notes;
    const q = searchQuery.toLowerCase();
    return notes.filter(n => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q) || n.relatedTo.toLowerCase().includes(q));
  }, [notes, searchQuery]);

  const sortedNotes = useMemo(() => {
    return [...filteredNotes].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
  }, [filteredNotes]);

  const handleAddNote = () => {
    if (!formData.title || !formData.content) {
      toast.error('Title and content are required');
      return;
    }
    const newNote = {
      id: Math.max(...notes.map(n => n.id)) + 1,
      title: formData.title,
      content: formData.content,
      relatedTo: formData.relatedTo || '-',
      relatedType: formData.relatedType,
      author: 'You',
      createdAt: new Date().toLocaleString('sv-SE', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }),
      pinned: false,
    };
    setNotes(prev => [newNote, ...prev]);
    toast.success(`Note "${formData.title}" created`);
    setFormData({ title: '', content: '', relatedTo: '', relatedType: 'lead' });
    setShowAddModal(false);
  };

  const handleTogglePin = (note) => {
    setNotes(prev => prev.map(n => n.id === note.id ? { ...n, pinned: !n.pinned } : n));
    toast.success(note.pinned ? 'Note unpinned' : 'Note pinned');
  };

  const handleDeleteNote = (note) => {
    setNotes(prev => prev.filter(n => n.id !== note.id));
    toast((t) => (
      <div className="flex items-center gap-3">
        <span>Note deleted</span>
        <button onClick={() => { setNotes(prev => [...prev, note].sort((a, b) => a.id - b.id)); toast.dismiss(t.id); toast.success('Restored'); }} className="px-2 py-1 bg-indigo-600 text-white text-xs rounded font-medium hover:bg-indigo-700">Undo</button>
      </div>
    ), { duration: 5000 });
  };

  const handleEditNote = () => {
    if (!editingNote.title || !editingNote.content) {
      toast.error('Title and content are required');
      return;
    }
    setNotes(prev => prev.map(n => n.id === editingNote.id ? { ...editingNote } : n));
    toast.success(`Note "${editingNote.title}" updated`);
    setEditingNote(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Notes</h1>
          <p className="text-sm text-slate-500">Quick notes linked to leads, deals & contacts</p>
        </div>
        <div className="flex items-center gap-2">
          <button
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
            className="flex items-center gap-2 px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
          >
            <Download className="w-4 h-4" /> Export
          </button>
          {canCreate && (
          <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
            <Plus className="w-4 h-4" /> Add Note
          </button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search notes by title or content..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
        />
      </div>

      {/* Notes Grid */}
      {sortedNotes.length === 0 ? (
        <div className="py-12 text-center text-slate-500">No notes found.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedNotes.map(note => (
            <div key={note.id} className={`bg-white dark:bg-slate-800 rounded-xl border p-4 hover:shadow-lg transition-shadow ${note.pinned ? 'border-indigo-300 dark:border-indigo-600' : 'border-slate-200 dark:border-slate-700'}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {note.pinned && <Pin className="w-4 h-4 text-indigo-500 flex-shrink-0" />}
                  <h3 className="font-semibold text-slate-900 dark:text-white truncate">{note.title}</h3>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                  {canUpdate && (
                  <button
                    onClick={() => setEditingNote({ ...note })}
                    className="p-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
                    title="Edit"
                  >
                    <Edit className="w-4 h-4 text-blue-500" />
                  </button>
                  )}
                  <button
                    onClick={() => handleTogglePin(note)}
                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                    title={note.pinned ? 'Unpin' : 'Pin'}
                  >
                    {note.pinned ? <PinOff className="w-4 h-4 text-slate-400" /> : <Pin className="w-4 h-4 text-slate-400" />}
                  </button>
                  {canDelete && (
                  <button
                    onClick={() => handleDeleteNote(note)}
                    className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                  )}
                </div>
              </div>
              <div
                className="cursor-pointer"
                onClick={() => setViewingNote(note)}
              >
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-3 line-clamp-3">{note.content}</p>
              </div>
              <div className="flex items-center gap-2 mb-3">
                <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${relatedTypeColors[note.relatedType]}`}>
                  {note.relatedType}
                </span>
                <span className="text-xs text-slate-500 truncate">{note.relatedTo}</span>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-700">
                <span className="text-xs text-slate-500">{note.author}</span>
                <span className="text-xs text-slate-400">{note.createdAt}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Note Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowAddModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Add New Note</h2>
              <button onClick={() => setShowAddModal(false)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Title *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Enter note title"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Content *</label>
                <textarea
                  value={formData.content}
                  onChange={e => setFormData({ ...formData, content: e.target.value })}
                  placeholder="Write your note..."
                  rows={4}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Related To</label>
                  <input
                    type="text"
                    value={formData.relatedTo}
                    onChange={e => setFormData({ ...formData, relatedTo: e.target.value })}
                    placeholder="e.g. Tech Solutions"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Related Type</label>
                  <select
                    value={formData.relatedType}
                    onChange={e => setFormData({ ...formData, relatedType: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
                  >
                    <option value="lead">Lead</option>
                    <option value="deal">Deal</option>
                    <option value="contact">Contact</option>
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
                onClick={handleAddNote}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
              >Save Note</button>
            </div>
          </div>
        </div>
      )}

      {/* View Note Modal */}
      {viewingNote && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setViewingNote(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">View Note</h2>
              <button onClick={() => setViewingNote(null)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
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
                  <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${relatedTypeColors[viewingNote.relatedType]}`}>{viewingNote.relatedType}</span>
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
            <div className="flex justify-end mt-6">
              <button
                onClick={() => setViewingNote(null)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
              >Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Note Modal */}
      {editingNote && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setEditingNote(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Edit Note</h2>
              <button onClick={() => setEditingNote(null)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Title *</label>
                <input
                  type="text"
                  value={editingNote.title}
                  onChange={e => setEditingNote({ ...editingNote, title: e.target.value })}
                  placeholder="Enter note title"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Content *</label>
                <textarea
                  value={editingNote.content}
                  onChange={e => setEditingNote({ ...editingNote, content: e.target.value })}
                  placeholder="Write your note..."
                  rows={4}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Related To</label>
                  <input
                    type="text"
                    value={editingNote.relatedTo}
                    onChange={e => setEditingNote({ ...editingNote, relatedTo: e.target.value })}
                    placeholder="e.g. Tech Solutions"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Related Type</label>
                  <select
                    value={editingNote.relatedType}
                    onChange={e => setEditingNote({ ...editingNote, relatedType: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
                  >
                    <option value="lead">Lead</option>
                    <option value="deal">Deal</option>
                    <option value="contact">Contact</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setEditingNote(null)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
              >Cancel</button>
              <button
                onClick={handleEditNote}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
              >Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== PRODUCTS PAGE ====================
export function ProductsPage() {
  const { can } = usePermissions();
  const canCreate = can('crm', 'create');
  const canUpdate = can('crm', 'update');
  const canDelete = can('crm', 'delete');
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [activeMenu, setActiveMenu] = useState(null);
  const [formData, setFormData] = useState({ name: '', sku: '', category: 'Software', price: '', stock: '', description: '' });
  const [editingProduct, setEditingProduct] = useState(null);
  const [viewingProduct, setViewingProduct] = useState(null);
  const fileInputRef = useRef(null);

  const [products, setProducts] = useState([
    { id: 1, name: 'CRM Pro License', sku: 'CRM-PRO-001', category: 'Software', price: 24999, stock: 999, status: 'active', description: 'Full-featured CRM with analytics and automation' },
    { id: 2, name: 'VoIP Desk Phone', sku: 'HW-VOIP-010', category: 'Hardware', price: 8499, stock: 45, status: 'active', description: 'HD voice desk phone with 3-line support' },
    { id: 3, name: 'Onboarding Package', sku: 'SVC-ONB-005', category: 'Service', price: 15000, stock: 50, status: 'active', description: 'Dedicated onboarding with data migration and training' },
    { id: 4, name: 'Marketing Automation Add-on', sku: 'CRM-MKT-002', category: 'Software', price: 9999, stock: 999, status: 'active', description: 'Email campaigns, A/B testing, and workflow builder' },
    { id: 5, name: 'IP Conference Speaker', sku: 'HW-CONF-011', category: 'Hardware', price: 12999, stock: 0, status: 'inactive', description: '360-degree conference speaker with noise cancellation' },
    { id: 6, name: 'Annual Support Plan', sku: 'SVC-SUP-003', category: 'Service', price: 35000, stock: 100, status: 'active', description: 'Priority support, quarterly reviews, and SLA guarantees' },
  ]);

  const filteredProducts = useMemo(() => {
    let result = [...products];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));
    }
    if (categoryFilter !== 'All') {
      result = result.filter(p => p.category === categoryFilter);
    }
    return result;
  }, [products, searchQuery, categoryFilter]);

  const stats = useMemo(() => ({
    total: products.length,
    active: products.filter(p => p.status === 'active').length,
    outOfStock: products.filter(p => p.stock === 0).length,
    revenue: products.reduce((sum, p) => sum + (p.price * Math.min(p.stock, 10)), 0),
  }), [products]);

  const formatPrice = (amount) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
  };

  const handleAddProduct = () => {
    if (!formData.name || !formData.sku) {
      toast.error('Product name and SKU are required');
      return;
    }
    const newProduct = {
      id: Math.max(...products.map(p => p.id)) + 1,
      name: formData.name,
      sku: formData.sku,
      category: formData.category,
      price: parseInt(formData.price) || 0,
      stock: parseInt(formData.stock) || 0,
      status: 'active',
      description: formData.description || '-',
    };
    setProducts(prev => [newProduct, ...prev]);
    toast.success(`Product "${formData.name}" added`);
    setFormData({ name: '', sku: '', category: 'Software', price: '', stock: '', description: '' });
    setShowAddModal(false);
  };

  const handleDeleteProduct = (product) => {
    setActiveMenu(null);
    setProducts(prev => prev.filter(p => p.id !== product.id));
    toast((t) => (
      <div className="flex items-center gap-3">
        <span>Product deleted</span>
        <button onClick={() => { setProducts(prev => [...prev, product].sort((a, b) => a.id - b.id)); toast.dismiss(t.id); toast.success('Restored'); }} className="px-2 py-1 bg-indigo-600 text-white text-xs rounded font-medium hover:bg-indigo-700">Undo</button>
      </div>
    ), { duration: 5000 });
  };

  const handleEditProduct = () => {
    if (!editingProduct.name || !editingProduct.sku) {
      toast.error('Product name and SKU are required');
      return;
    }
    setProducts(prev => prev.map(p => p.id === editingProduct.id ? { ...editingProduct, price: parseInt(editingProduct.price) || 0, stock: parseInt(editingProduct.stock) || 0 } : p));
    toast.success(`Product "${editingProduct.name}" updated`);
    setEditingProduct(null);
  };

  const handleToggleStatus = (product) => {
    setActiveMenu(null);
    const newStatus = product.status === 'active' ? 'inactive' : 'active';
    setProducts(prev => prev.map(p => p.id === product.id ? { ...p, status: newStatus } : p));
    toast.success(`"${product.name}" set to ${newStatus}`);
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
            const skuIdx = headers.findIndex(h => h.includes('sku'));
            if (nameIdx === -1) { toast.error('CSV must have a "Name" column'); return; }
            const categoryIdx = headers.findIndex(h => h.includes('category'));
            const priceIdx = headers.findIndex(h => h.includes('price'));
            const stockIdx = headers.findIndex(h => h.includes('stock'));
            let imported = 0;
            const maxId = Math.max(0, ...products.map(p => p.id));
            const newItems = [];
            for (let i = 1; i < lines.length; i++) {
              const cols = lines[i].split(',').map(c => c.trim().replace(/"/g, ''));
              if (!cols[nameIdx]) continue;
              newItems.push({ id: maxId + i, name: cols[nameIdx], sku: skuIdx >= 0 ? cols[skuIdx] : `SKU-${maxId + i}`, category: categoryIdx >= 0 ? cols[categoryIdx] : 'Software', price: priceIdx >= 0 ? parseInt(cols[priceIdx]) || 0 : 0, stock: stockIdx >= 0 ? parseInt(cols[stockIdx]) || 0 : 0, status: 'active', description: '-' });
              imported++;
            }
            setProducts(prev => [...newItems, ...prev]);
            toast.success(`Imported ${imported} products from CSV`);
          } catch { toast.error('Failed to parse CSV'); }
        };
        reader.readAsText(file);
        e.target.value = '';
      }} />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Products</h1>
          <p className="text-sm text-slate-500">Manage your product catalog</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300">
            <Upload className="w-4 h-4" /> Import
          </button>
          <button
            onClick={() => {
              const headers = ['Name','SKU','Category','Price','Stock','Status','Description'];
              const rows = filteredProducts.map(p => [p.name, p.sku, p.category, p.price, p.stock, p.status, p.description]);
              const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a'); a.href = url; a.download = `products_${new Date().toISOString().split('T')[0]}.csv`; a.click();
              URL.revokeObjectURL(url);
              toast.success(`Exported ${filteredProducts.length} products as CSV`);
            }}
            className="flex items-center gap-2 px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
          >
            <Download className="w-4 h-4" /> Export
          </button>
          {canCreate && (
          <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
            <Plus className="w-4 h-4" /> Add Product
          </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
          <p className="text-sm text-slate-500">Total Products</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{stats.total}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
          <p className="text-sm text-slate-500">Active</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{stats.active}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
          <p className="text-sm text-slate-500">Out of Stock</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{stats.outOfStock}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
          <p className="text-sm text-slate-500">Revenue (est.)</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{formatPrice(stats.revenue)}</p>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search products..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
        >
          <option>All</option>
          <option>Software</option>
          <option>Hardware</option>
          <option>Service</option>
        </select>
      </div>

      {/* Products Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 dark:bg-slate-800/50">
            <tr>
              <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">Product</th>
              <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">SKU</th>
              <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">Category</th>
              <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">Price</th>
              <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">Stock</th>
              <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
              <th className="py-3 px-4 text-center text-xs font-medium text-slate-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-500">No products found.</td>
              </tr>
            ) : (
              filteredProducts.map(product => (
                <tr key={product.id} className="border-t border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center">
                        <Package className="w-5 h-5 text-indigo-600" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-900 dark:text-white">{product.name}</p>
                        <p className="text-xs text-slate-500 truncate max-w-[200px]">{product.description}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-sm text-slate-600 dark:text-slate-400 font-mono">{product.sku}</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-1 rounded text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                      {product.category}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm font-medium text-slate-900 dark:text-white">{formatPrice(product.price)}</td>
                  <td className="py-3 px-4">
                    <span className={`text-sm font-medium ${product.stock === 0 ? 'text-red-600' : product.stock < 10 ? 'text-amber-600' : 'text-slate-600 dark:text-slate-400'}`}>
                      {product.stock}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${product.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {product.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 relative">
                    <div className="flex items-center justify-center">
                      <button
                        onClick={() => setActiveMenu(prev => prev === product.id ? null : product.id)}
                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                      >
                        <MoreVertical className="w-4 h-4 text-slate-400" />
                      </button>
                    </div>
                    {activeMenu === product.id && (
                      <div className="absolute right-4 top-12 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg z-20 w-44 py-1">
                        <button
                          onClick={() => { setActiveMenu(null); setViewingProduct(product); }}
                          className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"
                        ><Eye className="w-4 h-4" /> View</button>
                        {canUpdate && (
                        <button
                          onClick={() => { setActiveMenu(null); setEditingProduct({ ...product, price: String(product.price), stock: String(product.stock) }); }}
                          className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"
                        ><Edit className="w-4 h-4" /> Edit</button>
                        )}
                        {canUpdate && (
                        <button
                          onClick={() => handleToggleStatus(product)}
                          className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"
                        ><RotateCcw className="w-4 h-4" /> {product.status === 'active' ? 'Set Inactive' : 'Set Active'}</button>
                        )}
                        {canDelete && (
                        <button
                          onClick={() => handleDeleteProduct(product)}
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

      {/* Add Product Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowAddModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Add New Product</h2>
              <button onClick={() => setShowAddModal(false)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Product Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter product name"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">SKU *</label>
                  <input
                    type="text"
                    value={formData.sku}
                    onChange={e => setFormData({ ...formData, sku: e.target.value })}
                    placeholder="e.g. CRM-PRO-001"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Category</label>
                  <select
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
                  >
                    <option>Software</option>
                    <option>Hardware</option>
                    <option>Service</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Price (INR)</label>
                  <input
                    type="number"
                    value={formData.price}
                    onChange={e => setFormData({ ...formData, price: e.target.value })}
                    placeholder="e.g. 9999"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Stock</label>
                  <input
                    type="number"
                    value={formData.stock}
                    onChange={e => setFormData({ ...formData, stock: e.target.value })}
                    placeholder="e.g. 100"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Short description"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
              >Cancel</button>
              <button
                onClick={handleAddProduct}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
              >Save Product</button>
            </div>
          </div>
        </div>
      )}

      {/* View Product Modal */}
      {viewingProduct && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setViewingProduct(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Product Details</h2>
              <button onClick={() => setViewingProduct(null)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-1">Product Name</label>
                <p className="text-sm text-slate-900 dark:text-white font-medium">{viewingProduct.name}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-1">SKU</label>
                  <p className="text-sm text-slate-900 dark:text-white font-mono">{viewingProduct.sku}</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-1">Category</label>
                  <span className="px-2 py-1 rounded text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">{viewingProduct.category}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-1">Price</label>
                  <p className="text-sm text-slate-900 dark:text-white font-medium">{formatPrice(viewingProduct.price)}</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-1">Stock</label>
                  <p className={`text-sm font-medium ${viewingProduct.stock === 0 ? 'text-red-600' : 'text-slate-900 dark:text-white'}`}>{viewingProduct.stock}</p>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-1">Description</label>
                <p className="text-sm text-slate-700 dark:text-slate-300">{viewingProduct.description}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-1">Status</label>
                <span className={`px-2 py-1 rounded text-xs font-medium ${viewingProduct.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{viewingProduct.status}</span>
              </div>
            </div>
            <div className="flex justify-end mt-6">
              <button
                onClick={() => setViewingProduct(null)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
              >Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Product Modal */}
      {editingProduct && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setEditingProduct(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Edit Product</h2>
              <button onClick={() => setEditingProduct(null)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Product Name *</label>
                <input
                  type="text"
                  value={editingProduct.name}
                  onChange={e => setEditingProduct({ ...editingProduct, name: e.target.value })}
                  placeholder="Enter product name"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">SKU *</label>
                  <input
                    type="text"
                    value={editingProduct.sku}
                    onChange={e => setEditingProduct({ ...editingProduct, sku: e.target.value })}
                    placeholder="e.g. CRM-PRO-001"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Category</label>
                  <select
                    value={editingProduct.category}
                    onChange={e => setEditingProduct({ ...editingProduct, category: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
                  >
                    <option>Software</option>
                    <option>Hardware</option>
                    <option>Service</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Price (INR)</label>
                  <input
                    type="number"
                    value={editingProduct.price}
                    onChange={e => setEditingProduct({ ...editingProduct, price: e.target.value })}
                    placeholder="e.g. 9999"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Stock</label>
                  <input
                    type="number"
                    value={editingProduct.stock}
                    onChange={e => setEditingProduct({ ...editingProduct, stock: e.target.value })}
                    placeholder="e.g. 100"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description</label>
                <input
                  type="text"
                  value={editingProduct.description}
                  onChange={e => setEditingProduct({ ...editingProduct, description: e.target.value })}
                  placeholder="Short description"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Status</label>
                <select
                  value={editingProduct.status}
                  onChange={e => setEditingProduct({ ...editingProduct, status: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setEditingProduct(null)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
              >Cancel</button>
              <button
                onClick={handleEditProduct}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
              >Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== VENDORS PAGE ====================
export function VendorsPage() {
  const { can } = usePermissions();
  const canCreate = can('crm', 'create');
  const canUpdate = can('crm', 'update');
  const canDelete = can('crm', 'delete');
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [formData, setFormData] = useState({ name: '', company: '', email: '', phone: '', category: 'Software' });
  const [editingVendor, setEditingVendor] = useState(null);
  const [viewingVendor, setViewingVendor] = useState(null);
  const [activeMenu, setActiveMenu] = useState(null);
  const fileInputRef = useRef(null);

  const [vendors, setVendors] = useState([
    { id: 1, name: 'Suresh Menon', company: 'CloudServe India', email: 'suresh@cloudserve.in', phone: '+91 98765 11111', category: 'Software', rating: 5, activeDeals: 3, totalPurchases: 450000, status: 'active' },
    { id: 2, name: 'Deepa Nair', company: 'NetGear Solutions', email: 'deepa@netgear.co.in', phone: '+91 87654 22222', category: 'Hardware', rating: 4, activeDeals: 2, totalPurchases: 320000, status: 'active' },
    { id: 3, name: 'Amit Joshi', company: 'QuickShip Logistics', email: 'amit@quickship.com', phone: '+91 76543 33333', category: 'Logistics', rating: 4, activeDeals: 1, totalPurchases: 180000, status: 'active' },
    { id: 4, name: 'Lakshmi Rao', company: 'TechSupport Pro', email: 'lakshmi@techsupport.in', phone: '+91 65432 44444', category: 'Services', rating: 3, activeDeals: 0, totalPurchases: 95000, status: 'inactive' },
    { id: 5, name: 'Farhan Sheikh', company: 'DataSafe Systems', email: 'farhan@datasafe.com', phone: '+91 54321 55555', category: 'Software', rating: 5, activeDeals: 4, totalPurchases: 720000, status: 'active' },
  ]);

  const filteredVendors = useMemo(() => {
    let result = [...vendors];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(v => v.name.toLowerCase().includes(q) || v.company.toLowerCase().includes(q) || v.email.toLowerCase().includes(q));
    }
    if (categoryFilter !== 'All') {
      result = result.filter(v => v.category === categoryFilter);
    }
    return result;
  }, [vendors, searchQuery, categoryFilter]);

  const stats = useMemo(() => ({
    total: vendors.length,
    active: vendors.filter(v => v.status === 'active').length,
    totalPurchases: vendors.reduce((sum, v) => sum + v.totalPurchases, 0),
    avgRating: (vendors.reduce((sum, v) => sum + v.rating, 0) / vendors.length).toFixed(1),
  }), [vendors]);

  const formatPrice = (amount) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
  };

  const renderStars = (rating) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star key={i} className={`w-4 h-4 ${i < rating ? 'text-amber-400 fill-amber-400' : 'text-slate-300'}`} />
    ));
  };

  const handleAddVendor = () => {
    if (!formData.name || !formData.company) {
      toast.error('Vendor name and company are required');
      return;
    }
    const newVendor = {
      id: Math.max(...vendors.map(v => v.id)) + 1,
      name: formData.name,
      company: formData.company,
      email: formData.email || '-',
      phone: formData.phone || '-',
      category: formData.category,
      rating: 0,
      activeDeals: 0,
      totalPurchases: 0,
      status: 'active',
    };
    setVendors(prev => [newVendor, ...prev]);
    toast.success(`Vendor "${formData.name}" added`);
    setFormData({ name: '', company: '', email: '', phone: '', category: 'Software' });
    setShowAddModal(false);
  };

  const handleDeleteVendor = (vendor) => {
    setActiveMenu(null);
    setVendors(prev => prev.filter(v => v.id !== vendor.id));
    toast((t) => (
      <div className="flex items-center gap-3">
        <span>Vendor deleted</span>
        <button onClick={() => { setVendors(prev => [...prev, vendor].sort((a, b) => a.id - b.id)); toast.dismiss(t.id); toast.success('Restored'); }} className="px-2 py-1 bg-indigo-600 text-white text-xs rounded font-medium hover:bg-indigo-700">Undo</button>
      </div>
    ), { duration: 5000 });
  };

  const handleEditVendor = () => {
    if (!editingVendor.name || !editingVendor.company) {
      toast.error('Vendor name and company are required');
      return;
    }
    setVendors(prev => prev.map(v => v.id === editingVendor.id ? { ...v, name: editingVendor.name, company: editingVendor.company, email: editingVendor.email, phone: editingVendor.phone, category: editingVendor.category } : v));
    toast.success(`Vendor "${editingVendor.name}" updated`);
    setEditingVendor(null);
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
            const companyIdx = headers.findIndex(h => h.includes('company'));
            const emailIdx = headers.findIndex(h => h.includes('email'));
            const phoneIdx = headers.findIndex(h => h.includes('phone'));
            const categoryIdx = headers.findIndex(h => h.includes('category'));
            let imported = 0;
            const maxId = Math.max(0, ...vendors.map(v => v.id));
            const newItems = [];
            for (let i = 1; i < lines.length; i++) {
              const cols = lines[i].split(',').map(c => c.trim().replace(/"/g, ''));
              if (!cols[nameIdx]) continue;
              newItems.push({ id: maxId + i, name: cols[nameIdx], company: companyIdx >= 0 ? cols[companyIdx] : '-', email: emailIdx >= 0 ? cols[emailIdx] : '-', phone: phoneIdx >= 0 ? cols[phoneIdx] : '-', category: categoryIdx >= 0 ? cols[categoryIdx] : 'Software', rating: 0, activeDeals: 0, totalPurchases: 0, status: 'active' });
              imported++;
            }
            setVendors(prev => [...newItems, ...prev]);
            toast.success(`Imported ${imported} vendors from CSV`);
          } catch { toast.error('Failed to parse CSV'); }
        };
        reader.readAsText(file);
        e.target.value = '';
      }} />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Vendors</h1>
          <p className="text-sm text-slate-500">Manage your vendor relationships</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300">
            <Upload className="w-4 h-4" /> Import
          </button>
          <button
            onClick={() => {
              const headers = ['Name','Company','Email','Phone','Category','Rating','Active Deals','Total Purchases','Status'];
              const rows = filteredVendors.map(v => [v.name, v.company, v.email, v.phone, v.category, v.rating, v.activeDeals, v.totalPurchases, v.status]);
              const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a'); a.href = url; a.download = `vendors_${new Date().toISOString().split('T')[0]}.csv`; a.click();
              URL.revokeObjectURL(url);
              toast.success(`Exported ${filteredVendors.length} vendors as CSV`);
            }}
            className="flex items-center gap-2 px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
          >
            <Download className="w-4 h-4" /> Export
          </button>
          {canCreate && (
          <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
            <Plus className="w-4 h-4" /> Add Vendor
          </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
          <p className="text-sm text-slate-500">Total Vendors</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{stats.total}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
          <p className="text-sm text-slate-500">Active</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{stats.active}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
          <p className="text-sm text-slate-500">Total Purchases</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{formatPrice(stats.totalPurchases)}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
          <p className="text-sm text-slate-500">Avg Rating</p>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.avgRating}</p>
            <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
          </div>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search vendors..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
        >
          <option>All</option>
          <option>Software</option>
          <option>Hardware</option>
          <option>Services</option>
          <option>Logistics</option>
        </select>
      </div>

      {/* Vendors Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 dark:bg-slate-800/50">
            <tr>
              <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">Vendor</th>
              <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">Category</th>
              <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">Rating</th>
              <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">Active Deals</th>
              <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">Total Purchases</th>
              <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
              <th className="py-3 px-4 text-center text-xs font-medium text-slate-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredVendors.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-500">No vendors found.</td>
              </tr>
            ) : (
              filteredVendors.map(vendor => (
                <tr key={vendor.id} className="border-t border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center text-white font-medium">
                        {vendor.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900 dark:text-white">{vendor.name}</p>
                        <p className="text-xs text-slate-500">{vendor.company}</p>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-xs text-slate-400 flex items-center gap-1"><Mail className="w-3 h-3" />{vendor.email}</span>
                          <span className="text-xs text-slate-400 flex items-center gap-1"><Phone className="w-3 h-3" />{vendor.phone}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-1 rounded text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                      {vendor.category}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-0.5">
                      {renderStars(vendor.rating)}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-sm text-slate-600 dark:text-slate-400">{vendor.activeDeals}</td>
                  <td className="py-3 px-4 text-sm font-medium text-slate-900 dark:text-white">{formatPrice(vendor.totalPurchases)}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${vendor.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {vendor.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 relative">
                    <div className="flex items-center justify-center">
                      <button
                        onClick={() => setActiveMenu(prev => prev === vendor.id ? null : vendor.id)}
                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                      >
                        <MoreVertical className="w-4 h-4 text-slate-400" />
                      </button>
                    </div>
                    {activeMenu === vendor.id && (
                      <div className="absolute right-4 top-12 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg z-20 w-44 py-1">
                        <button
                          onClick={() => { setActiveMenu(null); setViewingVendor(vendor); }}
                          className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"
                        ><Eye className="w-4 h-4" /> View</button>
                        {canUpdate && (
                        <button
                          onClick={() => { setActiveMenu(null); setEditingVendor({ ...vendor }); }}
                          className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"
                        ><Edit className="w-4 h-4" /> Edit</button>
                        )}
                        <button
                          onClick={() => { setActiveMenu(null); window.open('tel:' + vendor.phone.replace(/\s/g, '')); }}
                          className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"
                        ><Phone className="w-4 h-4" /> Call</button>
                        <button
                          onClick={() => { setActiveMenu(null); window.open('mailto:' + vendor.email); }}
                          className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"
                        ><Mail className="w-4 h-4" /> Email</button>
                        {canDelete && (
                        <button
                          onClick={() => handleDeleteVendor(vendor)}
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

      {/* Add Vendor Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowAddModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Add New Vendor</h2>
              <button onClick={() => setShowAddModal(false)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Vendor Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter vendor name"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Company *</label>
                <input
                  type="text"
                  value={formData.company}
                  onChange={e => setFormData({ ...formData, company: e.target.value })}
                  placeholder="Enter company name"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    placeholder="vendor@email.com"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+91 XXXXX XXXXX"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Category</label>
                <select
                  value={formData.category}
                  onChange={e => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
                >
                  <option>Software</option>
                  <option>Hardware</option>
                  <option>Services</option>
                  <option>Logistics</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
              >Cancel</button>
              <button
                onClick={handleAddVendor}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
              >Save Vendor</button>
            </div>
          </div>
        </div>
      )}

      {/* View Vendor Modal */}
      {viewingVendor && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setViewingVendor(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Vendor Details</h2>
              <button onClick={() => setViewingVendor(null)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-4 mb-2">
                <div className="w-14 h-14 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center text-white text-xl font-bold">
                  {viewingVendor.name.charAt(0)}
                </div>
                <div>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">{viewingVendor.name}</p>
                  <p className="text-sm text-slate-500">{viewingVendor.company}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-1">Email</label>
                  <p className="text-sm text-slate-900 dark:text-white">{viewingVendor.email}</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-1">Phone</label>
                  <p className="text-sm text-slate-900 dark:text-white">{viewingVendor.phone}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-1">Category</label>
                  <span className="px-2 py-1 rounded text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">{viewingVendor.category}</span>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-1">Rating</label>
                  <div className="flex items-center gap-0.5">
                    {renderStars(viewingVendor.rating)}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-1">Active Deals</label>
                  <p className="text-sm text-slate-900 dark:text-white font-medium">{viewingVendor.activeDeals}</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-1">Total Purchases</label>
                  <p className="text-sm text-slate-900 dark:text-white font-medium">{formatPrice(viewingVendor.totalPurchases)}</p>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-1">Status</label>
                <span className={`px-2 py-1 rounded text-xs font-medium ${viewingVendor.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{viewingVendor.status}</span>
              </div>
            </div>
            <div className="flex justify-end mt-6">
              <button
                onClick={() => setViewingVendor(null)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
              >Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Vendor Modal */}
      {editingVendor && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setEditingVendor(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Edit Vendor</h2>
              <button onClick={() => setEditingVendor(null)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Vendor Name *</label>
                <input
                  type="text"
                  value={editingVendor.name}
                  onChange={e => setEditingVendor({ ...editingVendor, name: e.target.value })}
                  placeholder="Enter vendor name"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Company *</label>
                <input
                  type="text"
                  value={editingVendor.company}
                  onChange={e => setEditingVendor({ ...editingVendor, company: e.target.value })}
                  placeholder="Enter company name"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
                  <input
                    type="email"
                    value={editingVendor.email}
                    onChange={e => setEditingVendor({ ...editingVendor, email: e.target.value })}
                    placeholder="vendor@email.com"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={editingVendor.phone}
                    onChange={e => setEditingVendor({ ...editingVendor, phone: e.target.value })}
                    placeholder="+91 XXXXX XXXXX"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Category</label>
                <select
                  value={editingVendor.category}
                  onChange={e => setEditingVendor({ ...editingVendor, category: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
                >
                  <option>Software</option>
                  <option>Hardware</option>
                  <option>Services</option>
                  <option>Logistics</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setEditingVendor(null)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
              >Cancel</button>
              <button
                onClick={handleEditVendor}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
              >Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
