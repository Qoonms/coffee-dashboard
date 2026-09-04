'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type EmployeeRow = {
  employee_id: string
  employee_name: string
  branch_name: string
  schedule_status: string
  check_in_time: string | null
  check_out_time: string | null
}

function formatTime(ts: string | null) {
  if (!ts) return null
  return new Date(ts).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
}

function StatusBadge({ row }: { row: EmployeeRow }) {
  if (row.schedule_status === 'leave' || row.schedule_status === 'sick') {
    return (
      <span className="px-2 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">
        🌟 วันหยุด
      </span>
    )
  }
  if (row.check_in_time) {
    return (
      <span className="px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
        ✓ เช็คอินแล้ว
      </span>
    )
  }
  return (
    <span className="px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-600">
      ⚠ ยังไม่เช็คอิน
    </span>
  )
}

export default function Home() {
  const [rows, setRows] = useState<EmployeeRow[]>([])
  const [loading, setLoading] = useState(true)

  const today = new Date().toISOString().split('T')[0]
  const todayTH = new Date().toLocaleDateString('th-TH', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })

  useEffect(() => {
    async function load() {
      const { data: schedules } = await supabase
        .from('schedules')
        .select('employee_id, status, employees(name), branches(name)')
        .eq('work_date', today)

      const { data: attendance } = await supabase
        .from('attendance')
        .select('employee_id, check_in_time, check_out_time')
        .eq('work_date', today)

      const attMap = new Map((attendance ?? []).map(a => [a.employee_id, a]))

      const merged: EmployeeRow[] = (schedules ?? []).map((s: any) => ({
        employee_id: s.employee_id,
        employee_name: s.employees?.name ?? '',
        branch_name: s.branches?.name ?? '',
        schedule_status: s.status,
        check_in_time: attMap.get(s.employee_id)?.check_in_time ?? null,
        check_out_time: attMap.get(s.employee_id)?.check_out_time ?? null,
      }))

      setRows(merged)
      setLoading(false)
    }
    load()
  }, [today])

  const working = rows.filter(r => r.schedule_status === 'working')
  const checkedIn = working.filter(r => r.check_in_time)
  const notYet = working.filter(r => !r.check_in_time)
  const onLeave = rows.filter(r => r.schedule_status !== 'working')

  return (
    <main className="min-h-screen bg-white p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">☕ ภาพรวมวันนี้</h1>
        <p className="text-sm text-gray-500 mt-1">{todayTH}</p>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
          <div className="text-3xl font-bold text-green-700">{checkedIn.length}</div>
          <div className="text-xs text-green-600 mt-1">เช็คอินแล้ว</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
          <div className="text-3xl font-bold text-red-600">{notYet.length}</div>
          <div className="text-xs text-red-500 mt-1">ยังไม่เช็คอิน</div>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
          <div className="text-3xl font-bold text-gray-500">{onLeave.length}</div>
          <div className="text-xs text-gray-400 mt-1">วันหยุด</div>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-gray-400 py-12">กำลังโหลด...</div>
      ) : rows.length === 0 ? (
        <div className="text-center text-gray-400 py-12">
          <div className="text-4xl mb-2">📅</div>
          <div>ยังไม่มีตารางงานวันนี้</div>
          <div className="text-xs mt-1">เจ้าของต้องสร้างตารางงานก่อนครับ</div>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map(row => (
            <div
              key={row.employee_id}
              className={`flex items-center justify-between p-4 rounded-xl border ${
                row.schedule_status !== 'working'
                  ? 'bg-gray-50 border-gray-200 opacity-60'
                  : row.check_in_time
                  ? 'bg-white border-green-200'
                  : 'bg-red-50 border-red-200'
              }`}
            >
              <div>
                <div className="font-semibold text-gray-900">{row.employee_name}</div>
                <div className="text-sm text-gray-500">{row.branch_name}</div>
              </div>
              <div className="text-right">
                <StatusBadge row={row} />
                {row.check_in_time && (
                  <div className="text-xs text-gray-400 mt-1 font-mono">
                    เข้า {formatTime(row.check_in_time)}
                    {row.check_out_time && (() => { const out = new Date(row.check_out_time!); const early = out.getHours() < 16; return <span className={early ? 'text-red-500 font-semibold' : ''}> · ออก {formatTime(row.check_out_time)}{early ? ' ⚠ ออกก่อนเวลา' : ''}</span> })()}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="mt-6 text-center">
        <a href="/reports" className="inline-block px-6 py-3 rounded-xl bg-gray-900 text-white text-sm font-medium">📊 รายงานมาสาย / ต่างสาขา</a>
      </div>
    </main>
  )
}
