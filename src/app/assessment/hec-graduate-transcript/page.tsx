'use client'

import { useHecIntakesDropdown, useHecProgramsDropdown } from '@/hooks/assessment/useGraduateTranscript'
import { TranscriptGenerator } from '../graduate-transcript/_components/TranscriptGenerator'

// HEC Graduate Transcript (hec-graduate-transcript-page.md) — HEC and HECHS
// graduates only. Intakes from 20222 on (ISMIS transcript data starts there),
// no default intake; program group optional.
export default function HecGraduateTranscriptPage() {
  const { data: intakes = [], isLoading: intakesLoading } = useHecIntakesDropdown()
  const { data: programs = [], isLoading: programsLoading } = useHecProgramsDropdown()

  return (
    <TranscriptGenerator
      title="HEC Graduate Transcript"
      subtitle="Bulk-generate graduate transcript certificates for HEC and HECHS graduates."
      intakeOptions={intakes}
      intakesLoading={intakesLoading}
      programOptions={programs}
      programsLoading={programsLoading}
      programLabel="Program Group"
      notice={
        <div className="info-box mb-4 text-sm">
          <i className="lni lni-information mt-0.5"></i>
          <span>Only HEC and HECHS programmes, and academic intakes from 20222 onwards, are listed.</span>
        </div>
      }
    />
  )
}
