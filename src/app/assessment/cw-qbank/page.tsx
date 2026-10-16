'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import { Toast } from '@/components/Toast'
import { SearchSelect } from '@/components/SearchSelect'
import { TableSearch } from '@/components/TableSearch'
import { ScrollTable } from '@/components/ScrollTable'
import { ActionMenu } from '@/components/ActionMenu'
import { SuccessPopup } from '@/components/modals/shared/SuccessPopup'
import { SingleQuestionModal } from '@/components/modals/assessment/SingleQuestionModal'
import { RichTextDisplay, stripHtmlTags } from '@/components/RichTextEditor'
import { useIntakes, useCurrentAcademicIntake } from '@/hooks/academic/useIntakes'
import { useEmployees } from '@/hooks/employee/useEmployees'
import { EmployeeListItem } from '@/lib/api/employee/employee'
import { getSessionIdentity, getLoggedInUserGuid } from '@/lib/session'
import {
  useSingleQuestionCategories,
  useSingleQuestionCourseUnits,
  useQuestions,
  useDeleteQuestion,
} from '@/hooks/assessment/useQuestions'
import {
  useQuestionBankCategories,
  useDownloadQuestionBankTemplate,
  useQuestionBankSheets,
  useQuestionBankPreview,
  useQuestionBankImport,
  useDeleteQuestionBank,
  useQuestionBankCourseUnits,
  QuestionPreviewItem,
} from '@/hooks/assessment/useQuestionBank'
import { QuestionDto } from '@/lib/api/assessment/questions'

export default function QuestionBankUploadPage() {
  // ── Toast State ─────────────────────────────────────────────────────────────
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  const showToast = (msg: string, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  // ── Active Left Tab ('repository' or 'import') ──────────────────────────────
  const [activeTab, setActiveTab] = useState<'repository' | 'import'>('repository')
  const [isCategoryLoading, setIsCategoryLoading] = useState<boolean>(false)

  const handleTabChange = (newTab: 'repository' | 'import') => {
    if (newTab === activeTab) return
    setActiveTab(newTab)
    setIsCategoryLoading(true)
    setTimeout(() => {
      setIsCategoryLoading(false)
    }, 450)
  }

  // ── Global Scope State: Academic Intake & Faculty ───────────────────────────
  const [intakeGuid, setIntakeGuid] = useState<string>('')
  const [loggedInUserGuid, setLoggedInUserGuid] = useState<string>(() => getLoggedInUserGuid())
  const [loggedInUserName, setLoggedInUserName] = useState<string>('')

  // ── Tab 1: Question Repository Scope (Single Question API) ──────────────────
  // Categories: Class Test (1), Course Work (2), Class Activity (3)
  const [repoCategory, setRepoCategory] = useState<string>('2')
  const [repoCourseUnitGuid, setRepoCourseUnitGuid] = useState<string>('')
  const [repoFilterType, setRepoFilterType] = useState<'ALL' | 'MCQ' | 'DQ'>('ALL')
  const [repoSearch, setRepoSearch] = useState<string>('')

  // ── Tab 2: Bulk Excel Import Scope (Question Bank API) ──────────────────────
  // Categories: CBT (1), Course Work (2), University Exam (5)
  const [importCategory, setImportCategory] = useState<string>('2')
  const [importCourseUnitGuid, setImportCourseUnitGuid] = useState<string>('')
  const [file, setFile] = useState<File | null>(null)
  const [sheetNames, setSheetNames] = useState<string[]>([])
  const [selectedSheet, setSelectedSheet] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Excel Preview Table State ───────────────────────────────────────────────
  const [previewRows, setPreviewRows] = useState<QuestionPreviewItem[] | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [previewFilterType, setPreviewFilterType] = useState<'ALL' | 'MCQ' | 'DQ'>('ALL')
  const [previewSearch, setPreviewSearch] = useState<string>('')

  // ── Modals State ────────────────────────────────────────────────────────────
  const [isAddingQuestion, setIsAddingQuestion] = useState<boolean>(false)
  const [editingQuestion, setEditingQuestion] = useState<QuestionDto | null>(null)
  const [viewingQuestion, setViewingQuestion] = useState<QuestionDto | null>(null)
  const [questionToDelete, setQuestionToDelete] = useState<QuestionDto | null>(null)
  const [showDeleteBankModal, setShowDeleteBankModal] = useState<boolean>(false)
  const [successModal, setSuccessModal] = useState<{ title: string; subtitle: string } | null>(null)

  // ── Section Scroll Refs ─────────────────────────────────────────────────────
  const previewSectionRef = useRef<HTMLDivElement>(null)
  const errorRef = useRef<HTMLDivElement>(null)

  // ── Global Queries ──────────────────────────────────────────────────────────
  const { data: intakes, isLoading: isLoadingIntakes } = useIntakes()
  const { data: currentIntake } = useCurrentAcademicIntake()
  const { data: employeesData } = useEmployees()

  // ── Tab 1 Queries: Question Repository (Single Question Endpoints) ──────────
  const { data: singleCategories, isLoading: isLoadingSingleCategories } = useSingleQuestionCategories()
  const repoUnitsQuery = useSingleQuestionCourseUnits(
    intakeGuid,
    loggedInUserGuid || undefined,
    activeTab === 'repository' || Boolean(intakeGuid)
  )
  const repoCourseUnits = repoUnitsQuery.data

  const {
    data: liveQuestions,
    isLoading: isLoadingQuestions,
    isFetching: isFetchingQuestions,
    refetch: refetchQuestions,
  } = useQuestions(
    repoCourseUnitGuid,
    Number(repoCategory),
    intakeGuid,
    Boolean(repoCourseUnitGuid && repoCategory && intakeGuid)
  )

  // ── Tab 2 Queries: Bulk Excel Import (Question Bank Endpoints) ──────────────
  const { data: bankCategories, isLoading: isLoadingBankCategories } = useQuestionBankCategories()
  const importUnitsQuery = useQuestionBankCourseUnits(
    intakeGuid,
    loggedInUserGuid,
    activeTab === 'import' || Boolean(intakeGuid)
  )
  const importCourseUnits = importUnitsQuery.data
  const needsLecturer = activeTab === 'import' && !loggedInUserGuid

  // ── Mutations ───────────────────────────────────────────────────────────────
  const downloadTemplateMut = useDownloadQuestionBankTemplate()
  const sheetsMut = useQuestionBankSheets()
  const previewMut = useQuestionBankPreview()
  const importMut = useQuestionBankImport()
  const deleteSingleMut = useDeleteQuestion()
  const deleteBankMut = useDeleteQuestionBank()

  // ── Resolve logged-in faculty identity & UUID ──────────────────────────────
  useEffect(() => {
    const identity = getSessionIdentity()
    if (identity) {
      if (identity.displayName) setLoggedInUserName(identity.displayName)
      const guid =
        identity.employeeGuid ||
        identity.userGuid ||
        (identity as any)?.uuid ||
        (identity as any)?.id ||
        ''
      if (guid && !loggedInUserGuid) {
        setLoggedInUserGuid(guid)
      }
    }
  }, [loggedInUserGuid])

  // ── Auto-select current intake ──────────────────────────────────────────────
  useEffect(() => {
    if (!intakeGuid) {
      if (currentIntake?.intakeGuid) {
        setIntakeGuid(currentIntake.intakeGuid)
      } else if (intakes && intakes.length > 0) {
        setIntakeGuid(intakes[0].intakeGuid)
      }
    }
  }, [currentIntake, intakes, intakeGuid])

  // ── Auto-select first repo course unit when units load ──────────────────────
  useEffect(() => {
    if (repoCourseUnits && repoCourseUnits.length > 0) {
      if (!repoCourseUnitGuid || !repoCourseUnits.some(u => u.courseUnitGuid === repoCourseUnitGuid)) {
        setRepoCourseUnitGuid(repoCourseUnits[0].courseUnitGuid)
      }
    } else if (repoCourseUnits && repoCourseUnits.length === 0) {
      setRepoCourseUnitGuid('')
    }
  }, [repoCourseUnits, repoCourseUnitGuid])

  // ── Auto-select first import course unit when units load ────────────────────
  useEffect(() => {
    if (importCourseUnits && importCourseUnits.length > 0) {
      if (!importCourseUnitGuid || !importCourseUnits.some(u => u.courseUnitGuid === importCourseUnitGuid)) {
        setImportCourseUnitGuid(importCourseUnits[0].courseUnitGuid)
      }
    } else if (importCourseUnits && importCourseUnits.length === 0) {
      setImportCourseUnitGuid('')
    }
  }, [importCourseUnits, importCourseUnitGuid])

  // ── Reset dependent fields when intake changes ──────────────────────────────
  const handleIntakeChange = (val: string) => {
    setIntakeGuid(val)
    setRepoCourseUnitGuid('')
    setImportCourseUnitGuid('')
    setPreviewRows(null)
    setValidationError(null)
  }

  // ── File Selection & Sheets Fetching ────────────────────────────────────────
  const handleFilePicked = (pickedFile: File) => {
    if (!pickedFile.name.toLowerCase().endsWith('.xlsx')) {
      showToast('Please upload an Excel workbook (.xlsx format)', 'danger')
      return
    }

    setFile(pickedFile)
    setPreviewRows(null)
    setValidationError(null)
    setSheetNames([])
    setSelectedSheet('')

    // Immediately fetch sheet names
    sheetsMut.mutate(pickedFile, {
      onSuccess: (sheets) => {
        if (sheets && sheets.length > 0) {
          setSheetNames(sheets)
          const defaultSheet = sheets.find(s => s.toLowerCase() === 'questions') ?? sheets[0]
          setSelectedSheet(defaultSheet)
          showToast(`Workbook loaded (${sheets.length} sheet(s) detected)`, 'info')
        } else {
          setSheetNames([])
          setSelectedSheet('')
        }
      },
      onError: (err) => {
        showToast(err.message || 'Failed to inspect workbook sheets', 'danger')
      },
    })
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFilePicked(files[0])
    }
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilePicked(e.dataTransfer.files[0])
    }
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleClearFile = () => {
    setFile(null)
    setSheetNames([])
    setSelectedSheet('')
    setPreviewRows(null)
    setValidationError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // ── Preview Submission ──────────────────────────────────────────────────────
  const handlePreview = () => {
    if (!file) {
      showToast('Please select an Excel file to preview', 'warn')
      return
    }
    if (!importCourseUnitGuid) {
      showToast('Please select a Course Unit for bulk import', 'warn')
      return
    }
    if (!importCategory) {
      showToast('Please select an Assessment Category for bulk import', 'warn')
      return
    }
    if (!intakeGuid) {
      showToast('Please select an Academic Intake', 'warn')
      return
    }

    setValidationError(null)

    previewMut.mutate(
      {
        file,
        sheetName: selectedSheet || undefined,
        courseUnitGuid: importCourseUnitGuid,
        category: Number(importCategory),
        intakeGuid,
      },
      {
        onSuccess: (data) => {
          setPreviewRows(data)
          setValidationError(null)
          showToast(`Preview loaded successfully (${data.length} question(s))`, 'success')
          setTimeout(() => {
            previewSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }, 100)
        },
        onError: (err) => {
          setPreviewRows(null)
          setValidationError(err.message || 'Validation failed. Please verify the Excel sheet structure.')
          setTimeout(() => {
            errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }, 100)
        },
      },
    )
  }

  // ── Import / Save Submission ────────────────────────────────────────────────
  const handleImport = () => {
    if (!file || !importCourseUnitGuid || !importCategory || !intakeGuid) {
      showToast('Missing required fields for import', 'warn')
      return
    }

    setValidationError(null)
    importMut.mutate(
      {
        file,
        sheetName: selectedSheet || undefined,
        courseUnitGuid: importCourseUnitGuid,
        category: Number(importCategory),
        intakeGuid,
      },
      {
        onSuccess: () => {
          const count = previewRows?.length ?? 0
          setSuccessModal({
            title: 'Questions Uploaded Successfully!',
            subtitle: `${count > 0 ? `${count} question(s)` : 'Questions'} committed to the Question Bank database.`,
          })
          handleClearFile()
          // Automatically sync repository unit and refetch live questions
          if (importCategory === '2') {
            setRepoCategory('2')
          }
          if (importCourseUnitGuid) {
            setRepoCourseUnitGuid(importCourseUnitGuid)
          }
          refetchQuestions()
          setActiveTab('repository')
        },
        onError: (err) => {
          setValidationError(err.message || 'Import failed. Please check validation rules.')
          showToast(err.message || 'Import failed', 'danger')
        },
      },
    )
  }

  // ── Single Question Delete ──────────────────────────────────────────────────
  const handleConfirmDeleteSingle = () => {
    if (!questionToDelete) return

    deleteSingleMut.mutate(questionToDelete.questionGuid, {
      onSuccess: () => {
        showToast('Question deleted successfully!', 'success')
        setQuestionToDelete(null)
        refetchQuestions()
      },
      onError: (err: any) => {
        showToast(err.message || 'Failed to delete question', 'danger')
      },
    })
  }

  // ── Delete Entire Bank Questions ────────────────────────────────────────────
  const handleConfirmDeleteBank = () => {
    if (!repoCourseUnitGuid || !repoCategory || !intakeGuid) return

    deleteBankMut.mutate(
      {
        courseUnitGuid: repoCourseUnitGuid,
        category: Number(repoCategory),
        intakeGuid,
      },
      {
        onSuccess: (res) => {
          setShowDeleteBankModal(false)
          setPreviewRows(null)
          refetchQuestions()
          setSuccessModal({
            title: 'Question Bank Cleared',
            subtitle: res.message || 'The questions have been soft-deleted from the database.',
          })
        },
        onError: (err) => {
          showToast(err.message || 'Failed to delete question bank', 'danger')
        },
      },
    )
  }

  // ── Template Download ───────────────────────────────────────────────────────
  const handleDownloadTemplate = () => {
    downloadTemplateMut.mutate(undefined, {
      onSuccess: () => {
        showToast('Template download started', 'success')
      },
      onError: (err) => {
        showToast(err.message || 'Failed to generate template download link', 'danger')
      },
    })
  }

  // ── Derived Lookups: Tab 1 (Repository) ─────────────────────────────────────
  const selectedRepoUnit = useMemo(() => {
    return repoCourseUnits?.find(u => u.courseUnitGuid === repoCourseUnitGuid)
  }, [repoCourseUnits, repoCourseUnitGuid])

  const selectedRepoCategoryObj = useMemo(() => {
    const defaultList = [
      { value: 1, name: 'Class Test' },
      { value: 2, name: 'Course Work' },
      { value: 3, name: 'Class Activity' },
    ]
    const list = singleCategories && singleCategories.length > 0 ? singleCategories : defaultList
    return list.find(c => String(c.value) === String(repoCategory)) || list[1]
  }, [singleCategories, repoCategory])

  // ── Derived Lookups: Tab 2 (Import) ─────────────────────────────────────────
  const selectedImportUnit = useMemo(() => {
    return importCourseUnits?.find(u => u.courseUnitGuid === importCourseUnitGuid)
  }, [importCourseUnits, importCourseUnitGuid])

  const selectedImportCategoryObj = useMemo(() => {
    const defaultList = [
      { value: 1, name: 'CBT' },
      { value: 2, name: 'Course Work' },
      { value: 5, name: 'University Exam' },
    ]
    const list = bankCategories && bankCategories.length > 0 ? bankCategories : defaultList
    return list.find(c => String(c.value) === String(importCategory)) || list[1]
  }, [bankCategories, importCategory])

  // ── Global Lookups ──────────────────────────────────────────────────────────
  const selectedIntake = useMemo(() => {
    return intakes?.find(i => i.intakeGuid === intakeGuid)
  }, [intakes, intakeGuid])

  const loggedInEmployee = useMemo(() => {
    if (loggedInUserGuid && employeesData) {
      return employeesData.find((e: EmployeeListItem) => e.employeeGuid === loggedInUserGuid)
    }
    return null
  }, [employeesData, loggedInUserGuid])

  // ── Filtered Live Questions ─────────────────────────────────────────────────
  const filteredLiveQuestions = useMemo(() => {
    if (!liveQuestions) return []
    return liveQuestions.filter((q) => {
      if (repoFilterType === 'MCQ' && q.questionType !== 1) return false
      if (repoFilterType === 'DQ' && q.questionType !== 2) return false
      if (repoSearch.trim()) {
        const needle = repoSearch.toLowerCase()
        const matchQ = q.questionText?.toLowerCase().includes(needle)
        const matchAns = q.answerText?.toLowerCase().includes(needle)
        const matchOpts =
          q.option1Text?.toLowerCase().includes(needle) ||
          q.option2Text?.toLowerCase().includes(needle) ||
          q.option3Text?.toLowerCase().includes(needle) ||
          q.option4Text?.toLowerCase().includes(needle)
        return matchQ || matchAns || matchOpts
      }
      return true
    })
  }, [liveQuestions, repoFilterType, repoSearch])

  const liveMcqCount = useMemo(
    () => liveQuestions?.filter(q => q.questionType === 1).length ?? 0,
    [liveQuestions],
  )
  const liveDqCount = useMemo(
    () => liveQuestions?.filter(q => q.questionType === 2).length ?? 0,
    [liveQuestions],
  )

  // ── Filtered Preview Rows ───────────────────────────────────────────────────
  const filteredPreviewRows = useMemo(() => {
    if (!previewRows) return []
    return previewRows.filter((item) => {
      if (previewFilterType !== 'ALL' && item.questionType !== previewFilterType) {
        return false
      }
      if (previewSearch.trim()) {
        const needle = previewSearch.toLowerCase()
        const matchQuestion = item.question?.toLowerCase().includes(needle)
        const matchAnswer = item.answer?.toLowerCase().includes(needle)
        const matchOptions =
          item.option1?.toLowerCase().includes(needle) ||
          item.option2?.toLowerCase().includes(needle) ||
          item.option3?.toLowerCase().includes(needle) ||
          item.option4?.toLowerCase().includes(needle)
        return matchQuestion || matchAnswer || matchOptions
      }
      return true
    })
  }, [previewRows, previewFilterType, previewSearch])

  const previewMcqCount = useMemo(
    () => previewRows?.filter(r => r.questionType === 'MCQ').length ?? 0,
    [previewRows],
  )
  const previewDqCount = useMemo(
    () => previewRows?.filter(r => r.questionType === 'DQ').length ?? 0,
    [previewRows],
  )

  const isFormValidForPreview = Boolean(
    file && importCourseUnitGuid && importCategory && intakeGuid && !sheetsMut.isPending,
  )

  return (
    <div className="page active">
      {/* ── Page Header ─────────────────────────────────────────────────────── */}
      <div className="pg-hdr flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div className="flex-1 min-w-0">
          <div className="pg-title flex items-center gap-2 flex-wrap">
            <span>Question Bank & Repository</span>
          </div>
          <div className="pg-sub text-xs text-slate-500">
            Manage course examination questions individually or in bulk via Excel (.xlsx)
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            className="btn btn-neu btn-sm flex items-center gap-1.5 shadow-sm text-xs"
            onClick={handleDownloadTemplate}
            disabled={downloadTemplateMut.isPending}
            title="Download the official 9-column question import template"
          >
            {downloadTemplateMut.isPending ? (
              <>
                <span className="inline-block w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></span>
                <span>Generating Link...</span>
              </>
            ) : (
              <>
                <i className="lni lni-download text-slate-600"></i>
                <span>Download Template (.xlsx)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Top Row: Left Tabs + Right Unified Filter Card ───── */}
      <div className="flex flex-col lg:flex-row items-stretch gap-4 mb-4">
        
        {/* Left: Workflow Module Navigation Tabs Card */}
        <div className="card p-3.5 w-full lg:w-72 xl:w-80 shrink-0 flex flex-col justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1 mb-2 flex items-center justify-between">
              <span>Select Module</span>
              <span className="badge badge-neu text-[10px] font-semibold">2 Modes</span>
            </div>

            <div className="flex flex-col gap-2">
              {/* Tab 1: Question Repository */}
              <button
                type="button"
                onClick={() => handleTabChange('repository')}
                className={`w-full text-left p-2.5 rounded-lg border transition-all flex items-start gap-2.5 cursor-pointer ${
                  activeTab === 'repository'
                    ? 'bg-indigo-50/90 border-indigo-300 text-indigo-950 shadow-xs'
                    : 'bg-white border-transparent hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-sm ${
                    activeTab === 'repository'
                      ? 'bg-indigo-600 text-white shadow-xs font-bold'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  <i className="lni lni-library"></i>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-bold text-slate-900 truncate">Question Repository</span>
                    <span
                      className={`badge ${
                        activeTab === 'repository' ? 'badge-indigo font-bold' : 'badge-neu'
                      } text-[10px] px-1.5 py-0.2`}
                    >
                      {liveQuestions?.length ?? 0}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                    Class Test, Course Work, Activity
                  </div>
                </div>
              </button>

              {/* Tab 2: Bulk Excel Import */}
              <button
                type="button"
                onClick={() => handleTabChange('import')}
                className={`w-full text-left p-2.5 rounded-lg border transition-all flex items-start gap-2.5 cursor-pointer ${
                  activeTab === 'import'
                    ? 'bg-indigo-50/90 border-indigo-300 text-indigo-950 shadow-xs'
                    : 'bg-white border-transparent hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-sm ${
                    activeTab === 'import'
                      ? 'bg-indigo-600 text-white shadow-xs font-bold'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  <i className="lni lni-cloud-upload"></i>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-bold text-slate-900 truncate">Bulk Excel Import</span>
                    <span className="badge badge-green text-[10px] font-bold px-1.5 py-0.2">
                      .xlsx
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                    CBT, Course Work, Univ Exam
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Right: Unified Filter & Academic Scope Card */}
        <div className="card p-4 flex-1 min-w-0 flex flex-col justify-between">
          <div className="flex flex-wrap items-center justify-between pb-3 mb-3 border-b border-slate-100 gap-2">
            <div className="font-semibold text-sm text-slate-800 flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs font-bold">
                <i className="lni lni-funnel"></i>
              </span>
              <span>
                {activeTab === 'repository'
                  ? 'Question Repository Scope & Filters'
                  : 'Bulk Import Scope & Target'}
              </span>
              <span
                className={`badge ${
                  activeTab === 'repository' ? 'badge-indigo' : 'badge-green'
                } text-[11px] font-semibold`}
              >
                {activeTab === 'repository' ? 'Single Questions Mode' : 'Bulk Excel Mode'}
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs">
              {(loggedInEmployee || loggedInUserName || loggedInUserGuid) && (
                <span className="flex items-center gap-1.5 bg-slate-50 text-slate-600 px-2.5 py-1 rounded-md border border-slate-200">
                  <i className="lni lni-user text-indigo-600 text-xs"></i>
                  <span>
                    Faculty: <strong className="text-slate-800">{loggedInEmployee?.empName || loggedInUserName || 'Current User'}</strong>
                  </span>
                </span>
              )}
              {currentIntake && (
                <span className="badge badge-green text-[10px] font-semibold">Active Session</span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Col 1: Academic Intake */}
            <div className="fg mb-0">
              <label className="lbl">
                Academic Intake <span className="text-red-500">*</span>
              </label>
              <SearchSelect
                options={
                  intakes?.map(i => ({
                    value: i.intakeGuid,
                    label: `${i.intakeCode} — ${i.description}`,
                  })) || []
                }
                value={intakeGuid}
                onChange={handleIntakeChange}
                placeholder={isLoadingIntakes ? 'Loading intakes...' : 'Select intake'}
                disabled={isLoadingIntakes}
              />
              <div className="text-[11px] text-slate-400 mt-1 truncate">
                {selectedIntake ? `Active: ${selectedIntake.intakeCode}` : 'Choose an intake period'}
              </div>
            </div>

            {/* Col 2: Assessment Category (Shows loading spinner on tab change) */}
            <div className="fg mb-0">
              <label className="lbl flex items-center justify-between">
                <span>
                  Assessment Category <span className="text-red-500">*</span>
                </span>
                {isCategoryLoading && (
                  <span className="flex items-center gap-1 text-[11px] text-indigo-600 font-semibold animate-pulse">
                    <span className="inline-block w-2.5 h-2.5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></span>
                    <span>Loading...</span>
                  </span>
                )}
              </label>
              <SearchSelect
                options={
                  activeTab === 'repository'
                    ? (singleCategories && singleCategories.length > 0
                        ? singleCategories.map(c => ({
                            value: String(c.value),
                            label: c.name,
                          }))
                        : [
                            { value: '1', label: 'Class Test' },
                            { value: '2', label: 'Course Work' },
                            { value: '3', label: 'Class Activity' },
                          ])
                    : (bankCategories && bankCategories.length > 0
                        ? bankCategories.map(c => ({
                            value: String(c.value),
                            label: c.name,
                          }))
                        : [
                            { value: '1', label: 'CBT' },
                            { value: '2', label: 'Course Work' },
                            { value: '5', label: 'University Exam' },
                          ])
                }
                value={activeTab === 'repository' ? repoCategory : importCategory}
                onChange={val => {
                  if (activeTab === 'repository') {
                    setRepoCategory(val)
                  } else {
                    setImportCategory(val)
                    setPreviewRows(null)
                    setValidationError(null)
                  }
                }}
                placeholder={
                  isCategoryLoading
                    ? `Loading ${activeTab === 'repository' ? 'Repository' : 'Bulk'} categories...`
                    : (activeTab === 'repository' ? isLoadingSingleCategories : isLoadingBankCategories)
                      ? 'Loading categories...'
                      : 'Select category'
                }
                disabled={
                  isCategoryLoading ||
                  (activeTab === 'repository' ? isLoadingSingleCategories : isLoadingBankCategories)
                }
                isLoading={
                  isCategoryLoading ||
                  (activeTab === 'repository' ? isLoadingSingleCategories : isLoadingBankCategories)
                }
              />
              <div className="text-[11px] text-slate-400 mt-1 truncate">
                {activeTab === 'repository'
                  ? 'Options: Class Test, Course Work, Class Activity'
                  : 'Options: CBT, Course Work, University Exam'}
              </div>
            </div>

            {/* Col 3: Course Unit */}
            <div className="fg mb-0">
              <label className="lbl flex items-center justify-between">
                <span>
                  Course Unit <span className="text-red-500">*</span>
                </span>
                {((activeTab === 'repository' ? repoUnitsQuery.isFetching : importUnitsQuery.isFetching) || isCategoryLoading) && (
                  <span className="text-[11px] text-indigo-500 font-normal">Updating...</span>
                )}
              </label>
              <SearchSelect
                options={
                  (activeTab === 'repository' ? repoCourseUnits : importCourseUnits)?.map(u => ({
                    value: u.courseUnitGuid,
                    label: u.courseUnitCode
                      ? `${u.courseUnitCode} — ${u.courseUnitName || 'Untitled Unit'}`
                      : (u.courseUnitName || 'Untitled Unit'),
                  })) || []
                }
                value={activeTab === 'repository' ? repoCourseUnitGuid : importCourseUnitGuid}
                onChange={val => {
                  if (activeTab === 'repository') {
                    setRepoCourseUnitGuid(val)
                  } else {
                    setImportCourseUnitGuid(val)
                    setPreviewRows(null)
                    setValidationError(null)
                  }
                }}
                placeholder={
                  !intakeGuid
                    ? 'Pick Academic Intake first'
                    : isCategoryLoading || (activeTab === 'repository' ? repoUnitsQuery.isLoading : (needsLecturer || importUnitsQuery.isLoading))
                      ? 'Loading course units...'
                      : (activeTab === 'repository' ? repoCourseUnits : importCourseUnits)?.length === 0
                        ? 'No course units found for this intake'
                        : 'Select course unit'
                }
                disabled={
                  !intakeGuid ||
                  isCategoryLoading ||
                  (activeTab === 'repository' ? repoUnitsQuery.isLoading : (needsLecturer || importUnitsQuery.isLoading))
                }
                isLoading={
                  isCategoryLoading ||
                  (activeTab === 'repository' ? repoUnitsQuery.isLoading : importUnitsQuery.isLoading)
                }
              />
              <div className="text-[11px] text-slate-400 mt-1 truncate">
                {(activeTab === 'repository' ? repoCourseUnits : importCourseUnits)?.length ?? 0} course unit(s) available
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* ── Active Tab Workspace: Expanded to 100% Full Width ───── */}
      <div className="w-full">

        {/* ───────────────────────────────────────────────────────────────────
            SECTION 1: QUESTION REPOSITORY CONTENT (FULL WIDTH)
           ─────────────────────────────────────────────────────────────────── */}
        {activeTab === 'repository' && (
          <div className="space-y-4 w-full">

              {/* Questions List Card */}
              <div className="card p-4">
                {/* Header Bar */}
                <div className="flex flex-wrap items-center justify-between pb-3 mb-3 border-b border-slate-100 gap-3">
                  <div>
                    <div className="font-semibold text-base text-slate-800 mb-1 flex items-center gap-2 flex-wrap">
                      <span className="w-6 h-6 rounded-md bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs font-bold">
                        <i className="lni lni-list"></i>
                      </span>
                      <span>Active Questions List</span>
                      {selectedRepoUnit && (
                        <span className="font-mono text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded">
                          {selectedRepoUnit.courseUnitCode}
                        </span>
                      )}
                      <span className="badge badge-purple text-xs">
                        {selectedRepoCategoryObj?.name || 'Category'}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500">
                      Course: <strong className="text-slate-800">{selectedRepoUnit?.courseUnitName || 'Select a course unit'}</strong>
                      {' • '}
                      Intake: <strong className="text-slate-800">{selectedIntake?.intakeCode || 'Active Intake'}</strong>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="btn btn-primary btn-sm flex items-center gap-1.5"
                      onClick={() => setIsAddingQuestion(true)}
                      disabled={!repoCourseUnitGuid || !repoCategory || !intakeGuid}
                      title="Add a single new question to the selected course unit bank"
                    >
                      <i className="lni lni-plus"></i>
                      <span>Add Single Question</span>
                    </button>

                    <button
                      type="button"
                      className="btn btn-neu btn-sm flex items-center gap-1.5"
                      onClick={() => refetchQuestions()}
                      disabled={isFetchingQuestions}
                      title="Refresh questions from database"
                    >
                      <i className={`lni lni-reload ${isFetchingQuestions ? 'animate-spin' : ''}`}></i>
                      <span>Refresh</span>
                    </button>

                    {repoCourseUnitGuid && (liveQuestions && liveQuestions.length > 0) && (
                      <button
                        type="button"
                        className="btn btn-danger btn-sm flex items-center gap-1.5"
                        onClick={() => setShowDeleteBankModal(true)}
                        title="Delete all questions in this question bank"
                      >
                        <i className="lni lni-trash-can"></i>
                        <span>Delete All</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Filter Toolbar with Counts & Search */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg border border-slate-200/70">
                    <button
                      type="button"
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${repoFilterType === 'ALL'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                        }`}
                      onClick={() => setRepoFilterType('ALL')}
                    >
                      <span>All Questions</span>
                      <span className="badge badge-neu text-[11px] font-bold px-1.5 py-0.2">
                        {liveQuestions?.length ?? 0}
                      </span>
                    </button>
                    <button
                      type="button"
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${repoFilterType === 'MCQ'
                        ? 'bg-white text-purple-700 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                        }`}
                      onClick={() => setRepoFilterType('MCQ')}
                    >
                      <span>Multiple Choice</span>
                      <span className="badge badge-purple text-[11px] font-bold px-1.5 py-0.2">
                        {liveMcqCount}
                      </span>
                    </button>
                    <button
                      type="button"
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${repoFilterType === 'DQ'
                        ? 'bg-white text-blue-700 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                        }`}
                      onClick={() => setRepoFilterType('DQ')}
                    >
                      <span>Descriptive</span>
                      <span className="badge badge-blue text-[11px] font-bold px-1.5 py-0.2">
                        {liveDqCount}
                      </span>
                    </button>
                  </div>

                  <TableSearch
                    className="w-full sm:w-72"
                    placeholder="Search question text or answer..."
                    value={repoSearch}
                    onChange={setRepoSearch}
                    results={filteredLiveQuestions.slice(0, 5).map(q => ({
                      id: q.questionGuid,
                      primary: stripHtmlTags(q.questionText) || 'Untitled Question',
                      secondary: `${q.questionType === 1 ? 'MCQ' : 'DQ'} • Ans: ${stripHtmlTags(q.answerText)}`,
                    }))}
                    onSelect={r => setRepoSearch(r.primary)}
                  />
                </div>

                {/* Live Questions Table */}
                <ScrollTable maxHeight="540px">
                  <table style={{ minWidth: 880, width: '100%' }}>
                    <thead className="sticky top-0 z-10 shadow-xs">
                      <tr>
                        <th style={{ width: 48, textAlign: 'center' }}>ACTION</th>
                        <th style={{ width: 45, textAlign: 'center' }}>#</th>
                        <th style={{ width: 85, textAlign: 'center' }}>TYPE</th>
                        <th style={{ minWidth: 280, maxWidth: 460 }}>QUESTION</th>
                        <th style={{ minWidth: 260 }}>OPTIONS</th>
                        <th style={{ minWidth: 160 }}>ANSWER</th>
                        <th style={{ width: 85, textAlign: 'center' }}>SECTION</th>
                      </tr>
                    </thead>
                    <tbody>
                      {isLoadingQuestions ? (
                        <tr>
                          <td colSpan={7} style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--g500)' }}>
                            <span className="inline-block w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mb-2"></span>
                            <div className="text-xs font-medium">Fetching live questions from repository...</div>
                          </td>
                        </tr>
                      ) : !repoCourseUnitGuid ? (
                        <tr>
                          <td colSpan={7} style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--g500)' }}>
                            <i className="lni lni-book text-3xl block mb-2 opacity-40"></i>
                            <div className="text-sm font-semibold text-slate-700">Please select a Course Unit above</div>
                            <div className="text-xs text-slate-400 mt-1">Choose a planned course unit to inspect active questions.</div>
                          </td>
                        </tr>
                      ) : filteredLiveQuestions.length === 0 ? (
                        <tr>
                          <td colSpan={7} style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--g400)' }}>
                            <i className="lni lni-inbox text-3xl block mb-2 opacity-40"></i>
                            <div className="text-sm font-semibold text-slate-700">No questions found in this Question Bank</div>
                            <div className="text-xs text-slate-400 mt-1">
                              There are currently no active questions for {selectedRepoUnit?.courseUnitCode} under {selectedRepoCategoryObj?.name || 'this category'}.
                            </div>
                            <div className="mt-4 flex items-center justify-center gap-2">
                              <button
                                type="button"
                                className="btn btn-primary btn-sm flex items-center gap-1.5"
                                onClick={() => setIsAddingQuestion(true)}
                              >
                                <i className="lni lni-plus"></i>
                                <span>Add First Question</span>
                              </button>
                              <button
                                type="button"
                                className="btn btn-neu btn-sm flex items-center gap-1.5"
                                onClick={() => handleTabChange('import')}
                              >
                                <i className="lni lni-upload"></i>
                                <span>Upload Excel (.xlsx)</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        filteredLiveQuestions.map((q, idx) => (
                          <tr key={q.questionGuid || idx} className="hover:bg-slate-50/80 transition-colors">
                            {/* ActionMenu in First Column */}
                            <td style={{ width: 48, textAlign: 'center' }}>
                              <ActionMenu tooltip="Question Actions">
                                <button
                                  type="button"
                                  className="btn btn-neu btn-sm flex items-center gap-1.5"
                                  onClick={() => setViewingQuestion(q)}
                                >
                                  <i className="lni lni-eye text-indigo-600"></i>
                                  <span>View Details</span>
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-neu btn-sm flex items-center gap-1.5"
                                  onClick={() => setEditingQuestion(q)}
                                >
                                  <i className="lni lni-pencil-alt text-amber-600"></i>
                                  <span>Edit Question</span>
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-neu btn-sm flex items-center gap-1.5 text-red-600"
                                  onClick={() => setQuestionToDelete(q)}
                                >
                                  <i className="lni lni-trash-can"></i>
                                  <span>Delete Question</span>
                                </button>
                              </ActionMenu>
                            </td>

                            {/* SL No */}
                            <td style={{ textAlign: 'center', fontFamily: 'monospace', fontSize: 12, color: 'var(--g500)' }}>
                              {idx + 1}
                            </td>

                            {/* Type Badge */}
                            <td style={{ textAlign: 'center' }}>
                              <span
                                className={`badge ${q.questionType === 1 ? 'badge-purple' : 'badge-blue'
                                  }`}
                              >
                                {q.questionType === 1 ? 'MCQ' : 'DQ'}
                              </span>
                            </td>

                            {/* Question Text */}
                            <td style={{ whiteSpace: 'normal', minWidth: 280, maxWidth: 460, lineHeight: 1.6, color: 'var(--g800)' }}>
                              <RichTextDisplay content={q.questionText} />
                              {q.imageUrl && (
                                <div className="mt-2 flex items-center gap-2">
                                  <a
                                    href={q.imageUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 rounded text-[11px] font-medium transition-colors"
                                    title="View attached diagram / image"
                                    onClick={e => e.stopPropagation()}
                                  >
                                    <i className="lni lni-image text-xs"></i>
                                    <span>Image Attached</span>
                                    {q.imageFileName && (
                                      <span className="text-slate-400 font-mono text-[10px]">
                                        ({q.imageFileName})
                                      </span>
                                    )}
                                  </a>
                                </div>
                              )}
                            </td>

                            {/* Options */}
                            <td style={{ whiteSpace: 'normal', minWidth: 260 }}>
                              {q.questionType === 1 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px]">
                                  <div className={`border rounded px-2 py-0.5 ${q.answerText === q.option1Text ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-medium' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                                    <strong className="text-slate-400 mr-1">A:</strong>
                                    {q.option1Text || '—'}
                                  </div>
                                  <div className={`border rounded px-2 py-0.5 ${q.answerText === q.option2Text ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-medium' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                                    <strong className="text-slate-400 mr-1">B:</strong>
                                    {q.option2Text || '—'}
                                  </div>
                                  <div className={`border rounded px-2 py-0.5 ${q.answerText === q.option3Text ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-medium' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                                    <strong className="text-slate-400 mr-1">C:</strong>
                                    {q.option3Text || '—'}
                                  </div>
                                  <div className={`border rounded px-2 py-0.5 ${q.answerText === q.option4Text ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-medium' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                                    <strong className="text-slate-400 mr-1">D:</strong>
                                    {q.option4Text || '—'}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-slate-400 text-xs italic">Descriptive (No options)</span>
                              )}
                            </td>

                            {/* Answer */}
                            <td style={{ whiteSpace: 'normal', minWidth: 160 }}>
                              {q.questionType === 1 ? (
                                <span className="inline-block bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11.5px] px-2.5 py-1 rounded font-medium font-mono font-bold">
                                  {stripHtmlTags(q.answerText)}
                                </span>
                              ) : (
                                <span className="inline-block bg-slate-50 border border-slate-200 text-slate-700 text-xs px-2.5 py-1 rounded font-medium max-w-[220px] truncate" title={stripHtmlTags(q.answerText)}>
                                  <RichTextDisplay content={q.answerText} />
                                </span>
                              )}
                            </td>

                            {/* Section */}
                            <td style={{ textAlign: 'center' }}>
                              {q.level ? (
                                <span
                                  className="badge badge-neu text-xs font-mono font-semibold"
                                  title={`Section ${q.level === 1 ? 'A' : q.level === 2 ? 'B' : q.level === 3 ? 'C' : q.level}`}
                                >
                                  {q.level === 1 ? 'Sec A' : q.level === 2 ? 'Sec B' : q.level === 3 ? 'Sec C' : `L${q.level}`}
                                </span>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </ScrollTable>
              </div>
            </div>
          )}

          {/* ───────────────────────────────────────────────────────────────────
              RIGHT PANEL 2: BULK EXCEL IMPORT CONTENT
             ─────────────────────────────────────────────────────────────────── */}
          {activeTab === 'import' && (
            <div className="space-y-4">

              {/* Upload Card */}
              <div className="card p-5">
                <div className="flex flex-wrap items-center justify-between pb-3 mb-4 border-b border-slate-100 gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">
                      <i className="lni lni-cloud-upload"></i>
                    </span>
                    <div>
                      <div className="card-title mb-0">Upload Questions via Excel (.xlsx)</div>
                      <div className="text-xs text-slate-500">
                        Target: <strong className="text-slate-800 font-mono">{selectedImportUnit?.courseUnitCode || 'Select Course Unit'}</strong>
                        {' • '}
                        Category: <strong className="text-slate-800">{selectedImportCategoryObj?.name || 'Course Work'}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="btn btn-neu btn-sm flex items-center gap-1.5"
                      onClick={handleDownloadTemplate}
                      disabled={downloadTemplateMut.isPending}
                      title="Download blank official 9-column template"
                    >
                      {downloadTemplateMut.isPending ? (
                        <>
                          <span className="inline-block w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></span>
                          <span>Generating Link...</span>
                        </>
                      ) : (
                        <>
                          <i className="lni lni-download"></i>
                          <span>Blank 9-Column Template</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Template Format Note */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3 text-xs text-slate-600 mb-4 flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <strong className="text-slate-800">Required 9 Columns:</strong> 1. Sl No · 2. Question · 3. Type (MCQ/DQ) · 4. Option 1 · 5. Option 2 · 6. Option 3 · 7. Option 4 · 8. Answer · 9. Section (1/2/3)
                  </div>
                  <span className="text-[11px] font-mono bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-500">
                    .xlsx format only
                  </span>
                </div>

                {/* File Upload Dropzone & Sheet Selector */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start mb-4">
                  <div className="lg:col-span-2">
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept=".xlsx"
                      onChange={handleFileInputChange}
                      className="hidden"
                      id="qb-file-input"
                    />

                    {!file ? (
                      <div
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed border-slate-300 hover:border-indigo-500 bg-slate-50 hover:bg-indigo-50/20 rounded-xl p-6 text-center cursor-pointer transition-all duration-200 group flex flex-col items-center justify-center min-h-[120px]"
                      >
                        <div className="w-10 h-10 rounded-full bg-slate-100 group-hover:bg-indigo-100 text-slate-500 group-hover:text-indigo-600 flex items-center justify-center text-xl mb-1.5 transition-colors">
                          <i className="lni lni-cloud-upload"></i>
                        </div>
                        <div className="text-sm font-semibold text-slate-800 group-hover:text-indigo-600">
                          Drop your Excel (.xlsx) file here or <span className="underline decoration-indigo-300">browse</span>
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          Must follow the official 9-column format · Maximum 10MB
                        </div>
                      </div>
                    ) : (
                      <div className="border border-slate-200 rounded-xl p-3 bg-white shadow-sm flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl shrink-0">
                            <i className="lni lni-empty-file"></i>
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-slate-900 line-clamp-1">{file.name}</div>
                            <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                              <span>{(file.size / 1024).toFixed(1)} KB</span>
                              <span>•</span>
                              <span className="text-emerald-600 font-medium">Ready for preview</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="btn btn-neu btn-sm"
                            onClick={() => fileInputRef.current?.click()}
                            title="Choose a different file"
                          >
                            Replace
                          </button>
                          <button
                            type="button"
                            className="w-8 h-8 rounded-lg border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 flex items-center justify-center transition-colors"
                            onClick={handleClearFile}
                            title="Remove file"
                          >
                            <i className="lni lni-close text-xs"></i>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Sheet Selector */}
                  <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 flex flex-col gap-3">
                    <div className="fg mb-0">
                      <label className="lbl flex items-center justify-between">
                        <span>Select Worksheet</span>
                        {sheetsMut.isPending && (
                          <span className="text-[11px] text-indigo-500 flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                            Scanning...
                          </span>
                        )}
                      </label>
                      <SearchSelect
                        options={sheetNames.map(s => ({ value: s, label: s }))}
                        value={selectedSheet}
                        onChange={val => {
                          setSelectedSheet(val)
                          setPreviewRows(null)
                          setValidationError(null)
                        }}
                        placeholder={
                          !file
                            ? 'Upload file to load sheets'
                            : sheetsMut.isPending
                              ? 'Reading workbook sheets...'
                              : sheetNames.length === 0
                                ? 'No sheets detected'
                                : 'Select worksheet'
                        }
                        disabled={!file || sheetsMut.isPending || sheetNames.length === 0}
                      />
                    </div>
                  </div>
                </div>

                {/* Action Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="btn btn-primary flex items-center gap-1.5"
                      onClick={handlePreview}
                      disabled={!isFormValidForPreview || previewMut.isPending}
                    >
                      {previewMut.isPending ? (
                        <>
                          <span className="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                          <span>Validating & Parsing...</span>
                        </>
                      ) : (
                        <>
                          <i className="lni lni-eye"></i>
                          <span>Preview & Validate Questions</span>
                        </>
                      )}
                    </button>

                    {file && (
                      <button
                        type="button"
                        className="btn btn-neu flex items-center gap-1"
                        onClick={handleClearFile}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Validation Error Banner */}
              {validationError && (
                <div ref={errorRef} style={{ scrollMarginTop: '20px' }} className="bg-red-50 border border-red-200 text-red-900 rounded-xl p-4 shadow-sm flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-red-100 text-red-600 flex items-center justify-center text-lg shrink-0 mt-0.5">
                    <i className="lni lni-warning"></i>
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-bold text-red-950 mb-1">Excel Sheet Validation Failed</div>
                    <div className="text-xs text-red-800 leading-relaxed font-mono bg-red-100/50 p-2.5 rounded border border-red-200/60 mb-2">
                      {validationError}
                    </div>
                    {validationError.toLowerCase().includes('no valid data') ? (
                      <div className="text-[12px] text-red-800 leading-relaxed bg-white/80 p-2.5 rounded border border-red-200 mt-1">
                        <strong>Why this happened:</strong> The uploaded file contains only column headers (Row 1) and no question rows below it. Downloaded templates from the system are blank templates for faculty to fill in questions.
                      </div>
                    ) : (
                      <div className="text-[11.5px] text-red-700">
                        Please fix the highlighted row(s) or sheet structure in your Excel file and preview again. No questions have been imported.
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    className="text-red-400 hover:text-red-700 transition-colors"
                    onClick={() => setValidationError(null)}
                  >
                    <i className="lni lni-close text-xs"></i>
                  </button>
                </div>
              )}

              {/* Excel Preview Grid Section */}
              {previewRows && (
                <div ref={previewSectionRef} style={{ scrollMarginTop: '20px' }} className="card">
                  <div className="card-hdr flex flex-wrap items-center justify-between gap-3 p-5 pb-3">
                    <div>
                      <div className="card-title flex items-center gap-2 mb-1">
                        <span className="ctitle-icon">
                          <i className="lni lni-eye"></i>
                        </span>
                        <span>Question Bank Preview</span>
                        <span className="badge badge-green ml-2">Validated & Ready</span>
                      </div>
                      <div className="text-xs text-slate-500">
                        Course Unit: <strong className="text-slate-800 font-mono">{selectedImportUnit?.courseUnitCode || 'Selected Unit'}</strong>
                        {' • '}
                        Category: <strong className="text-slate-800">{selectedImportCategoryObj?.name || 'Category'}</strong>
                        {' • '}
                        Worksheet: <strong className="text-slate-800">{selectedSheet || 'Default'}</strong>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        className="btn btn-primary bg-emerald-600 hover:bg-emerald-700 border-emerald-600 text-white flex items-center gap-2 px-5 py-2 shadow-sm font-semibold"
                        onClick={handleImport}
                        disabled={importMut.isPending}
                      >
                        {importMut.isPending ? (
                          <>
                            <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                            <span>Saving Questions...</span>
                          </>
                        ) : (
                          <>
                            <i className="lni lni-upload text-base"></i>
                            <span>Commit & Import Questions ({previewRows.length})</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="p-5 pt-0">
                    {/* KPI Summary Chips */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                      <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3">
                        <div className="text-xs text-slate-500 font-medium">Total Questions</div>
                        <div className="text-xl font-bold text-slate-900 mt-0.5">{previewRows.length}</div>
                      </div>
                      <div className="bg-purple-50/60 border border-purple-200/60 rounded-lg p-3">
                        <div className="text-xs text-purple-700 font-medium">MCQ (Multiple Choice)</div>
                        <div className="text-xl font-bold text-purple-900 mt-0.5">{previewMcqCount}</div>
                      </div>
                      <div className="bg-blue-50/60 border border-blue-200/60 rounded-lg p-3">
                        <div className="text-xs text-blue-700 font-medium">DQ (Descriptive)</div>
                        <div className="text-xl font-bold text-blue-900 mt-0.5">{previewDqCount}</div>
                      </div>
                      <div className="bg-emerald-50/60 border border-emerald-200/60 rounded-lg p-3">
                        <div className="text-xs text-emerald-700 font-medium">Validation Status</div>
                        <div className="text-sm font-bold text-emerald-800 mt-1 flex items-center gap-1">
                          <i className="lni lni-checkmark-circle text-emerald-600"></i> All Rules Passed
                        </div>
                      </div>
                    </div>

                    {/* Filter Tabs & Standard TableSearch */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                        <button
                          type="button"
                          className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${previewFilterType === 'ALL'
                            ? 'bg-white text-slate-900 shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                            }`}
                          onClick={() => setPreviewFilterType('ALL')}
                        >
                          All ({previewRows.length})
                        </button>
                        <button
                          type="button"
                          className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${previewFilterType === 'MCQ'
                            ? 'bg-white text-purple-700 shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                            }`}
                          onClick={() => setPreviewFilterType('MCQ')}
                        >
                          MCQ ({previewMcqCount})
                        </button>
                        <button
                          type="button"
                          className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${previewFilterType === 'DQ'
                            ? 'bg-white text-blue-700 shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                            }`}
                          onClick={() => setPreviewFilterType('DQ')}
                        >
                          DQ ({previewDqCount})
                        </button>
                      </div>

                      <TableSearch
                        className="w-full sm:w-72"
                        placeholder="Search in questions or answers..."
                        value={previewSearch}
                        onChange={setPreviewSearch}
                        results={filteredPreviewRows.slice(0, 5).map(q => ({
                          id: q.slNo,
                          primary: q.question,
                          secondary: `${q.questionType} • Ans: ${q.answer}`,
                        }))}
                        onSelect={r => setPreviewSearch(r.primary)}
                      />
                    </div>

                    {/* Preview Table */}
                    <ScrollTable className="no-sticky-col" maxHeight="540px">
                      <table style={{ width: '100%', minWidth: 820, tableLayout: 'auto' }}>
                        <thead className="sticky top-0 z-10 shadow-xs">
                          <tr>
                            <th style={{ width: 55, textAlign: 'center' }}>SL NO</th>
                            <th style={{ width: 75, textAlign: 'center' }}>TYPE</th>
                            <th style={{ minWidth: 240, maxWidth: 420 }}>QUESTION</th>
                            <th style={{ minWidth: 230, width: '28%' }}>OPTIONS</th>
                            <th style={{ minWidth: 150, width: '20%' }}>ANSWER</th>
                            <th style={{ width: 75, textAlign: 'center' }}>SECTION</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredPreviewRows.length === 0 ? (
                            <tr>
                              <td colSpan={6} style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--g400)' }}>
                                <i className="lni lni-search text-2xl block mb-2 opacity-50"></i>
                                No questions match the current filter or search criteria.
                              </td>
                            </tr>
                          ) : (
                            filteredPreviewRows.map((q, idx) => (
                              <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                                <td style={{ textAlign: 'center', fontFamily: 'monospace', fontSize: 12, color: 'var(--g500)', width: 55 }}>
                                  {q.slNo}
                                </td>
                                <td style={{ textAlign: 'center', width: 75 }}>
                                  <span
                                    className={`badge ${q.questionType === 'MCQ' ? 'badge-purple' : 'badge-blue'
                                      }`}
                                  >
                                    {q.questionType}
                                  </span>
                                </td>
                                <td style={{ whiteSpace: 'normal', minWidth: 240, maxWidth: 420, lineHeight: 1.55, color: 'var(--g800)' }}>
                                  <RichTextDisplay content={q.question} />
                                </td>
                                <td style={{ whiteSpace: 'normal', minWidth: 230 }}>
                                  {q.questionType === 'MCQ' ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px]">
                                      <div className="bg-slate-50 border border-slate-200 rounded px-2 py-0.5 text-slate-700">
                                        <strong className="text-slate-400 mr-1">A:</strong>
                                        {q.option1}
                                      </div>
                                      <div className="bg-slate-50 border border-slate-200 rounded px-2 py-0.5 text-slate-700">
                                        <strong className="text-slate-400 mr-1">B:</strong>
                                        {q.option2}
                                      </div>
                                      <div className="bg-slate-50 border border-slate-200 rounded px-2 py-0.5 text-slate-700">
                                        <strong className="text-slate-400 mr-1">C:</strong>
                                        {q.option3}
                                      </div>
                                      <div className="bg-slate-50 border border-slate-200 rounded px-2 py-0.5 text-slate-700">
                                        <strong className="text-slate-400 mr-1">D:</strong>
                                        {q.option4}
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-slate-400 text-xs italic">Descriptive (No options)</span>
                                  )}
                                </td>
                                <td style={{ whiteSpace: 'normal', minWidth: 150 }}>
                                  <span className="inline-block bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11.5px] px-2.5 py-1 rounded font-medium max-w-full break-words">
                                    <RichTextDisplay content={q.answer} />
                                  </span>
                                </td>
                                <td style={{ textAlign: 'center', width: 75 }}>
                                  {q.level ? (
                                    <span
                                      className="badge badge-neu text-xs font-mono font-semibold"
                                      title={`Section ${String(q.level) === '1' ? 'A' : String(q.level) === '2' ? 'B' : String(q.level) === '3' ? 'C' : q.level}`}
                                    >
                                      {String(q.level) === '1'
                                        ? 'Sec A'
                                        : String(q.level) === '2'
                                          ? 'Sec B'
                                          : String(q.level) === '3'
                                            ? 'Sec C'
                                            : `L${q.level}`}
                                    </span>
                                  ) : (
                                    <span className="text-slate-300">—</span>
                                  )}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </ScrollTable>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

      {/* ── Single Question Add Modal ───────────────────────────────────────── */}
      {isAddingQuestion && (
        <SingleQuestionModal
          isOpen={isAddingQuestion}
          onClose={() => setIsAddingQuestion(false)}
          courseUnitGuid={repoCourseUnitGuid}
          category={Number(repoCategory)}
          intakeGuid={intakeGuid}
          courseUnitCode={selectedRepoUnit?.courseUnitCode || ''}
          courseUnitName={selectedRepoUnit?.courseUnitName || ''}
          categoryName={selectedRepoCategoryObj?.name || ''}
          onSuccess={() => refetchQuestions()}
          showToast={showToast}
        />
      )}

      {/* ── Single Question Edit Modal ──────────────────────────────────────── */}
      {editingQuestion && (
        <SingleQuestionModal
          isOpen={Boolean(editingQuestion)}
          onClose={() => setEditingQuestion(null)}
          courseUnitGuid={repoCourseUnitGuid}
          category={Number(repoCategory)}
          intakeGuid={intakeGuid}
          question={editingQuestion}
          courseUnitCode={selectedRepoUnit?.courseUnitCode || ''}
          courseUnitName={selectedRepoUnit?.courseUnitName || ''}
          categoryName={selectedRepoCategoryObj?.name || ''}
          onSuccess={() => refetchQuestions()}
          showToast={showToast}
        />
      )}

      {/* ── Question Details View Modal ─────────────────────────────────────── */}
      {viewingQuestion && (
        <div className="modal-overlay open" style={{ zIndex: 640 }}>
          <div
            className="modal modal-lg flex flex-col"
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: 640 }}
          >
            <div className="modal-hdr modal-hdr-blue shrink-0">
              <div className="modal-title flex items-center gap-2">
                <i className="lni lni-eye"></i>
                <span>Question Details</span>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setViewingQuestion(null)}
              >
                <i className="lni lni-close"></i>
              </button>
            </div>

            <div className="modal-body p-5 flex flex-col gap-4 bg-slate-50 overflow-y-auto max-h-[70vh]">
              {/* Type, Level, & Scope Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-white border border-slate-200 rounded-lg shadow-sm">
                <div className="flex items-center gap-2">
                  <span
                    className={`badge ${viewingQuestion.questionType === 1 ? 'badge-purple' : 'badge-blue'
                      } text-xs font-semibold`}
                  >
                    {viewingQuestion.questionType === 1 ? 'Multiple Choice (MCQ)' : 'Descriptive Question (DQ)'}
                  </span>

                  {viewingQuestion.level ? (
                    <span className="badge badge-neu text-xs font-mono">
                      {viewingQuestion.level === 1
                        ? 'Section A'
                        : viewingQuestion.level === 2
                          ? 'Section B'
                          : viewingQuestion.level === 3
                            ? 'Section C'
                            : `Section ${viewingQuestion.level}`}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400 font-medium">Section: Not Required</span>
                  )}
                </div>

                <div className="text-xs text-slate-500 font-mono font-medium">
                  {selectedRepoUnit?.courseUnitCode} • {selectedRepoCategoryObj?.name}
                </div>
              </div>

              {/* Question Text Card */}
              <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Question Statement
                </div>
                <div className="text-sm font-medium text-slate-800 leading-relaxed">
                  <RichTextDisplay content={viewingQuestion.questionText} />
                </div>
              </div>

              {/* Question Image (If attached) */}
              {viewingQuestion.imageUrl && (
                <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <i className="lni lni-image text-indigo-600 text-xs"></i>
                      <span>Attached Diagram / Image</span>
                    </div>
                    <a
                      href={viewingQuestion.imageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 hover:underline"
                    >
                      <span>Open full size</span>
                      <i className="lni lni-arrow-right text-[10px]"></i>
                    </a>
                  </div>

                  <div className="rounded-lg border border-slate-200 overflow-hidden bg-slate-50 flex items-center justify-center p-2.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={viewingQuestion.imageUrl}
                      alt={viewingQuestion.imageFileName || 'Question diagram'}
                      className="max-h-64 max-w-full rounded object-contain shadow-2xs"
                    />
                  </div>

                  {viewingQuestion.imageFileName && (
                    <div className="mt-2 text-[11px] text-slate-500 font-mono text-center">
                      {viewingQuestion.imageFileName}
                    </div>
                  )}
                </div>
              )}

              {/* Options Section (If MCQ) */}
              {viewingQuestion.questionType === 1 ? (
                <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">
                    Options (A, B, C, D)
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className={`p-2.5 rounded-lg border ${viewingQuestion.answerText === viewingQuestion.option1Text ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950 font-medium' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                      <strong className="text-slate-400 block mb-1">Option A {viewingQuestion.answerText === viewingQuestion.option1Text && <span className="text-emerald-700 ml-1 font-bold">✓ Correct Answer</span>}</strong>
                      <div>{viewingQuestion.option1Text}</div>
                    </div>
                    <div className={`p-2.5 rounded-lg border ${viewingQuestion.answerText === viewingQuestion.option2Text ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950 font-medium' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                      <strong className="text-slate-400 block mb-1">Option B {viewingQuestion.answerText === viewingQuestion.option2Text && <span className="text-emerald-700 ml-1 font-bold">✓ Correct Answer</span>}</strong>
                      <div>{viewingQuestion.option2Text}</div>
                    </div>
                    <div className={`p-2.5 rounded-lg border ${viewingQuestion.answerText === viewingQuestion.option3Text ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950 font-medium' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                      <strong className="text-slate-400 block mb-1">Option C {viewingQuestion.answerText === viewingQuestion.option3Text && <span className="text-emerald-700 ml-1 font-bold">✓ Correct Answer</span>}</strong>
                      <div>{viewingQuestion.option3Text}</div>
                    </div>
                    <div className={`p-2.5 rounded-lg border ${viewingQuestion.answerText === viewingQuestion.option4Text ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950 font-medium' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                      <strong className="text-slate-400 block mb-1">Option D {viewingQuestion.answerText === viewingQuestion.option4Text && <span className="text-emerald-700 ml-1 font-bold">✓ Correct Answer</span>}</strong>
                      <div>{viewingQuestion.option4Text}</div>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Correct Answer / Key */}
              <div className="bg-white border border-emerald-200/80 rounded-lg p-4 shadow-sm bg-emerald-50/30">
                <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <i className="lni lni-checkmark-circle text-emerald-600"></i>
                  <span>{viewingQuestion.questionType === 1 ? 'Verified Answer' : 'Descriptive Answer / Evaluation Rubric'}</span>
                </div>
                <div className="text-xs text-slate-800 leading-relaxed font-medium bg-white p-3 rounded border border-emerald-100">
                  <RichTextDisplay content={viewingQuestion.answerText} />
                </div>
              </div>
            </div>

            <div className="modal-footer shrink-0 flex items-center justify-end p-4 bg-white border-t border-slate-200">
              <button
                type="button"
                className="btn btn-neu"
                onClick={() => setViewingQuestion(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Single Question Delete Confirmation Modal ──────────────────────── */}
      {questionToDelete && (
        <div className="modal-overlay open" style={{ zIndex: 670 }}>
          <div
            className="modal modal-md flex flex-col"
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: 500 }}
          >
            <div className="modal-hdr modal-hdr-red shrink-0">
              <div className="modal-title flex items-center gap-2">
                <i className="lni lni-warning"></i>
                <span>Delete Question</span>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setQuestionToDelete(null)}
              >
                <i className="lni lni-close"></i>
              </button>
            </div>

            <div className="modal-body p-5 flex flex-col gap-4 bg-slate-50">
              <div className="bg-red-50 border border-red-200 text-red-900 rounded-lg p-3 text-xs leading-relaxed">
                <strong>Warning:</strong> Are you sure you want to delete this question from the Question Bank? This action cannot be undone.
              </div>

              <div className="bg-white border border-slate-200 rounded-lg p-3 text-xs text-slate-700">
                <div className="font-semibold text-slate-500 mb-1">Question Text:</div>
                <div className="font-medium line-clamp-3 text-slate-900">
                  <RichTextDisplay content={questionToDelete.questionText} />
                </div>
              </div>
            </div>

            <div className="modal-footer shrink-0 flex items-center justify-end gap-2 p-4 bg-white border-t border-slate-200">
              <button
                type="button"
                className="btn btn-neu"
                onClick={() => setQuestionToDelete(null)}
                disabled={deleteSingleMut.isPending}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger flex items-center gap-1.5"
                onClick={handleConfirmDeleteSingle}
                disabled={deleteSingleMut.isPending}
              >
                {deleteSingleMut.isPending ? (
                  <>
                    <span className="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <i className="lni lni-trash-can"></i>
                    <span>Confirm Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk Delete Bank Questions Modal ────────────────────────────────── */}
      {showDeleteBankModal && (
        <div className="modal-overlay open" style={{ zIndex: 670 }}>
          <div
            className="modal modal-md flex flex-col"
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: 520 }}
          >
            <div className="modal-hdr modal-hdr-red shrink-0">
              <div className="modal-title flex items-center gap-2">
                <i className="lni lni-warning"></i>
                <span>Delete All Questions for Course Unit</span>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setShowDeleteBankModal(false)}
              >
                <i className="lni lni-close"></i>
              </button>
            </div>

            <div className="modal-body p-5 flex flex-col gap-4 bg-slate-50">
              <div className="bg-red-50 border border-red-200 text-red-900 rounded-lg p-3 text-xs leading-relaxed">
                <strong>Warning:</strong> Are you sure you want to delete all questions for this course unit in the selected category and intake? This action cannot be undone.
              </div>

              <div className="border border-slate-200 rounded-lg p-3.5 bg-white space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Course Unit:</span>
                  <strong className="text-slate-800 font-mono">
                    {selectedRepoUnit ? `${selectedRepoUnit.courseUnitCode} — ${selectedRepoUnit.courseUnitName}` : repoCourseUnitGuid}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Assessment Category:</span>
                  <strong className="text-slate-800">{selectedRepoCategoryObj?.name || repoCategory}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Academic Intake:</span>
                  <strong className="text-slate-800 font-mono">{selectedIntake?.intakeCode || intakeGuid}</strong>
                </div>
              </div>
            </div>

            <div className="modal-footer shrink-0 flex items-center justify-end gap-2 p-4 bg-white border-t border-slate-200">
              <button
                type="button"
                className="btn btn-neu"
                onClick={() => setShowDeleteBankModal(false)}
                disabled={deleteBankMut.isPending}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger flex items-center gap-1.5"
                onClick={handleConfirmDeleteBank}
                disabled={deleteBankMut.isPending}
              >
                {deleteBankMut.isPending ? (
                  <>
                    <span className="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <i className="lni lni-trash-can"></i>
                    <span>Confirm Soft Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Success Popup Modal ─────────────────────────────────────────────── */}
      {successModal && (
        <div className="modal-overlay open" style={{ zIndex: 680 }}>
          <div
            className="modal modal-sm flex flex-col"
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: 460 }}
          >
            <SuccessPopup
              title={successModal.title}
              subtitle={successModal.subtitle}
              onClose={() => setSuccessModal(null)}
            />
          </div>
        </div>
      )}

      {/* ── Toast Notification ──────────────────────────────────────────────── */}
      <Toast toast={toast} />
    </div>
  )
}
