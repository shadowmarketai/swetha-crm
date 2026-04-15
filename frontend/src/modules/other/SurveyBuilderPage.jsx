/**
 * SurveyBuilderPage — full editor for a single survey at /surveys/:id/edit
 *
 * Features:
 *   - Editable title / description
 *   - Question list with inline editor
 *   - Add / remove / reorder (move up/down) questions
 *   - 9 question types: short_text, long_text, single_choice, multiple_choice,
 *     dropdown, rating, nps, date, email
 *   - Settings panel (anonymous, multi-response, dates, max responses, theme)
 *   - Save Draft / Publish actions
 *   - Preview pane that renders the survey as a respondent will see it
 *   - Share link copy when active
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  ArrowLeft, Plus, Trash2, ChevronUp, ChevronDown, Save, Send, Eye,
  Settings, Type, AlignLeft, ListChecks, CheckSquare, Star, Hash,
  Calendar, Mail, ChevronsUpDown, Copy, ExternalLink, AlertCircle,
  Loader2, X,
} from 'lucide-react'

import { surveysAPI } from '../../services/api'

// ═══════════════════════════════════════════════════════════════════
// Question type catalog
// ═══════════════════════════════════════════════════════════════════

const QUESTION_TYPES = [
  { value: 'short_text',      label: 'Short Text',      icon: Type,         hasOptions: false },
  { value: 'long_text',       label: 'Long Text',       icon: AlignLeft,    hasOptions: false },
  { value: 'single_choice',   label: 'Single Choice',   icon: ListChecks,   hasOptions: true  },
  { value: 'multiple_choice', label: 'Multiple Choice', icon: CheckSquare,  hasOptions: true  },
  { value: 'dropdown',        label: 'Dropdown',        icon: ChevronsUpDown, hasOptions: true },
  { value: 'rating',          label: 'Rating (1–5)',    icon: Star,         hasOptions: false },
  { value: 'nps',             label: 'NPS (0–10)',      icon: Hash,         hasOptions: false },
  { value: 'date',            label: 'Date',            icon: Calendar,     hasOptions: false },
  { value: 'email',           label: 'Email',           icon: Mail,         hasOptions: false },
]

const TYPE_META = Object.fromEntries(QUESTION_TYPES.map((t) => [t.value, t]))

function newQuestionId() {
  return `q_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

function makeQuestion(type = 'short_text') {
  const meta = TYPE_META[type] || TYPE_META.short_text
  return {
    id: newQuestionId(),
    type,
    label: '',
    required: false,
    ...(meta.hasOptions ? { options: ['Option 1', 'Option 2'] } : {}),
  }
}

// ═══════════════════════════════════════════════════════════════════
// Main builder page
// ═══════════════════════════════════════════════════════════════════

export default function SurveyBuilderPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [survey, setSurvey] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [error, setError] = useState(null)

  const [showSettings, setShowSettings] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  // ── Load ──
  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await surveysAPI.getById(id)
      const data = res.data || {}
      setSurvey({
        id: data.id,
        title: data.title || '',
        description: data.description || '',
        slug: data.slug,
        status: data.status || 'draft',
        questions: Array.isArray(data.questions) ? data.questions : [],
        thank_you_message: data.thank_you_message || 'Thanks for your response!',
        redirect_url: data.redirect_url || '',
        is_anonymous: !!data.is_anonymous,
        allow_multiple_responses: !!data.allow_multiple_responses,
        require_auth: !!data.require_auth,
        show_progress_bar: data.show_progress_bar !== false,
        randomize_questions: !!data.randomize_questions,
        starts_at: data.starts_at || '',
        ends_at: data.ends_at || '',
        max_responses: data.max_responses || '',
      })
    } catch (e) {
      setError(e?.response?.data?.detail || e?.message || 'Failed to load survey')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  // ── Derivations ──
  const isActive   = survey?.status === 'active'
  const canPublish = !!survey && survey.questions.length > 0 && !!survey.title.trim() && !isActive

  const shareUrl = useMemo(() => {
    if (!survey?.slug) return ''
    return `${window.location.origin}/s/${survey.slug}`
  }, [survey?.slug])

  // ── Mutations ──
  const updateField = (field, value) => {
    setSurvey((prev) => ({ ...prev, [field]: value }))
  }

  const updateQuestion = (qid, patch) => {
    setSurvey((prev) => ({
      ...prev,
      questions: prev.questions.map((q) => (q.id === qid ? { ...q, ...patch } : q)),
    }))
  }

  const addQuestion = (type) => {
    setSurvey((prev) => ({
      ...prev,
      questions: [...prev.questions, makeQuestion(type)],
    }))
  }

  const removeQuestion = (qid) => {
    setSurvey((prev) => ({
      ...prev,
      questions: prev.questions.filter((q) => q.id !== qid),
    }))
  }

  const moveQuestion = (qid, direction) => {
    setSurvey((prev) => {
      const idx = prev.questions.findIndex((q) => q.id === qid)
      if (idx === -1) return prev
      const newIdx = direction === 'up' ? idx - 1 : idx + 1
      if (newIdx < 0 || newIdx >= prev.questions.length) return prev
      const next = [...prev.questions]
      ;[next[idx], next[newIdx]] = [next[newIdx], next[idx]]
      return { ...prev, questions: next }
    })
  }

  const buildPayload = () => ({
    title: survey.title.trim(),
    description: survey.description?.trim() || null,
    questions: survey.questions.map((q) => ({
      id: q.id,
      type: q.type,
      label: q.label?.trim() || 'Untitled question',
      required: !!q.required,
      ...(TYPE_META[q.type]?.hasOptions
        ? { options: (q.options || []).filter((o) => o && o.trim()) }
        : {}),
    })),
    thank_you_message: survey.thank_you_message || null,
    redirect_url: survey.redirect_url || null,
    is_anonymous: survey.is_anonymous,
    allow_multiple_responses: survey.allow_multiple_responses,
    require_auth: survey.require_auth,
    show_progress_bar: survey.show_progress_bar,
    randomize_questions: survey.randomize_questions,
    starts_at: survey.starts_at || null,
    ends_at: survey.ends_at || null,
    max_responses: survey.max_responses ? parseInt(survey.max_responses, 10) : null,
  })

  const validate = () => {
    if (!survey.title.trim()) {
      toast.error('Survey title is required')
      return false
    }
    for (const q of survey.questions) {
      if (!q.label?.trim()) {
        toast.error('Every question needs a label')
        return false
      }
      if (TYPE_META[q.type]?.hasOptions) {
        const opts = (q.options || []).filter((o) => o && o.trim())
        if (opts.length < 2) {
          toast.error(`"${q.label || 'Question'}" needs at least 2 options`)
          return false
        }
      }
    }
    return true
  }

  const saveDraft = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      await surveysAPI.update(id, buildPayload())
      toast.success('Saved')
      await load()
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const publish = async () => {
    if (!validate()) return
    if (survey.questions.length === 0) {
      toast.error('Add at least one question before publishing')
      return
    }
    setPublishing(true)
    try {
      // Save edits first, then flip to active
      await surveysAPI.update(id, buildPayload())
      await surveysAPI.publish(id)
      toast.success('Survey published')
      await load()
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Publish failed')
    } finally {
      setPublishing(false)
    }
  }

  const copyShareLink = async () => {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      toast.success('Share link copied')
    } catch {
      toast.error('Could not copy — copy manually from the field')
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════════════════════
  if (loading) {
    return (
      <div className="py-20 text-center text-sm text-slate-500">
        <Loader2 className="w-6 h-6 mx-auto mb-2 animate-spin" />
        Loading survey…
      </div>
    )
  }

  if (error || !survey) {
    return (
      <div className="max-w-xl mx-auto mt-12 p-6 rounded-xl border border-red-200 bg-red-50">
        <div className="flex items-center gap-2 text-red-700 mb-2">
          <AlertCircle className="w-5 h-5" />
          <h2 className="font-semibold">Could not load survey</h2>
        </div>
        <p className="text-sm text-red-600 mb-4">{error || 'Survey not found'}</p>
        <Link to="/surveys" className="text-sm text-indigo-600 underline">← Back to surveys</Link>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => navigate('/surveys/forms')}
            className="p-2 rounded-lg hover:bg-slate-100"
            aria-label="Back to surveys"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-slate-900 truncate">
              {survey.title || 'Untitled Survey'}
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider ${
                isActive
                  ? 'bg-emerald-100 text-emerald-700'
                  : survey.status === 'paused'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-slate-100 text-slate-600'
              }`}>{survey.status}</span>
              <span className="text-xs text-slate-400">{survey.questions.length} question{survey.questions.length === 1 ? '' : 's'}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPreview(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            <Eye className="w-4 h-4" /> Preview
          </button>
          <button
            onClick={() => setShowSettings((s) => !s)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm border rounded-lg ${
              showSettings ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Settings className="w-4 h-4" /> Settings
          </button>
          <button
            onClick={saveDraft}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save
          </button>
          <button
            onClick={publish}
            disabled={!canPublish || publishing}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium"
          >
            {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {isActive ? 'Published' : 'Publish'}
          </button>
        </div>
      </div>

      {/* ── Share link bar (only when published) ── */}
      {isActive && shareUrl && (
        <div className="flex items-center gap-2 p-3 rounded-lg border border-emerald-200 bg-emerald-50">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-wider font-bold text-emerald-700 mb-0.5">Public share link</p>
            <input
              readOnly
              value={shareUrl}
              onClick={(e) => e.target.select()}
              className="w-full bg-transparent text-sm text-emerald-900 font-mono outline-none truncate"
            />
          </div>
          <button
            onClick={copyShareLink}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-emerald-300 rounded-lg text-xs font-medium text-emerald-700 hover:bg-emerald-50"
          >
            <Copy className="w-3.5 h-3.5" /> Copy
          </button>
          <a
            href={shareUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium"
          >
            <ExternalLink className="w-3.5 h-3.5" /> Open
          </a>
        </div>
      )}

      {/* ── Title + description ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
        <input
          type="text"
          value={survey.title}
          onChange={(e) => updateField('title', e.target.value)}
          placeholder="Survey title"
          className="w-full text-2xl font-bold text-slate-900 placeholder-slate-300 border-0 border-b border-transparent focus:border-indigo-500 focus:outline-none bg-transparent pb-1"
        />
        <textarea
          value={survey.description}
          onChange={(e) => updateField('description', e.target.value)}
          placeholder="Optional description shown to respondents"
          rows={2}
          className="w-full text-sm text-slate-600 placeholder-slate-300 border-0 focus:outline-none bg-transparent resize-none"
        />
      </div>

      {/* ── Settings panel (collapsible) ── */}
      {showSettings && (
        <SettingsPanel survey={survey} updateField={updateField} />
      )}

      {/* ── Question list ── */}
      <div className="space-y-3">
        {survey.questions.length === 0 && (
          <div className="py-12 text-center bg-white rounded-xl border-2 border-dashed border-slate-200">
            <p className="text-sm text-slate-500 mb-4">No questions yet. Add your first question to get started.</p>
          </div>
        )}
        {survey.questions.map((q, idx) => (
          <QuestionCard
            key={q.id}
            index={idx}
            total={survey.questions.length}
            question={q}
            onChange={(patch) => updateQuestion(q.id, patch)}
            onRemove={() => removeQuestion(q.id)}
            onMoveUp={() => moveQuestion(q.id, 'up')}
            onMoveDown={() => moveQuestion(q.id, 'down')}
          />
        ))}
      </div>

      {/* ── Add question palette ── */}
      <AddQuestionPalette onAdd={addQuestion} />

      {/* ── Preview modal ── */}
      {showPreview && (
        <PreviewModal survey={survey} onClose={() => setShowPreview(false)} />
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// Settings panel
// ═══════════════════════════════════════════════════════════════════
function SettingsPanel({ survey, updateField }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <h2 className="text-sm font-semibold text-slate-900 mb-4">Settings</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Toggle
          label="Anonymous responses"
          description="Don't ask for respondent name/email"
          value={survey.is_anonymous}
          onChange={(v) => updateField('is_anonymous', v)}
        />
        <Toggle
          label="Allow multiple responses"
          description="Same email can submit more than once"
          value={survey.allow_multiple_responses}
          onChange={(v) => updateField('allow_multiple_responses', v)}
        />
        <Toggle
          label="Show progress bar"
          description="Display progress as user fills the form"
          value={survey.show_progress_bar}
          onChange={(v) => updateField('show_progress_bar', v)}
        />
        <Toggle
          label="Randomize question order"
          description="Show questions in random order to each respondent"
          value={survey.randomize_questions}
          onChange={(v) => updateField('randomize_questions', v)}
        />

        <Field label="Starts at">
          <input
            type="datetime-local"
            value={toLocalInput(survey.starts_at)}
            onChange={(e) => updateField('starts_at', fromLocalInput(e.target.value))}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
          />
        </Field>
        <Field label="Ends at">
          <input
            type="datetime-local"
            value={toLocalInput(survey.ends_at)}
            onChange={(e) => updateField('ends_at', fromLocalInput(e.target.value))}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
          />
        </Field>

        <Field label="Max responses">
          <input
            type="number"
            min="1"
            value={survey.max_responses}
            onChange={(e) => updateField('max_responses', e.target.value)}
            placeholder="Unlimited"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
          />
        </Field>

        <Field label="Redirect URL after submit">
          <input
            type="url"
            value={survey.redirect_url}
            onChange={(e) => updateField('redirect_url', e.target.value)}
            placeholder="https://…"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
          />
        </Field>
      </div>

      <div className="mt-4">
        <Field label="Thank-you message">
          <textarea
            value={survey.thank_you_message}
            onChange={(e) => updateField('thank_you_message', e.target.value)}
            rows={2}
            placeholder="Shown after a successful submission"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
          />
        </Field>
      </div>
    </div>
  )
}

function toLocalInput(iso) {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return ''
    const pad = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  } catch {
    return ''
  }
}

function fromLocalInput(local) {
  if (!local) return ''
  try {
    return new Date(local).toISOString()
  } catch {
    return ''
  }
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-600 mb-1">{label}</span>
      {children}
    </label>
  )
}

function Toggle({ label, description, value, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="flex items-start gap-3 text-left p-3 rounded-lg border border-slate-200 hover:bg-slate-50"
    >
      <div className={`w-9 h-5 rounded-full transition-colors flex items-center ${value ? 'bg-indigo-600' : 'bg-slate-300'}`}>
        <span className={`w-4 h-4 bg-white rounded-full transform transition-transform mx-0.5 ${value ? 'translate-x-4' : ''}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-900">{label}</p>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
    </button>
  )
}

// ═══════════════════════════════════════════════════════════════════
// Question editor card
// ═══════════════════════════════════════════════════════════════════
function QuestionCard({ index, total, question, onChange, onRemove, onMoveUp, onMoveDown }) {
  const meta = TYPE_META[question.type] || TYPE_META.short_text
  const Icon = meta.icon

  const updateOption = (i, value) => {
    const next = [...(question.options || [])]
    next[i] = value
    onChange({ options: next })
  }

  const addOption = () => {
    onChange({ options: [...(question.options || []), `Option ${(question.options?.length || 0) + 1}`] })
  }

  const removeOption = (i) => {
    onChange({ options: (question.options || []).filter((_, idx) => idx !== i) })
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 hover:border-slate-300">
      <div className="flex items-start gap-3">
        {/* Reorder controls */}
        <div className="flex flex-col gap-1 pt-1">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={index === 0}
            aria-label="Move up"
            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={index === total - 1}
            aria-label="Move down"
            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 min-w-0 space-y-3">
          {/* Type + label row */}
          <div className="flex items-start gap-2">
            <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-xs font-medium">
              <Icon className="w-3.5 h-3.5" />
              {meta.label}
            </div>
            <span className="text-xs text-slate-400 mt-1">Q{index + 1}</span>
          </div>

          <input
            type="text"
            value={question.label}
            onChange={(e) => onChange({ label: e.target.value })}
            placeholder="Question text"
            className="w-full text-base font-medium text-slate-900 placeholder-slate-300 border-0 border-b border-slate-200 focus:border-indigo-500 focus:outline-none bg-transparent pb-1"
          />

          {/* Type-specific editors */}
          {meta.hasOptions && (
            <div className="space-y-2">
              {(question.options || []).map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 w-5">{i + 1}.</span>
                  <input
                    type="text"
                    value={opt}
                    onChange={(e) => updateOption(i, e.target.value)}
                    placeholder={`Option ${i + 1}`}
                    className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                  <button
                    type="button"
                    onClick={() => removeOption(i)}
                    aria-label={`Remove option ${i + 1}`}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addOption}
                className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
              >
                + Add option
              </button>
            </div>
          )}

          {/* Quick previews of non-option types */}
          {question.type === 'rating' && (
            <div className="flex gap-1 pointer-events-none">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star key={n} className="w-6 h-6 text-slate-200" />
              ))}
            </div>
          )}
          {question.type === 'nps' && (
            <div className="flex gap-1 pointer-events-none">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <span key={n} className="w-7 h-7 inline-flex items-center justify-center text-xs border border-slate-200 text-slate-400 rounded">{n}</span>
              ))}
            </div>
          )}

          {/* Required toggle + delete */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <label className="inline-flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={!!question.required}
                onChange={(e) => onChange({ required: e.target.checked })}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/30"
              />
              Required
            </label>
            <button
              type="button"
              onClick={onRemove}
              aria-label="Remove question"
              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// Add question palette
// ═══════════════════════════════════════════════════════════════════
function AddQuestionPalette({ onAdd }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Add a question</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {QUESTION_TYPES.map((t) => {
          const Icon = t.icon
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => onAdd(t.value)}
              className="inline-flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 text-sm text-slate-700 transition-colors"
            >
              <Icon className="w-4 h-4" />
              <span className="truncate">{t.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// Preview modal — renders the survey as a respondent will see it
// ═══════════════════════════════════════════════════════════════════
function PreviewModal({ survey, onClose }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 bg-slate-900/60 z-50 flex items-start justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-2xl my-12 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Preview</p>
            <h2 className="text-base font-semibold text-slate-900">How respondents will see it</h2>
          </div>
          <button onClick={onClose} aria-label="Close preview" className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        <div className="p-6">
          <SurveyRenderer survey={survey} mode="preview" />
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// Shared survey renderer (also used by the public respondent page)
// Exported for reuse.
// ═══════════════════════════════════════════════════════════════════
export function SurveyRenderer({ survey, mode = 'preview', onSubmit }) {
  const [answers, setAnswers] = useState({})
  const [respondent, setRespondent] = useState({ name: '', email: '' })
  const [submitting, setSubmitting] = useState(false)

  const setAnswer = (qid, value) => {
    setAnswers((prev) => ({ ...prev, [qid]: value }))
  }

  const toggleMulti = (qid, opt) => {
    setAnswers((prev) => {
      const cur = Array.isArray(prev[qid]) ? prev[qid] : []
      return {
        ...prev,
        [qid]: cur.includes(opt) ? cur.filter((o) => o !== opt) : [...cur, opt],
      }
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (mode === 'preview') {
      toast('This is a preview — answers are not saved', { icon: '👀' })
      return
    }
    // Validate required
    for (const q of survey.questions || []) {
      if (q.required) {
        const v = answers[q.id]
        if (v == null || v === '' || (Array.isArray(v) && v.length === 0)) {
          toast.error(`"${q.label}" is required`)
          return
        }
      }
    }
    setSubmitting(true)
    try {
      await onSubmit({
        answers,
        respondent_name: respondent.name || null,
        respondent_email: respondent.email || null,
      })
    } finally {
      setSubmitting(false)
    }
  }

  const questions = survey.questions || []

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {survey.logo_url && (
        <img src={survey.logo_url} alt="" className="h-12 mx-auto" />
      )}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-slate-900">{survey.title || 'Untitled Survey'}</h1>
        {survey.description && (
          <p className="text-sm text-slate-600 mt-2">{survey.description}</p>
        )}
      </div>

      {!survey.is_anonymous && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-slate-50 rounded-lg">
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Your name</span>
            <input
              type="text"
              value={respondent.name}
              onChange={(e) => setRespondent({ ...respondent, name: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Your email</span>
            <input
              type="email"
              value={respondent.email}
              onChange={(e) => setRespondent({ ...respondent, email: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
            />
          </label>
        </div>
      )}

      {questions.length === 0 && (
        <p className="text-center text-sm text-slate-400 py-8">This survey has no questions yet.</p>
      )}

      {questions.map((q, idx) => (
        <QuestionInput
          key={q.id}
          index={idx}
          question={q}
          value={answers[q.id]}
          onChange={(v) => setAnswer(q.id, v)}
          onToggleMulti={(opt) => toggleMulti(q.id, opt)}
        />
      ))}

      <button
        type="submit"
        disabled={submitting}
        className="w-full px-4 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg font-medium"
      >
        {submitting ? 'Submitting…' : 'Submit'}
      </button>
    </form>
  )
}

function QuestionInput({ index, question: q, value, onChange, onToggleMulti }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-900 mb-2">
        <span className="text-slate-400 mr-1">{index + 1}.</span>
        {q.label || 'Untitled question'}
        {q.required && <span className="text-red-500 ml-1">*</span>}
      </label>

      {q.type === 'short_text' && (
        <input
          type="text"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
        />
      )}
      {q.type === 'long_text' && (
        <textarea
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
        />
      )}
      {q.type === 'email' && (
        <input
          type="email"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
        />
      )}
      {q.type === 'date' && (
        <input
          type="date"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
        />
      )}
      {q.type === 'dropdown' && (
        <select
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
        >
          <option value="">Select…</option>
          {(q.options || []).map((o, i) => (
            <option key={i} value={o}>{o}</option>
          ))}
        </select>
      )}
      {q.type === 'single_choice' && (
        <div className="space-y-2">
          {(q.options || []).map((o, i) => (
            <label key={i} className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
              <input
                type="radio"
                name={q.id}
                checked={value === o}
                onChange={() => onChange(o)}
                className="text-indigo-600 focus:ring-indigo-500/30"
              />
              <span className="text-sm text-slate-700">{o}</span>
            </label>
          ))}
        </div>
      )}
      {q.type === 'multiple_choice' && (
        <div className="space-y-2">
          {(q.options || []).map((o, i) => (
            <label key={i} className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
              <input
                type="checkbox"
                checked={Array.isArray(value) && value.includes(o)}
                onChange={() => onToggleMulti(o)}
                className="rounded text-indigo-600 focus:ring-indigo-500/30"
              />
              <span className="text-sm text-slate-700">{o}</span>
            </label>
          ))}
        </div>
      )}
      {q.type === 'rating' && (
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              aria-label={`${n} star${n > 1 ? 's' : ''}`}
              className="p-1"
            >
              <Star className={`w-7 h-7 ${value >= n ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}`} />
            </button>
          ))}
        </div>
      )}
      {q.type === 'nps' && (
        <div className="flex flex-wrap gap-1">
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              className={`w-9 h-9 inline-flex items-center justify-center text-sm border rounded font-medium ${
                value === n
                  ? 'bg-indigo-600 border-indigo-600 text-white'
                  : 'border-slate-200 text-slate-600 hover:border-indigo-300'
              }`}
            >{n}</button>
          ))}
        </div>
      )}
    </div>
  )
}
