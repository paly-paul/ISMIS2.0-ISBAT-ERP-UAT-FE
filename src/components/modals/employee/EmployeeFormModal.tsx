'use client'
import { useEffect, useMemo, useState } from 'react'
import { ModalProps } from '../types'
import { SuccessPopup } from '../shared/SuccessPopup'
import { SearchSelect } from '@/components/SearchSelect'
import DatePicker from '@/components/DatePicker'
import { CreateEmployeeInput } from '@/lib/api/employee/employee'
import { useEmployee, useCreateEmployee, useUpdateEmployee } from '@/hooks/employee/useEmployees'
import { useDepartments } from '@/hooks/config/useDepartments'
import { useDesignations } from '@/hooks/config/useDesignations'
import { useCountries } from '@/hooks/config/useCountries'

// Add and Edit share this form — differ in prefill and which mutation runs.

// Only one employee category is confirmed by the API for now.
const CATEGORIES: { label: string; category: number; prefix: string }[] = [
  { label: 'Administrative Staff', category: 1, prefix: 'AD' },
]

const TITLES = ['Mr', 'Mrs', 'Ms', 'Dr', 'Prof']
// The lookup values below are placeholders until the API provides fuller options.
const SEXES = ['Male', 'Female', 'Others']
const MARITAL_STATUSES = ['Single', 'Married', 'Divorced', 'Widow', 'Widower', 'Separated']
const RELIGIONS = ['Christian', 'Muslim', 'Hindu', 'Other']

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function sexToNumber(sex: string): number {
  return sex === 'Male' ? 1 : sex === 'Female' ? 2 : sex === 'Others' ? 3 : 0
}

function isAtLeast18(birthDate: string): boolean {
  const dob = new Date(birthDate)
  if (Number.isNaN(dob.getTime())) return false
  const today = new Date()
  let age = today.getFullYear() - dob.getFullYear()
  const m = today.getMonth() - dob.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--
  return age >= 18
}

function getMaxBirthDate(): string {
  const today = new Date()
  const year = today.getFullYear() - 18
  const month = `${today.getMonth() + 1}`.padStart(2, '0')
  const day = `${today.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

interface EmployeeFormModalProps extends ModalProps {
  mode: 'new' | 'edit'
  employeeGuid: string | null
}

export function EmployeeFormModal({ isOpen, onClose, showToast, mode, employeeGuid }: EmployeeFormModalProps) {
  const isEdit = mode === 'edit'
  const [saved, setSaved] = useState(false)
  const [department, setDepartment] = useState('')
  const [designation, setDesignation] = useState('')

  // These fields match the employee create/update payload.
  const [category, setCategory] = useState(CATEGORIES[0].label)
  const [title, setTitle] = useState('')
  const [firstName, setFirstName] = useState('')
  const [surname, setSurname] = useState('')
  const [otherName, setOtherName] = useState('')
  const [sex, setSex] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [placeOfBirth, setPlaceOfBirth] = useState('')
  const [country, setCountry] = useState('')
  const [natId, setNatId] = useState('')
  const [nationalId, setNationalId] = useState('')
  const [emailId, setEmailId] = useState('')
  const [religion, setReligion] = useState('')
  const [maritalStatus, setMaritalStatus] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const { data: employee } = useEmployee(isEdit ? employeeGuid : null)
  const createEmployee = useCreateEmployee()
  const updateEmployee = useUpdateEmployee()
  const { data: departments = [] } = useDepartments()
  const { data: designations = [] } = useDesignations()
  const { data: countries = [] } = useCountries()
  // Employee's own intCountryCode has no confirmed mapping back to a real country guid, so it's
  // sent as the option's 1-based list position — flagged, not a confirmed id (see country.ts).
  const defaultCountryIndex = countries.findIndex(c => c.defaultCountry === 1)
  const defaultCountryCode = defaultCountryIndex >= 0 ? defaultCountryIndex + 1 : 1
  const departmentOptions = departments.map(d => d.deptName)
  const selectedDept = departments.find(d => d.deptName === department)
  const designationOptions = selectedDept ? designations.filter(d => String(d.intDept) === String(selectedDept.intDept)).map(d => d.designationName) : []
  const selectedDesignation = selectedDept
    ? designations.find(d => d.designationName === designation && String(d.intDept) === String(selectedDept.intDept))
    : undefined

  // If the employee's saved intCountryCode falls outside the current list's
  // position range, show their stored country name as a fallback rather
  // than a blank/mismatched selection.
  const countryOptions = useMemo(() => {
    const opts = countries.map((c, i) => ({ value: String(i + 1), label: c.countryName }))
    const savedCode = employee?.intCountryCode
    if (savedCode != null && employee?.countryName && (savedCode < 1 || savedCode > countries.length)) {
      opts.push({ value: String(savedCode), label: employee.countryName })
    }
    return opts
  }, [countries, employee])

  // Reuse the API validation messages so the form shows issues immediately.
  function validate(): Record<string, string> {
    const e: Record<string, string> = {}
    const selectedCategory = CATEGORIES.find(c => c.label === category)
    if (!selectedCategory || selectedCategory.category <= 0) e.category = 'Select Category before proceeding!'
    if (!title.trim()) e.title = 'Select Title before proceeding!'
    if (!surname.trim()) e.surname = 'Surname cannot be left blank!'
    if (!firstName.trim()) e.firstName = 'First Name cannot be left blank!'
    if (sexToNumber(sex) <= 0) e.sex = 'Select Gender before proceeding!'
    if (!birthDate) e.birthDate = 'Date Of Birth cannot be left blank!'
    else if (!isAtLeast18(birthDate)) e.birthDate = 'The minimum age should be 18 years.'
    if (!placeOfBirth.trim()) e.placeOfBirth = 'Place Of Birth cannot be left blank!'
    if (!natId.trim()) e.natId = 'Select National ID (Yes/No) before proceeding!'
    if (natId.trim() === '0' && !nationalId.trim()) e.nationalId = 'National ID cannot be left blank!'
    if (!emailId.trim()) e.emailId = 'Email ID cannot be left blank!'
    else if (!EMAIL_RE.test(emailId.trim())) e.emailId = 'Invalid Email ID!'
    if (!maritalStatus.trim()) e.maritalStatus = 'Select Marital Status before proceeding!'
    if (!selectedDept) e.department = 'Select Department before proceeding!'
    if (!selectedDesignation) e.designation = 'Select Designation before proceeding!'
    return e
  }

  function clearError(field: string) {
    setErrors(prev => (prev[field] ? { ...prev, [field]: '' } : prev))
  }

  useEffect(() => {
    if (!isOpen) return
    if (isEdit && employee) {
      setCategory(CATEGORIES.find(c => c.category === employee.category)?.label ?? CATEGORIES[0].label)
      setTitle(employee.title)
      setFirstName(employee.firstName)
      setSurname(employee.surname)
      setOtherName(employee.otherName ?? '')
      setSex(employee.sex === 1 ? 'Male' : employee.sex === 2 ? 'Female' : 'Others')
      setBirthDate(employee.birthDate.slice(0, 10))
      setPlaceOfBirth(employee.placeOfBirth)
      setCountry(employee.intCountryCode != null ? String(employee.intCountryCode) : '')
      setNatId(employee.natId)
      setNationalId(employee.nationalId ?? '')
      setEmailId(employee.emailId)
      setReligion(employee.intReligion ? RELIGIONS[employee.intReligion - 1] ?? '' : '')
      setMaritalStatus(MARITAL_STATUSES[employee.maritalStatus - 1] ?? '')
      const deptRecord = employee.intDept != null ? departments.find(d => String(d.intDept) === String(employee.intDept)) : undefined
      setDepartment(deptRecord?.deptName ?? '')
      const desigRecord = employee.intDesignation != null ? designations.find(d => String(d.intDesignation) === String(employee.intDesignation)) : undefined
      setDesignation(desigRecord?.designationName ?? '')
    } else if (!isEdit) {
      setDepartment(''); setDesignation('')
      setCategory(CATEGORIES[0].label)
      setTitle(''); setFirstName(''); setSurname(''); setOtherName('')
      setSex(''); setBirthDate(''); setPlaceOfBirth(''); setCountry('')
      setNatId(''); setNationalId(''); setEmailId(''); setReligion(''); setMaritalStatus('')
    }
    setErrors({})
  }, [isOpen, isEdit, employee, departments, designations])

  if (!isOpen) return null

  function handleClose() { setSaved(false); setErrors({}); onClose() }

  function handleDepartmentChange(dept: string) {
    setDepartment(dept)
    const deptRecord = departments.find(d => d.deptName === dept)
    const opts = deptRecord ? designations.filter(d => String(d.intDept) === String(deptRecord.intDept)).map(d => d.designationName) : []
    setDesignation(prev => (opts.includes(prev) ? prev : ''))
  }

  function handleSubmit() {
    if (isEdit && !employeeGuid) return
    const validationErrors = validate()
    setErrors(validationErrors)
    if (Object.keys(validationErrors).length > 0) return

    const selectedCategory = CATEGORIES.find(c => c.label === category) ?? CATEGORIES[0]
    const input: CreateEmployeeInput = {
      category: selectedCategory.category,
      categoryPrefix: selectedCategory.prefix,
      title,
      surname,
      firstName,
      otherName: otherName.trim() || null,
      sex: sexToNumber(sex),
      birthDate,
      placeOfBirth,
      intCountryCode: country ? Number(country) : defaultCountryCode,
      natId,
      nationalId: nationalId.trim() || null,
      emailId,
      intReligion: religion ? RELIGIONS.indexOf(religion) + 1 : null,
      maritalStatus: MARITAL_STATUSES.indexOf(maritalStatus) + 1 || 1,
      intDept: selectedDept!.intDept,
      intDesignation: selectedDesignation!.intDesignation,
    }

    if (isEdit && employeeGuid) {
      updateEmployee.mutate(
        { id: employeeGuid, input },
        {
          onSuccess: () => { setSaved(true); showToast('Employee updated successfully') },
          onError: (error: Error) => showToast(error.message || 'Failed to update employee', 'error'),
        },
      )
    } else {
      createEmployee.mutate(input, {
        onSuccess: () => { setSaved(true); showToast('Employee added successfully') },
        onError: (error: Error) => showToast(error.message || 'Failed to add employee', 'error'),
      })
    }
  }

  const isPending = isEdit ? updateEmployee.isPending : createEmployee.isPending

  if (saved) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <SuccessPopup
            title={isEdit ? 'Employee Updated!' : 'Employee Added!'}
            subtitle={isEdit ? 'Your changes have been saved successfully.' : 'The new employee has been saved successfully.'}
            onClose={handleClose}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay open" id={isEdit ? 'edit-employee-modal' : 'new-employee-modal'}>
      <div className="modal modal-80 modal-flex" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className={`lni ${isEdit ? 'lni-pencil' : 'lni-user'}`}></i> {isEdit ? 'Edit Employee' : 'Add Employee'}</div>
          <button className="modal-close" onClick={onClose}><i className="lni lni-close"></i></button>
        </div>

        <div className="modal-scroll">

          {/* Personal Details */}
          <div className="sec-divider">Personal Details</div>
          <div className="g3">
            <div className="fg">
              <div className="lbl">Category <span className="req">*</span></div>
              <SearchSelect options={CATEGORIES.map(c => c.label)} value={category} onChange={v => { setCategory(v); clearError('category') }} />
              {errors.category && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.category}</p>}
            </div>
            <div className="fg">
              <div className="lbl">Title <span className="req">*</span></div>
              <SearchSelect placeholder="Select…" options={TITLES} value={title} onChange={v => { setTitle(v); clearError('title') }} />
              {errors.title && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.title}</p>}
            </div>
            <div className="fg">
              <div className="lbl">First Name <span className="req">*</span></div>
              <input className="ctrl" type="text" placeholder={isEdit ? undefined : 'First name'} value={firstName} onChange={e => { setFirstName(e.target.value); clearError('firstName') }} style={errors.firstName ? { borderColor: 'var(--red)' } : undefined} />
              {errors.firstName && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.firstName}</p>}
            </div>
            <div className="fg">
              <div className="lbl">Surname <span className="req">*</span></div>
              <input className="ctrl" type="text" placeholder={isEdit ? undefined : 'Surname'} value={surname} onChange={e => { setSurname(e.target.value); clearError('surname') }} style={errors.surname ? { borderColor: 'var(--red)' } : undefined} />
              {errors.surname && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.surname}</p>}
            </div>
            <div className="fg"><div className="lbl">Other Name</div><input className="ctrl" type="text" placeholder="Other name" value={otherName} onChange={e => setOtherName(e.target.value)} /></div>
            <div className="fg">
              <div className="lbl">University Email <span className="req">*</span></div>
              <input className="ctrl" type="email" placeholder={isEdit ? undefined : 'auto-generated'} value={emailId} onChange={e => { setEmailId(e.target.value); clearError('emailId') }} style={errors.emailId ? { borderColor: 'var(--red)' } : undefined} />
              {errors.emailId && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.emailId}</p>}
            </div>
            <div className="fg">
              <div className="lbl">Sex <span className="req">*</span></div>
              <SearchSelect placeholder="Select…" options={SEXES} value={sex} onChange={v => { setSex(v); clearError('sex') }} />
              {errors.sex && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.sex}</p>}
            </div>
            <div className="fg">
              <div className="lbl">Date of Birth <span className="req">*</span></div>
              <DatePicker
                value={birthDate}
                maxYmd={getMaxBirthDate()}
                onChange={v => { setBirthDate(v); clearError('birthDate') }}
                hasError={!!errors.birthDate}
              />
              {errors.birthDate && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.birthDate}</p>}
            </div>
            <div className="fg">
              <div className="lbl">Place of Birth <span className="req">*</span></div>
              <input className="ctrl" type="text" placeholder={isEdit ? undefined : 'e.g. Kampala'} value={placeOfBirth} onChange={e => { setPlaceOfBirth(e.target.value); clearError('placeOfBirth') }} style={errors.placeOfBirth ? { borderColor: 'var(--red)' } : undefined} />
              {errors.placeOfBirth && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.placeOfBirth}</p>}
            </div>
            <div className="fg">
              <div className="lbl">Country</div>
              <SearchSelect placeholder="Select…" options={countryOptions} value={country} onChange={setCountry} />
            </div>
            <div className="fg">
              <div className="lbl">National ID Type <span className="req">*</span></div>
              <input className="ctrl" type="text" placeholder={isEdit ? undefined : 'e.g. 1'} value={natId} onChange={e => { setNatId(e.target.value); clearError('natId') }} style={errors.natId ? { borderColor: 'var(--red)' } : undefined} />
              {errors.natId && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.natId}</p>}
            </div>
            <div className="fg">
              <div className="lbl">National ID Number</div>
              <input className="ctrl" type="text" placeholder={isEdit ? undefined : 'e.g. CM12345678'} value={nationalId} onChange={e => { setNationalId(e.target.value); clearError('nationalId') }} style={errors.nationalId ? { borderColor: 'var(--red)' } : undefined} />
              {errors.nationalId && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.nationalId}</p>}
            </div>
            <div className="fg">
              <div className="lbl">Religion</div>
              <SearchSelect placeholder="Select…" options={RELIGIONS} value={religion} onChange={setReligion} />
            </div>
            <div className="fg">
              <div className="lbl">Marital Status <span className="req">*</span></div>
              <SearchSelect placeholder="Select…" options={MARITAL_STATUSES} value={maritalStatus} onChange={v => { setMaritalStatus(v); clearError('maritalStatus') }} />
              {errors.maritalStatus && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.maritalStatus}</p>}
            </div>
            <div className="fg">
              <div className="lbl">Department <span className="req">*</span></div>
              <SearchSelect placeholder="Select department…" options={departmentOptions} value={department} onChange={v => { handleDepartmentChange(v); clearError('department') }} />
              {errors.department && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.department}</p>}
            </div>
            <div className="fg">
              <div className="lbl">Designation <span className="req">*</span></div>
              <SearchSelect
                placeholder={department ? 'Select designation…' : 'Select department first'}
                options={designationOptions}
                value={designation}
                onChange={v => { setDesignation(v); clearError('designation') }}
              />
              {errors.designation && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.designation}</p>}
            </div>
          </div>

        </div>

        <div className="modal-footer">
          <button className="btn btn-neu" onClick={handleClose}>Cancel</button>
          <button className="btn btn-primary" disabled={isPending} onClick={handleSubmit}>
            <i className="lni lni-checkmark"></i> {isPending ? (isEdit ? 'Saving…' : 'Adding…') : (isEdit ? 'Update Employee' : 'Add Employee')}
          </button>
        </div>
      </div>
    </div>
  )
}
