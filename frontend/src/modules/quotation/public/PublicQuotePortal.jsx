/**
 * Public Quote Portal — the client-facing page for a signed quote link.
 * Shows branded quote details + Accept / Negotiate / Ask question buttons.
 * Enforces the tenant's flat discount cap.
 */
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Loader2, CheckCircle2, XCircle, MessageCircle, Building2, IndianRupee,
  Eye, Image as ImageIcon, Clock, Sparkles, Shield, Send, AlertTriangle,
} from 'lucide-react';
import { quotationPublicAPI } from '../../../services/api';

function applyBranding(tenant) {
  const root = document.documentElement;
  root.style.setProperty('--brand-primary', tenant?.primary_color || '#6366f1');
  root.style.setProperty('--brand-accent', tenant?.accent_color || '#8b5cf6');
  if (tenant?.name) document.title = `${tenant.name} · Your Quote`;
}

const StatusPill = ({ status }) => {
  const map = {
    sent: { bg: '#fef3c7', color: '#b45309', label: 'Awaiting Response' },
    accepted: { bg: '#d1fae5', color: '#047857', label: 'Accepted' },
    rejected: { bg: '#fee2e2', color: '#b91c1c', label: 'Rejected' },
    draft: { bg: '#e0e7ff', color: '#4338ca', label: 'Draft' },
    revised: { bg: '#ede9fe', color: '#6d28d9', label: 'Revised' },
  };
  const s = map[status] || map.draft;
  return (
    <span className="px-3 py-1 rounded-full text-xs font-bold" style={{ background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
};

export default function PublicQuotePortal() {
  const { token } = useParams();
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState(null); // "accept" | "reject" | "negotiate" | "ask"
  const [offerAmount, setOfferAmount] = useState('');
  const [offerMessage, setOfferMessage] = useState('');
  const [question, setQuestion] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    setLoading(true);
    quotationPublicAPI.viewQuote(token)
      .then(res => {
        setQuote(res.data);
        applyBranding(res.data.tenant);
      })
      .catch(() => toast.error('Invalid or expired link'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [token]);

  const handleAccept = async () => {
    if (!confirm('Accept this quotation?')) return;
    setSubmitting(true);
    try {
      await quotationPublicAPI.acceptQuote(token);
      toast.success('Quote accepted! The team will reach out shortly.');
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Accept failed');
    } finally { setSubmitting(false); }
  };

  const handleReject = async () => {
    if (!confirm('Reject this quotation?')) return;
    setSubmitting(true);
    try {
      await quotationPublicAPI.rejectQuote(token);
      toast.success('Quote rejected');
      load();
    } catch {
      toast.error('Reject failed');
    } finally { setSubmitting(false); }
  };

  const handleNegotiate = async () => {
    const amount = parseFloat(offerAmount);
    if (!amount || amount <= 0) { toast.error('Enter a valid amount'); return; }
    setSubmitting(true);
    try {
      await quotationPublicAPI.proposeOffer(token, amount, offerMessage);
      toast.success('Your offer has been sent. The team will respond shortly.');
      setAction(null);
      setOfferAmount('');
      setOfferMessage('');
      load();
    } catch (e) {
      const detail = e.response?.data?.detail;
      if (typeof detail === 'object' && detail.error === 'below_floor') {
        toast.error(detail.message, { duration: 6000 });
      } else {
        toast.error(detail || 'Offer failed');
      }
    } finally { setSubmitting(false); }
  };

  const handleAsk = async () => {
    if (!question.trim()) return;
    setSubmitting(true);
    try {
      await quotationPublicAPI.askQuestion(token, question);
      toast.success('Question sent');
      setQuestion('');
      setAction(null);
    } catch {
      toast.error('Send failed');
    } finally { setSubmitting(false); }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>;
  }
  if (!quote) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6 text-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Link invalid or expired</h1>
          <p className="text-sm text-slate-500 mt-2">Please contact the team for a fresh quotation link.</p>
        </div>
      </div>
    );
  }

  const tenant = quote.tenant || {};
  const isFinal = ['accepted', 'rejected'].includes(quote.status);
  const canNegotiate = quote.negotiation_enabled && !isFinal;
  const minAcceptable = quote.min_acceptable_amount || 0;

  return (
    <div className="min-h-screen bg-[#f7f8fc]">
      {/* Header */}
      <div
        className="border-b border-slate-200"
        style={{
          background: `linear-gradient(135deg, color-mix(in oklab, ${tenant.primary_color || '#6366f1'} 8%, white), white 60%, color-mix(in oklab, ${tenant.accent_color || '#ec4899'} 6%, white))`,
        }}
      >
        <div className="max-w-4xl mx-auto px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {tenant.logo_url ? (
              <img src={tenant.logo_url} alt={tenant.name} className="w-12 h-12 rounded-xl object-contain bg-white shadow-sm" />
            ) : (
              <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg text-white"
                style={{ background: `linear-gradient(135deg, ${tenant.primary_color}, ${tenant.accent_color})` }}>
                <Building2 className="w-6 h-6" strokeWidth={2.6} />
              </div>
            )}
            <div>
              <h1 className="text-xl font-bold text-slate-900">{tenant.app_name || tenant.name || 'Tendent'}</h1>
              <p className="text-sm text-slate-500">Quote · Q-{quote.quotation_id}</p>
            </div>
          </div>
          <StatusPill status={quote.status} />
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Hero card */}
        <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 opacity-20 pointer-events-none"
            style={{ background: `radial-gradient(circle at top right, ${tenant.accent_color || '#ec4899'}, transparent 70%)` }} />
          <div className="relative">
            <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full mb-3"
              style={{ background: `color-mix(in oklab, ${tenant.primary_color} 12%, white)`, color: tenant.primary_color }}>
              <Sparkles className="w-3.5 h-3.5" /> Your Quotation
            </div>
            <h2 className="text-3xl font-bold text-slate-900">{quote.project_name}</h2>
            <p className="text-sm text-slate-500 mt-1">Prepared for <span className="font-semibold">{quote.client_name}</span></p>

            <div className="mt-6 p-5 rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50">
              <div className="text-xs text-slate-500 uppercase tracking-wider font-bold">Total Amount</div>
              <div className="text-4xl font-bold mt-1" style={{
                background: `linear-gradient(135deg, ${tenant.primary_color}, ${tenant.accent_color})`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}>
                ₹{(quote.final_amount || quote.total_amount).toLocaleString('en-IN')}
              </div>
              {quote.final_amount && quote.final_amount !== quote.total_amount && (
                <div className="text-xs text-slate-500 mt-1">Original: ₹{quote.total_amount.toLocaleString('en-IN')}</div>
              )}
              {quote.valid_until && (
                <div className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Valid until {new Date(quote.valid_until).toLocaleDateString()}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Visual artifacts */}
        {(quote.render_3d_url || quote.drawings_url || (quote.ai_render_urls || []).length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {quote.render_3d_url && (
              <Link to={`/view/${token}/3d`} className="group bg-white rounded-2xl p-4 border border-slate-200 hover:border-indigo-400 hover:shadow-lg transition-all">
                <div className="aspect-video rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center mb-3">
                  <Eye className="w-8 h-8 text-indigo-600" />
                </div>
                <div className="font-semibold">Interactive 3D Model</div>
                <div className="text-xs text-slate-500 mt-0.5">Rotate, zoom, inspect →</div>
              </Link>
            )}
            {quote.drawings_url && (
              <a href={quote.drawings_url} target="_blank" rel="noreferrer" className="group bg-white rounded-2xl p-4 border border-slate-200 hover:border-emerald-400 hover:shadow-lg transition-all">
                <div className="aspect-video rounded-xl bg-gradient-to-br from-emerald-100 to-cyan-100 flex items-center justify-center mb-3">
                  <ImageIcon className="w-8 h-8 text-emerald-600" />
                </div>
                <div className="font-semibold">2D Drawings</div>
                <div className="text-xs text-slate-500 mt-0.5">Plan, elevation, section →</div>
              </a>
            )}
            {(quote.ai_render_urls || []).length > 0 && (
              <Link to={`/view/${token}/render`} className="group bg-white rounded-2xl p-4 border border-slate-200 hover:border-pink-400 hover:shadow-lg transition-all">
                <div className="aspect-video rounded-xl bg-gradient-to-br from-pink-100 to-orange-100 flex items-center justify-center mb-3">
                  <Sparkles className="w-8 h-8 text-pink-600" />
                </div>
                <div className="font-semibold">AI Renders</div>
                <div className="text-xs text-slate-500 mt-0.5">Realistic previews →</div>
              </Link>
            )}
          </div>
        )}

        {/* BOQ breakdown */}
        {quote.boq_results?.items?.length > 0 && (
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-slate-100"><h3 className="font-bold text-slate-900">Breakdown</h3></div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    {['Item', 'Description', 'Qty', 'Rate', 'Amount'].map(h => (
                      <th key={h} className="text-[11px] font-bold uppercase tracking-wider text-slate-500 px-4 py-3 text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {quote.boq_results.items.map((item, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">{item.item_no}</td>
                      <td className="px-4 py-3 text-slate-900">{(item.description || '').split('\n')[0]}</td>
                      <td className="px-4 py-3 text-slate-600">{item.quantity?.toLocaleString('en-IN')} {item.unit}</td>
                      <td className="px-4 py-3 text-slate-600">₹{item.rate?.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 font-semibold">₹{item.amount?.toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Offer history */}
        {quote.offers && quote.offers.length > 0 && (
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
            <h3 className="font-bold text-slate-900 mb-4">Offer History</h3>
            <div className="space-y-3">
              {quote.offers.map(o => (
                <div key={o.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">₹{o.proposed_amount.toLocaleString('en-IN')}</div>
                    <span className="text-xs font-bold uppercase px-2 py-0.5 rounded-full" style={{
                      background: o.status === 'tenant_approved' ? '#d1fae5' : o.status === 'auto_rejected' || o.status === 'tenant_rejected' ? '#fee2e2' : '#fef3c7',
                      color: o.status === 'tenant_approved' ? '#047857' : o.status === 'auto_rejected' || o.status === 'tenant_rejected' ? '#b91c1c' : '#b45309',
                    }}>{o.status.replace(/_/g, ' ')}</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">{o.discount_pct}% off</div>
                  {o.client_message && <div className="text-xs text-slate-600 mt-1">You: "{o.client_message}"</div>}
                  {o.tenant_response && <div className="text-xs text-slate-700 mt-1">Team: "{o.tenant_response}"</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action panel */}
        {!isFinal && (
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
            <h3 className="font-bold text-slate-900 mb-4">What would you like to do?</h3>

            {action === null && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <button onClick={handleAccept} disabled={submitting} className="p-4 rounded-2xl text-white font-semibold flex flex-col items-center gap-2 transition-all hover:brightness-110 disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #10b981, #06b6d4)', boxShadow: '0 8px 20px -8px rgba(16,185,129,0.5)' }}>
                  <CheckCircle2 className="w-6 h-6" /> Accept
                </button>
                {canNegotiate && (
                  <button onClick={() => setAction('negotiate')} className="p-4 rounded-2xl text-white font-semibold flex flex-col items-center gap-2 transition-all hover:brightness-110"
                    style={{ background: 'linear-gradient(135deg, #f59e0b, #f43f5e)', boxShadow: '0 8px 20px -8px rgba(245,158,11,0.5)' }}>
                    <IndianRupee className="w-6 h-6" /> Negotiate
                  </button>
                )}
                <button onClick={() => setAction('ask')} className="p-4 rounded-2xl bg-white border border-slate-300 font-semibold flex flex-col items-center gap-2 hover:border-slate-400 transition-all">
                  <MessageCircle className="w-6 h-6 text-slate-600" /> Ask a Question
                </button>
                <button onClick={handleReject} disabled={submitting} className="p-4 rounded-2xl bg-white border border-rose-200 text-rose-600 font-semibold flex flex-col items-center gap-2 hover:bg-rose-50 transition-all disabled:opacity-50">
                  <XCircle className="w-6 h-6" /> Decline
                </button>
              </div>
            )}

            {action === 'negotiate' && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3">
                  <Shield className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-800">
                    <strong>Minimum acceptable amount:</strong> ₹{minAcceptable.toLocaleString('en-IN')}
                    <br />
                    Offers below this will be automatically rejected.
                  </div>
                </div>
                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">Your proposed amount (₹)</span>
                  <input
                    type="number"
                    className="mt-1 w-full h-12 px-3 rounded-xl border border-slate-200 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-amber-400"
                    value={offerAmount}
                    onChange={e => setOfferAmount(e.target.value)}
                    placeholder={minAcceptable.toLocaleString('en-IN')}
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">Message (optional)</span>
                  <textarea rows={3} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
                    value={offerMessage} onChange={e => setOfferMessage(e.target.value)} placeholder="Why are you proposing this amount?" />
                </label>
                <div className="flex gap-2">
                  <button onClick={() => setAction(null)} className="px-4 h-10 rounded-xl bg-white border border-slate-200 text-sm font-semibold">Cancel</button>
                  <button onClick={handleNegotiate} disabled={submitting} className="flex-1 h-10 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2"
                    style={{ background: 'linear-gradient(135deg, #f59e0b, #f43f5e)' }}>
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Send Offer
                  </button>
                </div>
              </div>
            )}

            {action === 'ask' && (
              <div className="space-y-4">
                <textarea rows={4} value={question} onChange={e => setQuestion(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 resize-none"
                  style={{ '--tw-ring-color': tenant.primary_color }}
                  placeholder="Type your question..." />
                <div className="flex gap-2">
                  <button onClick={() => setAction(null)} className="px-4 h-10 rounded-xl bg-white border border-slate-200 text-sm font-semibold">Cancel</button>
                  <button onClick={handleAsk} disabled={submitting || !question.trim()} className="flex-1 h-10 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                    style={{ background: `linear-gradient(135deg, ${tenant.primary_color}, ${tenant.accent_color})` }}>
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Send
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {quote.terms_conditions && (
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
            <h3 className="font-bold text-slate-900 mb-3">Terms & Conditions</h3>
            <pre className="whitespace-pre-wrap text-xs text-slate-600 font-sans">{quote.terms_conditions}</pre>
          </div>
        )}

        <footer className="text-center text-xs text-slate-400 py-4">
          Powered by Tendent · Secure portal link
        </footer>
      </div>
    </div>
  );
}
