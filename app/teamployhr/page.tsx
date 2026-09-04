'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'

declare global { interface Window { liff: any } }

const LIFF_ID = process.env.NEXT_PUBLIC_LIFF_ID ?? ''

type Tab = 'checkin' | 'schedule' | 'leave' | 'shift'

type Employee = {
  id: string
  name: string
  primary_branch_id: string | null
  line_user_id: string | null
}

type Branch = { id: string; name: string; latitude: number | null; longitude: number | null; radius_meters: number | null }
type Schedule = { id: string; work_date: string; status: string; branch_id: string }
type Attendance = { id: string; work_date: string; check_in_time: string | null; check_out_time: string | null }

const STATUS_LABEL: Record<string, string> = { working: 'ทำงาน', leave: 'หยุด', sick: 'ลาป่วย' }
const STATUS_COLOR: Record<string, string> = { working: '#16a34a', leave: '#dc2626', sick: '#d97706' }

function fmt(d: Date) { return d.toISOString().split('T')[0] }
const today = fmt(new Date())

function getWeekDates() {
  const base = new Date()
  const day = base.getDay()
  const mon = new Date(base)
  mon.setDate(base.getDate() - ((day + 6) % 7))
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(mon); d.setDate(mon.getDate() + i); return d })
}

const DAY_TH = ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา']

export default function LiffPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lineUser, setLineUser] = useState<{ userId: string; displayName: string; pictureUrl?: string } | null>(null)
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [isOwner, setIsOwner] = useState(false)
  const [ownerName, setOwnerName] = useState('')
  const [tab, setTab] = useState<Tab>('checkin')
  const [branches, setBranches] = useState<Branch[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [todayAtt, setTodayAtt] = useState<Attendance | null>(null)
  const [checking, setChecking] = useState(false)
  const [checkMsg, setCheckMsg] = useState('')
  const [leaveStart, setLeaveStart] = useState(today)
  const [leaveEnd, setLeaveEnd] = useState(today)
  const [leaveReason, setLeaveReason] = useState('')
  const [shiftDate, setShiftDate] = useState(today)
  const [shiftToDate, setShiftToDate] = useState(today)
  const [shiftReason, setShiftReason] = useState('')
  const [submitMsg, setSubmitMsg] = useState('')

  // Load LIFF
  useEffect(() => {
    async function init() {
      try {
        if (!window.liff) {
          await new Promise<void>((res) => {
            const s = document.createElement('script')
            s.src = 'https://static.line-scdn.net/liff/edge/versions/2.22.3/sdk.js'
            s.onload = () => res()
            document.head.appendChild(s)
          })
        }
        await window.liff.init({ liffId: LIFF_ID })
        if (!window.liff.isLoggedIn()) { window.liff.login(); return }
        const profile = await window.liff.getProfile()
        setLineUser({ userId: profile.userId, displayName: profile.displayName, pictureUrl: profile.pictureUrl })

        // Match employee
        const { data: emp } = await supabase.from('employees').select('id, name, primary_branch_id, line_user_id').eq('line_user_id', profile.userId).single()
        if (!emp) {
          const { data: owner } = await supabase.from('owners').select('id, name').eq('line_user_id', profile.userId).single()
          if (owner) { setIsOwner(true); setOwnerName(owner.name) }
        }
        if (emp) {
          setEmployee(emp)
          // Load branches, schedules, attendance
          const week = getWeekDates()
          const [{ data: brs }, { data: schs }, { data: att }] = await Promise.all([
            supabase.from('branches').select('id, name, latitude, longitude, radius_meters'),
            supabase.from('schedules').select('id, work_date, status, branch_id').eq('employee_id', emp.id).gte('work_date', fmt(week[0])).lte('work_date', fmt(week[6])),
            supabase.from('attendance').select('id, work_date, check_in_time, check_out_time').eq('employee_id', emp.id).eq('work_date', today).maybeSingle(),
          ])
          setBranches(brs ?? [])
          setSchedules(schs ?? [])
          setTodayAtt(att)
        }
      } catch (e: any) {
        setError(e.message ?? 'เกิดข้อผิดพลาด')
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  // Check-in / Check-out
  async function handleCheckIn() {
    if (!employee) return
    setChecking(true); setCheckMsg('')
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude: lat, longitude: lng } = pos.coords
      // Find today's schedule branch
      const todaySch = schedules.find(s => s.work_date === today)
      const branch = branches.find(b => b.id === todaySch?.branch_id)

      // GPS check (if branch has coordinates)
      if (branch?.latitude && branch?.longitude && branch?.radius_meters) {
        const dist = Math.sqrt(Math.pow((lat - branch.latitude) * 111000, 2) + Math.pow((lng - branch.longitude) * 111000, 2))
        if (dist > (branch.radius_meters ?? 200)) {
          setCheckMsg(`❌ คุณอยู่ห่างจากสาขา ${Math.round(dist)} เมตร (รัศมี ${branch.radius_meters} เมตร)`)
          setChecking(false); return
        }
      }

      // Auto-create schedule if not exists
      if (!todaySch) {
        await supabase.from('schedules').insert({ employee_id: employee.id, work_date: today, branch_id: employee.primary_branch_id, status: 'present' })
      }

      if (!todayAtt) {
        const { error } = await supabase.from('attendance').insert({ employee_id: employee.id, work_date: today, check_in_time: new Date().toISOString(), check_in_lat: lat, check_in_lng: lng, branch_id: todaySch?.branch_id ?? employee.primary_branch_id })
        if (error) { setCheckMsg('❌ ' + error.message) }
        else {
          const { data: att } = await supabase.from('attendance').select('id, work_date, check_in_time, check_out_time').eq('employee_id', employee.id).eq('work_date', today).maybeSingle()
          setTodayAtt(att)
          setCheckMsg('✅ เช็คอินสำเร็จ!')
        }
      } else {
        const { error } = await supabase.from('attendance').update({ check_out_time: new Date().toISOString(), check_out_lat: lat, check_out_lng: lng }).eq('id', todayAtt.id)
        if (error) { setCheckMsg('❌ ' + error.message) }
        else {
          setTodayAtt({ ...todayAtt, check_out_time: new Date().toISOString() })
          setCheckMsg('✅ เช็คเอาท์สำเร็จ!')
        }
      }
      setChecking(false)
    }, (err) => { setCheckMsg('❌ ไม่สามารถเข้าถึง GPS: ' + err.message); setChecking(false) })
  }

  async function submitLeave() {
    if (!employee) return
    setSubmitMsg('')
    const { error } = await supabase.from('leave_requests').insert({ employee_id: employee.id, start_date: leaveStart, end_date: leaveEnd, reason: leaveReason, status: 'pending' })
    setSubmitMsg(error ? '❌ ' + error.message : '✅ ส่งใบลาเรียบร้อยแล้ว')
    if (!error) { setLeaveReason('') }
  }

  async function submitShift() {
    if (!employee) return
    setSubmitMsg('')
    const { error } = await supabase.from('schedule_change_requests').insert({ employee_id: employee.id, original_date: shiftDate, requested_date: shiftToDate, reason: shiftReason, status: 'pending' })
    setSubmitMsg(error ? '❌ ' + error.message : '✅ ส่งคำขอเปลี่ยนกะเรียบร้อยแล้ว')
    if (!error) { setShiftReason('') }
  }

  if (loading) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center text-gray-400">
        <div className="text-4xl mb-3">☕</div>
        <div className="text-sm">กำลังโหลด...</div>
      </div>
    </div>
  )

  if (error) return (
    <div className="min-h-screen bg-white flex items-center justify-center p-6">
      <div className="text-center text-red-500 text-sm">{error}</div>
    </div>
  )

  if (!employee) return (
    <div className="min-h-screen bg-white flex items-center justify-center p-6">
      <div className="text-center">
        {lineUser?.pictureUrl && <img src={lineUser.pictureUrl} className="w-16 h-16 rounded-full mx-auto mb-3" />}
        <div className="font-bold text-gray-800 mb-2">{isOwner ? ownerName : lineUser?.displayName}</div>
        {isOwner ? (
          <div className="w-full">
            <div className="text-sm text-amber-600 font-medium mb-5">👑 เจ้าของร้าน</div>
            <a href="https://coffee-mgmt.vercel.app" className="block w-full py-3 rounded-xl bg-gray-900 text-white text-sm font-medium text-center mb-2">🏠 หน้าหลัก</a>
            <a href="https://coffee-mgmt.vercel.app/schedule" className="block w-full py-3 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium text-center mb-2">📅 ตารางงาน</a>
            <a href="https://coffee-mgmt.vercel.app/teamployhr" className="block w-full py-3 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium text-center">⏱ เช็คอิน/เช็คเอาท์</a>
          </div>
        ) : (
          <div>
            <div className="text-sm text-gray-500 mb-4">ยังไม่ได้ลงทะเบียนในระบบ<br/>กรุณาติดต่อผู้จัดการ</div>
            <div className="text-xs text-gray-300">Line ID: {lineUser?.userId}</div>
          </div>
        )}
      </div>
    </div>
  )

  const week = getWeekDates()
  const todayBranch = branches.find(b => b.id === schedules.find(s => s.work_date === today)?.branch_id)

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-md mx-auto">
      {/* Header */}
      <div className="bg-white px-4 pt-4 pb-3 border-b border-gray-100">
        <div className="flex items-center gap-3">
          {lineUser?.pictureUrl && <img src={lineUser.pictureUrl} className="w-9 h-9 rounded-full" />}
          <div>
            <div className="font-bold text-gray-800 text-sm">{employee.name}</div>
            <div className="text-xs text-gray-400">{todayBranch?.name ?? 'ไม่มีตาราง'} · วันนี้</div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-20">

        {/* CHECK-IN TAB */}
        {tab === 'checkin' && (
          <div className="p-4 space-y-4">
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <div className="text-center mb-5">
                <div className="text-xs text-gray-400 mb-1">{new Date().toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
                {todayAtt?.check_in_time && (
                  <div className="text-sm text-gray-600">เข้างาน {new Date(todayAtt.check_in_time).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</div>
                )}
                {todayAtt?.check_out_time && (
                  <div className="text-sm text-gray-600">ออกงาน {new Date(todayAtt.check_out_time).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</div>
                )}
              </div>

              {!todayAtt?.check_out_time && (
                <button
                  onClick={handleCheckIn}
                  disabled={checking}
                  className={`w-full py-4 rounded-2xl font-bold text-white text-lg transition-all ${
                    todayAtt?.check_in_time ? 'bg-red-500 active:bg-red-600' : 'bg-green-500 active:bg-green-600'
                  } ${checking ? 'opacity-60' : ''}`}
                >
                  {checking ? '...' : todayAtt?.check_in_time ? '🚪 เช็คเอาท์' : '✅ เช็คอิน'}
                </button>
              )}
              {todayAtt?.check_out_time && (
                <div className="text-center text-green-600 font-medium py-3">เสร็จงานแล้ววันนี้ 🎉</div>
              )}
              {checkMsg && <div className="mt-3 text-center text-sm">{checkMsg}</div>}
            </div>

            {todayBranch && (
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="text-xs text-gray-400 mb-1">สาขาวันนี้</div>
                <div className="font-semibold text-gray-800">{todayBranch.name}</div>
              </div>
            )}
          </div>
        )}

        {/* SCHEDULE TAB */}
        {tab === 'schedule' && (
          <div className="p-4">
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="px-4 pt-4 pb-2 border-b border-gray-50">
                <div className="font-semibold text-gray-800 text-sm">ตารางงานสัปดาห์นี้</div>
              </div>
              <div className="divide-y divide-gray-50">
                {week.map((d, i) => {
                  const sch = schedules.find(s => s.work_date === fmt(d))
                  const branch = branches.find(b => b.id === sch?.branch_id)
                  const isToday = fmt(d) === today
                  return (
                    <div key={i} className={`flex items-center justify-between px-4 py-3 ${isToday ? 'bg-blue-50' : ''}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${isToday ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                          {d.getDate()}
                        </div>
                        <div className="text-xs text-gray-500">{DAY_TH[i]}</div>
                      </div>
                      <div className="text-right">
                        {sch ? (
                          <>
                            <span className="text-xs font-semibold" style={{ color: STATUS_COLOR[sch.status] ?? '#6b7280' }}>{STATUS_LABEL[sch.status] ?? sch.status}</span>
                            {branch && <div className="text-xs text-gray-400">{branch.name}</div>}
                          </>
                        ) : (
                          <span className="text-xs text-gray-300">ยังไม่มีตาราง</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* LEAVE TAB */}
        {tab === 'leave' && (
          <div className="p-4 space-y-4">
            <div className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
              <div className="font-semibold text-gray-800 text-sm">ยื่นใบลา</div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">วันที่เริ่มลา</label>
                <input type="date" value={leaveStart} onChange={e => setLeaveStart(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">วันที่สิ้นสุด</label>
                <input type="date" value={leaveEnd} onChange={e => setLeaveEnd(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">เหตุผล</label>
                <textarea value={leaveReason} onChange={e => setLeaveReason(e.target.value)} rows={3}
                  placeholder="ระบุเหตุผลการลา..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 resize-none" />
              </div>
              <button onClick={submitLeave} className="w-full py-3 bg-gray-900 text-white rounded-xl font-medium text-sm">ส่งใบลา</button>
              {submitMsg && <div className="text-center text-sm">{submitMsg}</div>}
            </div>
          </div>
        )}

        {/* SHIFT CHANGE TAB */}
        {tab === 'shift' && (
          <div className="p-4 space-y-4">
            <div className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
              <div className="font-semibold text-gray-800 text-sm">ขอเปลี่ยนกะ</div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">วันที่ต้องการเปลี่ยน</label>
                <input type="date" value={shiftDate} onChange={e => setShiftDate(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">ขอเลื่อนเป็นวันที่</label>
                <input type="date" value={shiftToDate} onChange={e => setShiftToDate(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">เหตุผล</label>
                <textarea value={shiftReason} onChange={e => setShiftReason(e.target.value)} rows={3}
                  placeholder="ระบุเหตุผล..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 resize-none" />
              </div>
              <button onClick={submitShift} className="w-full py-3 bg-gray-900 text-white rounded-xl font-medium text-sm">ส่งคำขอ</button>
              {submitMsg && <div className="text-center text-sm">{submitMsg}</div>}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Tab Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex max-w-md mx-auto">
        {([
          { key: 'checkin', icon: '✅', label: 'เช็คอิน' },
          { key: 'schedule', icon: '📅', label: 'ตาราง' },
          { key: 'leave', icon: '📝', label: 'ใบลา' },
          { key: 'shift', icon: '🔄', label: 'เปลี่ยนกะ' },
        ] as { key: Tab; icon: string; label: string }[]).map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setSubmitMsg('') }}
            className={`flex-1 flex flex-col items-center py-2.5 text-xs transition-colors ${tab === t.key ? 'text-blue-600' : 'text-gray-400'}`}>
            <span className="text-lg">{t.icon}</span>
            <span className="mt-0.5">{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
