import type { Metadata } from 'next'
import './globals.css'
import NavBar from './components/NavBar'

export const metadata: Metadata = {
  title: 'ระบบพนักงาน',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body className="bg-white">
        <div className="pb-20">
          {children}
        </div>
        <NavBar />
      </body>
    </html>
  )
}
