'use client'
import { useEffect, useState } from 'react'
import DatePicker from '@/components/DatePicker'
import { ScrollTable } from '@/components/ScrollTable'
import { EmptyState } from '@/components/EmptyState'
import { TableLoadingState } from '@/components/TableLoadingState'
import { Toast } from '@/components/Toast'
import { SuccessPopup } from '@/components/modals/shared/SuccessPopup'
import { useCalendarBatch, useBulkUpdateCalendarBatch } from '@/hooks/academic/useCalendarBatch'
import { AcademicCalendarBatchEntryDto } from '@/lib/api/academic/intake'
import { formatDate } from '@/lib/date'

// This page is a client for PATCH /api/v1/academic/intakes/calendar-batch
// (see patch-calendar-batch-bulk.md) — it does NOT bulk-edit arbitrary
// intakes. Both GET and PATCH always resolve against whichever intake
// currently has currentAdmissionIntake = true and operate on that intake's
// calendar "back-fill batch": one row per semester calendar entry, which can
// span older, back-filled intakes too. Only the date fields below are
// editable — intakeGuid/intakeCode/description/semCode are accepted by the
// PATCH but silently ignored server-side, so they're rendered read-only here.
type FieldKey = Exclude<keyof AcademicCalendarBatchEntryDto, 'intakeGuid' | 'intakeCode' | 'description' | 'academicCalendarGuid' | 'semCode'>

interface BulkField {
  key: FieldKey
  label: string
}

// Every date field is always editable at once through the single edit panel
// below — there's no separate "which fields am I bulk-editing" picker
// anymore. The backend does still require semesterStartDate/EndDate and
// term1/term2 Start/EndDate to be non-null on every entry it receives (see
// patch-calendar-batch-bulk.md), but that's only ever a problem if a row's
// existing data is already missing one of those, which editing an unrelated
// field can't cause — so it's left to the backend's own 400 to report.
const BULK_FIELDS: BulkField[] = [
  { key: 'semesterStartDate', label: 'Semester Start Date' },
  { key: 'semesterEndDate', label: 'Semester End Date' },
  { key: 'term1StartDate', label: 'Term 1 Start Date' },
  { key: 'term1EndDate', label: 'Term 1 End Date' },
  { key: 'term2StartDate', label: 'Term 2 Start Date' },
  { key: 'term2EndDate', label: 'Term 2 End Date' },
  { key: 'admissionStartDate', label: 'Admission Start Date' },
  { key: 'admissionLateFeeDate', label: 'Admission Late Fee Date' },
  { key: 'admissionEndDate', label: 'Admission End Date' },
  { key: 'reentryStartDate', label: 'Re-entry Start Date' },
  { key: 'reentryLateFeeDate', label: 'Re-entry Late Fee Date' },
  { key: 'reentryEndDate', label: 'Re-entry End Date' },
  { key: 'lumpsumDate', label: 'Lumpsum Date' },
  { key: 'resitStartDate', label: 'Resit Start Date' },
  { key: 'resitEndDate', label: 'Resit End Date' },
  { key: 'finalExamStartDate', label: 'Final Exam Start Date' },
  { key: 'finalExamEndDate', label: 'Final Exam End Date' },
  { key: 'clearanceDate', label: 'Clearance Date' },
]

// pendingValues is keyed by "academicCalendarGuid::field" so one flat map can
// hold every selected entry's edit across every field at once.
function pendingKey(guid: string, fieldKey: FieldKey) {
  return `${guid}::${fieldKey}`
}

// The API returns full datetime values, so date fields work with the
// DatePicker in yyyy-mm-dd form.
function toDateInputValue(value: string | null): string {
  if (!value) return ''
  return value.includes('T') ? value.split('T')[0] : value
}

function originalValueFor(entry: AcademicCalendarBatchEntryDto, fieldKey: FieldKey): string {
  return toDateInputValue(entry[fieldKey])
}

// Every ≥ pair the backend validator enforces (see the Validation table in
// patch-calendar-batch-bulk.md) — [start, end] fields where end must be on
// or after start whenever both are present.
const DATE_ORDER_RULES: [FieldKey, FieldKey, string][] = [
  ['term1StartDate', 'term1EndDate', 'Term 1 End Date must be on or after Term 1 Start Date'],
  ['term2StartDate', 'term2EndDate', 'Term 2 End Date must be on or after Term 2 Start Date'],
  ['admissionStartDate', 'admissionLateFeeDate', 'Admission Late Fee Date must be on or after Admission Start Date'],
  ['admissionLateFeeDate', 'admissionEndDate', 'Admission End Date must be on or after Admission Late Fee Date'],
  ['reentryStartDate', 'reentryLateFeeDate', 'Re-entry Late Fee Date must be on or after Re-entry Start Date'],
  ['reentryStartDate', 'reentryEndDate', 'Re-entry End Date must be on or after Re-entry Start Date'],
  ['resitStartDate', 'resitEndDate', 'Resit End Date must be on or after Resit Start Date'],
  ['finalExamStartDate', 'finalExamEndDate', 'Final Exam End Date must be on or after Final Exam Start Date'],
]

// Mirrors the backend's ≥ pair rules above (checked only when both sides of
// the pair are present, same as the backend does) — not the required-field
// rule, which is intentionally left to the backend's own 400 (see the
// BULK_FIELDS comment above). Returns the first violation found, or null if
// the entry is clean. Dates are all plain "yyyy-mm-ddT00:00:00" strings, so
// string comparison sorts them correctly.
function validateCalendarEntry(entry: AcademicCalendarBatchEntryDto): string | null {
  const label = `Intake ${entry.intakeCode} Sem ${entry.semCode}`
  for (const [startKey, endKey, message] of DATE_ORDER_RULES) {
    const start = entry[startKey]
    const end = entry[endKey]
    if (start && end && end < start) return `${label}: ${message}`
  }
  return null
}

interface FieldDiff {
  label: string
  from: string
  to: string
}

// What actually changed between a row's real data and the entry about to be
// submitted, for the confirm popup — only fields whose value differs.
function fieldDiffs(original: AcademicCalendarBatchEntryDto, entry: AcademicCalendarBatchEntryDto): FieldDiff[] {
  return BULK_FIELDS
    .filter(f => entry[f.key] !== original[f.key])
    .map(f => ({ label: f.label, from: formatDate(original[f.key]), to: formatDate(entry[f.key]) }))
}

// What Save Changes / a row's tick icon is about to submit, held until the
// confirm popup below is answered.
type ConfirmAction =
  | { kind: 'bulk'; rows: AcademicCalendarBatchEntryDto[]; entries: AcademicCalendarBatchEntryDto[] }
  | { kind: 'row'; row: AcademicCalendarBatchEntryDto; entry: AcademicCalendarBatchEntryDto }

export default function Page() {
  const { data: batch = [], isLoading } = useCalendarBatch()
  const bulkUpdate = useBulkUpdateCalendarBatch()
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  const [search, setSearch] = useState('')
  const [selectedGuids, setSelectedGuids] = useState<Set<string>>(new Set())
  const [pendingValues, setPendingValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  // Per-row inline edit (the pencil/tick column) — independent of the
  // checkbox + top-panel bulk flow above. A row in editingGuids gets
  // editable date cells right in the table; once it actually has a pending
  // change the pencil swaps to a tick that PATCHes just that one row.
  const [editingGuids, setEditingGuids] = useState<Set<string>>(new Set())
  const [rowSaving, setRowSaving] = useState<Set<string>>(new Set())

  // Set once Save Changes or a row's tick icon has a valid, non-empty set of
  // edits ready to go — renders the confirm popup below. Nothing is actually
  // sent to the API until that popup is confirmed.
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null)

  // Set once the PATCH behind confirmAction actually succeeds — swaps the
  // same modal from the diff/confirm view over to SuccessPopup, same as
  // EditIntakeModal/NewIntakeModal etc. do elsewhere in the academic module.
  const [successInfo, setSuccessInfo] = useState<{ title: string; subtitle: string } | null>(null)

  // The edit panel always tracks the first selected row in table order — if
  // that row gets unchecked, this naturally falls through to whichever
  // selected row now comes first, without any extra bookkeeping.
  const activeRow = batch.find(e => selectedGuids.has(e.academicCalendarGuid)) ?? null

  // Seed pendingValues for any newly-selected row across every field (so the
  // panel starts pre-filled with that row's real values), without disturbing
  // edits already made to rows that were already selected.
  useEffect(() => {
    setPendingValues(prev => {
      const next = { ...prev }
      let changed = false
      for (const guid of selectedGuids) {
        const entry = batch.find(e => e.academicCalendarGuid === guid)
        if (!entry) continue
        for (const field of BULK_FIELDS) {
          const key = pendingKey(guid, field.key)
          if (next[key] === undefined) { next[key] = originalValueFor(entry, field.key); changed = true }
        }
      }
      return changed ? next : prev
    })
    // Only re-seed when the selection changes, not on every batch refetch —
    // an in-progress edit shouldn't reset just because some other query
    // invalidated it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Array.from(selectedGuids).join(',')])

  const visibleRows = batch.filter(e => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return `${e.intakeCode} ${e.description} sem ${e.semCode}`.toLowerCase().includes(q)
  })

  const allVisibleSelected = visibleRows.length > 0 && visibleRows.every(r => selectedGuids.has(r.academicCalendarGuid))

  function toggleRow(guid: string) {
    setSelectedGuids(prev => {
      const next = new Set(prev)
      if (next.has(guid)) next.delete(guid); else next.add(guid)
      return next
    })
  }

  function toggleAllVisible() {
    setSelectedGuids(prev => {
      if (allVisibleSelected) return new Set([...prev].filter(g => !visibleRows.some(r => r.academicCalendarGuid === g)))
      return new Set([...prev, ...visibleRows.map(r => r.academicCalendarGuid)])
    })
  }

  function rowHasChanges(row: AcademicCalendarBatchEntryDto): boolean {
    return BULK_FIELDS.some(f => {
      const v = pendingValues[pendingKey(row.academicCalendarGuid, f.key)]
      return v !== undefined && v !== originalValueFor(row, f.key)
    })
  }

  // Rows that will actually be saved: checked in, and at least one field's
  // value actually differs from what the entry already has.
  const changedSelectedRows = batch.filter(e => selectedGuids.has(e.academicCalendarGuid) && rowHasChanges(e))

  // Edits made in the panel apply to every currently selected row at once —
  // this page is a bulk editor, so there's no separate "Apply" step.
  function updateSelectedField(fieldKey: FieldKey, value: string) {
    setPendingValues(prev => {
      const next = { ...prev }
      selectedGuids.forEach(guid => { next[pendingKey(guid, fieldKey)] = value })
      return next
    })
  }

  function resetChanges() {
    setPendingValues({})
    setSelectedGuids(new Set())
  }

  function updateRowValue(guid: string, fieldKey: FieldKey, value: string) {
    setPendingValues(prev => ({ ...prev, [pendingKey(guid, fieldKey)]: value }))
  }

  // Single-row inline edit (the pencil/tick column) — commented out per
  // request, kept here for reference rather than deleted. Bulk edit via the
  // checkbox + top panel is unaffected. Uncomment this pair, saveRow below,
  // rowIconBtnStyle, and the matching table column further down to restore
  // it.
  /*
  // Enters inline edit mode for one row: seeds its pending values (if not
  // already seeded via the checkbox flow) so the row's date cells start
  // editable and pre-filled rather than blank.
  function startEditRow(row: AcademicCalendarBatchEntryDto) {
    setPendingValues(prev => {
      const next = { ...prev }
      for (const field of BULK_FIELDS) {
        const key = pendingKey(row.academicCalendarGuid, field.key)
        if (next[key] === undefined) next[key] = originalValueFor(row, field.key)
      }
      return next
    })
    setEditingGuids(prev => new Set(prev).add(row.academicCalendarGuid))
  }

  // Leaves inline edit mode without saving, discarding whatever was typed —
  // clicking the pencil again before making any change cancels the same way.
  function cancelEditRow(row: AcademicCalendarBatchEntryDto) {
    setPendingValues(prev => {
      const next = { ...prev }
      for (const field of BULK_FIELDS) delete next[pendingKey(row.academicCalendarGuid, field.key)]
      return next
    })
    setEditingGuids(prev => { const next = new Set(prev); next.delete(row.academicCalendarGuid); return next })
  }
  */

  // The tick icon: validates, then opens the confirm popup rather than
  // saving straight away. The actual PATCH (see confirmRowSave below) only
  // fires once that popup is confirmed. Commented out along with the rest of
  // the single-row edit UI — see the note above startEditRow.
  /*
  function saveRow(row: AcademicCalendarBatchEntryDto) {
    const entry = buildSubmitEntry(row)
    const invalid = validateCalendarEntry(entry)
    if (invalid) { showToast(invalid, 'error'); return }
    setConfirmAction({ kind: 'row', row, entry })
  }
  */

  // Runs after the confirm popup is accepted for a single-row save: PATCHes
  // just this one row through the same bulkUpdateCalendarBatch call the top
  // Save Changes button uses, just with a single-entry array. The popup
  // stays open on success too — it swaps from the diff view to SuccessPopup
  // (see the modal render below) rather than closing outright, same as the
  // rest of the academic module's Edit/New modals. On failure it stays on
  // the diff view with an error toast so it's still visible to retry against.
  async function confirmRowSave(row: AcademicCalendarBatchEntryDto, entry: AcademicCalendarBatchEntryDto) {
    setRowSaving(prev => new Set(prev).add(row.academicCalendarGuid))
    try {
      await bulkUpdate.mutateAsync([entry])
      showToast(`Updated Intake ${row.intakeCode} Sem ${row.semCode}`)
      setEditingGuids(prev => { const next = new Set(prev); next.delete(row.academicCalendarGuid); return next })
      setSuccessInfo({ title: 'Calendar Updated!', subtitle: `Intake ${row.intakeCode} · Sem ${row.semCode} has been updated successfully.` })
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Save failed — please retry', 'error')
    } finally {
      setRowSaving(prev => { const next = new Set(prev); next.delete(row.academicCalendarGuid); return next })
    }
  }

  // Builds the full entry PATCH expects for one changed row: the original
  // entry with every field's pending value merged in. Submitted in full
  // rather than as a partial patch, per patch-calendar-batch-bulk.md.
  function buildSubmitEntry(row: AcademicCalendarBatchEntryDto): AcademicCalendarBatchEntryDto {
    let entry = row
    for (const field of BULK_FIELDS) {
      const value = pendingValues[pendingKey(row.academicCalendarGuid, field.key)]
      if (value !== undefined) entry = { ...entry, [field.key]: value ? `${value}T00:00:00` : null }
    }
    return entry
  }

  // Validates, then opens the confirm popup rather than saving straight
  // away. The actual PATCH (see confirmBulkSave below) only fires once that
  // popup is confirmed.
  function handleSave() {
    if (changedSelectedRows.length === 0) return

    const entries = changedSelectedRows.map(buildSubmitEntry)

    // Mirrors the backend validator's shape-level rules (see the Validation
    // table in patch-calendar-batch-bulk.md) so a bad edit gets caught here
    // rather than round-tripping to a 400. Dates are all "yyyy-mm-ddT00:00:00"
    // strings, so plain string comparison sorts them correctly.
    const invalidEntry = entries.map(validateCalendarEntry).find(msg => msg !== null)
    if (invalidEntry) {
      showToast(invalidEntry, 'error')
      return
    }

    setConfirmAction({ kind: 'bulk', rows: changedSelectedRows, entries })
  }

  // Runs after the confirm popup is accepted for a bulk save. Same
  // swap-to-SuccessPopup-on-success behavior as confirmRowSave above.
  async function confirmBulkSave(entries: AcademicCalendarBatchEntryDto[]) {
    setSaving(true)
    try {
      await bulkUpdate.mutateAsync(entries)
      showToast(`Updated ${entries.length} calendar entr${entries.length === 1 ? 'y' : 'ies'} successfully`)
      setSelectedGuids(new Set())
      setSuccessInfo({ title: 'Calendar Updated!', subtitle: `Updated ${entries.length} calendar entr${entries.length === 1 ? 'y' : 'ies'} successfully.` })
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Save failed — please retry', 'error')
    } finally {
      setSaving(false)
    }
  }

  function displayValue(row: AcademicCalendarBatchEntryDto, field: BulkField) {
    return formatDate(row[field.key])
  }

  // Bordered, filled icon-button look (not a bare icon) for the pencil/
  // tick/cancel column, so it reads as clickable rather than decorative —
  // 'edit' (grey, ready to click), 'save' (green, has a real change to
  // submit), 'save-disabled' (muted green, editing but nothing changed
  // yet), 'cancel' (red-tinted, always available while editing).
  // Only used by the single-row edit column's pencil/tick/cancel buttons,
  // commented out below along with the rest of that feature.
  /*
  function rowIconBtnStyle(variant: 'edit' | 'save' | 'save-disabled' | 'cancel'): React.CSSProperties {
    const base: React.CSSProperties = {
      width: 28, height: 28, borderRadius: 'var(--rxs)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      cursor: 'pointer', transition: 'var(--tr)', flexShrink: 0, fontSize: 13,
    }
    if (variant === 'save') return { ...base, border: '1.5px solid var(--green-bd)', background: 'var(--green-bg)', color: 'var(--green)' }
    if (variant === 'save-disabled') return { ...base, border: '1.5px solid var(--g200)', background: 'var(--g100)', color: 'var(--g400)', cursor: 'default' }
    if (variant === 'cancel') return { ...base, border: '1.5px solid var(--red-bd)', background: 'var(--red-bg)', color: 'var(--red)' }
    return { ...base, border: '1.5px solid var(--g200)', background: 'var(--surface)', color: 'var(--g500)' }
  }
  */

  return (
    <>
      <div className="page active">
        <div className="pg-hdr">
          <div>
            <div className="pg-title">Bulk Intake Calendar Update</div>
            <div className="pg-sub">Update calendar dates across the current admission intake's back-fill batch · Select entries, edit values, then save</div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 18 }}>
          <div className="card-hdr">
            <div className="card-title"><span className="ctitle-icon"><i className="lni lni-calendar"></i></span> Edit Calendar Dates</div>
          </div>
          {!activeRow ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '18px 22px', padding: '10px 14px', background: 'var(--b50)', border: '1.5px solid var(--b100)', borderRadius: 'var(--rsm)', fontSize: 12.5, color: 'var(--g700)' }}>
              <i className="lni lni-information" style={{ color: 'var(--b600)', fontSize: 16 }}></i>
              Select an intake&apos;s checkbox below to edit its calendar dates.
            </div>
          ) : (
            <div style={{ padding: '18px 22px' }}>
              <div style={{ fontSize: 12.5, color: 'var(--g400)', marginBottom: 14 }}>
                Editing <strong style={{ color: 'var(--g700)' }}>Intake {activeRow.intakeCode} · {activeRow.description} · Sem {activeRow.semCode}</strong>
                {selectedGuids.size > 1 && ` — changes apply to all ${selectedGuids.size} selected rows`}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
                {BULK_FIELDS.map(field => (
                  <div className="fg" key={field.key}>
                    <div className="lbl">{field.label}</div>
                    <DatePicker
                      value={pendingValues[pendingKey(activeRow.academicCalendarGuid, field.key)] ?? originalValueFor(activeRow, field.key)}
                      onChange={v => updateSelectedField(field.key, v)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, padding: '14px 22px', borderTop: '1px solid var(--g200)' }}>
            <span style={{ fontSize: 12.5, color: 'var(--g400)' }}>
              {changedSelectedRows.length} of {selectedGuids.size} selected row{selectedGuids.size === 1 ? '' : 's'} changed
            </span>
            <button className="btn btn-neu" onClick={resetChanges} disabled={saving}>
              <i className="lni lni-reload"></i> Reset
            </button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving || changedSelectedRows.length === 0}>
              <i className="lni lni-checkmark"></i> {saving ? 'Saving…' : `Save Changes${changedSelectedRows.length ? ` (${changedSelectedRows.length})` : ''}`}
            </button>
          </div>
        </div>

        <div className="card">
          <div className="card-hdr" style={{ flexWrap: 'wrap', gap: 12 }}>
            <div className="card-title"><span className="ctitle-icon"><i className="lni lni-calendar"></i></span> Calendar Batch Entries</div>
            <span style={{ fontSize: 12.5, color: 'var(--g400)' }}>{selectedGuids.size} selected</span>
            <span className="flex-1"></span>
            <input
              className="ctrl w-56"
              placeholder="Search by intake code, description, or sem…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ maxWidth: 240 }}
            />
          </div>

          {selectedGuids.size >= 2 && (
            // The icon and message must be the flex container's only two
            // items — putting flex directly on a mix of bare text nodes and
            // <strong> makes each text run its own anonymous flex item, so
            // the sentence spreads out with huge gaps between words instead
            // of wrapping normally. Wrapping the message in a <span> keeps
            // it as one flex item that wraps like a normal paragraph.
            <div className="fade-up" style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '0 22px 16px', padding: '10px 14px', background: 'var(--amber-bg)', border: '1.5px solid var(--amber-bd)', borderRadius: 'var(--rsm)', fontSize: 12.5, color: 'var(--g700)' }}>
              <span className="warn-badge"><i className="lni lni-warning"></i></span>
              <span>You&apos;ve selected {selectedGuids.size} intakes — saving will overwrite the calendar dates for <strong>all</strong> selected intakes with the values shown above.</span>
            </div>
          )}

          <ScrollTable>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 40 }}>
                    <input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} style={{ width: 15, height: 15, accentColor: 'var(--b500)', cursor: 'pointer' }} />
                  </th>
                  {/* Single-row inline edit (pencil/tick) column —
                      commented out per request, kept for reference. See the
                      note above startEditRow further up this file. */}
                  <th>Intake Code</th>
                  <th>Description</th>
                  <th>Sem</th>
                  {BULK_FIELDS.map(field => (
                    <th key={field.key}>{field.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading
                  // 4 fixed columns now that the single-row edit column
                  // above is commented out (was 5).
                  ? <TableLoadingState colSpan={4 + BULK_FIELDS.length} />
                  : visibleRows.length === 0
                    ? <EmptyState colSpan={4 + BULK_FIELDS.length} hasFilters={!!search} onClearFilters={() => setSearch('')} />
                    : null}
                {visibleRows.map(row => {
                  const selected = selectedGuids.has(row.academicCalendarGuid)
                  const editing = editingGuids.has(row.academicCalendarGuid)
                  const rowChanged = rowHasChanges(row)
                  const changed = selected && rowChanged
                  const active = activeRow?.academicCalendarGuid === row.academicCalendarGuid
                  // Only fed the now-commented-out single-row edit column below.
                  // const isRowSaving = rowSaving.has(row.academicCalendarGuid)
                  return (
                    <tr key={row.academicCalendarGuid} className={changed ? 'selected-row' : ''} style={active ? { outline: '2px solid var(--b400)', outlineOffset: -2 } : undefined}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleRow(row.academicCalendarGuid)}
                          style={{ width: 15, height: 15, accentColor: 'var(--b500)', cursor: 'pointer' }}
                        />
                      </td>
                      {/* Single-row inline edit (pencil/tick) column —
                          commented out per request, kept for reference. See
                          the note above startEditRow further up this file.
                      <td>
                        {editing ? (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              type="button"
                              onClick={() => saveRow(row)}
                              disabled={!rowChanged || isRowSaving}
                              title={rowChanged ? 'Save this row' : 'No changes to save yet'}
                              style={{ ...rowIconBtnStyle(rowChanged ? 'save' : 'save-disabled'), opacity: isRowSaving ? 0.7 : 1 }}
                              onMouseEnter={e => { if (rowChanged && !isRowSaving) { e.currentTarget.style.background = 'var(--green)'; e.currentTarget.style.color = 'var(--white)' } }}
                              onMouseLeave={e => { if (rowChanged) { e.currentTarget.style.background = 'var(--green-bg)'; e.currentTarget.style.color = 'var(--green)' } }}
                            >
                              <i className={isRowSaving ? 'lni lni-reload animate-spin' : 'lni lni-checkmark-circle'}></i>
                            </button>
                            <button
                              type="button"
                              onClick={() => cancelEditRow(row)}
                              disabled={isRowSaving}
                              title="Cancel edit"
                              style={rowIconBtnStyle('cancel')}
                              onMouseEnter={e => { e.currentTarget.style.background = 'var(--red)'; e.currentTarget.style.color = 'var(--white)' }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'var(--red-bg)'; e.currentTarget.style.color = 'var(--red)' }}
                            >
                              <i className="lni lni-close"></i>
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => startEditRow(row)}
                            title="Edit this row"
                            style={rowIconBtnStyle('edit')}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--b300)'; e.currentTarget.style.background = 'var(--b50)'; e.currentTarget.style.color = 'var(--b600)' }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--g200)'; e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.color = 'var(--g500)' }}
                          >
                            <i className="lni lni-pencil"></i>
                          </button>
                        )}
                      </td>
                      */}
                      <td><span className="font-mono text-b700">{row.intakeCode}</span></td>
                      <td><strong>{row.description}</strong></td>
                      <td>{row.semCode}</td>
                      {BULK_FIELDS.map(field => {
                        const pending = pendingValues[pendingKey(row.academicCalendarGuid, field.key)]
                        if (editing) {
                          return (
                            <td key={field.key}>
                              <DatePicker
                                value={pending ?? originalValueFor(row, field.key)}
                                onChange={v => updateRowValue(row.academicCalendarGuid, field.key, v)}
                              />
                            </td>
                          )
                        }
                        const value = pending !== undefined ? (pending ? formatDate(`${pending}T00:00:00`) : '—') : displayValue(row, field)
                        return <td key={field.key}>{value}</td>
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </ScrollTable>
        </div>
      </div>

      {confirmAction && (() => {
        const inFlight = confirmAction.kind === 'bulk' ? saving : rowSaving.has(confirmAction.row.academicCalendarGuid)
        const dismiss = () => { if (!inFlight) setConfirmAction(null) }
        const closeSuccess = () => { setConfirmAction(null); setSuccessInfo(null) }
        return (
        <div className="modal-overlay open confirm-modal-overlay" onClick={successInfo ? undefined : dismiss}>
          <div className="modal modal-sm confirm-modal-pop" onClick={e => e.stopPropagation()}>
            {successInfo ? (
              // Same swap-the-modal-body-to-SuccessPopup pattern used across
              // the rest of the academic module (EditIntakeModal, NewIntakeModal,
              // etc.) rather than a bespoke success state just for this page.
              <SuccessPopup title={successInfo.title} subtitle={successInfo.subtitle} onClose={closeSuccess} />
            ) : (
              <>
                <div className="modal-hdr modal-hdr-blue">
                  <div className="modal-title">Confirm Calendar Update</div>
                  <button className="modal-close" onClick={dismiss} disabled={inFlight}>
                    <i className="lni lni-close"></i>
                  </button>
                </div>
                {confirmAction.kind === 'bulk' && confirmAction.rows.length >= 2 && (
                  // See the same note on the inline banner above the table —
                  // the message needs to be one <span>, not bare text nodes,
                  // or each run around <strong> becomes its own flex item.
                  <div className="fade-up" style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '16px 20px 0', padding: '10px 14px', background: 'var(--amber-bg)', border: '1.5px solid var(--amber-bd)', borderRadius: 'var(--rsm)', fontSize: 12.5, color: 'var(--g700)' }}>
                    <span className="warn-badge"><i className="lni lni-warning"></i></span>
                    <span>You&apos;re about to overwrite the calendar dates for <strong>{confirmAction.rows.length} intakes</strong> at once. This can&apos;t be undone.</span>
                  </div>
                )}
                <div style={{ maxHeight: '50vh', overflowY: 'auto' }}>
                  {(confirmAction.kind === 'bulk' ? confirmAction.rows : [confirmAction.row]).map((row, i) => {
                    const entry = confirmAction.kind === 'bulk' ? confirmAction.entries[i] : confirmAction.entry
                    const diffs = fieldDiffs(row, entry)
                    return (
                      <div key={row.academicCalendarGuid} style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--g800)', marginBottom: 8 }}>
                          Intake {row.intakeCode} · {row.description} · Sem {row.semCode}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {diffs.map(d => (
                            <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, padding: '6px 10px', background: 'var(--b50)', borderRadius: 'var(--rxs)' }}>
                              <span style={{ minWidth: 150, color: 'var(--g500)' }}>{d.label}</span>
                              <span style={{ color: 'var(--g500)', textDecoration: 'line-through' }}>{d.from}</span>
                              <i className="lni lni-arrow-right" style={{ fontSize: 11, color: 'var(--g400)' }}></i>
                              <span style={{ color: 'var(--b700)', fontWeight: 700 }}>{d.to}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="modal-footer">
                  <button className="btn btn-neu" onClick={dismiss} disabled={inFlight}>
                    Cancel
                  </button>
                  <button
                    className="btn btn-primary"
                    disabled={inFlight}
                    onClick={() =>
                      confirmAction.kind === 'bulk'
                        ? confirmBulkSave(confirmAction.entries)
                        : confirmRowSave(confirmAction.row, confirmAction.entry)
                    }
                  >
                    <i className="lni lni-checkmark"></i> {inFlight ? 'Updating…' : 'Confirm & Update'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
        )
      })()}

      <Toast toast={toast} />
    </>
  )
}
