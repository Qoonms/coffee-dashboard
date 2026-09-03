'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

type Employee = {
  id: string
  name: string
  primary_branch_id: string | null
}

type Schedule = {
  id: string
  employee_id: string
  branch_id: string
  work_date: string
  status: 'working' | 'leave' | 'sick'
}

type Branch = {
  id: string
  name: string
}

const STATUS_LABEL: Record<string, string> = {
  working: 'ทำงาน',
  leave: 'หยุด',
  sick: 'ลาป่วย',
}

const STATUS_STYLE: Record<string, string> = {
  working: 'bg-green-100 text-green-700 border-green-200',
  leave:   'bg-red-100 text-red-600 border-red-200',
  sick:    'bg-yellow-100 text-yellow-700 border-yellow-200',
}

function getWeekDates(base: Date) {
  const day = base.getDay() // 0=Sun
  const mon = new Date(base)
  mon.setDate(base.getDate() - ((day + 6) % 7))
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon)
    d.setDate(mon.getDate() + i)
    return d
  })
}

function fmt(d: Date) {
  return d.toISOString().split('T')[0]
}

const DAY_TH = ['จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.', 'อา.']

export default function SchedulePage() {
  const [weekBase, setWeekBase] = useState(new Date())
  const [employees, setEmployees] = useState<Employee[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [modal, setModal] = useState<{ emp: Employee; date: Date; current: Schedule | null } | null>(null)
  const [modalBranch, setModalBranch] = useState('')
  const [modalStatus, setModalStatus] = useState<'working' | 'leave' | 'sick'>('working')

  const days = getWeekDates(weekBase)
  const weekStart = fmt(days[0])
  const weekEnd = fmt(days[6])

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [{ data: emps }, { data: brs }, { data: schs }] = await Promise.all([
        supabase.from('employees').select('id, name, primary_branch_id').eq('is_active', true).order('name'),
        supabase.from('branches').select('id, name').order('name'),
        supabase.from('schedules').select('id, employee_id, branch_id, work_date, status')
          .gte('work_date', weekStart).lte('work_date', weekEnd),
      ])
      setEmployees(emps ?? [])
      setBranches(brs ?? [])
      setSchedules(schs ?? [])
      setLoading(false)
    }
    load()
  }, [weekStart, weekEnd])

  function getSchedule(empId: string, date: Date) {
    return schedules.find(s => s.employee_id === empId && s.work_date === fmt(date)) ?? null
  }

  function openModal(emp: Employee, date: Date) {
    const current = getSchedule(emp.id, date)
    setModal({ emp, date, current })
    setModalStatus(current?.status ?? 'working')
    setModalBranch(current?.branch_id ?? emp.primary_branch_id ?? (branches[0]?.id ?? ''))
  }

  async function saveSchedule() {
    if (!modal) return
    setSaving(`${modal.emp.id}-${fmt(modal.date)}`)
    const existing = modal.current

    if (existing) {
      await supabase.from('schedules').update({
        status: modalStatus,
        branch_id: modalBranch,
      }).eq('id', existing.id)
    } else {
      await supabase.from('schedules').insert({
        employee_id: modal.emp.id,
        branch_id: modalBranch,
        work_date: fmt(modal.date),
        status: modalStatus,
      })
    }

    // reload schedules
    const { data: schs } = await supabase.from('schedules').select('id, employee_id, branch_id, work_date, status')
      .gte('work_date', weekStart).lte('work_date', weekEnd)
    setSchedules(schs ?? [])
    setSaving(null)
    setModal(null)
  }

  async function deleteSchedule() {
    if (!modal?.current) return
    setSaving(`${modal.emp.id}-${fmt(modal.date)}`)
    await supabase.from('schedules').delete().eq('id', modal.current.id)
    const { data: schs } = await supabase.from('schedules').select('id, employee_id, branch_id, work_date, status')
      .gte('work_date', weekStart).lte('work_date', weekEnd)
    setSchedules(schs ?? [])
    setSaving(null)
    setModal(null)
  }

  const today = fmt(new Date())

  return (
    <main className="min-h-screen bg-white p-4 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">📅 ตารางงาน</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {days[0].toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })} –{' '}
            {days[6].toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { const d = new Date(weekBase); d.setDate(d.getDate() - 7); setWeekBase(d) }}
            className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50"
          >← สัปดาห์ก่อน</button>
          <button
            onClick={() => setWeekBase(new Date())}
            className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50"
          >วันนี้</button>
          <button
            onClick={() => { const d = new Date(weekBase); d.setDate(d.getDate() + 7); setWeekBase(d) }}
            className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50"
          >สัปดาห์ถัดไป →</button>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-gray-400 py-20">กำลังโหลด...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="text-left p-3 text-sm font-medium text-gray-500 w-32">พนักงาน</th>
                {days.map((d, i) => (
                  <th key={i} className={`p-2 text-center text-sm font-medium w-24 ${
                    fmt(d) === today ? 'text-blue-600' : 'text-gray-500'
                  }`}>
                    <div>{DAY_TH[i]}</div>
                    <div className={`text-lg font-bold ${fmt(d) === today ? 'text-blue-600' : 'text-gray-800'}`}>
                      {d.getDate()}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {employees.map(emp => (
                <tr key={emp.id} className="border-t border-gray-100">
                  <td className="p-3">
                    <div className="font-medium text-gray-800 text-sm">{emp.name}</div>
                  </td>
                  {days.map((d, i) => {
                    const sch = getSchedule(emp.id, d)
                    const key = `${emp.id}-${fmt(d)}`
                    const isToday = fmt(d) === today
                    return (
                      <td key={i} className={`p-1.5 text-center ${isToday ? 'bg-blue-50' : ''}`}>
                        <button
                          onClick={() => openModal(emp, d)}
                          disabled={saving === key}
                          className={`w-full py-1.5 px-1 rounded-lg border text-xs font-medium transition-all hover:opacity-80 ${
                            sch ? STATUS_STYLE[sch.status] : 'bg-gray-50 text-gray-300 border-dashed border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          {saving === key ? '...' : sch ? (
                            <span className="flex flex-col leading-tight">
                              <span>{STATUS_LABEL[sch.status]}</span>
                              {sch.status === 'working' && sch.branch_id && (
                                <span className="text-[10px] opacity-70 truncate">
                                  {branches.find(b => b.id === sch.branch_id)?.name ?? ''}
                                </span>
                              )}
                            </span>
                          ) : '+'}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      <div className="flex gap-4 mt-6 flex-wrap">
        {Object.entries(STATUS_LABEL).map(([k, v]) => (
          <div key={k} className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className={`px-2 py-0.5 rounded border text-xs font-medium ${STATUS_STYLE[k]}`}>{v}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <span className="px-2 py-0.5 rounded border border-dashed border-gray-200 text-xs">+</span>
          ยังไม่มีตาราง (กดเพื่อเพิ่ม)
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setModal(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="font-bold text-gray-900 text-lg mb-1">{modal.emp.name}</h2>
            <p className="text-sm text-gray-500 mb-5">
              {modal.date.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>

            <div className="mb-4">
              <label className="text-sm font-medium text-gray-700 mb-2 block">สถานะ</label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(STATUS_LABEL).map(([k, v]) => (
                  <button
                    key={k}
                    onClick={() => setModalStatus(k as any)}
                    className={`py-2 px-3 rounded-xl border text-sm font-medium transition-all ${
                      modalStatus === k ? STATUS_STYLE[k] + ' ring-2 ring-offset-1 ring-current' : 'bg-gray-50 text-gray-500 border-gray-200'
                    }`}
                  >{v}</button>
                ))}
              </div>
            </div>

            {modalStatus === 'working' && (
              <div className="mb-5">
                <label className="text-sm font-medium text-gray-700 mb-2 block">สาขา</label>
                <select
                  value={modalBranch}
                  onChange={e => setModalBranch(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-gray-300"
                >
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex gap-2">
              {modal.current && (
                <button
                  onClick={deleteSchedule}
                  className="flex-1 py-2.5 rounded-xl border border-red-200 text-red-500 text-sm font-medium hover:bg-red-50"
                >ลบ</button>
              )}
              <button
                onClick={() => setModal(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50"
              >ยกเลิก</button>
              <button
                onClick={saveSchedule}
                className="flex-1 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-700"
              >บันทึก</button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
