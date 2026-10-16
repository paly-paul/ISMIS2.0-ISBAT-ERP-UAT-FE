'use client'

import { useIntakesDropdown } from '@/hooks/academic/useIntakes'
import { useProgramGroupsDropdown } from '@/hooks/assessment/useGraduateTranscript'
import { TranscriptGenerator } from './_components/TranscriptGenerator'

// Graduate Transcript (graduate-transcript-page.md) — every intake and
// program group. The HEC/HECHS-only version is /assessment/hec-graduate-transcript.
export default function GraduateTranscriptPage() {
  const { data: intakes = [], isLoading: intakesLoading } = useIntakesDropdown()
  const { data: programs = [], isLoading: programsLoading } = useProgramGroupsDropdown()

  return (
    <TranscriptGenerator
      title="Graduate Transcript"
      subtitle="Bulk-generate official, QR-verifiable graduate transcript certificates."
      intakeOptions={intakes.map(i => ({ value: i.intakeGuid, label: i.description ? `${i.description} (${i.intakeCode})` : String(i.intakeCode) }))}
      intakesLoading={intakesLoading}
      programOptions={programs}
      programsLoading={programsLoading}
    />
  )
}
