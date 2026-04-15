/**
 * AI-Powered Quotation — Swetha Structures
 *
 * Four AI tools in one page:
 *   1. Voice/Text → Instant Quote (type or speak building requirements)
 *   2. Photo → Quote (upload site photo for AI dimension estimation)
 *   3. Steel Rate Intelligence (market prediction + recommendation)
 *   4. Market Position (competitor price comparison)
 */

import { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  Mic, MicOff, Camera, Upload, TrendingUp, TrendingDown, BarChart3,
  Sparkles, ArrowRight, Building2, IndianRupee, Target, Zap, Clock,
  AlertTriangle, CheckCircle, Send, Loader2, ChevronRight, RefreshCw,
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  Card, CardHeader, CardBody, Stat, Button, PageHeader, Badge, Input,
  Textarea, Segmented, Skeleton, EmptyState,
} from '../../components/ui/primitives'
import api, { quotationAPI } from '../../services/api'

const fmtINR = (n) => n == null ? '—' : `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

export default function AIQuote() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('voice')
  const fileInputRef = useRef(null)

  // Voice-to-Quote state
  const [voiceText, setVoiceText] = useState('')
  const [voiceLoading, setVoiceLoading] = useState(false)
  const [voiceResult, setVoiceResult] = useState(null)
  const [isRecording, setIsRecording] = useState(false)
  const mediaRecorderRef = useRef(null)

  // Photo-to-Quote state
  const [photoPreview, setPhotoPreview] = useState(null)
  const [photoFile, setPhotoFile] = useState(null)
  const [photoContext, setPhotoContext] = useState('')
  const [photoLoading, setPhotoLoading] = useState(false)
  const [photoResult, setPhotoResult] = useState(null)

  // Rate Prediction state
  const [rateData, setRateData] = useState(null)
  const [rateLoading, setRateLoading] = useState(false)
  const [weeksAhead, setWeeksAhead] = useState(2)

  // Market Position state
  const [marketResult, setMarketResult] = useState(null)

  // ── Voice-to-Quote ─────────────────────────────────────
  const handleVoiceSubmit = async () => {
    if (!voiceText.trim()) { toast.error('Enter a building description'); return }
    setVoiceLoading(true)
    try {
      const res = await api.post('/api/v1/ai-quote/voice', { text: voiceText, auto_calculate: true })
      setVoiceResult(res.data)
      if (res.data.market_position) setMarketResult(res.data.market_position)
      toast.success('AI quotation generated!')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to generate quote')
    } finally {
      setVoiceLoading(false)
    }
  }

  // ── Browser Speech Recognition ──────────────────────────
  const toggleRecording = () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop?.()
      setIsRecording(false)
      return
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) { toast.error('Speech recognition not supported in this browser'); return }
    const recognition = new SpeechRecognition()
    recognition.lang = 'en-IN'
    recognition.continuous = false
    recognition.interimResults = false
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript
      setVoiceText(transcript)
      setIsRecording(false)
      toast.success('Voice captured!')
    }
    recognition.onerror = () => { setIsRecording(false); toast.error('Voice capture failed') }
    recognition.onend = () => setIsRecording(false)
    recognition.start()
    setIsRecording(true)
    mediaRecorderRef.current = recognition
  }

  // ── Photo-to-Quote ─────────────────────────────────────
  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => setPhotoPreview(ev.target.result)
    reader.readAsDataURL(file)
  }

  const handlePhotoSubmit = async () => {
    if (!photoFile) { toast.error('Upload a site photo first'); return }
    setPhotoLoading(true)
    try {
      const formData = new FormData()
      formData.append('file', photoFile)
      formData.append('context', photoContext)
      formData.append('auto_calculate', 'true')
      const res = await api.post('/api/v1/ai-quote/photo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setPhotoResult(res.data)
      if (res.data.market_position) setMarketResult(res.data.market_position)
      toast.success('Photo analyzed! Quotation generated.')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Photo analysis failed')
    } finally {
      setPhotoLoading(false)
    }
  }

  // ── Rate Prediction ─────────────────────────────────────
  const loadRates = useCallback(async () => {
    setRateLoading(true)
    try {
      const res = await api.get(`/api/v1/ai-quote/rates?weeks_ahead=${weeksAhead}`)
      setRateData(res.data)
    } catch (err) {
      toast.error('Failed to load rate data')
    } finally {
      setRateLoading(false)
    }
  }, [weeksAhead])

  // ── Save as Quotation ──────────────────────────────────
  const saveAsQuotation = async (result) => {
    if (!result?.building_params) return
    try {
      const res = await quotationAPI.create({
        project_name: result.project_name || 'AI-Generated Quote',
        client_name: '',
        client_location: '',
        building_params: result.building_params,
      })
      toast.success('Quotation saved!')
      navigate(`/quotation/${res.data.id}`)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save')
    }
  }

  // Current result (voice or photo)
  const currentResult = activeTab === 'voice' ? voiceResult : photoResult

  const tabs = [
    { value: 'voice', label: 'Voice / Text' },
    { value: 'photo', label: 'Photo' },
    { value: 'rates', label: 'Steel Rates' },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Quotation Engine"
        subtitle="Generate instant PEB quotations with AI — voice, photo, or text"
        actions={<Badge tone="purple" dot>AI Powered</Badge>}
      />

      <Segmented options={tabs} value={activeTab} onChange={setActiveTab} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── LEFT: Input Panel ────────────────────────── */}
        <div className="space-y-4">
          {activeTab === 'voice' && (
            <Card>
              <CardHeader title="Describe Your Building" subtitle="Type or speak — AI extracts dimensions instantly" />
              <CardBody className="space-y-4">
                <div className="relative">
                  <Textarea
                    value={voiceText}
                    onChange={(e) => setVoiceText(e.target.value)}
                    placeholder='E.g. "I need a warehouse 100 by 60, gable roof, 30 feet height with bare galvalume"'
                    rows={4}
                  />
                  <button
                    onClick={toggleRecording}
                    className={`absolute bottom-3 right-3 p-2.5 rounded-xl transition-all ${
                      isRecording
                        ? 'bg-red-500 text-white animate-pulse'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-amber-100 hover:text-amber-600'
                    }`}
                  >
                    {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                  </button>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleVoiceSubmit} loading={voiceLoading} leftIcon={Sparkles} className="flex-1">
                    Generate Quote
                  </Button>
                </div>
                {/* Quick examples */}
                <div className="flex flex-wrap gap-2">
                  {[
                    '100x60, gable, 30ft height',
                    '150x80, PUF panels, mezzanine 80x40',
                    'Small workshop 40x30, single slope',
                  ].map((ex) => (
                    <button
                      key={ex}
                      onClick={() => setVoiceText(ex)}
                      className="px-2.5 py-1 text-xs rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-amber-50 hover:text-amber-700 transition-colors"
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              </CardBody>
            </Card>
          )}

          {activeTab === 'photo' && (
            <Card>
              <CardHeader title="Upload Site Photo" subtitle="AI analyzes the image and estimates building dimensions" />
              <CardBody className="space-y-4">
                <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={handlePhotoSelect} />
                {photoPreview ? (
                  <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
                    <img src={photoPreview} alt="Site" className="w-full h-48 object-cover" />
                    <button
                      onClick={() => { setPhotoPreview(null); setPhotoFile(null); setPhotoResult(null) }}
                      className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/50 text-white hover:bg-black/70"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-48 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl flex flex-col items-center justify-center gap-3 text-slate-500 hover:border-amber-400 hover:text-amber-600 transition-colors"
                  >
                    <Camera className="w-8 h-8" />
                    <span className="text-sm font-medium">Click to upload site photo</span>
                    <span className="text-xs">JPEG, PNG — max 10MB</span>
                  </button>
                )}
                <Input
                  value={photoContext}
                  onChange={(e) => setPhotoContext(e.target.value)}
                  placeholder="Optional context: e.g. '1 acre plot in Coimbatore'"
                />
                <Button onClick={handlePhotoSubmit} loading={photoLoading} leftIcon={Sparkles} disabled={!photoFile} className="w-full">
                  Analyze & Generate Quote
                </Button>
              </CardBody>
            </Card>
          )}

          {activeTab === 'rates' && (
            <Card>
              <CardHeader
                title="Steel Rate Intelligence"
                subtitle="Market prediction and pricing recommendation"
                action={<Button variant="ghost" size="sm" leftIcon={RefreshCw} onClick={loadRates} loading={rateLoading}>Refresh</Button>}
              />
              <CardBody className="space-y-4">
                {!rateData && !rateLoading && (
                  <EmptyState
                    icon={TrendingUp}
                    title="Load Market Data"
                    description="Get steel rate predictions and pricing recommendations"
                    action={<Button onClick={loadRates} leftIcon={BarChart3}>Load Rates</Button>}
                  />
                )}
                {rateLoading && <div className="space-y-3"><Skeleton className="h-20" /><Skeleton className="h-40" /><Skeleton className="h-20" /></div>}
                {rateData && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <Stat label="Current Rate" value={`₹${rateData.current_rate}/Kg`} icon={IndianRupee} accent="#D97706" />
                      <Stat
                        label={`Predicted (${rateData.weeks_ahead}w)`}
                        value={`₹${rateData.predicted_rate}/Kg`}
                        change={`${rateData.cost_impact.percentage > 0 ? '+' : ''}${rateData.cost_impact.percentage}%`}
                        changeType={rateData.trend === 'up' ? 'up' : 'down'}
                        icon={rateData.trend === 'up' ? TrendingUp : TrendingDown}
                        accent={rateData.trend === 'up' ? '#ef4444' : '#10b981'}
                      />
                    </div>

                    {/* Price History Chart */}
                    <Card>
                      <CardBody>
                        <div className="h-48">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={rateData.history}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                              <YAxis tick={{ fontSize: 11 }} domain={['dataMin - 5', 'dataMax + 5']} />
                              <Tooltip formatter={(v) => [`₹${v}/Kg`, 'Steel Rate']} />
                              <Area type="monotone" dataKey="rate" stroke="#D97706" fill="#D97706" fillOpacity={0.15} strokeWidth={2} />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </CardBody>
                    </Card>

                    {/* Recommendation */}
                    <div className={`rounded-xl p-4 border ${
                      rateData.trend === 'up' ? 'bg-red-50 border-red-200 dark:bg-red-500/10 dark:border-red-500/20' :
                      rateData.trend === 'down' ? 'bg-green-50 border-green-200 dark:bg-green-500/10 dark:border-green-500/20' :
                      'bg-blue-50 border-blue-200 dark:bg-blue-500/10 dark:border-blue-500/20'
                    }`}>
                      <div className="flex items-start gap-3">
                        <AlertTriangle className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
                          rateData.trend === 'up' ? 'text-red-600' : rateData.trend === 'down' ? 'text-green-600' : 'text-blue-600'
                        }`} />
                        <div>
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">
                            {rateData.trend === 'up' ? 'Prices Rising' : rateData.trend === 'down' ? 'Prices Falling' : 'Market Stable'}
                          </p>
                          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{rateData.recommendation}</p>
                        </div>
                      </div>
                    </div>

                    {/* Cost Impact */}
                    <Card>
                      <CardHeader title="Impact on Typical Quote" subtitle={rateData.cost_impact.typical_building} />
                      <CardBody>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div><span className="text-slate-500">Current Cost</span><p className="font-semibold text-slate-900 dark:text-white">{fmtINR(rateData.cost_impact.current_cost)}</p></div>
                          <div><span className="text-slate-500">Predicted Cost</span><p className="font-semibold text-slate-900 dark:text-white">{fmtINR(rateData.cost_impact.predicted_cost)}</p></div>
                          <div className="col-span-2">
                            <span className="text-slate-500">Difference</span>
                            <p className={`font-bold text-lg ${rateData.cost_impact.difference > 0 ? 'text-red-600' : 'text-green-600'}`}>
                              {rateData.cost_impact.difference > 0 ? '+' : ''}{fmtINR(rateData.cost_impact.difference)}
                            </p>
                          </div>
                        </div>
                      </CardBody>
                    </Card>
                  </>
                )}
              </CardBody>
            </Card>
          )}
        </div>

        {/* ── RIGHT: Results Panel ────────────────────────── */}
        <div className="space-y-4">
          {(activeTab === 'voice' || activeTab === 'photo') && currentResult && (
            <>
              {/* BOQ Summary */}
              <Card>
                <CardHeader
                  title="AI Quotation Result"
                  subtitle={`Confidence: ${Math.round((currentResult.confidence || 0) * 100)}%`}
                  action={
                    <Button size="sm" leftIcon={ArrowRight} onClick={() => saveAsQuotation(currentResult)}>
                      Save as Quote
                    </Button>
                  }
                />
                <CardBody>
                  {/* Building Params */}
                  <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                    {(() => {
                      const bp = currentResult.building_params || {}
                      return (
                        <>
                          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                            <span className="text-slate-500 text-xs">Size</span>
                            <p className="font-semibold text-slate-900 dark:text-white">{bp.building_length}' × {bp.building_width}'</p>
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                            <span className="text-slate-500 text-xs">Height</span>
                            <p className="font-semibold text-slate-900 dark:text-white">{bp.full_height}' (Wall: {bp.wall_height}')</p>
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                            <span className="text-slate-500 text-xs">Roof</span>
                            <p className="font-semibold text-slate-900 dark:text-white capitalize">{bp.roof_type?.replace('_', ' ')} · {bp.roof_sheet_type === 'puf' ? 'PUF' : 'Galvalume'}</p>
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                            <span className="text-slate-500 text-xs">Mezzanine</span>
                            <p className="font-semibold text-slate-900 dark:text-white">{bp.mezzanine_required ? `Yes (${bp.mezz_length}'×${bp.mezz_width}')` : 'No'}</p>
                          </div>
                        </>
                      )
                    })()}
                  </div>

                  {/* Total */}
                  <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-500/10 dark:to-orange-500/10 rounded-xl p-4 border border-amber-200/60 dark:border-amber-500/20">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">Total Estimated Amount</p>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{fmtINR(currentResult.total_amount)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">Rate / Sqft</p>
                        <p className="text-lg font-bold text-slate-900 dark:text-white mt-1">{fmtINR(currentResult.rate_per_sqft)}</p>
                      </div>
                    </div>
                  </div>

                  {/* BOQ Items */}
                  {currentResult.boq_results?.items && (
                    <div className="mt-4 space-y-2">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Bill of Quantities</p>
                      {currentResult.boq_results.items.map((item, i) => (
                        <div key={i} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{item.category}</p>
                            <p className="text-xs text-slate-500">{item.quantity?.toLocaleString()} {item.unit} × ₹{item.rate}</p>
                          </div>
                          <p className="text-sm font-semibold text-slate-900 dark:text-white ml-4">{fmtINR(item.amount)}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {currentResult.notes && (
                    <p className="mt-3 text-xs text-slate-500 italic">{currentResult.notes}</p>
                  )}
                </CardBody>
              </Card>

              {/* Market Position */}
              {marketResult && (
                <Card>
                  <CardHeader title="Market Position" subtitle="How your quote compares to competitors" />
                  <CardBody>
                    {/* Position indicator */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                        <span>Cheapest</span>
                        <span>Most Expensive</span>
                      </div>
                      <div className="h-3 bg-gradient-to-r from-green-400 via-amber-400 to-red-400 rounded-full relative">
                        <div
                          className="absolute top-1/2 -translate-y-1/2 w-5 h-5 bg-white border-2 border-slate-900 rounded-full shadow-lg"
                          style={{ left: `${Math.min(95, Math.max(5, marketResult.market_percentile))}%`, transform: 'translate(-50%, -50%)' }}
                        />
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <Badge tone={marketResult.price_signal === 'competitive' ? 'success' : marketResult.price_signal === 'premium' ? 'danger' : 'warning'}>
                          {marketResult.segment_label} · {marketResult.market_percentile}th percentile
                        </Badge>
                        <span className="text-sm font-semibold">{marketResult.win_probability}% win probability</span>
                      </div>
                    </div>

                    {/* Competitor comparison */}
                    <div className="space-y-1.5">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Competitor Rates</p>
                      {marketResult.competitors?.slice(0, 5).map((c, i) => {
                        const isYou = Math.abs(c.rate_per_sqft - marketResult.rate_per_sqft) < 5
                        return (
                          <div key={i} className={`flex items-center justify-between py-1.5 text-sm ${isYou ? 'font-bold' : ''}`}>
                            <span className="text-slate-700 dark:text-slate-300">{c.name}</span>
                            <div className="flex items-center gap-3">
                              <span className="text-slate-500">₹{c.rate_per_sqft?.toFixed(0)}/sqft</span>
                              <span className="text-xs text-slate-400">{c.delivery_weeks}w</span>
                            </div>
                          </div>
                        )
                      })}
                      <div className="flex items-center justify-between py-1.5 text-sm font-bold border-t border-amber-200 dark:border-amber-800 mt-1 pt-2">
                        <span className="text-amber-700 dark:text-amber-400">→ Swetha Structures</span>
                        <span className="text-amber-700 dark:text-amber-400">₹{marketResult.rate_per_sqft?.toFixed(0)}/sqft</span>
                      </div>
                    </div>

                    <p className="mt-3 text-xs text-slate-600 dark:text-slate-400">{marketResult.recommendation}</p>
                  </CardBody>
                </Card>
              )}
            </>
          )}

          {(activeTab === 'voice' || activeTab === 'photo') && !currentResult && (
            <Card>
              <CardBody>
                <EmptyState
                  icon={Sparkles}
                  title="AI Quotation"
                  description={activeTab === 'voice'
                    ? 'Type or speak your building requirements and AI will generate an instant BOQ quotation'
                    : 'Upload a site photo and AI will estimate building dimensions and generate a quotation'
                  }
                />
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
