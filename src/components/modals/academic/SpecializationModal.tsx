'use client'
import { ModalProps } from '../types'
import { ScrollTable } from '@/components/ScrollTable'
import { EmptyState } from '@/components/EmptyState'
import { TableLoadingState } from '@/components/TableLoadingState'
import { useProgramSpecializations } from '@/hooks/academic/useProgramSpecializations'

// Previous mock content (hardcoded rows, a fake "Add Specialization" create
// form) — replaced per Program_Master_Change_Requests_Final.md's Home Page
// "Specialization" action: this now just displays the real specializations
// already assigned to the selected programme (GET
// /api/v1/academic/specializations?programGuid=), read-only. Managing the
// programme's specializations themselves still happens on the Programme
// Details step (Step 1's Specialization(s) multi-select).
// const rows = [
//   { num: 1, name: 'Finance Management',       startSem: 'Sem 3', students: 42 },
//   { num: 2, name: 'Operations Management',     startSem: 'Sem 3', students: 38 },
//   { num: 3, name: 'Human Resource Management', startSem: 'Sem 3', students: 27 },
// ]

interface SpecializationModalProps extends ModalProps {
  programGuid: string | null
  programName?: string
}

export function SpecializationModal({ isOpen, onClose, programGuid, programName }: SpecializationModalProps) {
  const { data: specializations = [], isLoading } = useProgramSpecializations(programGuid, isOpen && !!programGuid)

  if (!isOpen) return null
  return (
    <div className="modal-overlay open" id="specialization-modal">
      <div className="modal modal-md" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className="lni lni-target"></i> Specializations{programName ? ` — ${programName}` : ''}</div>
          <button className="modal-close" onClick={onClose}><i className="lni lni-close"></i></button>
        </div>
        <ScrollTable>
          <table>
            <thead><tr><th>Code</th><th>Specialization Name</th></tr></thead>
            <tbody>
              {isLoading
                ? <TableLoadingState colSpan={2} />
                : specializations.length === 0
                  ? <EmptyState colSpan={2} title="No specializations" subtitle="This programme has no specializations assigned yet." />
                  : specializations.map(s => (
                      <tr key={s.streamGuid}>
                        <td className="font-mono text-[var(--fs-xs)] text-b700">{s.streamCode}</td>
                        <td><strong>{s.streamName}</strong></td>
                      </tr>
                    ))}
            </tbody>
          </table>
        </ScrollTable>
        <div className="modal-footer">
          <button className="btn btn-neu" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
