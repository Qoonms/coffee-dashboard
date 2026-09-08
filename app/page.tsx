'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabase'

type Row = {
  employee_id: string
  employee_name: string
  scheduled_branch_id: string
  scheduled_branch_name: string
  shift_start: string | null
  shift_end: string | null
  schedule_status: string
  is_ot: boolean
  check_in_time: string | null
  check_out_time: string | null
  actual_branch_id: string | null
  actual_branch_name: string | null
}

function formatTime(ts: string | null) {
  if (!ts) return null
  return new Date(ts).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
}

function lateMinutes(checkIn: string | null, shiftStart: string | null): number {
  if (!checkIn || !shiftStart) return 0
  const ci = new Date(checkIn)
  const [h, m] = shiftStart.split(':').map(Number)
  const deadline = new Date(ci)
  deadline.setHours(h, m + 15, 0, 0) // 15 min grace
  if (ci <= deadline) return 0
  const shiftDeadline = new Date(ci)
  shiftDeadline.setHours(h, m, 0, 0)
  return Math.round((ci.getTime() - shiftDeadline.getTime()) / 60000)
}

function isLate(checkIn: string | null, shiftStart: string | null): boolean {
  return lateMinutes(checkIn, shiftStart) > 0
}

function isCrossBranch(actualBranchId: string | null, scheduledBranchId: string): boolean {
  if (!actualBranchId) return false
  return actualBranchId !== scheduledBranchId
}

export default function Home() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [branchMap, setBranchMap] = useState<Record<string, string>>({})

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date())
  const todayTH = new Date().toLocaleDateString('th-TH', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })

  useEffect(() => {
    // Redirect LINE app users to check-in page
    if (typeof window !== 'undefined' && /Line\//i.test(navigator.userAgent)) {
      window.location.href = '/teamployhr'
      return
    }
    async function load() {
      const [{ data: schedules }, { data: attendance }, { data: branches }] = await Promise.all([
        supabase.from('schedules').select('employee_id, status, is_ot, branch_id, shift_start, shift_end, employees(name), branches(name)').eq('work_date', today),
        supabase.from('attendance').select('employee_id, check_in_time, check_out_time, branch_id').eq('work_date', today),
        supabase.from('branches').select('id, name'),
      ])

      const bMap: Record<string, string> = {}
      ;(branches ?? []).forEach((b: any) => { bMap[b.id] = b.name })
      setBranchMap(bMap)

      const attMap = new Map((attendance ?? []).map((a: any) => [a.employee_id, a]))

      const merged: Row[] = (schedules ?? []).map((s: any) => {
        const att = attMap.get(s.employee_id)
        return {
          employee_id: s.employee_id,
          employee_name: s.employees?.name ?? '',
          scheduled_branch_id: s.branch_id ?? '',
          scheduled_branch_name: s.branches?.name ?? '',
          shift_start: s.shift_start ?? null,
          shift_end: s.shift_end ?? null,
          schedule_status: s.status,
          is_ot: s.is_ot ?? false,
          check_in_time: att?.check_in_time ?? null,
          check_out_time: att?.check_out_time ?? null,
          actual_branch_id: att?.branch_id ?? null,
          actual_branch_name: att?.branch_id ? bMap[att.branch_id] ?? null : null,
        }
      })

      setRows(merged)
      setLoading(false)
    }
    load()
  }, [today])

  const working = rows.filter(r => r.schedule_status === 'working' && !r.is_ot)
  const otRows = rows.filter(r => r.is_ot)
  const checkedIn = working.filter(r => r.check_in_time)
  const notYet = working.filter(r => !r.check_in_time)
  const onLeave = rows.filter(r => r.schedule_status !== 'working')
  const lateRows = checkedIn.filter(r => isLate(r.check_in_time, r.shift_start))
  const crossRows = checkedIn.filter(r => isCrossBranch(r.actual_branch_id, r.scheduled_branch_id))

  return (
    <main className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-white border-b border-gray-100 px-6 pt-6 pb-4">
        <h1 className="text-xl font-bold text-gray-900">☕ ภาพรวมวันนี้</h1>
        <p className="text-xs text-gray-500 mt-0.5">{todayTH}</p>
      </div>

      {/* Overview banner */}
      <div className="px-4 pt-4">
        <div className="flex items-center justify-between bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3">
          <div>
            <span className="font-semibold text-sm text-indigo-800">📊 ภาพรวมวันนี้</span>
            <div className="text-xs text-indigo-500 mt-0.5">พนักงานเช็คอินแล้ว {checkedIn.length} / {working.length} คน</div>
          </div>
          <Link href="/teamployhr" className="text-xs text-indigo-400 underline">หน้าพนักงาน →</Link>
        </div>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-4 gap-2 p-4">
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-green-700">{checkedIn.length}</div>
          <div className="text-xs text-green-600 mt-0.5">เช็คอินแล้ว</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-red-600">{notYet.length}</div>
          <div className="text-xs text-red-500 mt-0.5">ยังไม่มา</div>
        </div>
        <Link href="/reports/late" className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-center block active:opacity-70">
          <div className="text-2xl font-bold text-orange-600">{lateRows.length}</div>
          <div className="text-xs text-orange-500 mt-0.5">มาสาย</div>
          <div className="text-xs text-orange-300 mt-0.5">15 วัน →</div>
        </Link>
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-purple-600">{otRows.filter(r => r.check_in_time).length}</div>
          <div className="text-xs text-purple-500 mt-0.5">โอที</div>
        </div>
      </div>

      {/* Report shortcuts - always visible */}
      <div className="grid grid-cols-2 gap-2 px-4 pb-2">
        <Link href="/reports/late" className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-xl px-3 py-2.5 active:opacity-70">
          <span className="text-lg">⏰</span>
          <div>
            <div className="text-xs font-semibold text-orange-700">รายงานมาสาย</div>
            <div className="text-xs text-orange-400">ย้อนหลัง 15 วัน →</div>
          </div>
        </Link>
        <Link href="/reports/cross" className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2.5 active:opacity-70">
          <span className="text-lg">📍</span>
          <div>
            <div className="text-xs font-semibold text-blue-700">เข้าต่างสาขา</div>
            <div className="text-xs text-blue-400">ย้อนหลัง 15 วัน →</div>
          </div>
        </Link>
      </div>

      {loading ? (
        <div className="text-center text-gray-400 py-12">กำลังโหลด...</div>
      ) : rows.length === 0 ? (
        <div className="text-center text-gray-400 py-12">
          <div className="text-4xl mb-2">📅</div>
          <div className="text-sm">ยังไม่มีตารางงานวันนี้</div>
        </div>
      ) : (
        <div className="px-4 space-y-4">

          {/* Alerts */}
          {(lateRows.length > 0 || crossRows.length > 0) && (
            <div className="space-y-2">
              {lateRows.map(r => (
                <div key={'late-'+r.employee_id} className="flex items-center gap-3 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
                  <span className="text-lg">⏰</span>
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-gray-900 text-sm">{r.employee_name}</span>
                    <span className="text-orange-600 text-xs ml-2">มาสาย</span>
                  </div>
                  <div className="text-xs text-gray-500 font-mono shrink-0 text-right">
                    <div>กะ {r.shift_start?.slice(0,5)}</div>
                    <div>เข้า {formatTime(r.check_in_time)}</div>
                    <div className="text-orange-600 font-semibold">สาย {lateMinutes(r.check_in_time, r.shift_start)} นาที</div>
                  </div>
                </div>
              ))}
              {crossRows.map(r => (
                <div key={'cross-'+r.employee_id} className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                  <span className="text-lg">📍</span>
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-gray-900 text-sm">{r.employee_name}</span>
                    <span className="text-blue-600 text-xs ml-2">เข้าต่างสาขา</span>
                  </div>
                  <div className="text-xs text-gray-500 shrink-0 text-right">
                    <div>ตาราง: {r.scheduled_branch_name}</div>
                    <div className="text-blue-600">จริง: {r.actual_branch_name ?? '-'}</div>
                  </div>
                </div>
              ))}
              {crossRows.length > 0 && (
                <Link href="/reports/cross" className="block text-center text-xs text-blue-500 py-1 underline">ดูประวัติต่างสาขา 15 วัน →</Link>
              )}
            </div>
          )}

          {/* Working employees */}
          <div>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">พนักงานประจำ</div>
            <div className="space-y-2">
              {working.map(r => (
                <div key={r.employee_id} className={`flex items-center justify-between p-3 rounded-xl border bg-white ${
                  !r.check_in_time ? 'border-red-200' : isLate(r.check_in_time, r.shift_start) ? 'border-orange-200' : 'border-green-200'
                }`}>
                  <div className="min-w-0">
                    <div className="font-semibold text-gray-900 text-sm">{r.employee_name}</div>
                    <div className="text-xs text-gray-400">{r.scheduled_branch_name}{r.shift_start ? ` · ${r.shift_start.slice(0,5)}–${r.shift_end?.slice(0,5) ?? ''}` : ''}</div>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    {r.check_in_time ? (
                      <>
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">✓ เช็คอิน</span>
                        <div className="text-xs text-gray-400 mt-0.5 font-mono">
                          {formatTime(r.check_in_time)}{r.check_out_time ? ` → ${formatTime(r.check_out_time)}` : ''}
                        </div>
                        {isLate(r.check_in_time, r.shift_start) && (
                          <div className="text-xs text-orange-500 font-semibold">สาย {lateMinutes(r.check_in_time, r.shift_start)} นาที</div>
                        )}
                        {r.actual_branch_name && r.actual_branch_id !== r.scheduled_branch_id && (
                          <div className="text-xs text-blue-500">📍 {r.actual_branch_name}</div>
                        )}
                      </>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-600">⚠ ยังไม่มา</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* OT */}
          {otRows.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">โอที</div>
              <div className="space-y-2">
                {otRows.map(r => (
                  <div key={r.employee_id} className="flex items-center justify-between p-3 rounded-xl border bg-purple-50 border-purple-200">
                    <div>
                      <div className="font-semibold text-gray-900 text-sm">{r.employee_name}</div>
                      <div className="text-xs text-gray-400">{r.scheduled_branch_name}</div>
                    </div>
                    <div className="text-right">
                      {r.check_in_time ? (
                        <>
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">⏱ OT</span>
                          <div className="text-xs text-gray-400 mt-0.5 font-mono">
                            {formatTime(r.check_in_time)}{r.check_out_time ? ` → ${formatTime(r.check_out_time)}` : ''}
                          </div>
                        </>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">รอเช็คอิน</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* On leave */}
          {onLeave.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">วันหยุด / ลา</div>
              <div className="space-y-2">
                {onLeave.map(r => (
                  <div key={r.employee_id} className="flex items-center justify-between p-3 rounded-xl border bg-gray-50 border-gray-200 opacity-60">
                    <div>
                      <div className="font-semibold text-gray-700 text-sm">{r.employee_name}</div>
                      <div className="text-xs text-gray-400">{r.scheduled_branch_name}</div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-200 text-gray-500">
                      {r.schedule_status === 'sick' ? '🤒 ลาป่วย' : '🌴 หยุด'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}
    </main>
  )
}
