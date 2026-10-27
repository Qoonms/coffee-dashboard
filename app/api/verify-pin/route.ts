import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { pin } = await req.json()
  const adminPin = process.env.ADMIN_PIN
  if (!adminPin) return NextResponse.json({ ok: false, error: 'ยังไม่ได้ตั้ง PIN' }, { status: 500 })
  if (pin === adminPin) {
    const res = NextResponse.json({ ok: true })
    res.cookies.set('admin_auth', 'true', {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 วัน
      path: '/',
    })
    return res
  }
  return NextResponse.json({ ok: false, error: 'PIN ไม่ถูกต้อง' }, { status: 401 })
}
