'use client'

import React, { useState, useEffect, useRef } from 'react'
import { QuestionDto } from '@/lib/api/assessment/questions'
import {
  useCreateQuestion,
  useUpdateQuestion,
  useUploadQuestionImage,
  useDeleteQuestionImage,
} from '@/hooks/assessment/useQuestions'
import { RichTextEditor, isHtmlEmpty, stripHtmlTags } from '@/components/RichTextEditor'

interface SingleQuestionModalProps {
  isOpen: boolean
  onClose: () => void
  courseUnitGuid: string
  category: number
  intakeGuid: string
  question?: QuestionDto | null
  courseUnitCode?: string
  courseUnitName?: string
  categoryName?: string
  onSuccess: () => void
  showToast: (msg: string, type?: string) => void
}

export function SingleQuestionModal({
  isOpen,
  onClose,
  courseUnitGuid,
  category,
  intakeGuid,
  question,
  courseUnitCode,
  courseUnitName,
  categoryName,
  onSuccess,
  showToast,
}: SingleQuestionModalProps) {
  const isEdit = Boolean(question?.questionGuid)

  const [questionType, setQuestionType] = useState<number>(question?.questionType ?? 1)
  const [level, setLevel] = useState<number>(question?.level ?? 1)
  const [questionText, setQuestionText] = useState<string>(stripHtmlTags(question?.questionText) ?? '')
  const [option1Text, setOption1Text] = useState<string>(stripHtmlTags(question?.option1Text) ?? '')
  const [option2Text, setOption2Text] = useState<string>(stripHtmlTags(question?.option2Text) ?? '')
  const [option3Text, setOption3Text] = useState<string>(stripHtmlTags(question?.option3Text) ?? '')
  const [option4Text, setOption4Text] = useState<string>(stripHtmlTags(question?.option4Text) ?? '')
  const [selectedCorrectOptionIndex, setSelectedCorrectOptionIndex] = useState<number>(0)
  const [descriptiveAnswer, setDescriptiveAnswer] = useState<string>(stripHtmlTags(question?.answerText) ?? '')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Image upload state
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(question?.imageUrl ?? null)
  const [existingImageFileName, setExistingImageFileName] = useState<string | null>(question?.imageFileName ?? null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(question?.imageUrl ?? null)
  const [isImageMarkedForDeletion, setIsImageMarkedForDeletion] = useState<boolean>(false)
  const [imageError, setImageError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const createMut = useCreateQuestion()
  const updateMut = useUpdateQuestion()
  const uploadImageMut = useUploadQuestionImage()
  const deleteImageMut = useDeleteQuestionImage()

  useEffect(() => {
    if (question) {
      setQuestionType(question.questionType ?? 1)
      setLevel(question.level ?? 1)
      setQuestionText(stripHtmlTags(question.questionText))
      setOption1Text(stripHtmlTags(question.option1Text))
      setOption2Text(stripHtmlTags(question.option2Text))
      setOption3Text(stripHtmlTags(question.option3Text))
      setOption4Text(stripHtmlTags(question.option4Text))

      const ans = stripHtmlTags(question.answerText)
      if (ans && question.questionType === 1) {
        const o1 = stripHtmlTags(question.option1Text)
        const o2 = stripHtmlTags(question.option2Text)
        const o3 = stripHtmlTags(question.option3Text)
        const o4 = stripHtmlTags(question.option4Text)
        if (ans === o1) setSelectedCorrectOptionIndex(0)
        else if (ans === o2) setSelectedCorrectOptionIndex(1)
        else if (ans === o3) setSelectedCorrectOptionIndex(2)
        else if (ans === o4) setSelectedCorrectOptionIndex(3)
        else setSelectedCorrectOptionIndex(0)
      } else {
        setDescriptiveAnswer(ans)
      }

      setExistingImageUrl(question.imageUrl ?? null)
      setExistingImageFileName(question.imageFileName ?? null)
      setPreviewUrl(question.imageUrl ?? null)
      setSelectedFile(null)
      setIsImageMarkedForDeletion(false)
    } else {
      setQuestionType(1)
      setLevel(1)
      setQuestionText('')
      setOption1Text('')
      setOption2Text('')
      setOption3Text('')
      setOption4Text('')
      setSelectedCorrectOptionIndex(0)
      setDescriptiveAnswer('')

      setExistingImageUrl(null)
      setExistingImageFileName(null)
      setPreviewUrl(null)
      setSelectedFile(null)
      setIsImageMarkedForDeletion(false)
    }
    setImageError(null)
    setErrorMsg(null)
  }, [question, isOpen])

  // Revoke object URLs on unmount/change
  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  if (!isOpen) return null

  const validateAndSetFile = (file: File) => {
    setImageError(null)

    // Allowed extensions: .png, .jpg, .jpeg
    const ext = '.' + file.name.split('.').pop()?.toLowerCase()
    const validExts = ['.png', '.jpg', '.jpeg']
    const validMimes = ['image/png', 'image/jpeg', 'image/jpg']
    if (!validExts.includes(ext) || (!validMimes.includes(file.type) && file.type !== '')) {
      setImageError('Only .png, .jpg and .jpeg images are allowed.')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    // Max size: 5 MB (5,242,880 bytes)
    if (file.size > 5242880) {
      setImageError('File size must not exceed 5 MB (5,242,880 bytes).')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl)
    }

    setSelectedFile(file)
    setPreviewUrl(URL.createObjectURL(file))
    setIsImageMarkedForDeletion(false)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      validateAndSetFile(file)
    }
  }

  const handleRemoveImage = () => {
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl)
    }
    setSelectedFile(null)
    setPreviewUrl(null)
    setIsImageMarkedForDeletion(true)
    setImageError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)

    const cleanQuestionText = stripHtmlTags(questionText)
    if (!cleanQuestionText) {
      setErrorMsg('Question text cannot be left blank!')
      return
    }

    let resolvedAnswer = ''

    if (questionType === 1) {
      // MCQ validations
      const o1 = stripHtmlTags(option1Text)
      const o2 = stripHtmlTags(option2Text)
      const o3 = stripHtmlTags(option3Text)
      const o4 = stripHtmlTags(option4Text)

      if (!o1 || !o2 || !o3 || !o4) {
        setErrorMsg('All four options (Option 1, 2, 3, 4) cannot be left blank!')
        return
      }

      // Check unique options
      const opts = [o1, o2, o3, o4]
      const uniqueOpts = new Set(opts.map(o => o.toLowerCase()))
      if (uniqueOpts.size < 4) {
        setErrorMsg('Options should not duplicate! Each option must be distinct.')
        return
      }

      resolvedAnswer = opts[selectedCorrectOptionIndex]
      if (!resolvedAnswer) {
        setErrorMsg('Please select which option is the correct answer!')
        return
      }
    } else {
      // Descriptive validation
      const cleanAnswer = stripHtmlTags(descriptiveAnswer)
      if (!cleanAnswer) {
        setErrorMsg('Answer / Evaluation criteria cannot be left blank!')
        return
      }
      resolvedAnswer = cleanAnswer
    }

    if (isEdit && question?.questionGuid) {
      try {
        await updateMut.mutateAsync({
          guid: question.questionGuid,
          payload: {
            questionType,
            level: questionType === 1 ? level : null,
            questionText: cleanQuestionText,
            option1Text: questionType === 1 ? stripHtmlTags(option1Text) : null,
            option2Text: questionType === 1 ? stripHtmlTags(option2Text) : null,
            option3Text: questionType === 1 ? stripHtmlTags(option3Text) : null,
            option4Text: questionType === 1 ? stripHtmlTags(option4Text) : null,
            answerText: resolvedAnswer,
          },
        })

        // Handle image upload or deletion
        if (selectedFile) {
          await uploadImageMut.mutateAsync({
            questionGuid: question.questionGuid,
            file: selectedFile,
          })
        } else if (isImageMarkedForDeletion && existingImageUrl) {
          await deleteImageMut.mutateAsync(question.questionGuid)
        }

        showToast('Question updated successfully!', 'success')
        onSuccess()
        onClose()
      } catch (err: any) {
        setErrorMsg(err.message || 'Failed to update question')
      }
    } else {
      if (!courseUnitGuid || !category || !intakeGuid) {
        setErrorMsg('Course Unit, Assessment Category, and Academic Intake are required.')
        return
      }

      try {
        const created = await createMut.mutateAsync({
          courseUnitGuid,
          category,
          intakeGuid,
          questionType,
          level: questionType === 1 ? level : null,
          questionText: cleanQuestionText,
          option1Text: questionType === 1 ? stripHtmlTags(option1Text) : null,
          option2Text: questionType === 1 ? stripHtmlTags(option2Text) : null,
          option3Text: questionType === 1 ? stripHtmlTags(option3Text) : null,
          option4Text: questionType === 1 ? stripHtmlTags(option4Text) : null,
          answerText: resolvedAnswer,
        })

        const createdGuid = created?.questionGuid || (created as any)?.guid
        if (selectedFile && createdGuid) {
          await uploadImageMut.mutateAsync({
            questionGuid: createdGuid,
            file: selectedFile,
          })
        }

        showToast('Question created and added to bank!', 'success')
        onSuccess()
        onClose()
      } catch (err: any) {
        setErrorMsg(err.message || 'Failed to create question')
      }
    }
  }

  const isPending = createMut.isPending || updateMut.isPending || uploadImageMut.isPending || deleteImageMut.isPending

  return (
    <div className="modal-overlay open" style={{ zIndex: 650 }}>
      <div
        className="modal modal-lg flex flex-col"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: 720 }}
      >
        {/* Modal Header */}
        <div className="modal-hdr modal-hdr-blue shrink-0">
          <div className="modal-title flex items-center gap-2">
            <i className={isEdit ? 'lni lni-pencil-alt' : 'lni lni-plus'}></i>
            <span>{isEdit ? 'Edit Question' : 'Add New Question to Bank'}</span>
          </div>
          <button type="button" className="modal-close" onClick={onClose} disabled={isPending}>
            <i className="lni lni-close"></i>
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="modal-body p-5 flex flex-col gap-4 bg-slate-50 overflow-y-auto max-h-[72vh]">
            {/* Scope Badge Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-white border border-slate-200 rounded-lg shadow-sm text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-500">Course Unit:</span>
                <span className="font-mono bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-bold border border-indigo-200">
                  {courseUnitCode || 'Unit'} {courseUnitName ? `— ${courseUnitName}` : ''}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-500">Category:</span>
                <span className="badge badge-purple">{categoryName || 'Assessment'}</span>
              </div>
            </div>

            {/* Error Banner */}
            {errorMsg && (
              <div className="bg-red-50 border border-red-200 text-red-900 rounded-lg p-3 text-xs flex items-center gap-2">
                <i className="lni lni-warning text-red-600 text-base shrink-0"></i>
                <span className="font-medium">{errorMsg}</span>
              </div>
            )}

            {/* Question Type & Section Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-white border border-slate-200 rounded-lg p-3">
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  Question Type <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    className={`py-1.5 px-3 rounded text-xs font-semibold border transition-all flex items-center justify-center gap-1.5 ${
                      questionType === 1
                        ? 'bg-purple-50 border-purple-300 text-purple-800 shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                    onClick={() => setQuestionType(1)}
                  >
                    <i className="lni lni-radio-button"></i>
                    <span>MCQ</span>
                  </button>
                  <button
                    type="button"
                    className={`py-1.5 px-3 rounded text-xs font-semibold border transition-all flex items-center justify-center gap-1.5 ${
                      questionType === 2
                        ? 'bg-blue-50 border-blue-300 text-blue-800 shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                    onClick={() => setQuestionType(2)}
                  >
                    <i className="lni lni-text-format"></i>
                    <span>Descriptive (DQ)</span>
                  </button>
                </div>
              </div>

              {questionType === 1 ? (
                <div className="bg-white border border-slate-200 rounded-lg p-3">
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    Section <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      className={`py-1.5 px-2 rounded text-xs font-semibold border transition-all ${
                        level === 1
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-800 shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                      onClick={() => setLevel(1)}
                    >
                      Section A
                    </button>
                    <button
                      type="button"
                      className={`py-1.5 px-2 rounded text-xs font-semibold border transition-all ${
                        level === 2
                          ? 'bg-blue-50 border-blue-300 text-blue-800 shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                      onClick={() => setLevel(2)}
                    >
                      Section B
                    </button>
                    <button
                      type="button"
                      className={`py-1.5 px-2 rounded text-xs font-semibold border transition-all ${
                        level === 3
                          ? 'bg-purple-50 border-purple-300 text-purple-800 shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                      onClick={() => setLevel(3)}
                    >
                      Section C
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-white border border-slate-200 rounded-lg p-3 flex flex-col justify-center text-xs text-slate-400">
                  <span>Section is not applicable for Descriptive questions.</span>
                </div>
              )}
            </div>

            {/* Question Text with side Upload Image button */}
            <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-sm">
              <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
                    <span>Question Text</span>
                    <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[11px] font-normal text-slate-400">
                    (Attach optional diagram / image)
                  </span>
                </div>

                {/* Right side: Blue Upload Image Button / Actions */}
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".png,.jpg,.jpeg,image/png,image/jpeg"
                    className="hidden"
                    onChange={handleFileChange}
                    disabled={isPending}
                  />

                  {previewUrl && !isImageMarkedForDeletion ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        className="btn btn-neu btn-sm text-xs py-1 px-2.5 flex items-center gap-1 text-slate-700 hover:text-slate-900"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isPending}
                        title="Choose a different image to replace current diagram (.png, .jpg, .jpeg, max 5MB)"
                      >
                        <i className="lni lni-reload text-[11px]"></i>
                        <span>Change Image</span>
                      </button>
                      <button
                        type="button"
                        className="btn btn-neu btn-sm text-xs py-1 px-2.5 text-red-600 hover:text-red-700 hover:bg-red-50 flex items-center gap-1"
                        onClick={handleRemoveImage}
                        disabled={isPending}
                        title="Remove attached diagram from question"
                      >
                        <i className="lni lni-trash-can text-[11px]"></i>
                        <span>Remove</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm flex items-center gap-1.5 text-xs py-1 px-3 shadow-xs"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isPending}
                      title="Upload diagram or figure for this question (PNG, JPG, JPEG up to 5 MB)"
                    >
                      <i className="lni lni-image text-sm"></i>
                      <span>+ Add Question Image</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Slim Attached Diagram Preview Strip (if attached) */}
              {previewUrl && !isImageMarkedForDeletion && (
                <div className="mb-2 p-2 bg-blue-50/70 border border-blue-200/80 rounded-lg flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewUrl}
                      alt="Question diagram"
                      className="h-9 w-12 rounded border border-blue-200 object-contain bg-white shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => window.open(previewUrl, '_blank')}
                      title="Click to view full size in new tab"
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-900 truncate flex items-center gap-1.5">
                        <span className="truncate" title={selectedFile ? selectedFile.name : (existingImageFileName || 'diagram.png')}>
                          {selectedFile ? selectedFile.name : (existingImageFileName || 'diagram.png')}
                        </span>
                        {selectedFile ? (
                          <span className="badge badge-purple text-[10px] py-0.2 shrink-0">
                            New Upload ({(selectedFile.size / 1048576).toFixed(2)} MB)
                          </span>
                        ) : (
                          <span className="badge badge-blue text-[10px] py-0.2 shrink-0">
                            Attached Diagram
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                        <span>Image attached to this question</span>
                        <span>•</span>
                        <a
                          href={previewUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 hover:underline font-medium inline-flex items-center gap-1"
                        >
                          <span>View Full Size</span>
                          <i className="lni lni-arrow-right text-[10px]"></i>
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Image Error Alert if any */}
              {imageError && (
                <div className="mb-2 bg-red-50 border border-red-200 text-red-700 px-3 py-1.5 rounded-lg text-xs flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <i className="lni lni-warning text-red-500 shrink-0"></i>
                    <span>{imageError}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setImageError(null)}
                    className="text-red-400 hover:text-red-600"
                  >
                    <i className="lni lni-close text-xs"></i>
                  </button>
                </div>
              )}

              {/* Deletion Notice */}
              {isImageMarkedForDeletion && existingImageUrl && (
                <div className="mb-2 bg-amber-50 border border-amber-200 text-amber-800 px-2.5 py-1 rounded text-xs flex items-center justify-between">
                  <span>Image marked for deletion. Will be removed when you update this question.</span>
                  <button
                    type="button"
                    className="text-amber-900 underline font-semibold hover:text-amber-950 ml-2"
                    onClick={() => {
                      setIsImageMarkedForDeletion(false)
                      setPreviewUrl(existingImageUrl)
                    }}
                  >
                    Undo
                  </button>
                </div>
              )}

              {/* Rich Text Editor */}
              <RichTextEditor
                value={questionText}
                onChange={setQuestionText}
                placeholder="Enter complete question statement here..."
                minHeight={110}
                disabled={isPending}
              />
            </div>

            {/* MCQ Options and Correct Answer Selector */}
            {questionType === 1 ? (
              <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-slate-800">
                    Options & Correct Answer Selection <span className="text-red-500">*</span>
                  </div>
                  <span className="text-[11px] text-indigo-600 font-medium">
                    Click the radio button to designate the correct option
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* Option 1 */}
                  <div
                    className={`p-2.5 rounded-lg border flex items-start gap-2 transition-all ${
                      selectedCorrectOptionIndex === 0
                        ? 'bg-emerald-50/70 border-emerald-300 ring-1 ring-emerald-300'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <input
                      type="radio"
                      name="correctOptionRadio"
                      checked={selectedCorrectOptionIndex === 0}
                      onChange={() => setSelectedCorrectOptionIndex(0)}
                      className="mt-1 cursor-pointer"
                      id="opt1-radio"
                    />
                    <div className="flex-1">
                      <label htmlFor="opt1-radio" className="text-[11px] font-bold text-slate-500 block mb-1 cursor-pointer">
                        Option A {selectedCorrectOptionIndex === 0 && <span className="text-emerald-700 font-bold ml-1">(Correct Answer)</span>}
                      </label>
                      <input
                        type="text"
                        className="w-full text-xs p-1.5 border border-slate-300 rounded bg-white"
                        placeholder="Option 1 text..."
                        value={option1Text}
                        onChange={e => setOption1Text(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  {/* Option 2 */}
                  <div
                    className={`p-2.5 rounded-lg border flex items-start gap-2 transition-all ${
                      selectedCorrectOptionIndex === 1
                        ? 'bg-emerald-50/70 border-emerald-300 ring-1 ring-emerald-300'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <input
                      type="radio"
                      name="correctOptionRadio"
                      checked={selectedCorrectOptionIndex === 1}
                      onChange={() => setSelectedCorrectOptionIndex(1)}
                      className="mt-1 cursor-pointer"
                      id="opt2-radio"
                    />
                    <div className="flex-1">
                      <label htmlFor="opt2-radio" className="text-[11px] font-bold text-slate-500 block mb-1 cursor-pointer">
                        Option B {selectedCorrectOptionIndex === 1 && <span className="text-emerald-700 font-bold ml-1">(Correct Answer)</span>}
                      </label>
                      <input
                        type="text"
                        className="w-full text-xs p-1.5 border border-slate-300 rounded bg-white"
                        placeholder="Option 2 text..."
                        value={option2Text}
                        onChange={e => setOption2Text(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  {/* Option 3 */}
                  <div
                    className={`p-2.5 rounded-lg border flex items-start gap-2 transition-all ${
                      selectedCorrectOptionIndex === 2
                        ? 'bg-emerald-50/70 border-emerald-300 ring-1 ring-emerald-300'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <input
                      type="radio"
                      name="correctOptionRadio"
                      checked={selectedCorrectOptionIndex === 2}
                      onChange={() => setSelectedCorrectOptionIndex(2)}
                      className="mt-1 cursor-pointer"
                      id="opt3-radio"
                    />
                    <div className="flex-1">
                      <label htmlFor="opt3-radio" className="text-[11px] font-bold text-slate-500 block mb-1 cursor-pointer">
                        Option C {selectedCorrectOptionIndex === 2 && <span className="text-emerald-700 font-bold ml-1">(Correct Answer)</span>}
                      </label>
                      <input
                        type="text"
                        className="w-full text-xs p-1.5 border border-slate-300 rounded bg-white"
                        placeholder="Option 3 text..."
                        value={option3Text}
                        onChange={e => setOption3Text(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  {/* Option 4 */}
                  <div
                    className={`p-2.5 rounded-lg border flex items-start gap-2 transition-all ${
                      selectedCorrectOptionIndex === 3
                        ? 'bg-emerald-50/70 border-emerald-300 ring-1 ring-emerald-300'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <input
                      type="radio"
                      name="correctOptionRadio"
                      checked={selectedCorrectOptionIndex === 3}
                      onChange={() => setSelectedCorrectOptionIndex(3)}
                      className="mt-1 cursor-pointer"
                      id="opt4-radio"
                    />
                    <div className="flex-1">
                      <label htmlFor="opt4-radio" className="text-[11px] font-bold text-slate-500 block mb-1 cursor-pointer">
                        Option D {selectedCorrectOptionIndex === 3 && <span className="text-emerald-700 font-bold ml-1">(Correct Answer)</span>}
                      </label>
                      <input
                        type="text"
                        className="w-full text-xs p-1.5 border border-slate-300 rounded bg-white"
                        placeholder="Option 4 text..."
                        value={option4Text}
                        onChange={e => setOption4Text(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-sm">
                {/* Descriptive Answer / Rubric */}
                <label className="text-xs font-bold text-slate-800 block mb-1.5">
                  Expected Answer / Evaluation Rubric <span className="text-red-500">*</span>
                </label>
                <RichTextEditor
                  value={descriptiveAnswer}
                  onChange={setDescriptiveAnswer}
                  placeholder="Enter expected answer, key evaluation criteria or sample solution..."
                  minHeight={110}
                  disabled={isPending}
                />
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="modal-footer shrink-0 flex items-center justify-end gap-2 p-4 bg-white border-t border-slate-200">
            <button
              type="button"
              className="btn btn-neu"
              onClick={onClose}
              disabled={isPending}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary flex items-center gap-1.5"
              disabled={isPending}
            >
              {isPending ? (
                <>
                  <span className="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <i className="lni lni-checkmark"></i>
                  <span>{isEdit ? 'Update Question' : 'Save Question'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
