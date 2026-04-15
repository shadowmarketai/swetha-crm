/**
 * Public AI Render Gallery — full-screen tenant-branded render viewer.
 */
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Loader2, Download, ImageOff } from 'lucide-react';
import { quotationPublicAPI } from '../../../services/api';

export default function PublicRenderGallery() {
  const { token } = useParams();
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    quotationPublicAPI.viewQuote(token)
      .then(res => setQuote(res.data))
      .catch(() => setQuote(null))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-950"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>;
  if (!quote) return <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">Invalid link</div>;

  const tenant = quote.tenant || {};
  const renders = quote.ai_render_urls || [];

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <Link to={`/q/${token}`} className="p-2 rounded-lg hover:bg-slate-800">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="font-semibold text-sm">{quote.project_name}</div>
            <div className="text-xs text-slate-400">{tenant.name || 'Tendent'} · AI Renders</div>
          </div>
        </div>
      </div>

      {renders.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
          <ImageOff className="w-16 h-16 mb-3" />
          <p className="text-lg">No renders available yet</p>
          <p className="text-sm mt-1">AI renders are being generated. Please check back shortly.</p>
        </div>
      ) : (
        <>
          {/* Main render */}
          <div className="flex-1 flex items-center justify-center p-6 relative">
            <img src={renders[activeIdx]} alt={`Render ${activeIdx + 1}`} className="max-w-full max-h-[75vh] rounded-2xl shadow-2xl" />
            <a
              href={renders[activeIdx]}
              download
              className="absolute bottom-8 right-8 w-12 h-12 rounded-full flex items-center justify-center shadow-xl text-white"
              style={{ background: `linear-gradient(135deg, ${tenant.primary_color || '#6366f1'}, ${tenant.accent_color || '#8b5cf6'})` }}
              title="Download"
            >
              <Download className="w-5 h-5" />
            </a>
          </div>

          {/* Thumbnails */}
          {renders.length > 1 && (
            <div className="flex items-center justify-center gap-2 p-4 border-t border-slate-800">
              {renders.map((src, i) => (
                <button key={i} onClick={() => setActiveIdx(i)} className={`w-20 h-14 rounded-lg overflow-hidden border-2 transition ${i === activeIdx ? 'border-white' : 'border-transparent opacity-60 hover:opacity-100'}`}>
                  <img src={src} alt={`thumb ${i + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
