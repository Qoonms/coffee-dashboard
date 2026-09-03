'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

type OTRow = {
  employee_id: string
  employee_name: string
  ot_hours: number
  days: { date: string; hours: number }[]
}

function getMonthRange(year: number, month: number) {
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const last = new Date(year, month, 0).getDate()
  const end = `${year}-${String(month).padStart(2, '0')}-${String(last).padStart(2, '0')}`
  return { start, end }
}

const OT_RATE = 50 // บาทต่อชั่วโมง

export default function OTPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [rows, setRows] = useState<OTRow[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { start, end } = getMonthRange(year, month)

      const { data } = await supabase
        .from('attendance')
        .select('employee_id, work_date, ot_hours, employees(name)')
        .gte('work_date', start)
        .lte('work_date', end)
        .gt('ot_hours', 0)
        .order('work_date')

      const map = new Map<string, OTRow>()
      for (const r of data ?? []) {
        const name = (r as any).employees?.name ?? ''
        if (!map.has(r.employee_id)) {
          map.set(r.employee_id, { employee_id: r.employee_id, employee_name: name, ot_hours: 0, days: [] })
        }
        const entry = map.get(r.employee_id)!
        entry.ot_hours += r.ot_hours
        entry.days.push({ date: r.work_date, hours: r.ot_hours })
      }

      setRows([...map.values()].sort((a, b) => b.ot_hours - a.ot_hours))
      setLoading(false)
    }
    load()
  }, [year, month])

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
  }

  const monthTH = new Date(year, month - 1, 1).toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })
  const totalHours = rows.reduce((s, r) => s + r.ot_hours, 0)
  const totalBaht = totalHours * OT_RATE

  return (
    <main className="min-h-screen bg-white p-4 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">⏱ โอที</h1>
        <p className="text-sm text-gray-500 mt-0.5">สรุปชั่วโมง OT รายเดือน</p>
      </div>

      {/* Month picker */}
      <div className="flex items-center justify-between mb-5">
        <button onClick={prevMonth} className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">←</button>
        <span className="font-semibold text-gray-800">{monthTH}</span>
        <button onClick={nextMonth} className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">→</button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-center">
          <div className="text-3xl font-bold text-orange-600">{totalHours.toFixed(1)}</div>
          <div className="text-xs text-orange-500 mt-1">ชั่วโมง OT รวม</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
          <div className="text-3xl font-bold text-green-700">{totalBaht.toLocaleString()}</div>
          <div className="text-xs text-green-600 mt-1">บาท (฿{OT_RATE}/ชม.)</div>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-gray-400 py-20">กำลังโหลด...</div>
      ) : rows.length === 0 ? (
        <div className="text-center text-gray-400 py-20">
          <div className="text-4xl mb-3">✨</div>
          <div>ไม่มี OT เดือนนี้</div>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map(r => (
            <div key={r.employee_id} className="rounded-2xl border border-gray-100 overflow-hidden">
              <button
                onClick={() => setExpanded(expanded === r.employee_id ? null : r.employee_id)}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="text-left">
                  <div className="font-semibold text-gray-900">{r.employee_name}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{r.days.length} วัน</div>
                </div>
                <div className="text-right flex items-center gap-3">
                  <div>
                    <div className="font-bold text-orange-600">{r.ot_hours.toFixed(1)} ชม.</div>
                    <div className="text-xs text-gray-400">{(r.ot_hours * OT_RATE).toLocaleString()} บาท</div>
                  </div>
                  <span className="text-gray-400 text-sm">{expanded === r.employee_id ? '▲' : '▼'}</span>
                </div>
              </button>

              {expanded === r.employee_id && (
                <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 space-y-2">
                  {r.days.map(d => (
                    <div key={d.date} className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">
                        {new Date(d.date).toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short' })}
                      </span>
                      <span className="font-medium text-orange-600">{d.hours.toFixed(1)} ชม.</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-400 text-center mt-8">อัตรา OT ฿{OT_RATE} ต่อชั่วโมง · กดบัตรพนักงานเพื่อดูรายวัน</p>
    </main>
  )
}
