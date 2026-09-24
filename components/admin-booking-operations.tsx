'use client'

import { useCallback, useEffect, useState } from 'react'

type Booking = { id: string; booking_reference: string; customer_name: string | null; customer_email: string | null; arrival_date: string; duration_days: number; guests: number; accommodation: string | null; transport: string | null; status: string; payment_status: string; currency: string; total_amount: number; created_at: string; safari_packages: { title: string; slug: string } | null }
const statusOptions = ['all', 'inquiry', 'pending', 'confirmed', 'cancelled', 'completed']

export function AdminBookingOperations() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [selected, setSelected] = useState<Booking | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    const params = new URLSearchParams({ q: query })
    if (status !== 'all') params.set('status', status)
    const response = await fetch(`/api/admin/bookings?${params}`)
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) setError(payload.error || 'Unable to load bookings.')
    else setBookings(payload.data || [])
    setLoading(false)
  }, [query, status])

  useEffect(() => { void load() }, [load])

  async function updateStatus(nextStatus: string) {
    if (!selected || !window.confirm(`Move ${selected.booking_reference} to ${nextStatus}?`)) return
    setSaving(true)
    const response = await fetch('/api/admin/bookings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: selected.id, status: nextStatus }) })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) setError(payload.error || 'Unable to update booking.')
    else { setSelected(null); await load() }
    setSaving(false)
  }

  return <section className="dashboard-section admin-booking-operations">
    <div className="section-heading-row"><div><p className="eyebrow">Booking desk</p><h2>Every journey, <i>accounted for.</i></h2></div><button className="outline-button" onClick={() => void load()} disabled={loading}>Refresh</button></div>
    <div className="booking-filters"><label><span className="sr-only">Search bookings</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search reference, name, or email" /></label><label><span className="sr-only">Filter status</span><select value={status} onChange={(event) => setStatus(event.target.value)}>{statusOptions.map((option) => <option key={option} value={option}>{option === 'all' ? 'All statuses' : option}</option>)}</select></label></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    {loading ? <p className="dashboard-muted">Loading booking desk…</p> : bookings.length === 0 ? <p className="dashboard-muted">No bookings match these filters.</p> : <div className="booking-table-wrap"><table className="booking-table"><thead><tr><th>Reference</th><th>Customer</th><th>Safari</th><th>Travel date</th><th>Status</th><th>Payment</th><th>Total</th></tr></thead><tbody>{bookings.map((booking) => <tr key={booking.id} onClick={() => setSelected(booking)} tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter') setSelected(booking) }}><td><strong>{booking.booking_reference}</strong></td><td>{booking.customer_name || booking.customer_email || 'Guest'}</td><td>{booking.safari_packages?.title || 'Safari package'}</td><td>{new Date(`${booking.arrival_date}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</td><td><span className={`status-pill status-${booking.status}`}>{booking.status}</span></td><td><span className={`status-pill status-${booking.payment_status}`}>{booking.payment_status}</span></td><td>{booking.currency} {Number(booking.total_amount).toLocaleString()}</td></tr>)}</tbody></table></div>}
    {selected && <div className="booking-detail" role="dialog" aria-modal="true" aria-label={`Booking ${selected.booking_reference}`}><div className="section-heading-row"><div><p className="eyebrow">Booking detail</p><h3>{selected.booking_reference}</h3></div><button className="text-link" onClick={() => setSelected(null)}>Close</button></div><div className="booking-detail-grid"><p><span>Customer</span><strong>{selected.customer_name || 'Guest'}</strong>{selected.customer_email}</p><p><span>Travel</span><strong>{selected.arrival_date}</strong>{selected.guests} travelers · {selected.duration_days} days</p><p><span>Stay</span><strong>{selected.accommodation || 'Not specified'}</strong>{selected.transport || 'Transport not specified'}</p><p><span>Payment</span><strong>{selected.payment_status}</strong>{selected.currency} {Number(selected.total_amount).toLocaleString()}</p></div><div className="booking-actions"><button className="outline-button" disabled={saving || selected.status !== 'pending'} onClick={() => void updateStatus('cancelled')}>Cancel booking</button><button className="primary-button" disabled={saving || selected.status !== 'confirmed'} onClick={() => void updateStatus('completed')}>Mark completed</button></div></div>}
  </section>
}
