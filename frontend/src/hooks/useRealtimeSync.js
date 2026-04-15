/**
 * useRealtimeSync — Auto-refresh CRM data when WebSocket events arrive
 *
 * Usage in any page:
 *
 *   const { data, loading, refetch } = useRealtimeSync({
 *     fetchFn: () => companiesAPI.getAll({ limit: 100 }),
 *     events: ['company.created', 'company.updated', 'company.deleted'],
 *     mapFn: (items) => items.map(c => ({ id: c.id, name: c.name, ... })),
 *   })
 *
 * When any listed event arrives via WebSocket, it auto-refetches from API.
 * Also provides a manual refetch() for pull-to-refresh.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRealtimeEvent } from '../contexts/RealtimeContext'
import toast from 'react-hot-toast'

export default function useRealtimeSync({
  fetchFn,
  events = [],
  mapFn = (data) => data,
  toastOnEvent = true,
  debounceMs = 500,
}) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const debounceRef = useRef(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const refetch = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetchFn()
      if (!mountedRef.current) return
      const raw = res.data
      const items = Array.isArray(raw) ? raw : raw?.items || raw?.results || []
      setData(mapFn(items))
    } catch (err) {
      if (!mountedRef.current) return
      setError(err.response?.data?.detail || err.message || 'Failed to load data')
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [fetchFn, mapFn])

  // Initial fetch
  useEffect(() => { refetch() }, [refetch])

  // Debounced refetch on WS event
  const debouncedRefetch = useCallback((payload, envelope) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      refetch()
      if (toastOnEvent && envelope?.type) {
        const [entity, action] = (envelope.type || '').split('.')
        const name = payload?.name || payload?.title || payload?.subject || ''
        const label = entity.charAt(0).toUpperCase() + entity.slice(1)
        if (action === 'created') toast(`New ${label} added${name ? `: ${name}` : ''}`, { icon: '🔔' })
        else if (action === 'updated') toast(`${label} updated${name ? `: ${name}` : ''}`, { icon: '🔄' })
        else if (action === 'deleted') toast(`${label} deleted`, { icon: '🗑️' })
      }
    }, debounceMs)
  }, [refetch, toastOnEvent, debounceMs])

  // Subscribe to each event
  for (const event of events) {
    useRealtimeEvent(event, debouncedRefetch)
  }

  return { data, loading, error, refetch, setData }
}
