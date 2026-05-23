'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { apiRequest, API_BASE_URL, resolveUploadUrl } from '@/lib/api'
import { toast } from 'sonner'
import { ExternalLink, Upload } from 'lucide-react'

type Expense = {
  _id: string
  title: string
  amount: number
  employeeAmount?: number
  approvedAmount?: number
  category: string
  description?: string
  employeeRemarks?: string
  managerRemarks?: string
  date: string
  gpsDistance?: number
  approxKms?: number
  claimedDistanceKm?: number
  transportType?: string
  travelFrom?: string
  travelTo?: string
  expItemId?: string
  receipt?: string
  ticketReceipt?: string
  employeeId?: {
    _id: string
    name: string
    email: string
  }
  trainerId?: {
    _id: string
    name: string
    email: string
  }
}

function normalizeCategory(cat: string) {
  const c = (cat || '').toLowerCase()
  if (c === 'travel') return 'travel'
  if (c === 'food') return 'food'
  if (c === 'accommodation' || c === 'accomodation') return 'accommodation'
  return 'other'
}

function claimedKm(exp: Expense) {
  return exp.approxKms ?? exp.claimedDistanceKm ?? null
}

function travelSummary(exp: Expense) {
  if (normalizeCategory(exp.category) !== 'travel') return exp.description || exp.title || ''
  const parts = [exp.transportType, exp.travelFrom && exp.travelTo ? `${exp.travelFrom} → ${exp.travelTo}` : '']
  return parts.filter(Boolean).join(' · ') || exp.title
}

type ExpenseFormState = {
  approvedAmount: string
  managerRemarks: string
  employeeRemarks: string
}

export default function ManagerExpenseUpdatePage() {
  const router = useRouter()
  const params = useParams()
  const employeeId = params.employeeId as string

  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [employeeName, setEmployeeName] = useState('')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [uploadingBillId, setUploadingBillId] = useState<string | null>(null)

  const [expenseForms, setExpenseForms] = useState<Record<string, ExpenseFormState>>({})

  useEffect(() => {
    if (employeeId) {
      loadExpenses()
    }
  }, [employeeId, fromDate, toDate])

  const loadExpenses = async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams()
      qs.append('status', 'Executive Manager Approved')
      if (fromDate) qs.append('fromDate', fromDate)
      if (toDate) qs.append('toDate', toDate)

      const data = await apiRequest<Expense[]>(
        `/expenses/employee/${employeeId}?${qs.toString()}`
      )

      setExpenses(data || [])

      const initialForms: Record<string, ExpenseFormState> = {}
      data.forEach((exp) => {
        initialForms[exp._id] = {
          approvedAmount: exp.approvedAmount?.toString() || exp.amount.toString(),
          managerRemarks: exp.managerRemarks || '',
          employeeRemarks: exp.employeeRemarks || '',
        }
      })
      setExpenseForms(initialForms)

      if (data.length > 0) {
        setEmployeeName(data[0].employeeId?.name || data[0].trainerId?.name || '')
      }
    } catch (error: any) {
      toast.error(error?.message || 'Failed to load expenses')
      setExpenses([])
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    loadExpenses()
  }

  const handleFormChange = (
    expenseId: string,
    field: keyof ExpenseFormState,
    value: string
  ) => {
    setExpenseForms((prev) => ({
      ...prev,
      [expenseId]: {
        ...prev[expenseId],
        [field]: value,
      },
    }))
  }

  const handleViewEmployeeTrack = () => {
    const qs = new URLSearchParams()
    qs.set('employeeId', employeeId)
    if (fromDate) qs.set('fromDate', fromDate)
    if (toDate) qs.set('toDate', toDate)
    if (employeeName) qs.set('employeeName', employeeName)
    qs.set('returnTo', `/dashboard/expenses/manager-update/${employeeId}`)
    router.push(`/dashboard/reports/employee-track?${qs.toString()}`)
  }

  const handleBillUpload = async (expenseId: string, file: File) => {
    setUploadingBillId(expenseId)
    try {
      const formData = new FormData()
      formData.append('bill', file)

      const token =
        typeof window !== 'undefined' ? localStorage.getItem('authToken') : null
      const response = await fetch(`${API_BASE_URL}/api/expenses/upload-bill`, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.message || 'Upload failed')
      }

      const data = await response.json()
      const fileUrl = data.fileUrl || data.url

      await apiRequest(`/expenses/${expenseId}`, {
        method: 'PUT',
        body: JSON.stringify({ receipt: fileUrl }),
      })

      setExpenses((prev) =>
        prev.map((e) => (e._id === expenseId ? { ...e, receipt: fileUrl } : e))
      )
      toast.success('Bill image updated')
    } catch (error: any) {
      toast.error(error?.message || 'Failed to upload bill')
    } finally {
      setUploadingBillId(null)
    }
  }

  const handleRowDecision = async (expenseId: string, status: 'Needs Correction' | 'Rejected') => {
    const remarks = expenseForms[expenseId]?.managerRemarks?.trim()
    if (!remarks) {
      toast.error('Enter manager remarks before sending back or rejecting')
      return
    }
    setSubmitting(true)
    try {
      await apiRequest('/expenses/approve-multiple', {
        method: 'POST',
        body: JSON.stringify({
          expenses: [
            {
              id: expenseId,
              status,
              managerRemarks: remarks,
            },
          ],
        }),
      })
      toast.success(status === 'Rejected' ? 'Expense rejected' : 'Sent back for correction')
      await loadExpenses()
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Action failed')
    } finally {
      setSubmitting(false)
    }
  }

  const handleApprove = async () => {
    if (expenses.length === 0) {
      toast.error('No expenses to approve')
      return
    }

    setSubmitting(true)
    try {
      const expensesToApprove = expenses.map((exp) => ({
        id: exp._id,
        approvedAmount: expenseForms[exp._id]?.approvedAmount
          ? parseFloat(expenseForms[exp._id].approvedAmount)
          : exp.amount,
        managerRemarks: expenseForms[exp._id]?.managerRemarks || '',
        employeeRemarks: expenseForms[exp._id]?.employeeRemarks ?? exp.employeeRemarks ?? '',
      }))

      await apiRequest('/expenses/approve-multiple', {
        method: 'POST',
        body: JSON.stringify({ expenses: expensesToApprove }),
      })

      toast.success(`${expenses.length} expense(s) approved successfully`)
      router.push('/dashboard/expenses/pending')
    } catch (error: any) {
      toast.error(error?.message || 'Failed to approve expenses')
    } finally {
      setSubmitting(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  const getExpenseType = (category: string) => {
    if (category === 'Travel') return 'Travel'
    if (category === 'Food') return 'Food'
    return category
  }

  const totalAmount = expenses.reduce((sum, exp) => {
    const approvedAmount = expenseForms[exp._id]?.approvedAmount
      ? parseFloat(expenseForms[exp._id].approvedAmount)
      : exp.amount
    return sum + approvedAmount
  }, 0)

  const totalGpsDistance = expenses.reduce((sum, exp) => sum + (exp.gpsDistance || 0), 0)
  const totalClaimedKm = expenses.reduce((sum, exp) => sum + (claimedKm(exp) || 0), 0)

  const isImageReceipt = (url: string) =>
    /\.(jpe?g|png|gif|webp|bmp)$/i.test(url) || url.includes('/uploads/')

  return (
    <div className="space-y-6">
      {/* Date Filters */}
      <Card className="p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="fromDate" className="whitespace-nowrap">
              From Date:
            </Label>
            <Input
              id="fromDate"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-[180px] bg-white"
            />
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="toDate" className="whitespace-nowrap">
              To Date:
            </Label>
            <Input
              id="toDate"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-[180px] bg-white"
            />
          </div>
          <Button onClick={handleSearch} className="bg-blue-600 hover:bg-blue-700 text-white">
            Search
          </Button>
        </div>
      </Card>

      <Card className="p-4 shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              className="bg-white"
              onClick={handleViewEmployeeTrack}
            >
              View Employee Track
            </Button>
          </div>
          <div className="text-lg font-semibold text-neutral-900">
            Employee:{' '}
            <span className="text-blue-600">{employeeName || 'Loading...'}</span>
          </div>
        </div>
      </Card>

      <Card className="shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-neutral-50">
                <TableHead className="font-semibold">S.No</TableHead>
                <TableHead className="font-semibold">Exp Item ID</TableHead>
                <TableHead className="font-semibold">Expense Type</TableHead>
                <TableHead className="font-semibold">Claimed km</TableHead>
                <TableHead className="font-semibold">GPS km</TableHead>
                <TableHead className="font-semibold">Details</TableHead>
                <TableHead className="font-semibold">Date of Expense</TableHead>
                <TableHead className="font-semibold text-right">Amount</TableHead>
                <TableHead className="font-semibold">Emp.Remarks</TableHead>
                <TableHead className="font-semibold">Approval Amount</TableHead>
                <TableHead className="font-semibold">Mngr.Remarks</TableHead>
                <TableHead className="font-semibold">Proofs</TableHead>
                <TableHead className="font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={13} className="text-center py-8 text-neutral-500">
                    Loading expenses...
                  </TableCell>
                </TableRow>
              ) : expenses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={13} className="text-center py-8 text-neutral-500">
                    No pending expenses found for this employee
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {expenses.map((expense, index) => {
                    const receiptUrl = expense.receipt
                      ? resolveUploadUrl(expense.receipt)
                      : ''
                    return (
                      <TableRow
                        key={expense._id}
                        className={index % 2 === 0 ? 'bg-white' : 'bg-neutral-50/50'}
                      >
                        <TableCell>{index + 1}</TableCell>
                        <TableCell className="font-medium">
                          {expense.expItemId || expense._id.slice(-5)}
                        </TableCell>
                        <TableCell>{getExpenseType(expense.category)}</TableCell>
                        <TableCell className="text-right">
                          {claimedKm(expense) != null ? `${claimedKm(expense)} km` : '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          {expense.gpsDistance ? (
                            <span
                              className={
                                claimedKm(expense) != null &&
                                Math.abs((claimedKm(expense) || 0) - expense.gpsDistance) > 20
                                  ? 'text-amber-700 font-medium'
                                  : ''
                              }
                            >
                              {expense.gpsDistance.toFixed(1)} km
                            </span>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell className="max-w-xs text-xs">
                          {travelSummary(expense)}
                        </TableCell>
                        <TableCell>{formatDate(expense.date)}</TableCell>
                        <TableCell className="text-right font-medium">
                          {expense.amount.toFixed(2)}
                        </TableCell>
                        <TableCell className="max-w-xs">
                          <Textarea
                            value={
                              expenseForms[expense._id]?.employeeRemarks ??
                              expense.employeeRemarks ??
                              ''
                            }
                            onChange={(e) =>
                              handleFormChange(
                                expense._id,
                                'employeeRemarks',
                                e.target.value
                              )
                            }
                            placeholder="Employee Remarks"
                            className="min-h-[60px] resize-none bg-white text-sm"
                            rows={2}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            value={
                              expenseForms[expense._id]?.approvedAmount ||
                              expense.amount.toString()
                            }
                            onChange={(e) =>
                              handleFormChange(
                                expense._id,
                                'approvedAmount',
                                e.target.value
                              )
                            }
                            className="w-32 bg-white text-sm font-medium"
                            placeholder="Approved P"
                          />
                        </TableCell>
                        <TableCell className="max-w-xs">
                          <Textarea
                            value={expenseForms[expense._id]?.managerRemarks || ''}
                            onChange={(e) =>
                              handleFormChange(
                                expense._id,
                                'managerRemarks',
                                e.target.value
                              )
                            }
                            placeholder="Manager Remarks"
                            className="min-h-[60px] resize-none bg-white text-sm"
                            rows={2}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-2 min-w-[120px]">
                            {receiptUrl ? (
                              <div className="flex flex-col gap-1">
                                {isImageReceipt(receiptUrl) ? (
                                  <button
                                    type="button"
                                    onClick={() => setPreviewUrl(receiptUrl)}
                                    className="block"
                                  >
                                    <img
                                      src={receiptUrl}
                                      alt="Bill"
                                      className="h-14 w-14 object-cover rounded border border-neutral-200 hover:opacity-90"
                                    />
                                  </button>
                                ) : null}
                                <a
                                  href={receiptUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-700 flex items-center gap-1 text-sm"
                                >
                                  Bill
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              </div>
                            ) : (
                              <span className="text-neutral-400 text-sm">No bill</span>
                            )}
                            {expense.ticketReceipt && (
                              <a
                                href={resolveUploadUrl(expense.ticketReceipt)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 text-xs flex items-center gap-1"
                              >
                                Ticket
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                            <label className="cursor-pointer">
                              <input
                                type="file"
                                accept="image/*,.pdf"
                                className="hidden"
                                disabled={uploadingBillId === expense._id}
                                onChange={(e) => {
                                  const file = e.target.files?.[0]
                                  if (file) handleBillUpload(expense._id, file)
                                  e.target.value = ''
                                }}
                              />
                              <span className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                                <Upload className="h-3 w-3" />
                                {uploadingBillId === expense._id ? 'Uploading…' : 'Upload'}
                              </span>
                            </label>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1 min-w-[100px]">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="text-orange-700 border-orange-300 text-xs"
                              disabled={submitting}
                              onClick={() => handleRowDecision(expense._id, 'Needs Correction')}
                            >
                              Send back
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="text-red-700 border-red-300 text-xs"
                              disabled={submitting}
                              onClick={() => handleRowDecision(expense._id, 'Rejected')}
                            >
                              Reject
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                  <TableRow className="bg-neutral-100 font-semibold">
                    <TableCell colSpan={3} className="text-right">
                      Total:
                    </TableCell>
                    <TableCell className="text-right">
                      {totalClaimedKm > 0 ? `${totalClaimedKm.toFixed(1)} km` : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      {totalGpsDistance > 0
                        ? `${totalGpsDistance.toFixed(1)} km`
                        : '—'}
                    </TableCell>
                    <TableCell colSpan={4}></TableCell>
                    <TableCell className="text-right">
                      Rs. {totalAmount.toFixed(2)}
                    </TableCell>
                    <TableCell colSpan={2}></TableCell>
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </div>

        {expenses.length > 0 && (
          <div className="px-4 py-2 text-sm text-neutral-600 border-t">
            Showing 1 to {expenses.length} of {expenses.length} entries
          </div>
        )}
      </Card>

      {expenses.length > 0 && (
        <div className="flex justify-center">
          <Button
            onClick={handleApprove}
            disabled={submitting}
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-2"
          >
            {submitting ? 'Approving...' : 'Approve'}
          </Button>
        </div>
      )}

      <Dialog open={!!previewUrl} onOpenChange={(open) => !open && setPreviewUrl(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Bill Image</DialogTitle>
          </DialogHeader>
          {previewUrl && (
            <img
              src={previewUrl}
              alt="Bill preview"
              className="w-full h-auto max-h-[70vh] object-contain rounded"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
