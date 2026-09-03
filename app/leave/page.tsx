'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

type LeaveRequest = {
  id: string
  employee_id: string
  employee_name: string
  leave_type: 'planned' | 'sick'
  start_date: string
  end_date: string
  reason: string | null
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
}

type ChangeRequest = {
  id: string
  employee_id: string
  employee_name: string
  original_date: string
  requested_date: string
  reason: string | null
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
}

function daysBetween(start: string, end: string) {
  const a = new Date(start), b = new Date(end)
  return Math.round((b.getTime() - a.getTime()) / 86400000) + 1
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'approved') return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">✓ อนุมัติแล้ว</span>
  if (status === 'rejected') return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-500">✕ ปฏิเสธแล้ว</span>
  return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">⏳ รออนุมัติ</span>
}

export default function LeavePage() {
  const [tab, setTab] = useState<'leave' | 'change'>('leave')
  const [leaves, setLeaves] = useState<LeaveRequest[]>([])
  const [changes, setChanges] = useState<ChangeRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)

  async function loadData() {
    setLoading(true)
    const [{ data: lv }, { data: ch }] = await Promise.all([
      supabase
        .from('leave_requests')
        .select('id, employee_id, leave_type, start_date, end_date, reason, status, created_at, employees(name)')
        .order('created_at', { ascending: false }),
      supabase
        .from('schedule_change_requests')
        .select('id, employee_id, original_date, requested_date, reason, status, created_at, employees(name)')
        .order('created_at', { ascending: false }),
    ])
    setLeaves((lv ?? []).map((r: any) => ({ ...r, employee_name: r.employees?.name ?? '' })))
    setChanges((ch ?? []).map((r: any) => ({ ...r, employee_name: r.employees?.name ?? '' })))
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  async function actLeave(id: string, status: 'approved' | 'rejected') {
    setActing(id)
    await supabase.from('leave_requests').update({ status, reviewed_at: new Date().toISOString() }).eq('id', id)
    await loadData()
    setActing(null)
  }

  async function actChange(id: string, status: 'approved' | 'rejected') {
    setActing(id)
    await supabase.from('schedule_change_requests').update({ status, reviewed_at: new Date().toISOString() }).eq('id', id)
    await loadData()
    setActing(null)
  }

  const pendingLeave = leaves.filter(r => r.status === 'pending').length
  const pendingChange = changes.filter(r => r.status === 'pending').length

  return (
    <main className="min-h-screen bg-white p-4 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">📋 ใบลา</h1>
        <p className="text-sm text-gray-500 mt-0.5">อนุมัติหรือปฏิเสธคำขอจากพนักงาน</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-5">
        <button
          onClick={() => setTab('leave')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all ${
            tab === 'leave' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
          }`}
        >
          ใบลา {pendingLeave > 0 && <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs ${tab === 'leave' ? 'bg-white text-gray-900' : 'bg-red-500 text-white'}`}>{pendingLeave}</span>}
        </button>
        <button
          onClick={() => setTab('change')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all ${
            tab === 'change' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
          }`}
        >
          ขอเปลี่ยนตาราง {pendingChange > 0 && <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs ${tab === 'change' ? 'bg-white text-gray-900' : 'bg-red-500 text-white'}`}>{pendingChange}</span>}
        </button>
      </div>

      {loading ? (
        <div className="text-center text-gray-400 py-20">กำลังโหลด...</div>
      ) : tab === 'leave' ? (
        leaves.length === 0 ? (
          <Empty text="ยังไม่มีคำขอลา" />
        ) : (
          <div className="space-y-3">
            {leaves.map(r => (
              <div key={r.id} className={`rounded-2xl border p-4 ${r.status === 'pending' ? 'border-yellow-200 bg-yellow-50' : 'border-gray-100 bg-white'}`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="font-semibold text-gray-900">{r.employee_name}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{r.leave_type === 'sick' ? '🤒 ลาป่วย' : '📅 ลาพัก'}</div>
                  </div>
                  <StatusBadge status={r.status} />
                </div>
                <div className="bg-white rounded-xl p-3 border border-gray-100 mb-3">
                  <div className="text-sm text-gray-700">
                    <span className="font-medium">{fmtDate(r.start_date)}</span>
                    {r.start_date !== r.end_date && <> – <span className="font-medium">{fmtDate(r.end_date)}</span></>}
                    <span className="text-gray-400 ml-2">({daysBetween(r.start_date, r.end_date)} วัน)</span>
                  </div>
                  {r.reason && <div className="text-sm text-gray-500 mt-1">"{r.reason}"</div>}
                </div>
                {r.status === 'pending' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => actLeave(r.id, 'rejected')}
                      disabled={acting === r.id}
                      className="flex-1 py-2 rounded-xl border border-red-200 text-red-500 text-sm font-medium hover:bg-red-50 disabled:opacity-50"
                    >ปฏิเสธ</button>
                    <button
                      onClick={() => actLeave(r.id, 'approved')}
                      disabled={acting === r.id}
                      className="flex-1 py-2 rounded-xl bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                    >{acting === r.id ? '...' : 'อนุมัติ'}</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      ) : (
        changes.length === 0 ? (
          <Empty text="ยังไม่มีคำขอเปลี่ยนตาราง" />
        ) : (
          <div className="space-y-3">
            {changes.map(r => (
              <div key={r.id} className={`rounded-2xl border p-4 ${r.status === 'pending' ? 'border-yellow-200 bg-yellow-50' : 'border-gray-100 bg-white'}`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="font-semibold text-gray-900">{r.employee_name}</div>
                  <StatusBadge status={r.status} />
                </div>
                <div className="bg-white rounded-xl p-3 border border-gray-100 mb-3">
                  <div className="text-sm text-gray-700 flex items-center gap-2">
                    <span>วันที่ <span className="font-medium">{fmtDate(r.original_date)}</span></span>
                    <span className="text-gray-400">→</span>
                    <span>เป็น <span className="font-medium">{fmtDate(r.requested_date)}</span></span>
                  </div>
                  {r.reason && <div className="text-sm text-gray-500 mt-1">"{r.reason}"</div>}
                </div>
                {r.status === 'pending' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => actChange(r.id, 'rejected')}
                      disabled={acting === r.id}
                      className="flex-1 py-2 rounded-xl border border-red-200 text-red-500 text-sm font-medium hover:bg-red-50 disabled:opacity-50"
                    >ปฏิเสธ</button>
                    <button
                      onClick={() => actChange(r.id, 'approved')}
                      disabled={acting === r.id}
                      className="flex-1 py-2 rounded-xl bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                    >{acting === r.id ? '...' : 'อนุมัติ'}</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      )}
    </main>
  )
}

function Empty({ text }: { text: string }) {
  return (
    <div className="text-center text-gray-400 py-20">
      <div className="text-4xl mb-3">🎉</div>
      <div>{text}</div>
    </div>
  )
}
