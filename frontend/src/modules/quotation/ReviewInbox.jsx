/**
 * Review Inbox — Pending client intakes + auto-calculated drafts.
 * Tenant users approve → triggers PDF + WhatsApp send.
 */
import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Inbox, Check, X, Eye, Send, Clock, IndianRupee, Sparkles, AlertTriangle, ArrowRight,
} from 'lucide-react';
import {
  Card, CardHeader, Stat, Button, PageHeader, Avatar, StatusBadge, EmptyState, Badge, Skeleton,
} from '../../components/ui/primitives';
import { quotationAPI, quotationTemplateAPI } from '../../services/api';

export default function ReviewInbox() {
  const navigate = useNavigate();
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await quotationAPI.getAll({ status: 'draft', page_size: 50 });
      const items = data?.items || data || [];
      // Only show intake-originated drafts (have intake_id)
      setQuotes(items.filter(q => q.intake_id || q.user_id === 'public-intake'));
    } catch {
      setQuotes([]);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const handleApprove = async (quote) => {
    setSending(quote.id);
    try {
      // 1. Generate portal token
      const tok = await quotationTemplateAPI.generateToken(quote.id, 30);
      // 2. Mark as sent (backend would handle WhatsApp send here in Task #10 wiring)
      await quotationAPI.changeStatus(quote.id, 'sent');
      const portalUrl = `${window.location.origin}/q/${tok.data.token}`;
      toast.success(
        `Quote #${quote.id} approved & sent! Portal: ${portalUrl}`,
        { duration: 6000 }
      );
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Send failed');
    } finally {
      setSending(null);
    }
  };

  const handleReject = async (quote) => {
    if (!confirm(`Reject quote #${quote.id}?`)) return;
    try {
      await quotationAPI.changeStatus(quote.id, 'rejected');
      toast.success('Rejected');
      load();
    } catch {
      toast.error('Reject failed');
    }
  };

  const stats = [
    { label: 'Awaiting Review', value: quotes.length, icon: Inbox, accent: '#6366f1', accentTo: '#8b5cf6' },
    { label: 'Auto-calculated', value: quotes.filter(q => q.boq_results).length, icon: Sparkles, accent: '#10b981', accentTo: '#06b6d4' },
    { label: 'With 3D Ready', value: quotes.filter(q => q.render_3d_url).length, icon: Eye, accent: '#f59e0b', accentTo: '#f43f5e' },
    { label: 'Today', value: quotes.filter(q => {
      const d = q.created_at ? new Date(q.created_at) : null;
      return d && d.toDateString() === new Date().toDateString();
    }).length, icon: Clock, accent: '#ec4899', accentTo: '#8b5cf6' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Review Inbox"
        subtitle="Client intakes awaiting your review and approval"
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, i) => <Stat key={i} {...s} />)}
      </div>

      <Card>
        <CardHeader
          title="Pending Intakes"
          subtitle={loading ? 'Loading…' : `${quotes.length} drafts from public intake`}
        />
        {loading ? (
          <div className="p-6 space-y-3">
            {[1,2,3].map(i => <Skeleton key={i} className="h-20" />)}
          </div>
        ) : quotes.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="Inbox is clear"
            description="When clients submit the public intake form, their auto-calculated draft quotes will appear here for your review."
          />
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {quotes.map(q => (
              <div key={q.id} className="px-6 py-4 flex items-start gap-4 hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                <Avatar name={q.client_name || 'Client'} size={44} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-900 dark:text-white">{q.client_name}</span>
                    <span className="text-xs text-slate-500 font-mono">Q-{q.id}</span>
                    <StatusBadge status={q.status} />
                    {q.negotiation_enabled && <Badge tone="warning">Negotiable to {q.max_discount_pct}%</Badge>}
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-400 mt-0.5 truncate">{q.project_name}</div>
                  <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                    <span className="flex items-center gap-1"><IndianRupee className="w-3 h-3" />{(q.total_amount || 0).toLocaleString('en-IN')}</span>
                    {q.client_phone && <span>📱 {q.client_phone}</span>}
                    {q.client_location && <span>📍 {q.client_location}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" leftIcon={Eye} onClick={() => navigate(`/quotation/${q.id}`)}>View</Button>
                  <Button variant="danger" size="sm" leftIcon={X} onClick={() => handleReject(q)}>Reject</Button>
                  <Button variant="success" size="sm" leftIcon={Send} loading={sending === q.id} onClick={() => handleApprove(q)}>Approve & Send</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
