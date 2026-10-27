import { NextRequest, NextResponse } from 'next/server'

export function middleware(req: NextRequest) {
  const auth = req.cookies.get('admin_auth')
  if (auth?.value === 'true') return NextResponse.next()

  const loginUrl = new URL('/login', req.url)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: [
    '/((?!teamployhr|login|api|_next/static|_next/image|favicon\\.ico).*)',
  ],
}
