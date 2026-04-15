/**
 * Audit Logs — Quotation action history (admin-only view)
 */

import { useState, useEffect } from 'react'
import { Shield, FileText, Clock, User } from 'lucide-react'
import { quotationAPI } from '../../services/api'

const actionColors = {
  created: 'bg-green-100 text-green-700 border-green-200',
  updated: 'bg-blue-100 text-blue-700 border-blue-200',
  pdf_generated: 'bg-purple-100 text-purple-700 border-purple-200',
  sent: 'bg-amber-100 text-amber-700 border-amber-200',
  status_changed: 'bg-orange-100 text-orange-700 border-orange-200',
  deleted: 'bg-red-100 text-red-700 border-red-200',
  revised: 'bg-indigo-100 text-indigo-700 border-indigo-200',
}

const actionIcons = {
  created: '🆕',
  updated: '✏️',
  pdf_generated: '📄',
  sent: '📤',
  status_changed: '🔄',
  deleted: '🗑️',
  revised: '📋',
}

export default function AuditLogs() {
  const [quotationId, setQuotationId] = useState('')
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(false)
  const [allQuotations, setAllQuotations] = useState([])

  useEffect(() => {
    async function loadQuotations() {
      try {
        const res = await quotationAPI.getAll({ page_size: 100 })
        setAllQuotations(res.data?.items || [])
      } catch {
        // fallback
      }
    }
    loadQuotations()
  }, [])

  const loadLogs = async (id) => {
    if (!id) return
    setLoading(true)
    try {
      const res = await quotationAPI.getLogs(id)
      setLogs(res.data?.items || [])
    } catch {
      setLogs([])
    } finally {
      setLoading(false)
    }
  }

  const handleSelect = (id) => {
    setQuotationId(id)
    loadLogs(id)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Shield className="w-6 h-6 text-amber-600" /> Audit Logs
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Track who did what on every quotation</p>
      </div>

      {/* Quotation Selector */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Select Quotation</label>
        <select value={quotationId} onChange={e => handleSelect(e.target.value)}
          className="w-full md:w-96 px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white">
          <option value="">Choose a quotation...</option>
          {allQuotations.map(q => (
            <option key={q.id} value={q.id}>Q-{q.id} — {q.project_name} (Rs. {(q.total_amount || 0).toLocaleString('en-IN')})</option>
          ))}
        </select>
      </div>

      {/* Logs Timeline */}
      {loading ? (
        <div className="text-center py-8 text-slate-500">Loading logs...</div>
      ) : logs.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8 text-center text-slate-500">
          <FileText className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p>{quotationId ? 'No logs found for this quotation' : 'Select a quotation to view its audit trail'}</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <div className="space-y-4">
            {logs.map(log => (
              <div key={log.id} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${actionColors[log.action]?.split(' ')[0] || 'bg-slate-100'}`}>
                    {actionIcons[log.action] || '📝'}
                  </div>
                  <div className="w-px flex-1 bg-slate-200 dark:bg-slate-700 mt-2" />
                </div>
                <div className="flex-1 pb-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${actionColors[log.action] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                      {log.action}
                    </span>
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <User className="w-3 h-3" /> User #{log.user_id}
                    </span>
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {log.created_at ? new Date(log.created_at).toLocaleString() : '—'}
                    </span>
                  </div>
                  {log.details && Object.keys(log.details).length > 0 && (
                    <div className="mt-1 text-xs text-slate-500 bg-slate-50 dark:bg-slate-700/50 rounded-lg p-2 font-mono">
                      {JSON.stringify(log.details, null, 2)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
