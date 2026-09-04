'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

const START_HOUR = 7
const END_HOUR = 16

function getDaysAgo(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}

function minutesLate(checkIn: string): number {
  const d = new Date(checkIn)
  const start = new Date(d)
  start.setHours(6, 59, 0, 0)
  return Math.max(0, Math.round((d.getTime() - start.getTime()) / 60000))
}

function minutesEarly(checkOut: string): number {
  const d = new Date(checkOut)
  const end = new Date(d)
  end.setHours(END_HOUR, 0, 0, 0)
  return Math.max(0, Math.round((end.getTime() - d.getTime()) / 60000))
}

type LateRow = { name: string; work_date: string; check_in_time: string; minutes: number }
type EarlyRow = { name: string; work_date: string; check_out_time: string; minutes: number }
type BranchRow = { name: string; work_date: string; branch_name: string; primary_branch: string; is_ot: boolean }
type Tab = 'late' | 'early' | 'branch'

export default function ReportsPage() {
  const [lateRows, setLateRows] = useState<LateRow[]>([])
  const [earlyRows, setEarlyRows] = useState<EarlyRow[]>([])
  const [branchRows, setBranchRows] = useState<BranchRow[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('late')

  useEffect(() => {
    async function load() {
      const from15 = getDaysAgo(15)
      const from30 = getDaysAgo(30)
      const today = new Date().toISOString().split('T')[0]

      const { data: att15 } = await supabase
        .from('attendance')
        .select('employee_id, work_date, check_in_time, check_out_time, employees(name)')
        .gte('work_date', from15)
        .lte('work_date', today)

      const { data: sched15 } = await supabase
        .from('schedules')
        .select('employee_id, work_date, shift_start, shift_end')
        .gte('work_date', from15)
        .lte('work_date', today)

      function getShiftStart(emp_id: string, work_date: string): number {
        const s = sched15?.find(x => x.employee_id === emp_id && x.work_date === work_date)
        if (s?.shift_start) return parseInt(s.shift_start.split(':')[0]) * 60 + parseInt(s.shift_start.split(':')[1])
        return START_HOUR * 60
      }
      function getShiftEnd(emp_id: string, work_date: string): number {
        const s = sched15?.find(x => x.employee_id === emp_id && x.work_date === work_date)
        if (s?.shift_end) return parseInt(s.shift_end.split(':')[0]) * 60 + parseInt(s.shift_end.split(':')[1])
        return END_HOUR * 60
      }

      // Late
      const late: LateRow[] = []
      for (const a of att15 ?? []) {
        if (!a.check_in_time) continue
        const d = new Date(a.check_in_time)
        const checkInMins = d.getHours() * 60 + d.getMinutes()
        const startMins = getShiftStart(a.employee_id, a.work_date)
        const diff = checkInMins - (startMins - 1)
        if (diff > 0) late.push({ name: (a.employees as any)?.name ?? '-', work_date: a.work_date, check_in_time: a.check_in_time, minutes: diff })
      }
      late.sort((a, b) => b.work_date.localeCompare(a.work_date))
      setLateRows(late)

      // Early checkout
      const early: EarlyRow[] = []
      for (const a of att15 ?? []) {
        if (!a.check_out_time) continue
        const d = new Date(a.check_out_time)
        const checkOutMins = d.getHours() * 60 + d.getMinutes()
        const endMins = getShiftEnd(a.employee_id, a.work_date)
        const diff = endMins - checkOutMins
        if (diff > 0) early.push({ name: (a.employees as any)?.name ?? '-', work_date: a.work_date, check_out_time: a.check_out_time, minutes: diff })
      }
      early.sort((a, b) => b.work_date.localeCompare(a.work_date))
      setEarlyRows(early)

      // Cross branch
      const { data: att30 } = await supabase
        .from('attendance')
        .select('employee_id, work_date, branch_id, employees(name, primary_branch_id, branches!employees_primary_branch_id_fkey(name)), branches(name)')
        .gte('work_date', from30)
        .lte('work_date', today)

      const { data: scheds } = await supabase
        .from('schedules')
        .select('employee_id, work_date, is_ot')
        .gte('work_date', from30)
        .lte('work_date', today)

      const cross: BranchRow[] = []
      for (const a of att30 ?? []) {
        const emp = a.employees as any
        const primaryId = emp?.primary_branch_id
        if (a.branch_id && primaryId && a.branch_id !== primaryId) {
          const sched = scheds?.find(s => s.employee_id === a.employee_id && s.work_date === a.work_date)
          cross.push({ name: emp?.name ?? '-', work_date: a.work_date, branch_name: (a.branches as any)?.name ?? a.branch_id, primary_branch: emp?.branches?.name ?? '-', is_ot: sched?.is_ot ?? false })
        }
      }
      cross.sort((a, b) => b.work_date.localeCompare(a.work_date))
      setBranchRows(cross)

      setLoading(false)
    }
    load()
  }, [])

  const fmt = (d: string) => new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
  const fmtTime = (t: string) => new Date(t).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })

  const tabBtn = (id: Tab, label: string) => (
    <button onClick={() => setTab(id)} className={`flex-1 py-2 rounded-lg text-sm font-medium ${tab === id ? 'bg-gray-900 text-white' : 'bg-white border text-gray-600'}`}>
      {label}
    </button>
  )

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-xl font-bold text-gray-800 mb-4">📊 รายงาน</h1>

        <div className="flex gap-2 mb-4">
          {tabBtn('late', '⏰ มาสาย (15 วัน)')}
          {tabBtn('early', '🚪 ออกก่อน (15 วัน)')}
          {tabBtn('branch', '🏪 ต่างสาขา (30 วัน)')}
        </div>

        {loading ? (
          <div className="text-center text-gray-400 py-10">กำลังโหลด...</div>
        ) : tab === 'late' ? (
          lateRows.length === 0 ? (
            <div className="text-center text-gray-400 py-10">✅ ไม่มีพนักงานมาสายใน 15 วันที่ผ่านมา</div>
          ) : (
            <div className="space-y-2">
              {lateRows.map((r, i) => (
                <div key={i} className="bg-white rounded-xl p-4 flex items-center justify-between shadow-sm">
                  <div>
                    <div className="font-medium text-gray-800">{r.name}</div>
                    <div className="text-xs text-gray-400">{fmt(r.work_date)} · เข้า {fmtTime(r.check_in_time)}</div>
                  </div>
                  <span className="text-red-500 font-bold text-sm">สาย {r.minutes} นาที</span>
                </div>
              ))}
            </div>
          )
        ) : tab === 'early' ? (
          earlyRows.length === 0 ? (
            <div className="text-center text-gray-400 py-10">✅ ไม่มีพนักงานออกก่อนเวลาใน 15 วันที่ผ่านมา</div>
          ) : (
            <div className="space-y-2">
              {earlyRows.map((r, i) => (
                <div key={i} className="bg-white rounded-xl p-4 flex items-center justify-between shadow-sm">
                  <div>
                    <div className="font-medium text-gray-800">{r.name}</div>
                    <div className="text-xs text-gray-400">{fmt(r.work_date)} · ออก {fmtTime(r.check_out_time)}</div>
                  </div>
                  <span className="text-orange-500 font-bold text-sm">ก่อนเวลา {r.minutes} นาที</span>
                </div>
              ))}
            </div>
          )
        ) : (
          branchRows.length === 0 ? (
            <div className="text-center text-gray-400 py-10">✅ ไม่มีพนักงานไปต่างสาขาใน 30 วันที่ผ่านมา</div>
          ) : (
            <div className="space-y-2">
              {branchRows.map((r, i) => (
                <div key={i} className="bg-white rounded-xl p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-800">{r.name}</div>
                      <div className="text-xs text-gray-400">{fmt(r.work_date)}</div>
                    </div>
                    {r.is_ot && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-medium">โอที</span>}
                  </div>
                  <div className="mt-2 text-xs text-gray-500">
                    <span className="text-gray-400">สาขาหลัก:</span> {r.primary_branch} → <span className="text-blue-600 font-medium">{r.branch_name}</span>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  )
}
