'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../../lib/supabase'

type CrossRow = {
  work_date: string
  employee_name: string
  primary_branch: string
  actual_branch: string
  check_in_time: string | null
}

function formatTime(ts: string | null) {
  if (!ts) return '-'
  return new Date(ts).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
}

function formatDateTH(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short' })
}

function todayBKK() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date())
}

function daysAgo(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(d)
}

export default function CrossBranchReport() {
  const [rows, setRows] = useState<CrossRow[]>([])
  const [loading, setLoading] = useState(false)
  const [startDate, setStartDate] = useState(daysAgo(29))
  const [endDate, setEndDate] = useState(todayBKK())

  async function load(start: string, end: string) {
    if (typeof window !== 'undefined' && /Line\//i.test(navigator.userAgent)) {
      window.location.href = '/'; return
    }
    setLoading(true)
    const [{ data: employees }, { data: attendance }, { data: branches }] = await Promise.all([
      supabase.from('employees').select('id, name, primary_branch_id'),
      supabase.from('attendance').select('employee_id, work_date, check_in_time, branch_id')
        .gte('work_date', start).lte('work_date', end).not('check_in_time', 'is', null),
      supabase.from('branches').select('id, name'),
    ])

    const bMap: Record<string, string> = {}
    ;(branches ?? []).forEach((b: any) => { bMap[b.id] = b.name })
    const empMap: Record<string, { name: string; primary_branch_id: string }> = {}
    ;(employees ?? []).forEach((e: any) => { empMap[e.id] = { name: e.name, primary_branch_id: e.primary_branch_id } })

    const cross: CrossRow[] = []
    for (const a of (attendance ?? []) as any[]) {
      if (!a.branch_id) continue
      const emp = empMap[a.employee_id]
      if (!emp) continue
      if (a.branch_id !== emp.primary_branch_id) {
        cross.push({
          work_date: a.work_date,
          employee_name: emp.name,
          primary_branch: bMap[emp.primary_branch_id] ?? '-',
          actual_branch: bMap[a.branch_id] ?? a.branch_id,
          check_in_time: a.check_in_time,
        })
      }
    }
    cross.sort((a, b) => b.work_date.localeCompare(a.work_date) || (b.check_in_time ?? '').localeCompare(a.check_in_time ?? ''))
    setRows(cross)
    setLoading(false)
  }

  useEffect(() => { load(startDate, endDate) }, [])

  // Quick preset buttons
  function applyPreset(days: number) {
    const s = daysAgo(days - 1)
    const e = todayBKK()
    setStartDate(s); setEndDate(e)
    load(s, e)
  }

  const byDate = rows.reduce<Record<string, CrossRow[]>>((acc, r) => {
    if (!acc[r.work_date]) acc[r.work_date] = []
    acc[r.work_date].push(r)
    return acc
  }, {})

  const dayCount = Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000) + 1

  return (
    <main className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 pt-6 pb-4 flex items-center gap-3">
        <Link href="/" className="text-gray-400 text-xl">←</Link>
        <div>
          <h1 className="text-lg font-bold text-gray-900">📍 เข้าต่างสาขา</h1>
          <p className="text-xs text-gray-500">เทียบกับสาขาประจำ</p>
        </div>
      </div>

      {/* Date range picker */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 space-y-3">
        {/* Presets */}
        <div className="flex gap-2">
          {[7, 30, 60, 90].map(d => (
            <button
              key={d}
              onClick={() => applyPreset(d)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                dayCount === d ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200'
              }`}
            >
              {d} วัน
            </button>
          ))}
        </div>

        {/* Custom date inputs */}
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={startDate}
            max={endDate}
            onChange={e => setStartDate(e.target.value)}
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700"
          />
          <span className="text-gray-400 text-sm">—</span>
          <input
            type="date"
            value={endDate}
            min={startDate}
            max={todayBKK()}
            onChange={e => setEndDate(e.target.value)}
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700"
          />
          <button
            onClick={() => load(startDate, endDate)}
            className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg font-medium"
          >
            ดู
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center text-gray-400 py-12">กำลังโหลด...</div>
      ) : rows.length === 0 ? (
        <div className="text-center text-gray-400 py-12">
          <div className="text-4xl mb-2">✅</div>
          <div className="text-sm">ไม่มีการเข้าต่างสาขาในช่วงนี้</div>
        </div>
      ) : (
        <div className="px-4 py-4 space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
            <span className="text-sm text-blue-700 font-semibold">เข้าต่างสาขาทั้งหมด {rows.length} ครั้ง</span>
            <span className="text-xs text-blue-400 ml-2">ในช่วง {dayCount} วัน</span>
          </div>
          {Object.entries(byDate).map(([date, list]) => (
            <div key={date}>
              <div className="text-xs font-semibold text-gray-400 mb-2 flex items-center gap-2">
                {formatDateTH(date)}
                <span className="text-gray-300">·</span>
                <span>{list.length} ครั้ง</span>
              </div>
              <div className="space-y-2">
                {list.map((r, i) => (
                  <div key={i} className="bg-white border border-blue-200 rounded-xl px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-gray-900 text-sm">{r.employee_name}</div>
                      <div className="text-xs text-gray-400 font-mono">{formatTime(r.check_in_time)}</div>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs">
                      <span className="text-gray-400">ประจำ:</span>
                      <span className="text-gray-700">{r.primary_branch}</span>
                      <span className="text-gray-300">→</span>
                      <span className="text-blue-600 font-semibold">จริง: {r.actual_branch}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
