'use client'

import type { Metadata } from 'next'
import { useRouter } from 'next/navigation'
import PanelA from '@/components/PanelA'
import PortalCard from '@/components/PortalCard'
import Icon from '@/components/Icon'

export default function LoginPage() {
  const router = useRouter()

  return (
    <PanelA eyebrow="Sign in" headline="Welcome to ISBAT ERP.">
      <p style={{ color: 'var(--isb-muted)', fontSize: 14, margin: '0 0 32px', lineHeight: 1.55 }}>
        Choose your portal. Staff and faculty sign in to the administrative ERP;
        students use the student portal.
      </p>

      <div style={{ display: 'grid', gap: 12 }}>
        <PortalCard
          onClick={() => router.push('/login/staff')}
          icon="brief"
          title="Staff & Faculty"
          sub="For Registrars, Deans, Lecturers, Counselors and Support"
          meta="erp.isbatuniversity.ac.ug/login/staff"
          accent="var(--isb-blue)"
        />
        <PortalCard
          onClick={() => router.push('/login/student')}
          icon="grad"
          title="Students"
          sub="Fee status, timetables, grades, registration and services"
          meta="erp.isbatuniversity.ac.ug/frmStudentLogin.aspx"
          accent="#2EA862"
        />
      </div>

      <div style={{
        marginTop: 28, fontSize: 12, color: 'var(--isb-muted)',
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <Icon name="shield" size={14} color="var(--isb-muted)" />
        Secure sign-in · Your session is encrypted end-to-end.
      </div>
    </PanelA>
  )
}
