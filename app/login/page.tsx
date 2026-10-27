'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (pin.length < 4) return
    setLoading(true)
    setError('')
    const res = await fetch('/api/verify-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    })
    const data = await res.json()
    if (data.ok) {
      router.push('/')
      router.refresh()
    } else {
      setError('PIN ไม่ถูกต้อง ลองใหม่อีกครั้ง')
      setPin('')
    }
    setLoading(false)
  }

  function handlePad(val: string) {
    if (val === '←') { setPin(p => p.slice(0, -1)); return }
    if (pin.length >= 6) return
    setPin(p => p + val)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-xs">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">☕</div>
          <h1 className="text-xl font-bold text-gray-900">ระบบพนักงาน</h1>
          <p className="text-sm text-gray-400 mt-1">กรอก PIN เพื่อเข้าใช้งาน</p>
        </div>

        {/* PIN dots */}
        <div className="flex justify-center gap-3 mb-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className={`w-3 h-3 rounded-full transition-all ${
                i < pin.length ? 'bg-gray-900 scale-110' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>

        {error && (
          <div className="text-center text-red-500 text-sm mb-4">{error}</div>
        )}

        {/* Number pad */}
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-3 gap-3 mb-4">
            {['1','2','3','4','5','6','7','8','9','','0','←'].map((k, i) => (
              k === '' ? (
                <div key={i} />
              ) : (
                <button
                  key={i}
                  type="button"
                  onClick={() => handlePad(k)}
                  className={`h-14 rounded-2xl font-semibold text-lg transition-all active:scale-95 ${
                    k === '←'
                      ? 'bg-gray-100 text-gray-500 text-xl'
                      : 'bg-white shadow-sm border border-gray-100 text-gray-800'
                  }`}
                >
                  {k}
                </button>
              )
            ))}
          </div>

          <button
            type="submit"
            disabled={pin.length < 4 || loading}
            className="w-full py-3.5 bg-gray-900 text-white rounded-2xl font-semibold text-sm disabled:opacity-40 transition-opacity"
          >
            {loading ? 'กำลังตรวจสอบ...' : 'เข้าใช้งาน'}
          </button>
        </form>
      </div>
    </div>
  )
}
