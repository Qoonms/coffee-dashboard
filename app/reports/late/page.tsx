'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../../lib/supabase'

type LateRow = {
  work_date: string
  employee_name: string
  branch_name: string
  shift_start: string | null
  check_in_time: string | null
  late_minutes: number
}

function formatTime(ts: string | null) {
  if (!ts) return '-'
  return new Date(ts).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
}

function lateMinutes(checkIn: string | null, shiftStart: string | null): number {
  if (!checkIn || !shiftStart) return 0
  const ci = new Date(checkIn)
  const [h, m] = shiftStart.split(':').map(Number)
  const deadline = new Date(ci)
  deadline.setHours(h, m + 15, 0, 0)
  if (ci <= deadline) return 0
  const shiftDeadline = new Date(ci)
  shiftDeadline.setHours(h, m, 0, 0)
  return Math.round((ci.getTime() - shiftDeadline.getTime()) / 60000)
}

function formatDateTH(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short' })
}

export default function LateReport() {
  const [rows, setRows] = useState<LateRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const end = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date())
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - 14)
      const start = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(startDate)

      const [{ data: schedules }, { data: attendance }] = await Promise.all([
        supabase.from('schedules').select('employee_id, work_date, shift_start, branch_id, employees(name), branches(name)')
          .gte('work_date', start).lte('work_date', end).eq('status', 'working'),
        supabase.from('attendance').select('employee_id, work_date, check_in_time')
          .gte('work_date', start).lte('work_date', end),
      ])

      const attData: Record<string, any> = {}
      ;(attendance ?? []).forEach((a: any) => { attData[`${a.employee_id}_${a.work_date}`] = a })

      const late: LateRow[] = []
      for (const s of (schedules ?? []) as any[]) {
        const key = `${s.employee_id}_${s.work_date}`
        const att = attData[key]
        if (!att?.check_in_time) continue
        const mins = lateMinutes(att.check_in_time, s.shift_start)
        if (mins > 0) {
          late.push({
            work_date: s.work_date,
            employee_name: s.employees?.name ?? '',
            branch_name: s.branches?.name ?? '',
            shift_start: s.shift_start,
            check_in_time: att.check_in_time,
            late_minutes: mins,
          })
        }
      }

      late.sort((a, b) => b.work_date.localeCompare(a.work_date) || b.late_minutes - a.late_minutes)
      setRows(late)
      setLoading(false)
    }
    load()
  }, [])

  const byDate = rows.reduce<Record<string, LateRow[]>>((acc, r) => {
    if (!acc[r.work_date]) acc[r.work_date] = []
    acc[r.work_date].push(r)
    return acc
  }, {})

  return (
    <main className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-white border-b border-gray-100 px-4 pt-6 pb-4 flex items-center gap-3">
        <Link href="/" className="text-gray-400 text-xl">←</Link>
        <div>
          <h1 className="text-lg font-bold text-gray-900">⏰ รายงานมาสาย</h1>
          <p className="text-xs text-gray-500">ย้อนหลัง 15 วัน</p>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-gray-400 py-12">กำลังโหลด...</div>
      ) : rows.length === 0 ? (
        <div className="text-center text-gray-400 py-12">
          <div className="text-4xl mb-2">✅</div>
          <div className="text-sm">ไม่มีพนักงานมาสายใน 15 วันที่ผ่านมา</div>
        </div>
      ) : (
        <div className="px-4 py-4 space-y-4">
          <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-orange-700 font-semibold">มาสายทั้งหมด {rows.length} ครั้ง</span>
            <span className="text-xs text-orange-500">รวม {rows.reduce((s, r) => s + r.late_minutes, 0)} นาที</span>
          </div>
          {Object.entries(byDate).map(([date, list]) => (
            <div key={date}>
              <div className="text-xs font-semibold text-gray-400 mb-2">{formatDateTH(date)}</div>
              <div className="space-y-2">
                {list.map((r, i) => (
                  <div key={i} className="bg-white border border-orange-200 rounded-xl px-4 py-3 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-gray-900 text-sm">{r.employee_name}</div>
                      <div className="text-xs text-gray-400">{r.branch_name} · กะ {r.shift_start?.slice(0, 5)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-orange-600 font-bold text-sm">สาย {r.late_minutes} นาที</div>
                      <div className="text-xs text-gray-400 font-mono">เข้า {formatTime(r.check_in_time)}</div>
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
