/**
 * Quotation Detail — tenant-side quote management page.
 * Shows full quote, margin (admin/manager only), offer history,
 * portal link generator, WhatsApp send button.
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Send, Copy, Link2, RefreshCw, Download, MessageCircle,
  IndianRupee, TrendingUp, Shield, ExternalLink, Check, X, Clock,
} from 'lucide-react';
import {
  Card, CardHeader, Stat, Button, Modal, Field, Input, PageHeader,
  Avatar, StatusBadge, Badge, Segmented, Skeleton, EmptyState,
} from '../../components/ui/primitives';
import { quotationAPI, quotationTemplateAPI } from '../../services/api';
import { usePermissions } from '../../hooks/usePermissions';

export default function QuotationDetail() {
  const { quotationId } = useParams();
  const navigate = useNavigate();
  const { can, hasRole } = usePermissions();
  const canSeeMargin = hasRole ? (hasRole('admin') || hasRole('manager')) : true;

  const [quote, setQuote] = useState(null);
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [portalToken, setPortalToken] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [whatsappMessage, setWhatsappMessage] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [q, o] = await Promise.all([
        quotationAPI.get(quotationId),
        quotationTemplateAPI.listOffers(quotationId).catch(() => ({ data: [] })),
      ]);
      setQuote(q.data);
      setOffers(o.data || []);
    } catch {
      toast.error('Quotation not found');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [quotationId]);

  const generatePortalLink = async () => {
    setGenerating(true);
    try {
      const { data } = await quotationTemplateAPI.generateToken(quotationId, 30);
      const url = `${window.location.origin}/q/${data.token}`;
      setPortalToken({ token: data.token, url, expires_at: data.expires_at });
      navigator.clipboard.writeText(url).catch(() => {});
      toast.success('Portal link generated & copied');
    } catch {
      toast.error('Failed to generate link');
    } finally {
      setGenerating(false);
    }
  };

  const downloadPdf = async () => {
    try {
      const res = await quotationAPI.downloadPdf(quotationId);
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `quotation_${quotationId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('PDF downloaded');
    } catch {
      toast.error('PDF generation failed');
    }
  };

  const sendWhatsApp = async () => {
    if (!quote?.client_phone) { toast.error('No client phone on this quote'); return; }
    setSending(true);
    try {
      // Ensure portal token exists
      let token = portalToken;
      if (!token) {
        const { data } = await quotationTemplateAPI.generateToken(quotationId, 30);
        token = { token: data.token, url: `${window.location.origin}/q/${data.token}` };
        setPortalToken(token);
      }
      await quotationAPI.changeStatus(quotationId, 'sent');
      toast.success(`Quote queued for WhatsApp to ${quote.client_phone}`, { duration: 5000 });
      setShowWhatsAppModal(false);
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Send failed');
    } finally {
      setSending(false);
    }
  };

  const decideOffer = async (offerId, action, counterAmount = null) => {
    try {
      await quotationTemplateAPI.decideOffer(quotationId, offerId, action, counterAmount ? { counter_amount: counterAmount } : {});
      toast.success(`Offer ${action}d`);
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed');
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="w-64 h-8" />
        <Card className="p-6"><Skeleton className="w-full h-96" /></Card>
      </div>
    );
  }
  if (!quote) return <EmptyState title="Not found" description="This quotation doesn't exist." />;

  // Margin calc: material - labour assumptions from boq_results (rough)
  const boq = quote.boq_results || {};
  const materialCost = (boq.items || []).reduce((sum, i) => sum + (i.material_rate || 0) * (i.quantity || 0), 0);
  const labourCost = (boq.items || []).reduce((sum, i) => sum + (i.labour_rate || 0) * (i.quantity || 0), 0);
  const totalCost = materialCost + labourCost;
  const marginAmount = (quote.total_amount || 0) - totalCost;
  const marginPct = totalCost > 0 ? (marginAmount / quote.total_amount) * 100 : 0;

  const pendingOffers = offers.filter(o => o.status === 'client_proposed');

  return (
    <div className="space-y-6">
      <PageHeader
        title={quote.project_name}
        subtitle={`Q-${quote.id} · Revision ${quote.revision}`}
        breadcrumbs={[
          { label: 'Quotations', href: '/quotation' },
          { label: `Q-${quote.id}` },
        ]}
        actions={
          <>
            <Button variant="secondary" leftIcon={ArrowLeft} onClick={() => navigate(-1)}>Back</Button>
            <Button variant="secondary" leftIcon={Download} onClick={downloadPdf}>Download PDF</Button>
            <Button variant="secondary" leftIcon={Link2} onClick={generatePortalLink} loading={generating}>Portal Link</Button>
            <Button leftIcon={MessageCircle} onClick={() => setShowWhatsAppModal(true)}>Send on WhatsApp</Button>
          </>
        }
      />

      {/* Client + Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 p-5">
          <div className="flex items-start gap-4">
            <Avatar name={quote.client_name || 'Client'} size={52} />
            <div className="flex-1 min-w-0">
              <div className="font-bold text-slate-900 dark:text-white">{quote.client_name}</div>
              {quote.client_location && <div className="text-sm text-slate-500">📍 {quote.client_location}</div>}
              {quote.client_phone && <div className="text-sm text-slate-500">📱 {quote.client_phone}</div>}
              {quote.client_email && <div className="text-sm text-slate-500">✉️ {quote.client_email}</div>}
            </div>
            <StatusBadge status={quote.status} />
          </div>
          {quote.valid_until && (
            <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
              <Clock className="w-3 h-3" /> Valid until {new Date(quote.valid_until).toLocaleDateString()}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Amount</div>
          <div className="text-3xl font-bold mt-1" style={{
            background: 'linear-gradient(135deg, var(--brand-primary), var(--brand-accent))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            ₹{(quote.final_amount || quote.total_amount || 0).toLocaleString('en-IN')}
          </div>
          {quote.final_amount && quote.final_amount !== quote.total_amount && (
            <div className="text-xs text-slate-500 line-through">₹{quote.total_amount.toLocaleString('en-IN')}</div>
          )}
          {quote.rate_per_sqft > 0 && (
            <div className="text-xs text-slate-500 mt-1">₹{quote.rate_per_sqft.toLocaleString('en-IN')}/sqft</div>
          )}
        </Card>
      </div>

      {/* Margin (admin/manager only) */}
      {canSeeMargin && materialCost > 0 && (
        <Card className="p-5 border-l-4" style={{ borderLeftColor: marginPct > 20 ? '#10b981' : marginPct > 10 ? '#f59e0b' : '#ef4444' }}>
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-4 h-4 text-slate-600" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Internal · Margin Analysis</span>
            <Badge tone="warning">Admin only</Badge>
          </div>
          <div className="grid grid-cols-4 gap-4">
            <div>
              <div className="text-xs text-slate-500">Material Cost</div>
              <div className="text-lg font-bold">₹{materialCost.toLocaleString('en-IN')}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Labour Cost</div>
              <div className="text-lg font-bold">₹{labourCost.toLocaleString('en-IN')}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Total Cost</div>
              <div className="text-lg font-bold">₹{totalCost.toLocaleString('en-IN')}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Margin</div>
              <div className="text-lg font-bold" style={{ color: marginPct > 20 ? '#10b981' : marginPct > 10 ? '#f59e0b' : '#ef4444' }}>
                ₹{marginAmount.toLocaleString('en-IN')} ({marginPct.toFixed(1)}%)
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Portal link banner */}
      {portalToken && (
        <Card className="p-4 border-l-4" style={{ borderLeftColor: 'var(--brand-primary)' }}>
          <div className="flex items-center gap-3">
            <Link2 className="w-5 h-5" style={{ color: 'var(--brand-primary)' }} />
            <div className="flex-1 min-w-0">
              <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Client Portal Link</div>
              <div className="text-sm font-mono text-slate-700 dark:text-slate-300 truncate">{portalToken.url}</div>
            </div>
            <Button variant="secondary" size="sm" leftIcon={Copy} onClick={() => { navigator.clipboard.writeText(portalToken.url); toast.success('Copied'); }}>Copy</Button>
            <Button variant="secondary" size="sm" leftIcon={ExternalLink} onClick={() => window.open(portalToken.url, '_blank')}>Open</Button>
          </div>
        </Card>
      )}

      {/* Pending offers (needs tenant decision) */}
      {pendingOffers.length > 0 && (
        <Card>
          <CardHeader title="Pending Client Offers" subtitle={`${pendingOffers.length} offer(s) awaiting your decision`} />
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {pendingOffers.map(o => (
              <div key={o.id} className="px-6 py-4 flex items-center gap-4">
                <div className="flex-1">
                  <div className="text-lg font-bold">₹{o.proposed_amount.toLocaleString('en-IN')} <span className="text-sm font-normal text-slate-500">({o.discount_pct}% off)</span></div>
                  {o.client_message && <div className="text-sm text-slate-600 mt-1">"{o.client_message}"</div>}
                </div>
                <Button variant="success" size="sm" leftIcon={Check} onClick={() => decideOffer(o.id, 'approve')}>Approve</Button>
                <Button variant="secondary" size="sm" onClick={() => {
                  const amt = prompt('Counter amount (₹):', o.proposed_amount);
                  if (amt) decideOffer(o.id, 'counter', parseFloat(amt));
                }}>Counter</Button>
                <Button variant="danger" size="sm" leftIcon={X} onClick={() => decideOffer(o.id, 'reject')}>Reject</Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* BOQ */}
      {quote.boq_results?.items?.length > 0 && (
        <Card>
          <CardHeader title="Bill of Quantities" subtitle={`${quote.boq_results.items.length} line items`} />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800">
                  {['Item', 'Description', 'Unit', 'Qty', 'Rate', 'Amount'].map(h => (
                    <th key={h} className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-6 py-3 text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {quote.boq_results.items.map((item, i) => (
                  <tr key={i} className="border-b border-slate-50 dark:border-slate-800/60 last:border-0 hover:bg-white/70 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-3.5 font-mono text-xs text-slate-500">{item.item_no}</td>
                    <td className="px-6 py-3.5">{(item.description || '').split('\n')[0]}</td>
                    <td className="px-6 py-3.5 text-slate-500">{item.unit}</td>
                    <td className="px-6 py-3.5 text-right tabular-nums">{item.quantity?.toLocaleString('en-IN')}</td>
                    <td className="px-6 py-3.5 text-right tabular-nums">{item.rate?.toLocaleString('en-IN')}</td>
                    <td className="px-6 py-3.5 text-right font-semibold tabular-nums">₹{item.amount?.toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* WhatsApp send modal */}
      <Modal
        open={showWhatsAppModal}
        onClose={() => setShowWhatsAppModal(false)}
        title="Send via WhatsApp"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowWhatsAppModal(false)}>Cancel</Button>
            <Button leftIcon={Send} onClick={sendWhatsApp} loading={sending}>Send Now</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-800">
            📱 Sending to: <strong>{quote.client_phone || 'No phone on file'}</strong>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm">
            Your client will receive:
            <ul className="list-disc list-inside mt-2 text-xs text-slate-600">
              <li>A branded PDF of the quotation</li>
              <li>A secure link to view 3D model, drawings & negotiate</li>
            </ul>
          </div>
          <Field label="Custom message (optional)">
            <textarea
              rows={4}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={whatsappMessage}
              onChange={e => setWhatsappMessage(e.target.value)}
              placeholder="Add a personal note..."
            />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
