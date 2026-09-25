'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { apiRequest, apiUrl } from '@/lib/api'
import { usePermissions } from '@/components/permissions/PermissionsProvider'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

type Choice = 'term1' | 'both'
type EditType = 'Excess' | 'Shortage' | 'Exchange'
type Allocation = { id: string; program: string; class: string; books: string[]; model: string; fromClass?: string; fromBooks?: string[]; quantities?: number[] }
type Mapping = { id: string; program: string; model: string; scenario: string; fromClass: string; fromBooks: string[]; toClass: string; toBooks: string[] }
type Catalog = { mappings: Mapping[]; unmappedRows?: Allocation[]; initial: Record<Choice, Allocation[]>; books: Record<string, string[]> }
type Row = { lineId: string; product: string; productName?: string; class: string; productCategory?: string; category?: string; level?: string; quantity: number; strength?: number }
type Change = { lineId: string; before: Row; after: Row; quantityDifference: number }
type Adjustment = { reference: string; editType: EditType; createdAt: string; createdByName?: string; status: string; remarks?: string; changes: Change[] }
type Main = {
  _id: string; dc_code?: string; customerName: string; customerPhone?: string; customerAddress?: string; status: string; poPhotoUrl?: string;
  dcOrderId?: { school_name?: string; school_code?: string; year?: string };
  grid?: { academicYear: string; deliveryChoice: Choice; scenario: string; sourceDcId?: string; revision: number; adjustments: Adjustment[] };
  originalRows?: Row[]; currentRows?: Row[]; linkedDcs?: Main[];
}
type Selection = { allocationId: string; quantities: string[]; prices: string[] }
type Preview = { scenario: string; academicYear: string; allocations: Allocation[]; unavailable: { program: string; class: string; message: string }[] }
const selectClass = 'h-10 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm text-neutral-900'
const modelLabel: Record<string, string> = { single: 'Single level per year', two: 'Two levels per year', both: 'Both levels together' }
const scenarioLabel: Record<string, string> = { initial: 'First allocation', same_year: 'Same Year', next_year: 'Next Year' }

function Field({ title, children }: { title: string; children: ReactNode }) {
  return <label className="block space-y-1.5 text-sm font-medium text-neutral-700"><span>{title}</span>{children}</label>
}
function RowsTable({ rows, original }: { rows: Row[]; original?: Row[] }) {
  return <div className="min-w-0 overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm">
    <thead><tr className="border-b bg-neutral-50">{['Product', 'Class', 'Category / Book', 'Level', ...(original ? ['Original quantity'] : []), original ? 'Current quantity' : 'Quantity'].map((h) => <th key={h} className="p-3">{h}</th>)}</tr></thead>
    <tbody>{rows.map((row) => <tr key={row.lineId} className="border-b">
      <td className="p-3">{row.product || row.productName}</td><td className="p-3">{row.class}</td>
      <td className="p-3">{row.productCategory || row.category || '—'}</td><td className="p-3">{row.level || '—'}</td>
      {original && <td className="p-3">{original.find((r) => r.lineId === row.lineId)?.quantity ?? '—'}</td>}
      <td className="p-3">{row.quantity}</td>
    </tr>)}</tbody>
  </table></div>
}

export default function DcGridWorkspace({ initialDcId, initialAction }: { initialDcId?: string; initialAction?: string }) {
  const [screen, setScreen] = useState<'home' | 'new' | 'sub' | 'detail'>(initialDcId ? initialAction === 'sub' ? 'sub' : initialAction === 'new' ? 'new' : 'detail' : 'home')
  const [creationType, setCreationType] = useState<'' | 'new_school' | 'existing_dc'>(initialAction === 'new' ? 'existing_dc' : '')
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [mains, setMains] = useState<Main[]>([])
  const [sourceId, setSourceId] = useState(initialDcId || '')
  const [main, setMain] = useState<Main | null>(null)
  const [mainLoading, setMainLoading] = useState(false)
  const [reload, setReload] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [year, setYear] = useState('')
  const [sourceAcademicYear, setSourceAcademicYear] = useState('')
  const [choice, setChoice] = useState<Choice>('term1')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState('')
  const [selections, setSelections] = useState<Selection[]>([])
  const [allocationId, setAllocationId] = useState('')
  const [school, setSchool] = useState({ school_name: '', school_code: '', contact_mobile: '', address: '' })
  const [employeeId, setEmployeeId] = useState('')
  const [employees, setEmployees] = useState<{ _id: string; name: string }[]>([])
  const [remarks, setRemarks] = useState('')
  const [editType, setEditType] = useState<EditType>('Excess')
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [showReference, setShowReference] = useState(false)
  const [poUrl, setPoUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const { user } = usePermissions()
  const canAssign = Boolean(user?.isSuperAdmin || ['Super Admin', 'Admin', 'Coordinator', 'Senior Coordinator', 'Manager'].includes(user?.role || ''))

  useEffect(() => {
    let active = true
    Promise.all([apiRequest<Catalog>('/dc/grid/catalog'), apiRequest<Main[]>('/dc/grid')])
      .then(([rules, records]) => { if (active) { setCatalog(rules); setMains(records) } })
      .catch((e) => { if (active) setError(e.message || 'Unable to load DCs.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [reload])

  useEffect(() => {
    let active = true
    setMain(null); setEdits({}); setSourceAcademicYear('')
    if (!sourceId) { setMainLoading(false); return }
    setMainLoading(true)
    apiRequest<Main>(`/dc/${sourceId}/grid`).then((record) => {
      if (active) { setMain(record); setSourceAcademicYear(record.grid?.academicYear || record.dcOrderId?.year || ''); setChoice(record.grid?.deliveryChoice || 'term1'); setPoUrl(record.poPhotoUrl || '') }
    }).catch((e) => { if (active) setError(e.message || 'Unable to load Main DC.') })
      .finally(() => { if (active) setMainLoading(false) })
    return () => { active = false }
  }, [sourceId, reload])

  useEffect(() => {
    if (!canAssign || creationType !== 'new_school') return
    let active = true
    apiRequest<{ _id: string; name: string }[]>('/employees').then((data) => {
      if (active) setEmployees(Array.isArray(data) ? data : [])
    }).catch((e) => { if (active) setError(e.message || 'Unable to load employees.') })
    return () => { active = false }
  }, [canAssign, creationType])

  useEffect(() => {
    let active = true
    setPreview(null); setSelections([]); setAllocationId(''); setPreviewError(''); setPreviewLoading(false)
    if (screen !== 'new' || creationType !== 'existing_dc' || !main || !sourceAcademicYear || !/^\d{4}(?:-\d{2}(?:\d{2})?)?$/.test(year)) return
    setPreviewLoading(true)
    apiRequest<Preview>('/dc/grid/preview', { method: 'POST', body: JSON.stringify({ sourceDcId: main._id, sourceAcademicYear, academicYear: year, deliveryChoice: choice }) })
      .then((result) => {
        if (!active) return
        setPreview(result)
        setSelections(result.allocations.map((a) => ({ allocationId: a.id, quantities: a.books.map((_, i) => String(a.quantities?.[i] || '')), prices: a.books.map(() => '') })))
      }).catch((e) => { if (active) setPreviewError(e.message || 'Unable to apply the grid.') })
      .finally(() => { if (active) setPreviewLoading(false) })
    return () => { active = false }
  }, [screen, creationType, main, sourceAcademicYear, year, choice])

  const allocations = creationType === 'existing_dc' ? preview?.allocations || [] : catalog?.initial[choice] || []
  const bookOptions = (row: Row) => {
    const key = (row.product || row.productName || '').toLowerCase().replace(/[\s_-]/g, '')
    const program = key === 'abacus' ? 'Abacus' : ['vedicmath', 'vedicmaths', 'vedhmath'].includes(key) ? 'Vedic Maths' : ['spellingbee', 'newspellingbee'].includes(key) ? 'Spelling Bee' : ''
    return catalog?.books[program] || []
  }
  function startNew(type: '' | 'new_school' | 'existing_dc' = '') {
    setScreen('new'); setCreationType(type); setSelections([]); setRemarks(''); setError(''); setYear('')
    if (type !== 'existing_dc') setSourceId('')
  }
  function openRecord(record: Main, action: 'detail' | 'sub' = 'detail') {
    setSourceId(record._id); setScreen(action); setError(''); setEdits({}); setRemarks('')
  }
  async function saveMain() {
    setSaving(true); setError('')
    try {
      const result = await apiRequest<Main>('/dc/grid', { method: 'POST', body: JSON.stringify({ creationType, sourceDcId: sourceId,
        sourceAcademicYear, academicYear: year, deliveryChoice: choice, selections, school, employeeId, remarks }) })
      setSourceId(result._id); setScreen('detail'); setReload((n) => n + 1); toast.success('Main DC created')
    } catch (e: any) { setError(e.message || 'Unable to create DC.') }
    finally { setSaving(false) }
  }
  async function saveSub() {
    if (!main) return
    setSaving(true); setError('')
    try {
      await apiRequest(`/dc/${main._id}/sub-dc`, { method: 'POST', body: JSON.stringify({ editType, revision: main.grid?.revision || 0,
        academicYear: sourceAcademicYear, deliveryChoice: choice, remarks,
        edits: Object.entries(edits).map(([lineId, value]) => editType === 'Exchange' ? { lineId, book: value } : { lineId, quantity: value }) }) })
      setScreen('detail'); setEdits({}); setReload((n) => n + 1); toast.success('Sub DC applied')
    } catch (e: any) { setError(e.message || 'Unable to create Sub DC.') }
    finally { setSaving(false) }
  }
  async function uploadPo(file: File) {
    setUploading(true); setError('')
    try {
      const data = new FormData(); data.append('poPhoto', file)
      const response = await fetch(apiUrl('/dc/upload-po'), { method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('authToken') || ''}` }, body: data })
      const uploaded = await response.json()
      if (!response.ok) throw new Error(uploaded.message || 'Unable to upload PO.')
      setPoUrl(uploaded.poPhotoUrl)
    } catch (e: any) { setError(e.message || 'Unable to upload PO.') }
    finally { setUploading(false) }
  }
  async function requestDc() {
    if (!main) return
    setSaving(true); setError('')
    try {
      await apiRequest(`/dc/${main._id}/grid/request`, { method: 'POST', body: JSON.stringify({ poPhotoUrl: poUrl }) })
      setReload((n) => n + 1); toast.success('DC sent to Closed Sales for review')
    } catch (e: any) { setError(e.message || 'Unable to request DC.') }
    finally { setSaving(false) }
  }
  const sourceSelector = <Field title="Main DC"><select aria-label="Main DC" className={selectClass} value={sourceId} onChange={(e) => { setSourceId(e.target.value); setError('') }}>
    <option value="">Select a Main DC</option>{mains.map((dc) => <option key={dc._id} value={dc._id}>{dc.dc_code || dc._id} · {dc.customerName} · {dc.grid?.academicYear || dc.dcOrderId?.year || 'Year not set'}</option>)}
  </select></Field>

  return <div className="mx-auto min-w-0 max-w-7xl space-y-6 text-neutral-900">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h1 className="text-2xl font-semibold">{screen === 'detail' ? 'Main DC Details' : screen === 'sub' ? 'Create Sub DC' : 'Create DC'}</h1>
        <p className="mt-1 text-sm text-neutral-600">School book allocations and DC adjustment history</p></div>
      <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setShowReference(!showReference)}>View grids</Button>
        {screen !== 'home' && <Button variant="outline" disabled={saving} onClick={() => { setScreen('home'); setError('') }}>All Main DCs</Button>}</div>
    </div>
    {error && <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
    {loading && <p role="status">Loading DCs and allocation grids…</p>}
    {showReference && catalog && <Card className="overflow-x-auto p-4"><h2 className="mb-3 font-semibold">Grid.docx — listed mappings</h2>
      <table className="w-full text-left text-sm"><thead><tr>{['Program', 'Model', 'Current class', 'Current books', 'Next class', 'Next books'].map((h) => <th key={h} className="p-2">{h}</th>)}</tr></thead>
        <tbody>{catalog.mappings.map((m) => <tr key={m.id} className="border-t"><td className="p-2">{m.program}</td><td className="p-2">{modelLabel[m.model]}</td><td className="p-2">{m.fromClass}</td><td className="p-2">{m.fromBooks.join(' + ') || '0'}</td><td className="p-2">{m.toClass}</td><td className="p-2">{m.toBooks.join(' + ')}</td></tr>)}
          {catalog.unmappedRows?.map((row) => <tr key={row.id} className="border-t"><td className="p-2">{row.program}</td><td className="p-2">{modelLabel[row.model]}</td><td className="p-2">{row.class}</td><td className="p-2">{row.books.join(' + ')}</td><td className="p-2" colSpan={2}>No next-year destination listed</td></tr>)}
        </tbody>
      </table></Card>}
    {screen === 'home' && <>
      <div className="grid gap-4 md:grid-cols-2"><Card className="space-y-3 p-6"><h2 className="text-lg font-semibold">New DC</h2><p className="text-sm text-neutral-600">Create a Main DC for a new school or a new transaction against an existing DC.</p><Button disabled={!catalog} onClick={() => startNew()}>New DC</Button></Card>
        <Card className="space-y-3 p-6"><h2 className="text-lg font-semibold">Sub DC</h2><p className="text-sm text-neutral-600">Apply Excess, Shortage or Exchange to an existing Main DC.</p><Button disabled={!catalog} onClick={() => { setScreen('sub'); setSourceId(''); setEdits({}); setRemarks(''); setError('') }}>Sub DC</Button></Card></div>
      <Card className="overflow-x-auto p-4"><h2 className="mb-3 font-semibold">Main DCs</h2>
        {!loading && !mains.length && <p className="text-sm text-neutral-500">No Main DCs yet.</p>}
        <table className="w-full text-left text-sm"><thead><tr>{['Reference', 'School', 'Academic year', 'Status', ''].map((h) => <th key={h} className="p-3">{h}</th>)}</tr></thead>
          <tbody>{mains.map((dc) => <tr className="border-t" key={dc._id}><td className="p-3">{dc.dc_code || dc._id}</td><td className="p-3">{dc.customerName}</td><td className="p-3">{dc.grid?.academicYear || dc.dcOrderId?.year || '—'}</td><td className="p-3">{dc.status.replaceAll('_', ' ')}</td><td className="p-3"><Button size="sm" variant="outline" onClick={() => openRecord(dc)}>Details / Sub DC</Button></td></tr>)}</tbody></table>
      </Card></>}
    {screen === 'new' && <Card className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap gap-3"><Button variant={creationType === 'new_school' ? 'default' : 'outline'} onClick={() => { setCreationType('new_school'); setSourceId('') }}>New School</Button><Button variant={creationType === 'existing_dc' ? 'default' : 'outline'} onClick={() => setCreationType('existing_dc')}>Against Existing DC</Button></div>
      {creationType && <>
        {creationType === 'new_school' ? <div className="grid gap-4 md:grid-cols-2">
          <Field title="School name"><Input value={school.school_name} onChange={(e) => setSchool({ ...school, school_name: e.target.value })} /></Field>
          <Field title="School code"><Input value={school.school_code} onChange={(e) => setSchool({ ...school, school_code: e.target.value })} /></Field>
          <Field title="Contact mobile"><Input inputMode="numeric" maxLength={10} value={school.contact_mobile} onChange={(e) => setSchool({ ...school, contact_mobile: e.target.value })} /></Field>
          <Field title="School address"><Input value={school.address} onChange={(e) => setSchool({ ...school, address: e.target.value })} /></Field>
          {canAssign && <Field title="Assigned employee"><select className={selectClass} value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}><option value="">Select employee</option>{employees.map((employee) => <option key={employee._id} value={employee._id}>{employee.name}</option>)}</select></Field>}
        </div> : <div className="space-y-3">{sourceSelector}<p className="text-sm text-neutral-500">This creates a new DC transaction linked to the selected DC.</p></div>}
        <div className="grid gap-4 md:grid-cols-3">
          <Field title="Delivery choice"><select className={selectClass} value={choice} onChange={(e) => setChoice(e.target.value as Choice)}><option value="term1">Term 1</option><option value="both">Both Levels</option></select></Field>
          {creationType === 'existing_dc' && <Field title="Original academic year"><Input placeholder="2026-27" value={sourceAcademicYear} disabled={Boolean(main?.grid?.academicYear || main?.dcOrderId?.year)} onChange={(e) => setSourceAcademicYear(e.target.value)} /></Field>}
          <Field title="DC academic year"><Input placeholder="2026-27" value={year} onChange={(e) => setYear(e.target.value)} /></Field>
        </div>
        {mainLoading && creationType === 'existing_dc' && <p role="status">Loading original allocation…</p>}
        {previewLoading && <p role="status">Applying the distribution grid…</p>}
        {previewError && <p role="alert" className="text-sm text-red-700">{previewError}</p>}
        {preview && <div className="space-y-2"><p className="font-medium">Distribution: {scenarioLabel[preview.scenario]}</p>{preview.unavailable.map((item, i) => <p key={i} className="text-sm text-amber-800">{item.program}, Class {item.class}: {item.message}</p>)}</div>}
        {creationType === 'new_school' && <div className="flex items-end gap-2"><div className="min-w-0 flex-1"><Field title="Class / category / level allocation"><select className={selectClass} value={allocationId} onChange={(e) => setAllocationId(e.target.value)}><option value="">Select a listed allocation</option>{allocations.map((a) => <option key={a.id} value={a.id}>{a.program} · Class {a.class} · {a.books.join(' + ')}</option>)}</select></Field></div>
          <Button disabled={!allocationId} onClick={() => {
            const a = allocations.find((item) => item.id === allocationId)
            if (!a) return
            if (selections.some((s) => { const other = allocations.find((item) => item.id === s.allocationId); return other?.program === a.program && other.class === a.class })) { setError('Choose one allocation per product and class.'); return }
            setSelections([...selections, { allocationId, quantities: a.books.map(() => ''), prices: a.books.map(() => '') }]); setAllocationId(''); setError('')
          }}>Add class</Button></div>}
        {selections.map((selection, index) => {
          const allocation = allocations.find((a) => a.id === selection.allocationId)
          if (!allocation) return null
          return <div key={selection.allocationId} className="space-y-3 rounded-lg border p-4">
            <div className="flex items-start justify-between gap-2"><div><h3 className="font-semibold">{allocation.program} · Class {allocation.class}</h3><p className="text-sm text-neutral-500">{modelLabel[allocation.model]}{allocation.fromBooks ? ` · From Class ${allocation.fromClass}: ${allocation.fromBooks.join(' + ')}` : ''}</p></div><Button size="sm" variant="ghost" onClick={() => setSelections(selections.filter((_, i) => i !== index))}>Remove</Button></div>
            {allocation.books.map((book, bookIndex) => <div key={book} className="grid items-end gap-3 md:grid-cols-[2fr_1fr_1fr]"><p className="py-2 text-sm">{book}</p>
              <Field title="Quantity"><Input type="number" min="1" step="1" value={selection.quantities[bookIndex]} onChange={(e) => setSelections(selections.map((s, i) => i === index ? { ...s, quantities: s.quantities.map((q, j) => j === bookIndex ? e.target.value : q) } : s))} /></Field>
              <Field title="Unit price"><Input type="number" min="0" step="0.01" value={selection.prices[bookIndex]} onChange={(e) => setSelections(selections.map((s, i) => i === index ? { ...s, prices: s.prices.map((p, j) => j === bookIndex ? e.target.value : p) } : s))} /></Field>
            </div>)}
          </div>
        })}
        <Field title="Remarks"><Input value={remarks} onChange={(e) => setRemarks(e.target.value)} maxLength={2000} /></Field>
        <Button disabled={saving || loading || previewLoading || mainLoading || !year || !selections.length || (creationType === 'existing_dc' && !preview)} onClick={saveMain}>{saving ? 'Creating…' : 'Create Main DC'}</Button>
      </>}
    </Card>}
    {(screen === 'detail' || screen === 'sub') && <>
      {sourceSelector}
      {mainLoading && <p role="status">Loading Main DC…</p>}
      {main && <>
        <Card className="space-y-4 p-4 md:p-6"><div className="grid gap-3 text-sm md:grid-cols-3">
          <div><span className="text-neutral-500">Main DC reference</span><p className="font-semibold">{main.dc_code || main._id}</p></div>
          <div><span className="text-neutral-500">School</span><p className="font-semibold">{main.customerName} {main.dcOrderId?.school_code ? `(${main.dcOrderId.school_code})` : ''}</p></div>
          <div><span className="text-neutral-500">Academic year</span><p className="font-semibold">{main.grid?.academicYear || main.dcOrderId?.year || 'Not set'}</p></div>
          <div><span className="text-neutral-500">Distribution</span><p>{main.grid ? `${scenarioLabel[main.grid.scenario]} · ${main.grid.deliveryChoice === 'both' ? 'Both Levels' : 'Term 1'}` : 'Original allocation'}</p></div>
          <div><span className="text-neutral-500">Status</span><p>{main.status.replaceAll('_', ' ')}</p></div>
          {main.grid?.sourceDcId && <div><span className="text-neutral-500">Created against</span><p><Link className="text-blue-700 underline" href={`/dashboard/dc/grid?dc=${main.grid.sourceDcId}`}>Previous Main DC</Link></p></div>}
        </div><RowsTable rows={main.currentRows || []} original={main.originalRows} />
          <details className="text-sm"><summary className="cursor-pointer font-medium">Original allocation</summary><RowsTable rows={main.originalRows || []} /></details>
          <div className="flex flex-wrap gap-2"><Button disabled={saving} onClick={() => { setScreen('sub'); setEdits({}); setRemarks(''); setError('') }}>Create Sub DC</Button><Button variant="outline" disabled={saving} onClick={() => startNew('existing_dc')}>Create New DC</Button><Link href="/dashboard/dc/client-dc"><Button variant="outline">Client requests</Button></Link></div>
        </Card>
        {screen === 'detail' && main.grid && main.status === 'created' && <Card className="space-y-3 p-4 md:p-6"><h2 className="font-semibold">Request DC</h2><p className="text-sm text-neutral-600">Attach the purchase order and send this allocation to Closed Sales for review.</p>
          <Field title="Purchase order (PDF or image)"><Input type="file" accept=".pdf,.jpg,.jpeg,.png" disabled={uploading || saving} onChange={(e) => { const file = e.target.files?.[0]; if (file) void uploadPo(file) }} /></Field>
          {poUrl && <p className="text-sm text-green-700">Purchase order attached.</p>}
          <Button disabled={saving || uploading || !poUrl} onClick={requestDc}>{uploading ? 'Uploading…' : saving ? 'Submitting…' : 'Request DC'}</Button>
        </Card>}
        {screen === 'sub' && <Card className="space-y-4 p-4 md:p-6"><h2 className="font-semibold">Sub DC adjustment</h2>
          {!main.grid?.academicYear && !main.dcOrderId?.year && <Field title="Main DC academic year"><Input placeholder="2026-27" value={sourceAcademicYear} onChange={(e) => setSourceAcademicYear(e.target.value)} /></Field>}
          <Field title="Edit type"><select className={selectClass} value={editType} onChange={(e) => { setEditType(e.target.value as EditType); setEdits({}) }}>{['Excess', 'Shortage', 'Exchange'].map((type) => <option key={type}>{type}</option>)}</select></Field>
          <p className="text-sm text-neutral-600">{editType === 'Exchange' ? 'Select the replacement category / level. Quantity remains unchanged.' : `Enter the revised requirement for selected rows. ${editType === 'Excess' ? 'Excess increases' : 'Shortage decreases'} quantity.`}</p>
          {!['created', 'po_submitted', 'pending_dc', 'scheduled_for_later'].includes(main.status) && <p className="text-sm text-amber-800">This updates the school’s requirement. Warehouse processing and recorded deliveries remain in their existing workflow.</p>}
          {(main.currentRows || []).map((row) => <div key={row.lineId} className="grid items-center gap-3 rounded-md border p-3 md:grid-cols-[auto_2fr_1fr]">
            <input type="checkbox" aria-label={`Adjust ${row.product}, Class ${row.class}, ${row.productCategory || row.level}`} checked={row.lineId in edits} onChange={(e) => setEdits((previous) => { const next = { ...previous }; if (e.target.checked) next[row.lineId] = editType === 'Exchange' ? '' : String(row.quantity); else delete next[row.lineId]; return next })} />
            <div className="text-sm"><p className="font-medium">{row.product} · Class {row.class} · {row.productCategory || row.level}</p><p className="text-neutral-500">Current quantity: {row.quantity}</p></div>
            {editType === 'Exchange' ? <select aria-label="Replacement book" className={selectClass} disabled={!(row.lineId in edits)} value={edits[row.lineId] || ''} onChange={(e) => setEdits({ ...edits, [row.lineId]: e.target.value })}><option value="">Select replacement</option>{bookOptions(row).filter((book) => book !== row.productCategory).map((book) => <option key={book}>{book}</option>)}</select> :
              <div><Input aria-label="Revised quantity" type="number" min="0" step="1" disabled={!(row.lineId in edits)} value={edits[row.lineId] ?? ''} onChange={(e) => setEdits({ ...edits, [row.lineId]: e.target.value })} />{row.lineId in edits && edits[row.lineId] !== '' && <p className="mt-1 text-xs text-neutral-500">Difference: {Number(edits[row.lineId]) - row.quantity > 0 ? '+' : ''}{Number(edits[row.lineId]) - row.quantity}</p>}</div>}
          </div>)}
          <Field title="Remarks"><Input value={remarks} maxLength={2000} onChange={(e) => setRemarks(e.target.value)} /></Field>
          <Button disabled={saving || !Object.keys(edits).length} onClick={saveSub}>{saving ? 'Applying…' : 'Create Sub DC'}</Button>
        </Card>}
        <Card className="space-y-4 p-4 md:p-6"><h2 className="font-semibold">Sub DC History</h2>
          {!main.grid?.adjustments?.length && <p className="text-sm text-neutral-500">No adjustments yet. Sub DC actions are available from Main DC creation.</p>}
          {main.grid?.adjustments?.map((a) => <div key={a.reference} className="space-y-2 rounded-lg border p-4"><div className="flex flex-wrap justify-between gap-2 text-sm"><span className="break-all font-semibold">{a.editType} · {a.reference}</span><span>{a.status}</span></div>
            <p className="text-xs text-neutral-500">Main DC: {main.dc_code || main._id} · {new Date(a.createdAt).toLocaleString()} · {a.createdByName || '—'}</p>
            {a.changes.map((change) => <p key={change.lineId} className="text-sm">{change.before.product}, Class {change.before.class}: {a.editType === 'Exchange' ? `${change.before.productCategory || change.before.level} → ${change.after.productCategory || change.after.level}` : `${change.before.quantity} → ${change.after.quantity} (${change.quantityDifference > 0 ? '+' : ''}${change.quantityDifference})`}</p>)}
            {a.remarks && <p className="text-sm text-neutral-600">{a.remarks}</p>}</div>)}
        </Card>
        {!!main.linkedDcs?.length && <Card className="space-y-3 p-4"><h2 className="font-semibold">New DCs against this Main DC</h2>{main.linkedDcs.map((dc) => <div key={dc._id}><Link className="text-sm text-blue-700 underline" href={`/dashboard/dc/grid?dc=${dc._id}`}>{dc.dc_code || dc._id} · {dc.grid?.academicYear} · {dc.status}</Link></div>)}</Card>}
      </>}
    </>}
  </div>
}
