'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../../lib/supabase'

type CrossRow = {
  work_date: string
  employee_name: string
  scheduled_branch: string
  actual_branch: string
  check_in_time: string | null
}

function formatTime(ts: string | null) {
  if (!ts) return '-'
  return new Date(ts).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
}

function formatDateTH(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short' })
}

export default function CrossBranchReport() {
  const [rows, setRows] = useState<CrossRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Reports pages don't support LIFF - redirect LINE users to dashboard
    if (typeof window !== 'undefined' && /Line\//i.test(navigator.userAgent)) {
      window.location.href = '/'
      return
    }
    async function load() {
      const end = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date())
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - 14)
      const start = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(startDate)

      const [{ data: schedules }, { data: attendance }, { data: branches }] = await Promise.all([
        supabase.from('schedules').select('employee_id, work_date, branch_id, employees(name), branches(name)')
          .gte('work_date', start).lte('work_date', end).eq('status', 'working'),
        supabase.from('attendance').select('employee_id, work_date, check_in_time, branch_id')
          .gte('work_date', start).lte('work_date', end),
        supabase.from('branches').select('id, name'),
      ])

      const bMap: Record<string, string> = {}
      ;(branches ?? []).forEach((b: any) => { bMap[b.id] = b.name })

      const attData: Record<string, any> = {}
      ;(attendance ?? []).forEach((a: any) => { attData[`${a.employee_id}_${a.work_date}`] = a })

      const cross: CrossRow[] = []
      for (const s of (schedules ?? []) as any[]) {
        const key = `${s.employee_id}_${s.work_date}`
        const att = attData[key]
        if (!att?.check_in_time || !att?.branch_id) continue
        if (att.branch_id !== s.branch_id) {
          cross.push({
            work_date: s.work_date,
            employee_name: s.employees?.name ?? '',
            scheduled_branch: s.branches?.name ?? bMap[s.branch_id] ?? '-',
            actual_branch: bMap[att.branch_id] ?? att.branch_id,
            check_in_time: att.check_in_time,
          })
        }
      }

      cross.sort((a, b) => b.work_date.localeCompare(a.work_date))
      setRows(cross)
      setLoading(false)
    }
    load()
  }, [])

  const byDate = rows.reduce<Record<string, CrossRow[]>>((acc, r) => {
    if (!acc[r.work_date]) acc[r.work_date] = []
    acc[r.work_date].push(r)
    return acc
  }, {})

  return (
    <main className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-white border-b border-gray-100 px-4 pt-6 pb-4 flex items-center gap-3">
        <Link href="/" className="text-gray-400 text-xl">←</Link>
        <div>
          <h1 className="text-lg font-bold text-gray-900">📍 เข้าต่างสาขา</h1>
          <p className="text-xs text-gray-500">ย้อนหลัง 15 วัน</p>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-gray-400 py-12">กำลังโหลด...</div>
      ) : rows.length === 0 ? (
        <div className="text-center text-gray-400 py-12">
          <div className="text-4xl mb-2">✅</div>
          <div className="text-sm">ไม่มีการเข้าต่างสาขาใน 15 วันที่ผ่านมา</div>
        </div>
      ) : (
        <div className="px-4 py-4 space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
            <span className="text-sm text-blue-700 font-semibold">เข้าต่างสาขาทั้งหมด {rows.length} ครั้ง</span>
          </div>
          {Object.entries(byDate).map(([date, list]) => (
            <div key={date}>
              <div className="text-xs font-semibold text-gray-400 mb-2">{formatDateTH(date)}</div>
              <div className="space-y-2">
                {list.map((r, i) => (
                  <div key={i} className="bg-white border border-blue-200 rounded-xl px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-gray-900 text-sm">{r.employee_name}</div>
                      <div className="text-xs text-gray-400 font-mono">{formatTime(r.check_in_time)}</div>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs">
                      <span className="text-gray-400">ตาราง:</span>
                      <span className="text-gray-700">{r.scheduled_branch}</span>
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
