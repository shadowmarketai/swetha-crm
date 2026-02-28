/**
 * Remaining Modules - Appointments, Automation, Inbox, Surveys, Helpdesk, Reports
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Calendar, Clock, Users, Video, Phone, MapPin, Plus, ChevronLeft, ChevronRight,
  Check, X, MoreVertical, Zap, Play, Pause, CheckCircle, XCircle, AlertTriangle,
  ArrowRight, Mail, MessageSquare, Search, Filter, Star, Archive, Trash2,
  Send, Paperclip, Smile, FileText, ClipboardList, Headphones, BarChart3,
  TrendingUp, TrendingDown, Download, RefreshCw, Settings, Bot, Edit
} from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { usePermissions } from '../../hooks/usePermissions';

// ==================== APPOINTMENTS DASHBOARD ====================
export function AppointmentsDashboard() {
  const { can } = usePermissions();
  const canCreate = can('voiceAI', 'create');

  const [showModal, setShowModal] = useState(false);
  const [bookingForm, setBookingForm] = useState({ title: '', client: '', type: 'video', time: '' });

  const appointments = [
    { id: 1, title: 'Product Demo', client: 'Rajesh Kumar', type: 'video', time: '10:00 AM', date: 'Today', duration: '30 min', status: 'confirmed', bookedBy: 'Sales Bot' },
    { id: 2, title: 'Follow-up Call', client: 'Priya Sharma', type: 'call', time: '11:30 AM', date: 'Today', duration: '15 min', status: 'pending', bookedBy: 'Voice AI' },
    { id: 3, title: 'Strategy Meeting', client: 'Tech Solutions', type: 'video', time: '2:00 PM', date: 'Today', duration: '1 hour', status: 'confirmed', bookedBy: 'Manual' },
    { id: 4, title: 'Site Visit', client: 'Vikram Patel', type: 'in-person', time: '4:30 PM', date: 'Today', duration: '2 hours', status: 'confirmed', bookedBy: 'Sales Bot' },
  ];

  const typeIcons = { call: Phone, video: Video, 'in-person': MapPin };

  const handleCreateBooking = () => {
    if (!bookingForm.title.trim()) {
      toast.error('Title is required');
      return;
    }
    if (!bookingForm.client.trim()) {
      toast.error('Client name is required');
      return;
    }
    toast.success(`Booking "${bookingForm.title}" with ${bookingForm.client} created`);
    setBookingForm({ title: '', client: '', type: 'video', time: '' });
    setShowModal(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Appointments</h1>
          <p className="text-sm text-slate-500">Manage bookings from Voice AI and manual scheduling</p>
        </div>
        {canCreate && (
        <button onClick={() => setShowModal(true)} className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
          <Plus className="w-4 h-4" /> New Booking
        </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Today's Meetings", value: '8', icon: Calendar, color: 'bg-indigo-100 text-indigo-600' },
          { label: 'This Week', value: '34', icon: Clock, color: 'bg-emerald-100 text-emerald-600' },
          { label: 'Booked by AI', value: '156', icon: Bot, color: 'bg-purple-100 text-purple-600' },
          { label: 'Show Rate', value: '87%', icon: CheckCircle, color: 'bg-amber-100 text-amber-600' },
        ].map((stat, i) => (
          <div key={i} className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${stat.color}`}><stat.icon className="w-5 h-5" /></div>
              <div>
                <p className="text-xl font-bold text-slate-900 dark:text-white">{stat.value}</p>
                <p className="text-xs text-slate-500">{stat.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Appointments List */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700">
          <h3 className="font-semibold text-slate-900 dark:text-white">Today's Schedule</h3>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-700">
          {appointments.map(apt => {
            const TypeIcon = typeIcons[apt.type];
            return (
              <div key={apt.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 shrink-0 rounded-xl flex items-center justify-center ${
                      apt.type === 'video' ? 'bg-blue-100 text-blue-600' :
                      apt.type === 'call' ? 'bg-emerald-100 text-emerald-600' :
                      'bg-purple-100 text-purple-600'
                    }`}>
                      <TypeIcon className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-medium text-slate-900 dark:text-white">{apt.title}</h4>
                      <p className="text-sm text-slate-500">{apt.client}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 ml-16 sm:ml-0">
                    <div className="text-right">
                      <p className="font-medium text-slate-900 dark:text-white">{apt.time}</p>
                      <p className="text-sm text-slate-500">{apt.duration}</p>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${
                      apt.status === 'confirmed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    }`}>{apt.status}</span>
                    <button onClick={() => toast.success(`Options for "${apt.title}" with ${apt.client}`)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                      <MoreVertical className="w-4 h-4 text-slate-400" />
                    </button>
                  </div>
                </div>
                <div className="mt-2 ml-16">
                  <span className="text-xs text-slate-400">Booked by: <span className="text-indigo-600">{apt.bookedBy}</span></span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* New Booking Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">New Booking</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Title</label>
                <input type="text" value={bookingForm.title} onChange={e => setBookingForm({ ...bookingForm, title: e.target.value })} placeholder="e.g. Product Demo" className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Client</label>
                <input type="text" value={bookingForm.client} onChange={e => setBookingForm({ ...bookingForm, client: e.target.value })} placeholder="e.g. Rajesh Kumar" className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Type</label>
                <select value={bookingForm.type} onChange={e => setBookingForm({ ...bookingForm, type: e.target.value })} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white rounded-lg text-sm">
                  <option value="video">Video Call</option>
                  <option value="call">Phone Call</option>
                  <option value="in-person">In-Person</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Time</label>
                <input type="time" value={bookingForm.time} onChange={e => setBookingForm({ ...bookingForm, time: e.target.value })} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white rounded-lg text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-300">Cancel</button>
              <button onClick={handleCreateBooking} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== AUTOMATION DASHBOARD ====================
export function AutomationDashboard() {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const canCreate = can('campaigns', 'create');
  const canUpdate = can('campaigns', 'update');

  const [showModal, setShowModal] = useState(false);
  const [workflowForm, setWorkflowForm] = useState({ name: '', trigger: 'new-lead', action: 'voice-call' });
  const [workflows, setWorkflows] = useState([
    { id: 1, name: 'New Lead → Voice AI Call', description: 'Auto-call new leads within 5 minutes', status: 'active', executions: '2,847', success: 94 },
    { id: 2, name: 'Meeting Booked → Confirmation', description: 'Send WhatsApp + Email after booking', status: 'active', executions: '892', success: 99 },
    { id: 3, name: 'Deal Won → Onboarding', description: 'Trigger onboarding workflow', status: 'paused', executions: '156', success: 87 },
  ]);

  const handleCreateWorkflow = () => {
    if (!workflowForm.name.trim()) {
      toast.error('Workflow name is required');
      return;
    }
    toast.success(`Workflow "${workflowForm.name}" created`);
    setWorkflowForm({ name: '', trigger: 'new-lead', action: 'voice-call' });
    setShowModal(false);
  };

  const toggleWorkflow = (id) => {
    setWorkflows(prev => prev.map(wf => {
      if (wf.id === id) {
        const newStatus = wf.status === 'active' ? 'paused' : 'active';
        toast.success(`"${wf.name}" ${newStatus === 'active' ? 'activated' : 'paused'}`);
        return { ...wf, status: newStatus };
      }
      return wf;
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Automation</h1>
          <p className="text-sm text-slate-500">Build workflows to automate your business</p>
        </div>
        {canCreate && (
        <button onClick={() => navigate('/automation/builder')} className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
          <Plus className="w-4 h-4" /> New Workflow
        </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Active Workflows', value: '12', icon: Zap, color: 'bg-indigo-100 text-indigo-600' },
          { label: 'Executions Today', value: '1,284', icon: Play, color: 'bg-emerald-100 text-emerald-600' },
          { label: 'Success Rate', value: '98.2%', icon: CheckCircle, color: 'bg-blue-100 text-blue-600' },
          { label: 'Failed Today', value: '23', icon: AlertTriangle, color: 'bg-red-100 text-red-600' },
        ].map((stat, i) => (
          <div key={i} className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${stat.color}`}><stat.icon className="w-5 h-5" /></div>
              <div>
                <p className="text-xl font-bold text-slate-900 dark:text-white">{stat.value}</p>
                <p className="text-xs text-slate-500">{stat.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Workflows */}
      <div className="space-y-4">
        {workflows.map(wf => (
          <div key={wf.id} className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 shrink-0 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                  <Zap className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white">{wf.name}</h3>
                  <p className="text-sm text-slate-500">{wf.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 flex-wrap">
                <div className="text-right">
                  <p className="font-medium text-slate-900 dark:text-white">{wf.executions}</p>
                  <p className="text-xs text-slate-500">executions</p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-emerald-600">{wf.success}%</p>
                  <p className="text-xs text-slate-500">success</p>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${
                  wf.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                }`}>{wf.status}</span>
                <div className="flex items-center gap-1">
                  {canUpdate && (
                  <button onClick={() => navigate(`/automation/builder/${wf.id}`)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"><Edit className="w-4 h-4 text-slate-400" /></button>
                  )}
                  {canUpdate && (wf.status === 'active' ? (
                    <button onClick={() => toggleWorkflow(wf.id)} className="p-2 hover:bg-amber-50 rounded-lg"><Pause className="w-4 h-4 text-amber-500" /></button>
                  ) : (
                    <button onClick={() => toggleWorkflow(wf.id)} className="p-2 hover:bg-emerald-50 rounded-lg"><Play className="w-4 h-4 text-emerald-500" /></button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* New Workflow Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">New Workflow</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Workflow Name</label>
                <input type="text" value={workflowForm.name} onChange={e => setWorkflowForm({ ...workflowForm, name: e.target.value })} placeholder="e.g. Lead Follow-up" className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Trigger</label>
                <select value={workflowForm.trigger} onChange={e => setWorkflowForm({ ...workflowForm, trigger: e.target.value })} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white rounded-lg text-sm">
                  <option value="new-lead">New Lead Created</option>
                  <option value="meeting-booked">Meeting Booked</option>
                  <option value="deal-won">Deal Won</option>
                  <option value="form-submitted">Form Submitted</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Action</label>
                <select value={workflowForm.action} onChange={e => setWorkflowForm({ ...workflowForm, action: e.target.value })} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white rounded-lg text-sm">
                  <option value="voice-call">Voice AI Call</option>
                  <option value="whatsapp">Send WhatsApp</option>
                  <option value="email">Send Email</option>
                  <option value="sms">Send SMS</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-300">Cancel</button>
              <button onClick={handleCreateWorkflow} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== INBOX DASHBOARD ====================
export function InboxDashboard() {
  const [activeConversation, setActiveConversation] = useState(0);
  const [messageText, setMessageText] = useState('');

  const conversations = [
    { name: 'Rajesh Kumar', channel: 'whatsapp', lastMessage: 'Thanks for the demo!', time: '2m', unread: 2 },
    { name: 'Priya Sharma', channel: 'whatsapp', lastMessage: 'Can you send pricing?', time: '15m', unread: 1 },
    { name: 'Tech Solutions', channel: 'email', lastMessage: 'RE: Proposal', time: '1h', unread: 0 },
    { name: 'Vikram Patel', channel: 'sms', lastMessage: 'Meeting confirmed', time: '2h', unread: 0 },
  ];

  const messages = [
    { text: 'Hi! I saw your Voice AI demo. Very impressive!', time: '10:30 AM', isOwn: false },
    { text: 'Thank you! Would you like a personalized demo?', time: '10:32 AM', isOwn: true },
    { text: 'Yes, that would be great!', time: '10:35 AM', isOwn: false },
    { text: 'Thanks for the demo!', time: '11:45 AM', isOwn: false },
  ];

  const handleSendMessage = () => {
    if (!messageText.trim()) {
      toast.error('Please type a message');
      return;
    }
    toast.success('Message sent');
    setMessageText('');
  };

  return (
    <div className="h-[calc(100vh-180px)] flex flex-col md:flex-row bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      {/* Conversation List */}
      <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-700 max-h-[35vh] md:max-h-none overflow-y-auto">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" placeholder="Search..." className="w-full pl-10 pr-4 py-2 bg-slate-100 dark:bg-slate-700 rounded-lg text-sm dark:text-white" />
          </div>
        </div>
        <div className="overflow-y-auto">
          {conversations.map((conv, i) => (
            <div
              key={i}
              onClick={() => setActiveConversation(i)}
              className={`p-4 border-b border-slate-100 dark:border-slate-700 cursor-pointer ${activeConversation === i ? 'bg-indigo-50 dark:bg-indigo-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center text-white font-medium">
                  {conv.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-slate-900 dark:text-white truncate">{conv.name}</p>
                    <span className="text-xs text-slate-400">{conv.time}</span>
                  </div>
                  <p className="text-sm text-slate-500 truncate">{conv.lastMessage}</p>
                </div>
                {conv.unread > 0 && (
                  <span className="w-5 h-5 bg-indigo-600 text-white text-xs rounded-full flex items-center justify-center">{conv.unread}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full flex items-center justify-center text-white font-medium">
              {conversations[activeConversation]?.name.charAt(0) || 'R'}
            </div>
            <div>
              <p className="font-medium text-slate-900 dark:text-white">{conversations[activeConversation]?.name || 'Rajesh Kumar'}</p>
              <p className="text-xs text-slate-500">Online - {conversations[activeConversation]?.channel || 'WhatsApp'}</p>
            </div>
          </div>
          <button onClick={() => toast.success(`Options for ${conversations[activeConversation]?.name}`)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"><MoreVertical className="w-5 h-5 text-slate-400" /></button>
        </div>

        <div className="flex-1 p-6 overflow-y-auto bg-slate-50 dark:bg-slate-900/50">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.isOwn ? 'justify-end' : 'justify-start'} mb-3`}>
              <div className={`max-w-[70%] px-4 py-2 rounded-2xl ${msg.isOwn ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white'}`}>
                <p className="text-sm">{msg.text}</p>
                <p className={`text-xs mt-1 ${msg.isOwn ? 'text-indigo-200' : 'text-slate-400'}`}>{msg.time}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <button onClick={() => toast('Attach files coming soon', { icon: 'i' })} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"><Paperclip className="w-5 h-5 text-slate-500" /></button>
            <input
              type="text"
              value={messageText}
              onChange={e => setMessageText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSendMessage(); }}
              placeholder="Type a message..."
              className="flex-1 px-4 py-2 bg-slate-100 dark:bg-slate-700 rounded-lg text-sm dark:text-white"
            />
            <button onClick={() => toast('Emoji picker coming soon', { icon: 'i' })} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"><Smile className="w-5 h-5 text-slate-500" /></button>
            <button onClick={handleSendMessage} className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"><Send className="w-5 h-5" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== SURVEYS DASHBOARD ====================
export function SurveysDashboard() {
  const { can } = usePermissions();
  const canCreate = can('surveys', 'create');
  const canUpdate = can('surveys', 'update');

  const [showModal, setShowModal] = useState(false);
  const [surveyForm, setSurveyForm] = useState({ name: '', type: 'satisfaction' });

  const surveys = [
    { id: 1, name: 'Customer Satisfaction', responses: 456, completion: 78, avgScore: 4.2, status: 'active' },
    { id: 2, name: 'Product Feedback', responses: 234, completion: 65, avgScore: 3.8, status: 'active' },
    { id: 3, name: 'Post-Call Survey', responses: 892, completion: 92, avgScore: 4.5, status: 'active' },
  ];

  const handleCreateSurvey = () => {
    if (!surveyForm.name.trim()) {
      toast.error('Survey name is required');
      return;
    }
    toast.success(`Survey "${surveyForm.name}" created`);
    setSurveyForm({ name: '', type: 'satisfaction' });
    setShowModal(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Surveys</h1>
          <p className="text-sm text-slate-500">Collect customer feedback</p>
        </div>
        {canCreate && (
        <button onClick={() => setShowModal(true)} className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
          <Plus className="w-4 h-4" /> Create Survey
        </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {surveys.map(survey => (
          <div key={survey.id} className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                  <ClipboardList className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white">{survey.name}</h3>
                  <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">{survey.status}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-2">
                <p className="text-lg font-bold text-slate-900 dark:text-white">{survey.responses}</p>
                <p className="text-xs text-slate-500">Responses</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-2">
                <p className="text-lg font-bold text-emerald-600">{survey.completion}%</p>
                <p className="text-xs text-slate-500">Completion</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-2">
                <p className="text-lg font-bold text-amber-600">{survey.avgScore}</p>
                <p className="text-xs text-slate-500">Avg Score</p>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <button onClick={() => toast.success(`Viewing results for "${survey.name}" - ${survey.responses} responses`)} className="flex-1 px-3 py-2 bg-indigo-100 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-200">View Results</button>
              {canUpdate && (
              <button onClick={() => toast.success(`Editing "${survey.name}"`)} className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700"><Edit className="w-4 h-4 text-slate-500" /></button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Create Survey Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Create Survey</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Survey Name</label>
                <input type="text" value={surveyForm.name} onChange={e => setSurveyForm({ ...surveyForm, name: e.target.value })} placeholder="e.g. Customer Satisfaction" className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Survey Type</label>
                <select value={surveyForm.type} onChange={e => setSurveyForm({ ...surveyForm, type: e.target.value })} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white rounded-lg text-sm">
                  <option value="satisfaction">Customer Satisfaction (CSAT)</option>
                  <option value="nps">Net Promoter Score (NPS)</option>
                  <option value="feedback">Product Feedback</option>
                  <option value="post-call">Post-Call Survey</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-300">Cancel</button>
              <button onClick={handleCreateSurvey} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== HELPDESK DASHBOARD ====================
export function HelpdeskDashboard() {
  const { can } = usePermissions();
  const canCreate = can('helpdesk', 'create');

  const [showModal, setShowModal] = useState(false);
  const [ticketForm, setTicketForm] = useState({ subject: '', customer: '', priority: 'medium' });

  const tickets = [
    { id: 'TKT-001', subject: 'Integration Issue', customer: 'Rajesh Kumar', priority: 'high', status: 'open', created: '2h ago' },
    { id: 'TKT-002', subject: 'Billing Query', customer: 'Priya Sharma', priority: 'medium', status: 'in-progress', created: '4h ago' },
    { id: 'TKT-003', subject: 'Feature Request', customer: 'Tech Solutions', priority: 'low', status: 'open', created: '1d ago' },
  ];

  const priorityColors = { high: 'bg-red-100 text-red-700', medium: 'bg-amber-100 text-amber-700', low: 'bg-slate-100 text-slate-600' };
  const statusColors = { open: 'bg-blue-100 text-blue-700', 'in-progress': 'bg-amber-100 text-amber-700', resolved: 'bg-emerald-100 text-emerald-700' };

  const handleCreateTicket = () => {
    if (!ticketForm.subject.trim()) {
      toast.error('Subject is required');
      return;
    }
    if (!ticketForm.customer.trim()) {
      toast.error('Customer name is required');
      return;
    }
    toast.success(`Ticket "${ticketForm.subject}" created`);
    setTicketForm({ subject: '', customer: '', priority: 'medium' });
    setShowModal(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Help Desk</h1>
          <p className="text-sm text-slate-500">Manage support tickets</p>
        </div>
        {canCreate && (
        <button onClick={() => setShowModal(true)} className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
          <Plus className="w-4 h-4" /> New Ticket
        </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Open Tickets', value: '23', icon: Headphones, color: 'bg-blue-100 text-blue-600' },
          { label: 'In Progress', value: '12', icon: Clock, color: 'bg-amber-100 text-amber-600' },
          { label: 'Resolved Today', value: '18', icon: CheckCircle, color: 'bg-emerald-100 text-emerald-600' },
          { label: 'Avg Response', value: '2.4h', icon: TrendingUp, color: 'bg-purple-100 text-purple-600' },
        ].map((stat, i) => (
          <div key={i} className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${stat.color}`}><stat.icon className="w-5 h-5" /></div>
              <div>
                <p className="text-xl font-bold text-slate-900 dark:text-white">{stat.value}</p>
                <p className="text-xs text-slate-500">{stat.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tickets Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-x-auto">
        <table className="w-full min-w-[700px]">
          <thead className="bg-slate-50 dark:bg-slate-800/50">
            <tr>
              <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">Ticket</th>
              <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">Customer</th>
              <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">Priority</th>
              <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
              <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">Created</th>
              <th className="py-3 px-4 text-center text-xs font-medium text-slate-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map(ticket => (
              <tr key={ticket.id} className="border-t border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <td className="py-3 px-4">
                  <p className="font-medium text-slate-900 dark:text-white">{ticket.id}</p>
                  <p className="text-sm text-slate-500">{ticket.subject}</p>
                </td>
                <td className="py-3 px-4 text-sm text-slate-600 dark:text-slate-400">{ticket.customer}</td>
                <td className="py-3 px-4">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${priorityColors[ticket.priority]}`}>{ticket.priority}</span>
                </td>
                <td className="py-3 px-4">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[ticket.status]}`}>{ticket.status}</span>
                </td>
                <td className="py-3 px-4 text-sm text-slate-500">{ticket.created}</td>
                <td className="py-3 px-4 text-center">
                  <button onClick={() => toast.success(`Opening ticket ${ticket.id}: ${ticket.subject}`)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"><MoreVertical className="w-4 h-4 text-slate-400" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* New Ticket Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">New Ticket</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Subject</label>
                <input type="text" value={ticketForm.subject} onChange={e => setTicketForm({ ...ticketForm, subject: e.target.value })} placeholder="e.g. Integration Issue" className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Customer</label>
                <input type="text" value={ticketForm.customer} onChange={e => setTicketForm({ ...ticketForm, customer: e.target.value })} placeholder="e.g. Rajesh Kumar" className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Priority</label>
                <select value={ticketForm.priority} onChange={e => setTicketForm({ ...ticketForm, priority: e.target.value })} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white rounded-lg text-sm">
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-300">Cancel</button>
              <button onClick={handleCreateTicket} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== REPORTS DASHBOARD ====================
export function ReportsDashboard() {
  const [period, setPeriod] = useState('30d');

  const revenueData = [
    { month: 'Sep', revenue: 1450000 }, { month: 'Oct', revenue: 1680000 },
    { month: 'Nov', revenue: 1920000 }, { month: 'Dec', revenue: 2080000 },
    { month: 'Jan', revenue: 2280000 }, { month: 'Feb', revenue: 2450000 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Reports & Analytics</h1>
          <p className="text-sm text-slate-500">Cross-platform business intelligence</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select value={period} onChange={e => { setPeriod(e.target.value); toast.success(`Period changed to ${e.target.value === '30d' ? 'Last 30 Days' : e.target.value === '90d' ? 'Last 90 Days' : 'This Year'}`); }} className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm dark:text-white">
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
            <option value="year">This Year</option>
          </select>
          <button onClick={() => toast.success('Report exported')} className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 flex-1 sm:flex-initial">
            <Download className="w-4 h-4" /> Export
          </button>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Revenue', value: '₹24.5L', change: '+18%', up: true },
          { label: 'New Leads', value: '2,847', change: '+12%', up: true },
          { label: 'AI Calls Made', value: '8,934', change: '+32%', up: true },
          { label: 'Conversion Rate', value: '24.8%', change: '+3.2%', up: true },
        ].map((metric, i) => (
          <div key={i} className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700">
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{metric.value}</p>
            <p className="text-sm text-slate-500">{metric.label}</p>
            <p className={`text-sm font-medium mt-2 ${metric.up ? 'text-emerald-600' : 'text-red-500'}`}>{metric.change}</p>
          </div>
        ))}
      </div>

      {/* Revenue Chart */}
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
    </div>
  );
}
