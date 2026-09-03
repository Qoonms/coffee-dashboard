'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  { href: '/',         label: 'ภาพรวม',   icon: '☕' },
  { href: '/schedule', label: 'ตารางงาน', icon: '📅' },
  { href: '/leave',    label: 'ใบลา',      icon: '📋' },
  { href: '/ot',       label: 'โอที',      icon: '⏱' },
]

export default function NavBar() {
  const path = usePathname()

  return (
    <nav style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      background: '#fff',
      borderTop: '1px solid #f0f0f0',
      zIndex: 9999,
      display: 'flex',
      maxWidth: '768px',
      margin: '0 auto',
    }}>
      {NAV.map(item => {
        const active = path === item.href
        return (
          <Link
            key={item.href}
            href={item.href}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '10px 0 12px',
              gap: '2px',
              textDecoration: 'none',
              color: active ? '#111' : '#aaa',
            }}
          >
            <span style={{ fontSize: '20px', lineHeight: 1 }}>{item.icon}</span>
            <span style={{ fontSize: '11px', fontWeight: 500 }}>{item.label}</span>
            {active && (
              <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#111', marginTop: 2 }} />
            )}
          </Link>
        )
      })}
    </nav>
  )
}
