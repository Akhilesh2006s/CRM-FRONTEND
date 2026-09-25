import DcGridWorkspace from '@/components/dc/DcGridWorkspace'

export default function GridDcPage({ searchParams }: { searchParams: { dc?: string; action?: string } }) {
  return <DcGridWorkspace key={`${searchParams.dc || ''}:${searchParams.action || ''}`} initialDcId={searchParams.dc} initialAction={searchParams.action} />
}
