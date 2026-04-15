/**
 * PublicSurveyPage — anonymous respondent view at /s/:slug
 *
 * This page is mounted OUTSIDE the authenticated DashboardLayout so anyone
 * can open the share link without logging in. It uses the public endpoints
 * (`surveysAPI.getPublicBySlug` / `submitPublicResponse`) which bypass the
 * 401-redirect interceptor.
 */

import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import toast, { Toaster } from 'react-hot-toast'
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react'

import { surveysAPI } from '../../services/api'
import { SurveyRenderer } from './SurveyBuilderPage'

export default function PublicSurveyPage() {
  const { slug } = useParams()
  const [survey, setSurvey] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [submitted, setSubmitted] = useState(false)
  const [startedAt] = useState(() => new Date().toISOString())

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    surveysAPI
      .getPublicBySlug(slug)
      .then((res) => {
        if (cancelled) return
        setSurvey(res.data)
        setError(null)
      })
      .catch((e) => {
        if (cancelled) return
        setError(e?.response?.data?.detail || 'Survey not available')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [slug])

  const handleSubmit = async (payload) => {
    try {
      const res = await surveysAPI.submitPublicResponse(slug, {
        ...payload,
        is_complete: true,
        started_at: startedAt,
        completed_at: new Date().toISOString(),
        source: 'public_link',
      })
      setSubmitted(true)
      // Honor optional redirect_url
      if (survey?.redirect_url) {
        setTimeout(() => { window.location.href = survey.redirect_url }, 1500)
      }
      return res
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Submission failed. Please try again.')
      throw e
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <Toaster position="top-center" />
      <div className="max-w-2xl mx-auto px-4 py-12">
        {loading && (
          <div className="py-20 text-center text-slate-500">
            <Loader2 className="w-6 h-6 mx-auto mb-2 animate-spin" />
            Loading survey…
          </div>
        )}

        {!loading && error && (
          <div className="bg-white rounded-2xl border border-red-200 p-8 text-center shadow-sm">
            <AlertCircle className="w-12 h-12 mx-auto text-red-400 mb-3" />
            <h1 className="text-lg font-semibold text-slate-900 mb-1">Survey unavailable</h1>
            <p className="text-sm text-slate-500">{error}</p>
          </div>
        )}

        {!loading && !error && survey && submitted && (
          <div className="bg-white rounded-2xl border border-emerald-200 p-10 text-center shadow-sm">
            <CheckCircle className="w-14 h-14 mx-auto text-emerald-500 mb-4" />
            <h1 className="text-xl font-bold text-slate-900 mb-2">Thank you!</h1>
            <p className="text-sm text-slate-600">
              {survey.thank_you_message || 'Your response has been recorded.'}
            </p>
            {survey.redirect_url && (
              <p className="text-xs text-slate-400 mt-4">Redirecting…</p>
            )}
          </div>
        )}

        {!loading && !error && survey && !submitted && (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
            <SurveyRenderer survey={survey} mode="live" onSubmit={handleSubmit} />
          </div>
        )}
      </div>
    </div>
  )
}
