'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'

const LIFF_ID = process.env.NEXT_PUBLIC_LIFF_ID ?? '2011439804-P1ved3pv'

type Branch = { id: string; name: string }

function qrImageUrl(branchId: string) {
  const liffUrl = `https://liff.line.me/${LIFF_ID}?branch=${branchId}`
  return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=10&data=${encodeURIComponent(liffUrl)}`
}

export default function QRPage() {
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('branches').select('id, name').order('name')
      .then(({ data }) => { setBranches(data ?? []); setLoading(false) })
  }, [])

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-gray-400 text-sm">กำลังโหลด...</div>
    </div>
  )

  return (
    <main className="min-h-screen bg-gray-50 pb-16 print:bg-white print:p-0">
      {/* Header — hidden when printing */}
      <div className="print:hidden bg-white border-b border-gray-100 px-4 pt-6 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-gray-400 text-xl">←</Link>
          <div>
            <h1 className="text-lg font-bold text-gray-900">📲 QR Code เช็คอิน</h1>
            <p className="text-xs text-gray-500">พิมพ์และติดที่แต่ละสาขา</p>
          </div>
        </div>
        <button
          onClick={() => window.print()}
          className="px-4 py-2 bg-gray-900 text-white text-sm rounded-xl font-medium"
        >
          🖨️ พิมพ์
        </button>
      </div>

      {/* Info box */}
      <div className="print:hidden px-4 py-3">
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-700">
          พนักงานสแกน QR ที่สาขา → ระบบตรวจ GPS ของสาขานั้น → เช็คอินได้ทันที ไม่ว่าจะประจำสาขาไหน
        </div>
      </div>

      {/* QR grid */}
      <div className="px-4 py-4 grid grid-cols-2 gap-4 print:grid print:grid-cols-2 print:gap-6 print:p-6">
        {branches.map(b => (
          <div
            key={b.id}
            className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col items-center gap-3 print:rounded-xl print:border-2 print:border-gray-300 print:shadow-none print:break-inside-avoid"
          >
            <div className="text-sm font-bold text-gray-900 text-center leading-snug">{b.name}</div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrImageUrl(b.id)}
              alt={`QR สาขา${b.name}`}
              width={180}
              height={180}
              className="rounded-lg"
            />
            <div className="text-xs text-gray-400 text-center">สแกนเพื่อเช็คอิน</div>
          </div>
        ))}
      </div>
    </main>
  )
}
