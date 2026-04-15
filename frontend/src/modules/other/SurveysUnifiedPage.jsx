/**
 * SurveysUnifiedPage — single page that merges Overview, Forms and
 * Responses into one tabbed view. Shares one data source across all
 * three tabs and listens to realtime events broadcast by the surveys
 * router (survey.created, survey.updated, survey.deleted,
 * survey.response.created).
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  BarChart3, FileText, MessageSquare, Plus, Search, Edit, Copy, Trash2,
  ChevronDown, ChevronUp, Wifi, WifiOff, ClipboardList, AlertCircle,
  TrendingUp, CheckCircle, X, Share2,
} from 'lucide-react'

import { surveysAPI } from '../../services/api'
import { usePermissions } from '../../hooks/usePermissions'
import { useRealtime, useRealtimeEvent } from '../../contexts/RealtimeContext'

// ═══════════════════════════════════════════════════════════════════
// Tab definitions
// ═══════════════════════════════════════════════════════════════════

const TABS = [
  { id: 'overview',  label: 'Overview',  icon: BarChart3      },
  { id: 'forms',     label: 'Forms',     icon: FileText       },
  { id: 'responses', label: 'Responses', icon: MessageSquare  },
]

// Map a backend survey object to the shape used by the cards.
function mapSurvey(s) {
  return {
    id: s.id,
    name: s.title || s.name || 'Untitled',
    description: s.description || '',
    status: s.status || 'draft',
    slug: s.slug || null,
    fields: Array.isArray(s.questions) ? s.questions.length : (s.field_count || 0),
    responses: s.total_responses ?? s.response_count ?? s.responses ?? 0,
    started: s.total_started ?? 0,
    completion: s.completion_rate ?? 0,
    avgScore: s.avg_nps_score ?? null,
    created: s.created_at ? s.created_at.split('T')[0] : '-',
  }
}

// ═══════════════════════════════════════════════════════════════════
// Main page
// ═══════════════════════════════════════════════════════════════════

export default function SurveysUnifiedPage({ initialTab = 'overview' } = {}) {
  const navigate = useNavigate()
  const { can } = usePermissions()
  const canCreate = can('surveys', 'create')
  const canUpdate = can('surveys', 'update')
  const canDelete = can('surveys', 'delete')

  const { connected } = useRealtime()
  const [searchParams, setSearchParams] = useSearchParams()
  const urlTab = searchParams.get('tab')
  const activeTab = TABS.some((t) => t.id === urlTab) ? urlTab : initialTab
  const setActiveTab = (id) => {
    const next = new URLSearchParams(searchParams)
    if (id === 'overview') next.delete('tab')
    else next.set('tab', id)
    setSearchParams(next, { replace: true })
  }

  // ── Shared survey state ──
  const [surveys, setSurveys] = useState([])
  const [responses, setResponses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // ── Tab-local UI state ──
  const [showCreate, setShowCreate] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedRow, setExpandedRow] = useState(null)

  // ── Loaders ──
  const loadSurveys = useCallback(async () => {
    const res = await surveysAPI.getAll()
    const data = Array.isArray(res.data) ? res.data : res.data?.items || res.data?.surveys || []
    return data.map(mapSurvey)
  }, [])

  const loadResponsesFor = useCallback(async (surveyList) => {
    if (!surveyList.length) return []
    const calls = surveyList.map((s) =>
      surveysAPI
        .getResponses(s.id, { page: 1, page_size: 50 })
        .then((res) => {
          const items = Array.isArray(res.data) ? res.data : res.data?.items || []
          return items.map((r) => ({
            id: r.id,
            survey_id: s.id,
            form: s.name,
            respondent: r.respondent_name || r.respondent_email || 'Anonymous',
            email: r.respondent_email,
            date: r.completed_at || r.created_at || r.started_at,
            score: r.nps_score ?? null,
            answers: r.answers || {},
            is_complete: r.is_complete,
          }))
        })
        .catch(() => []) // tolerate per-survey failure
    )
    const all = await Promise.all(calls)
    return all.flat().sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  }, [])

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await loadSurveys()
      setSurveys(list)
      const resp = await loadResponsesFor(list)
      setResponses(resp)
    } catch (e) {
      setError(e?.response?.data?.detail || e?.message || 'Failed to load surveys')
    } finally {
      setLoading(false)
    }
  }, [loadSurveys, loadResponsesFor])

  useEffect(() => { loadAll() }, [loadAll])

  // ── Realtime: keep state in sync without refetching ──
  useRealtimeEvent('survey.created', (payload) => {
    const mapped = mapSurvey(payload)
    setSurveys((prev) => (prev.some((s) => s.id === mapped.id) ? prev : [mapped, ...prev]))
    toast.success(`New survey: ${mapped.name}`, { icon: '📋' })
  })

  useRealtimeEvent('survey.updated', (payload) => {
    const mapped = mapSurvey(payload)
    setSurveys((prev) => prev.map((s) => (s.id === mapped.id ? mapped : s)))
  })

  useRealtimeEvent('survey.deleted', (payload) => {
    setSurveys((prev) => prev.filter((s) => s.id !== payload.id))
    setResponses((prev) => prev.filter((r) => r.survey_id !== payload.id))
  })

  useRealtimeEvent('survey.response.created', (payload) => {
    const newResp = {
      id: payload.id,
      survey_id: payload.survey_id,
      form: payload.survey_title || 'Survey',
      respondent: payload.respondent_name || payload.respondent_email || 'Anonymous',
      email: payload.respondent_email,
      date: payload.completed_at || payload.created_at || payload.started_at,
      score: payload.nps_score ?? null,
      answers: payload.answers || {},
      is_complete: payload.is_complete,
    }
    setResponses((prev) => (prev.some((r) => r.id === newResp.id) ? prev : [newResp, ...prev]))
    toast.success(`New response: ${newResp.form}`, { icon: '✅' })
  })

  // ── Derived stats for Overview tab ──
  const stats = useMemo(() => {
    const totalSurveys  = surveys.length
    const activeSurveys = surveys.filter((s) => s.status === 'active').length
    const totalResponses = surveys.reduce((sum, s) => sum + (s.responses || 0), 0)
    const totalStarted   = surveys.reduce((sum, s) => sum + (s.started || 0), 0)
    const completionRate = totalStarted > 0
      ? Math.round((totalResponses / totalStarted) * 100)
      : 0
    return { totalSurveys, activeSurveys, totalResponses, completionRate }
  }, [surveys])

  // ── Filtered lists ──
  const filteredForms = useMemo(() => {
    if (!searchQuery.trim()) return surveys
    const q = searchQuery.toLowerCase()
    return surveys.filter((s) =>
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q)
    )
  }, [surveys, searchQuery])

  const filteredResponses = useMemo(() => {
    if (!searchQuery.trim()) return responses
    const q = searchQuery.toLowerCase()
    return responses.filter((r) =>
      r.form.toLowerCase().includes(q) ||
      (r.respondent || '').toLowerCase().includes(q) ||
      (r.email || '').toLowerCase().includes(q)
    )
  }, [responses, searchQuery])

  // ── Mutations ──
  const handleCreate = async (form) => {
    if (!form.title.trim()) {
      toast.error('Survey title is required')
      return false
    }
    try {
      const res = await surveysAPI.create({
        title: form.title,
        description: form.description,
        questions: [],
      })
      toast.success(`Survey "${form.title}" created`)
      // Jump straight to the builder so the user can add questions.
      const newId = res?.data?.id
      if (newId) {
        navigate(`/surveys/${newId}/edit`)
      } else if (!connected) {
        loadAll()
      }
      return true
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Failed to create survey')
      return false
    }
  }

  const handleShare = async (survey) => {
    if (survey.status !== 'active' || !survey.slug) {
      toast.error('Publish the survey first to get a share link')
      return
    }
    const url = `${window.location.origin}/s/${survey.slug}`
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Share link copied')
    } catch {
      toast(url, { duration: 6000 })
    }
  }

  const handleDelete = async (survey) => {
    if (!window.confirm(`Delete "${survey.name}"? This cannot be undone.`)) return
    try {
      await surveysAPI.delete(survey.id)
      toast.success(`Deleted "${survey.name}"`)
      if (!connected) loadAll()
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Cannot delete (only draft surveys are deletable)')
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════════════════════
  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Surveys</h1>
            <span
              title={connected ? 'Real-time updates active' : 'Disconnected'}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                connected
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-slate-50 text-slate-400 border-slate-200'
              }`}
            >
              {connected ? <Wifi className="w-2.5 h-2.5" /> : <WifiOff className="w-2.5 h-2.5" />}
              {connected ? 'Live' : 'Offline'}
            </span>
          </div>
          <p className="text-sm text-slate-500">Build forms, collect responses, analyze feedback</p>
        </div>
        {canCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium shadow-sm"
          >
            <Plus className="w-4 h-4" /> New Survey
          </button>
        )}
      </div>

      {/* ── Tab strip ── */}
      <div role="tablist" aria-label="Survey sections" className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-700">
        {TABS.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                isActive
                  ? 'border-indigo-600 text-indigo-700 dark:text-indigo-400'
                  : 'border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {tab.id === 'forms' && surveys.length > 0 && (
                <span className="ml-1 inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-slate-100 text-slate-600 text-[10px]">{surveys.length}</span>
              )}
              {tab.id === 'responses' && responses.length > 0 && (
                <span className="ml-1 inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-slate-100 text-slate-600 text-[10px]">{responses.length}</span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── Loading / Error ── */}
      {loading && (
        <div className="py-16 text-center text-sm text-slate-500">Loading surveys…</div>
      )}
      {error && (
        <div className="p-4 rounded-lg border border-red-200 bg-red-50 flex items-center gap-2 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {/* ── Tab content ── */}
      {!loading && !error && activeTab === 'overview' && (
        <OverviewTab stats={stats} surveys={surveys} onJump={setActiveTab} />
      )}

      {!loading && !error && activeTab === 'forms' && (
        <FormsTab
          forms={filteredForms}
          searchQuery={searchQuery}
          onSearch={setSearchQuery}
          canUpdate={canUpdate}
          canDelete={canDelete}
          onDelete={handleDelete}
          onEdit={(f) => navigate(`/surveys/${f.id}/edit`)}
          onShare={handleShare}
        />
      )}

      {!loading && !error && activeTab === 'responses' && (
        <ResponsesTab
          responses={filteredResponses}
          searchQuery={searchQuery}
          onSearch={setSearchQuery}
          expandedRow={expandedRow}
          onToggleRow={setExpandedRow}
        />
      )}

      {/* ── Create modal ── */}
      {showCreate && (
        <CreateSurveyModal
          onClose={() => setShowCreate(false)}
          onCreated={async (form) => {
            const ok = await handleCreate(form)
            if (ok) setShowCreate(false)
          }}
        />
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// Overview Tab
// ═══════════════════════════════════════════════════════════════════
function OverviewTab({ stats, surveys, onJump }) {
  const cards = [
    { label: 'Total Surveys',    value: stats.totalSurveys,    icon: ClipboardList, color: 'indigo'  },
    { label: 'Active',           value: stats.activeSurveys,   icon: CheckCircle,   color: 'emerald' },
    { label: 'Total Responses',  value: stats.totalResponses,  icon: MessageSquare, color: 'amber'   },
    { label: 'Completion Rate',  value: `${stats.completionRate}%`, icon: TrendingUp, color: 'rose'   },
  ]
  const colorMap = {
    indigo:  'bg-indigo-100 text-indigo-600',
    emerald: 'bg-emerald-100 text-emerald-600',
    amber:   'bg-amber-100 text-amber-600',
    rose:    'bg-rose-100 text-rose-600',
  }

  const top = [...surveys].sort((a, b) => (b.responses || 0) - (a.responses || 0)).slice(0, 5)

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => {
          const Icon = c.icon
          return (
            <div key={c.label} className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between mb-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorMap[c.color]}`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{c.value}</p>
              <p className="text-xs text-slate-500 mt-1">{c.label}</p>
            </div>
          )
        })}
      </div>

      {/* Top performing surveys */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Top Performing Surveys</h2>
          <button onClick={() => onJump('forms')} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">View all →</button>
        </div>
        {top.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-500">No surveys yet — create one to get started.</div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-700/60">
            {top.map((s) => (
              <li key={s.id} className="px-5 py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{s.name}</p>
                  <p className="text-xs text-slate-500">{s.fields} field{s.fields === 1 ? '' : 's'} · {s.status}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-slate-900 dark:text-white">{s.responses}</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">responses</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// Forms Tab
// ═══════════════════════════════════════════════════════════════════
function FormsTab({ forms, searchQuery, onSearch, canUpdate, canDelete, onDelete, onEdit, onShare }) {
  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search forms…"
          className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
        />
      </div>

      {forms.length === 0 ? (
        <div className="py-16 text-center bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
          <FileText className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p className="text-sm text-slate-500">No forms match your search</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {forms.map((f) => (
            <div key={f.id} className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <FileText className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-slate-900 dark:text-white truncate">{f.name}</h3>
                    <span className={`inline-block mt-0.5 text-[10px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider ${
                      f.status === 'active'
                        ? 'bg-emerald-100 text-emerald-700'
                        : f.status === 'paused'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-slate-100 text-slate-600'
                    }`}>{f.status}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center mb-4">
                <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-2">
                  <p className="text-lg font-bold text-slate-900 dark:text-white">{f.responses}</p>
                  <p className="text-[10px] text-slate-500 uppercase">Responses</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-2">
                  <p className="text-lg font-bold text-slate-900 dark:text-white">{f.fields}</p>
                  <p className="text-[10px] text-slate-500 uppercase">Fields</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-2">
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{f.created}</p>
                  <p className="text-[10px] text-slate-500 uppercase">Created</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {canUpdate && (
                  <button
                    onClick={() => onEdit(f)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-medium hover:bg-indigo-100"
                  >
                    <Edit className="w-3.5 h-3.5" /> Edit
                  </button>
                )}
                {f.status === 'active' && (
                  <button
                    onClick={() => onShare(f)}
                    aria-label={`Share ${f.name}`}
                    title="Copy public share link"
                    className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50"
                  >
                    <Share2 className="w-4 h-4 text-slate-500" />
                  </button>
                )}
                {canDelete && (
                  <button
                    onClick={() => onDelete(f)}
                    aria-label={`Delete ${f.name}`}
                    className="p-2 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// Responses Tab
// ═══════════════════════════════════════════════════════════════════
function ResponsesTab({ responses, searchQuery, onSearch, expandedRow, onToggleRow }) {
  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search responses…"
          className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
        />
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-x-auto">
        {responses.length === 0 ? (
          <div className="py-16 text-center">
            <MessageSquare className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p className="text-sm text-slate-500">No responses yet</p>
          </div>
        ) : (
          <table className="w-full min-w-[640px]">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr>
                <th className="py-3 px-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider w-8"></th>
                <th className="py-3 px-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Form</th>
                <th className="py-3 px-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Respondent</th>
                <th className="py-3 px-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Date</th>
                <th className="py-3 px-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Score</th>
              </tr>
            </thead>
            <tbody>
              {responses.map((r) => {
                const isExpanded = expandedRow === r.id
                return (
                  <Row
                    key={r.id}
                    response={r}
                    isExpanded={isExpanded}
                    onToggle={() => onToggleRow(isExpanded ? null : r.id)}
                  />
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function Row({ response: r, isExpanded, onToggle }) {
  const dateLabel = r.date ? new Date(r.date).toLocaleString() : '—'
  return (
    <>
      <tr
        onClick={onToggle}
        className="border-t border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer"
      >
        <td className="py-3 px-4">
          {isExpanded
            ? <ChevronUp className="w-4 h-4 text-slate-400" />
            : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </td>
        <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">{r.form}</td>
        <td className="py-3 px-4 text-sm text-slate-600 dark:text-slate-400">
          <div>{r.respondent}</div>
          {r.email && r.email !== r.respondent && (
            <div className="text-xs text-slate-400">{r.email}</div>
          )}
        </td>
        <td className="py-3 px-4 text-sm text-slate-500">{dateLabel}</td>
        <td className="py-3 px-4">
          {r.score != null ? (
            <span className={`px-2 py-1 rounded text-xs font-bold ${
              r.score >= 9 ? 'bg-emerald-100 text-emerald-700'
                : r.score >= 7 ? 'bg-amber-100 text-amber-700'
                  : 'bg-red-100 text-red-700'
            }`}>{r.score}</span>
          ) : (
            <span className="text-xs text-slate-400">—</span>
          )}
        </td>
      </tr>
      {isExpanded && (
        <tr className="bg-slate-50 dark:bg-slate-900/50">
          <td colSpan={5} className="px-8 py-4">
            {Object.keys(r.answers).length === 0 ? (
              <p className="text-xs text-slate-500">No answer data available.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Object.entries(r.answers).map(([key, val]) => (
                  <div key={key} className="bg-white dark:bg-slate-800 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
                    <p className="text-xs font-medium text-slate-500 mb-1">{key}</p>
                    <p className="text-sm text-slate-900 dark:text-white break-words">
                      {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════
// Create modal
// ═══════════════════════════════════════════════════════════════════
function CreateSurveyModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ title: '', description: '' })
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    await onCreated(form)
    setSubmitting(false)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md shadow-xl"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">New Survey</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Title <span className="text-red-500">*</span></span>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Customer Satisfaction Q2"
              autoFocus
              required
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Description</span>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              placeholder="Optional — what is this survey for?"
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            />
          </label>
          <p className="text-xs text-slate-500">
            Questions can be added in the survey builder after creation.
          </p>
        </div>
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
          >
            {submitting ? 'Creating…' : 'Create Survey'}
          </button>
        </div>
      </form>
    </div>
  )
}
