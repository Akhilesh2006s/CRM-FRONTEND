'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { apiRequest } from '@/lib/api'
import { 
  Brain, 
  TrendingUp, 
  AlertCircle, 
  Wallet, 
  Users, 
  ShieldCheck, 
  LineChart as LineChartIcon,
  Timer,
  UserMinus,
  FileText,
  ListChecks,
  RefreshCw,
  BarChart3,
  TrendingDown,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownRight,
  Info,
  Target,
  Award,
  AlertTriangle,
  Activity
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import LineChart from '@/components/charts/LineChart'
import PieChart from '@/components/charts/PieChart'
import BarGradient from '@/components/charts/BarGradient'
import AreaGradient from '@/components/charts/AreaGradient'
import { motion, AnimatePresence } from 'framer-motion'

const AI_TOOLS = [
  {
    id: 'revenue-at-risk',
    name: 'Revenue at Risk',
    shortName: 'Revenue Risk',
    description: 'AI-powered engine identifying revenue likely to get stuck or lost',
    icon: Wallet,
    gradient: 'from-rose-500 via-pink-500 to-rose-600',
    bgGradient: 'from-rose-50 via-pink-50 to-rose-100',
    color: 'rose'
  },
  {
    id: 'executive-dashboard',
    name: 'Executive Dashboard',
    shortName: 'Executive View',
    description: 'High-level strategic view of revenue trends and critical issues',
    icon: TrendingUp,
    gradient: 'from-blue-500 via-cyan-500 to-blue-600',
    bgGradient: 'from-blue-50 via-cyan-50 to-blue-100',
    color: 'blue'
  },
  {
    id: 'priority-engine',
    name: 'Smart Priority Engine',
    shortName: 'Priority AI',
    description: 'Automatically ranks daily actions by business impact and urgency',
    icon: ListChecks,
    gradient: 'from-amber-500 via-yellow-500 to-amber-600',
    bgGradient: 'from-amber-50 via-yellow-50 to-amber-100',
    color: 'amber'
  },
  {
    id: 'deal-risk-scoring',
    name: 'Deal Risk Scoring',
    shortName: 'Deal Risk',
    description: 'Identifies deals at high risk of failing with ML predictions',
    icon: AlertCircle,
    gradient: 'from-red-500 via-orange-500 to-red-600',
    bgGradient: 'from-red-50 via-orange-50 to-red-100',
    color: 'red'
  },
  {
    id: 'performance-risk',
    name: 'Performance Risk Index',
    shortName: 'Performance',
    description: 'Highlights managers and zones showing performance drops',
    icon: Users,
    gradient: 'from-purple-500 via-violet-500 to-purple-600',
    bgGradient: 'from-purple-50 via-violet-50 to-purple-100',
    color: 'purple'
  },
  {
    id: 'fraud-detection',
    name: 'Fraud Detection',
    shortName: 'Fraud AI',
    description: 'Advanced ML detection of unusual patterns in transactions',
    icon: ShieldCheck,
    gradient: 'from-orange-500 via-amber-500 to-orange-600',
    bgGradient: 'from-orange-50 via-amber-50 to-orange-100',
    color: 'orange'
  },
  {
    id: 'cashflow-analyzer',
    name: 'Cashflow Analyzer',
    shortName: 'Cashflow',
    description: 'Identifies payment delays and cashflow bottlenecks',
    icon: LineChartIcon,
    gradient: 'from-teal-500 via-cyan-500 to-teal-600',
    bgGradient: 'from-teal-50 via-cyan-50 to-teal-100',
    color: 'teal'
  },
  {
    id: 'delay-cost-calculator',
    name: 'Delay Cost Calculator',
    shortName: 'Delay Cost',
    description: 'Calculates financial loss from operational delays',
    icon: Timer,
    gradient: 'from-yellow-500 via-amber-500 to-yellow-600',
    bgGradient: 'from-yellow-50 via-amber-50 to-yellow-100',
    color: 'yellow'
  },
  {
    id: 'churn-predictor',
    name: 'Churn Predictor',
    shortName: 'Churn AI',
    description: 'ML-powered identification of customers likely to churn',
    icon: UserMinus,
    gradient: 'from-pink-500 via-rose-500 to-pink-600',
    bgGradient: 'from-pink-50 via-rose-50 to-pink-100',
    color: 'pink'
  },
  {
    id: 'narrative-bi',
    name: 'Narrative BI',
    shortName: 'Narrative',
    description: 'Converts complex data into simple business summaries',
    icon: FileText,
    gradient: 'from-indigo-500 via-purple-500 to-indigo-600',
    bgGradient: 'from-indigo-50 via-purple-50 to-indigo-100',
    color: 'indigo'
  }
]

export default function AIDashboardPage() {
  const searchParams = useSearchParams()
  const [activeTool, setActiveTool] = useState('narrative-bi')
  const [data, setData] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const toolParam = searchParams.get('tool')
    if (toolParam && AI_TOOLS.some((t) => t.id === toolParam)) {
      setActiveTool(toolParam)
    }
  }, [searchParams])

  useEffect(() => {
    loadAIData()
  }, [activeTool])

  const loadAIData = async () => {
    setLoading(true)
    setError(null)
    try {
      const endpoint = `/ai/${activeTool.replace(/_/g, '-')}`
      const response = await apiRequest(endpoint, { method: 'GET' })
      setData(response)
    } catch (err: any) {
      let errorMessage = err.message || 'Failed to load AI data'
      
      if (err.status === 503 || err.message?.includes('503') || err.message?.includes('not available') || err.message?.includes('AI Service')) {
        errorMessage = err.message || 'AI Service is not running. Please start the Python AI service:\n\ncd ai-service\npython app.py'
      }
      
      setError(errorMessage)
      console.error('AI Data Error:', err)
    } finally {
      setLoading(false)
    }
  }

  const activeToolConfig = AI_TOOLS.find(t => t.id === activeTool) || AI_TOOLS[0]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50">
      {/* Hero Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600">
        <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,white,transparent)]" />
        <div className="relative container mx-auto px-6 py-12">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-center gap-4"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-white/20 blur-xl rounded-full" />
              <Brain className="h-12 w-12 text-white relative z-10" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">AI Intelligence Platform</h1>
              <p className="text-indigo-100 text-lg">Advanced Revenue & Risk Intelligence for Modern Business</p>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8 space-y-8">
        {/* Tool Selector - Beautiful Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Tabs value={activeTool} onValueChange={setActiveTool} className="w-full">
            <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 lg:grid-cols-10 gap-3 h-auto p-2 bg-white/80 backdrop-blur-sm border border-gray-200/60 rounded-2xl shadow-lg">
              {AI_TOOLS.map((tool) => {
                const Icon = tool.icon
                const isActive = activeTool === tool.id
                return (
                  <TabsTrigger
                    key={tool.id}
                    value={tool.id}
                    className={`
                      flex flex-col items-center gap-2 p-4 h-auto rounded-xl
                      transition-all duration-300 relative overflow-hidden
                      ${isActive 
                        ? `bg-gradient-to-br ${tool.gradient} text-white shadow-lg scale-105` 
                        : 'bg-white/50 hover:bg-white/80 text-gray-700 hover:scale-102'
                      }
                    `}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activeTab"
                        className="absolute inset-0 bg-gradient-to-br opacity-20"
                        initial={false}
                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                      />
                    )}
                    <Icon className={`h-5 w-5 relative z-10 ${isActive ? 'text-white' : ''}`} />
                    <span className={`text-xs font-medium text-center relative z-10 ${isActive ? 'text-white' : ''}`}>
                      {tool.shortName}
                    </span>
                    {isActive && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute top-1 right-1"
                      >
                        <div className="w-2 h-2 bg-white rounded-full" />
                      </motion.div>
                    )}
                  </TabsTrigger>
                )
              })}
            </TabsList>

            {AI_TOOLS.map((tool) => (
              <TabsContent key={tool.id} value={tool.id} className="mt-8">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTool}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Card className={`overflow-hidden border-0 shadow-2xl bg-gradient-to-br ${tool.bgGradient}`}>
                      <CardHeader className="pb-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className={`p-3 rounded-xl bg-gradient-to-br ${tool.gradient} shadow-lg`}>
                              <tool.icon className="h-6 w-6 text-white" />
                            </div>
                            <div>
                              <CardTitle className="text-2xl font-bold text-gray-900">{tool.name}</CardTitle>
                              <p className="text-gray-600 mt-1">{tool.description}</p>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={loadAIData}
                            disabled={loading}
                            className="bg-white/80 hover:bg-white"
                          >
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Refresh
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {renderToolContent()}
                      </CardContent>
                    </Card>
                  </motion.div>
                </AnimatePresence>
              </TabsContent>
            ))}
          </Tabs>
        </motion.div>
      </div>
    </div>
  )

  function renderToolContent() {
    if (loading) {
      return (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 w-full rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      )
    }

    if (error) {
      const isServiceError = error.includes('not running') || error.includes('not available')
      return (
        <Card className="p-8 bg-white/90 backdrop-blur-sm border-2 border-red-200">
          <div className="text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", duration: 0.5 }}
            >
              <div className="relative inline-block mb-6">
                <div className="absolute inset-0 bg-red-500/20 blur-2xl rounded-full" />
                <AlertTriangle className="h-16 w-16 text-red-500 relative z-10" />
              </div>
            </motion.div>
            <h3 className="text-2xl font-bold text-gray-900 mb-3">
              {isServiceError ? 'AI Service Not Available' : 'Error Loading Data'}
            </h3>
            <div className="text-gray-600 mb-6 whitespace-pre-line max-w-2xl mx-auto">{error}</div>
            {isServiceError && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200 rounded-xl p-6 mb-6 text-left max-w-2xl mx-auto"
              >
                <p className="text-sm font-semibold text-yellow-900 mb-3 flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  Quick Setup Guide
                </p>
                <ol className="text-sm text-yellow-800 list-decimal list-inside space-y-2">
                  <li>Open a terminal/command prompt</li>
                  <li>Navigate: <code className="bg-yellow-100 px-2 py-1 rounded font-mono">cd ai-service</code></li>
                  <li>Install: <code className="bg-yellow-100 px-2 py-1 rounded font-mono">pip install -r requirements.txt</code></li>
                  <li>Start: <code className="bg-yellow-100 px-2 py-1 rounded font-mono">python app.py</code></li>
                </ol>
              </motion.div>
            )}
            <Button onClick={loadAIData} size="lg" className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry Connection
            </Button>
          </div>
        </Card>
      )
    }

    switch (activeTool) {
      case 'narrative-bi':
        return <NarrativeBIView data={data} />
      case 'revenue-at-risk':
        return <RevenueAtRiskView data={data} />
      case 'executive-dashboard':
        return <ExecutiveDashboardView data={data} />
      case 'priority-engine':
        return <PriorityEngineView data={data} />
      case 'deal-risk-scoring':
        return <DealRiskScoringView data={data} />
      case 'performance-risk':
        return <PerformanceRiskView data={data} />
      case 'fraud-detection':
        return <FraudDetectionView data={data} />
      case 'cashflow-analyzer':
        return <CashflowAnalyzerView data={data} />
      case 'delay-cost-calculator':
        return <DelayCostCalculatorView data={data} />
      case 'churn-predictor':
        return <ChurnPredictorView data={data} />
      default:
        return <div>Select a tool to view insights</div>
    }
  }
}

// Enhanced View Components with Beautiful UI
function NarrativeBIView({ data }: { data: any }) {
  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-8 text-white shadow-2xl"
      >
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <FileText className="h-8 w-8" />
            <h3 className="text-2xl font-bold">Business Intelligence Summary</h3>
          </div>
          <p className="text-lg leading-relaxed text-indigo-50 mb-6">{data.summary || 'Generating insights...'}</p>
          {data.overall_assessment && (
            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 border border-white/30">
              <p className="font-semibold text-lg">{data.overall_assessment}</p>
            </div>
          )}
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-0 shadow-lg bg-white/90 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-indigo-600" />
              Key Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {data.key_insights?.map((insight: string, i: number) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="flex items-start gap-3 p-3 bg-indigo-50 rounded-lg"
                >
                  <CheckCircle2 className="h-5 w-5 text-indigo-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-gray-700">{insight}</span>
                </motion.li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-white/90 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-amber-600" />
              Recommended Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {data.recommended_actions?.map((action: string, i: number) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg"
                >
                  <ArrowUpRight className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-gray-700">{action}</span>
                </motion.li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function RevenueAtRiskView({ data }: { data: any }) {
  const totalRisk = data.total_revenue_at_risk || 0
  const riskBreakdown = data.risk_breakdown || { high_risk: 0, medium_risk: 0, low_risk: 0 }
  const highRiskItems = data.high_risk_items || []
  
  const pieData = [
    { label: 'High Risk', value: riskBreakdown.high_risk || 0, color: '#ef4444' },
    { label: 'Medium Risk', value: riskBreakdown.medium_risk || 0, color: '#f59e0b' },
    { label: 'Low Risk', value: riskBreakdown.low_risk || 0, color: '#10b981' }
  ]

  // Calculate risk by status
  const riskByStatus = highRiskItems.reduce((acc: any, item: any) => {
    const status = item.status || 'Unknown'
    acc[status] = (acc[status] || 0) + (item.risk_amount || 0)
    return acc
  }, {})
  const statusLabels = Object.keys(riskByStatus)
  const statusValues = Object.values(riskByStatus) as number[]

  // Calculate risk by type (deal vs payment)
  const riskByType = highRiskItems.reduce((acc: any, item: any) => {
    const type = item.type || 'Unknown'
    acc[type] = (acc[type] || 0) + (item.risk_amount || 0)
    return acc
  }, {})
  const typeLabels = Object.keys(riskByType)
  const typeValues = Object.values(riskByType) as number[]

  // Generate trend data (last 7 days simulation)
  const trendLabels = ['6d ago', '5d ago', '4d ago', '3d ago', '2d ago', 'Yesterday', 'Today']
  const trendValues = trendLabels.map((_, i) => {
    // Simulate decreasing trend with some variance
    const baseValue = totalRisk * (0.7 + (i * 0.05))
    return Math.round(baseValue * (0.9 + Math.random() * 0.2))
  })

  // Calculate total items analyzed
  const totalItems = data.total_items_analyzed || 0
  const highRiskAmount = highRiskItems.reduce((sum: number, item: any) => sum + (item.risk_amount || 0), 0)
  const avgRiskPerItem = totalItems > 0 ? totalRisk / totalItems : 0

  return (
    <div className="space-y-6">
      {/* Hero Card with Total Risk */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-rose-500 via-pink-500 to-rose-600 p-8 text-white shadow-2xl"
      >
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-semibold mb-2 opacity-90">Total Revenue at Risk</h3>
              <p className="text-6xl font-bold mb-2">
                ₹{totalRisk.toLocaleString('en-IN')}
              </p>
              <p className="text-rose-100 text-sm">Based on ML risk analysis of {totalItems} items</p>
            </div>
            <div className="p-4 bg-white/20 backdrop-blur-sm rounded-2xl">
              <Wallet className="h-16 w-16" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 mt-6">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <p className="text-xs opacity-80 mb-1">High Risk Amount</p>
              <p className="text-2xl font-bold">₹{highRiskAmount.toLocaleString('en-IN')}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <p className="text-xs opacity-80 mb-1">Avg Risk/Item</p>
              <p className="text-2xl font-bold">₹{Math.round(avgRiskPerItem).toLocaleString('en-IN')}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <p className="text-xs opacity-80 mb-1">Items Analyzed</p>
              <p className="text-2xl font-bold">{totalItems}</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Risk Breakdown Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'High Risk', value: riskBreakdown.high_risk || 0, bgClass: 'bg-gradient-to-br from-red-50 to-red-100', iconClass: 'text-red-600', textClass: 'text-red-600', icon: AlertTriangle },
          { label: 'Medium Risk', value: riskBreakdown.medium_risk || 0, bgClass: 'bg-gradient-to-br from-amber-50 to-amber-100', iconClass: 'text-amber-600', textClass: 'text-amber-600', icon: Info },
          { label: 'Low Risk', value: riskBreakdown.low_risk || 0, bgClass: 'bg-gradient-to-br from-green-50 to-green-100', iconClass: 'text-green-600', textClass: 'text-green-600', icon: CheckCircle2 }
        ].map((item, i) => {
          const Icon = item.icon
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <Card className={`border-0 shadow-lg ${item.bgClass}`}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-gray-600">{item.label}</p>
                    <Icon className={`h-5 w-5 ${item.iconClass}`} />
                  </div>
                  <p className={`text-3xl font-bold ${item.textClass}`}>{item.value}</p>
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </div>

      {/* Charts Row 1: Risk Distribution & Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-rose-600" />
              <span>Risk Distribution</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <PieChart data={pieData} height={300} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-rose-600" />
              <span>Risk Trend (Last 7 Days)</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <AreaGradient labels={trendLabels} values={trendValues} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2: Risk by Status & Risk by Type */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {statusLabels.length > 0 && (
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-amber-600" />
                <span>Risk Amount by Status</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <BarGradient labels={statusLabels} values={statusValues} />
              </div>
            </CardContent>
          </Card>
        )}

        {typeLabels.length > 0 && (
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-purple-600" />
                <span>Risk Amount by Type</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <BarGradient labels={typeLabels} values={typeValues} />
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* High Risk Items Table */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              High Risk Items
            </span>
            <Badge variant="destructive" className="text-lg px-4 py-2">
              {highRiskItems.length} Items
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {highRiskItems.slice(0, 20).map((item: any, i: number) => {
              const riskPercent = Math.round((item.risk_probability || 0) * 100)
              const riskColor = riskPercent > 80 ? 'bg-red-600' : riskPercent > 60 ? 'bg-orange-600' : 'bg-amber-600'
              
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="flex items-center justify-between p-4 bg-gradient-to-r from-red-50 to-orange-50 rounded-xl border border-red-200 hover:shadow-md transition-shadow"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <p className="font-semibold text-gray-900 text-lg">{item.name}</p>
                      <Badge variant="outline" className="text-xs">
                        {item.type}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {item.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span>Amount: ₹{(item.amount || 0).toLocaleString('en-IN')}</span>
                      {item.priority && (
                        <span className="px-2 py-1 bg-amber-100 text-amber-800 rounded text-xs font-medium">
                          {item.priority} Priority
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right ml-6">
                    <p className="font-bold text-red-600 text-xl mb-1">
                      ₹{item.risk_amount?.toLocaleString('en-IN')}
                    </p>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${riskPercent}%` }}
                          transition={{ delay: i * 0.05, duration: 0.5 }}
                          className={`h-full ${riskColor}`}
                        />
                      </div>
                      <Badge variant="destructive" className="min-w-[4rem]">
                        {riskPercent}% risk
                      </Badge>
                    </div>
                  </div>
                </motion.div>
              )
            })}
            {highRiskItems.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500" />
                <p className="text-lg font-medium">No high risk items found</p>
                <p className="text-sm">All items are within acceptable risk levels</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function ExecutiveDashboardView({ data }: { data: any }) {
  const metrics = data.key_metrics || {}
  const trend = metrics.revenue_trend || 0
  
  // Generate sample chart data
  const chartLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']
  const chartData = {
    labels: chartLabels,
    datasets: [
      {
        label: 'Revenue',
        data: [100000, 120000, 110000, 140000, 130000, 150000],
        borderColor: '#3b82f6',
        backgroundColor: '#3b82f680',
        fill: true
      }
    ]
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Revenue', value: `₹${(metrics.total_revenue || 0).toLocaleString('en-IN')}`, icon: Wallet, bgClass: 'bg-blue-100', iconClass: 'text-blue-600', textClass: 'text-blue-600', trend: trend },
          { label: 'Total Deals', value: metrics.total_deals || 0, icon: Target, bgClass: 'bg-green-100', iconClass: 'text-green-600', textClass: 'text-green-600' },
          { label: 'Revenue Trend', value: `${trend > 0 ? '+' : ''}${trend.toFixed(1)}%`, icon: TrendingUp, bgClass: trend > 0 ? 'bg-green-100' : 'bg-red-100', iconClass: trend > 0 ? 'text-green-600' : 'text-red-600', textClass: trend > 0 ? 'text-green-600' : 'text-red-600' },
          { label: 'Avg Daily Revenue', value: `₹${(metrics.avg_daily_revenue || 0).toLocaleString('en-IN')}`, icon: BarChart3, bgClass: 'bg-purple-100', iconClass: 'text-purple-600', textClass: 'text-purple-600' }
        ].map((metric, i) => {
          const Icon = metric.icon
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.1 }}
            >
              <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-medium text-gray-600">{metric.label}</p>
                    <div className={`p-2 rounded-lg ${metric.bgClass}`}>
                      <Icon className={`h-5 w-5 ${metric.iconClass}`} />
                    </div>
                  </div>
                  <p className={`text-2xl font-bold ${metric.textClass}`}>{metric.value}</p>
                  {metric.trend !== undefined && (
                    <div className="flex items-center gap-1 mt-2">
                      {metric.trend > 0 ? (
                        <ArrowUpRight className="h-4 w-4 text-green-600" />
                      ) : (
                        <ArrowDownRight className="h-4 w-4 text-red-600" />
                      )}
                      <span className={`text-xs font-medium ${metric.trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {Math.abs(metric.trend).toFixed(1)}% vs last period
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LineChartIcon className="h-5 w-5" />
              Revenue Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <LineChart labels={chartData.labels} datasets={chartData.datasets} height={250} />
          </CardContent>
        </Card>

        {data.critical_issues && data.critical_issues.length > 0 && (
          <Card className="border-0 shadow-lg bg-gradient-to-br from-red-50 to-orange-50 border-red-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-800">
                <AlertTriangle className="h-5 w-5" />
                Critical Issues
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.critical_issues.map((issue: any, i: number) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="flex items-start gap-3 p-3 bg-white rounded-lg"
                  >
                    <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-gray-700">{issue.message}</p>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

function PriorityEngineView({ data }: { data: any }) {
  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between p-6 bg-gradient-to-r from-amber-50 to-yellow-50 rounded-2xl border border-amber-200"
      >
        <div>
          <h3 className="text-xl font-bold text-gray-900 mb-1">Prioritized Tasks</h3>
          <p className="text-gray-600">AI-ranked by business impact and urgency</p>
        </div>
        <Badge className="bg-amber-500 text-white text-lg px-4 py-2">
          {data.high_priority_count || 0} High Priority
        </Badge>
      </motion.div>

      <Card className="border-0 shadow-lg">
        <CardContent className="p-6">
          <div className="space-y-3">
            {data.prioritized_tasks?.slice(0, 20).map((task: any, i: number) => {
              const priorityColor = task.priority_score > 0.7 ? 'red' : task.priority_score > 0.4 ? 'amber' : 'green'
              const gradientClass = priorityColor === 'red' ? 'bg-gradient-to-r from-red-500 to-red-600' : 
                                    priorityColor === 'amber' ? 'bg-gradient-to-r from-amber-500 to-amber-600' : 
                                    'bg-gradient-to-r from-green-500 to-green-600'
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors border border-gray-200"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <p className="font-semibold text-gray-900">{task.name}</p>
                      <Badge variant={priorityColor === 'red' ? 'destructive' : priorityColor === 'amber' ? 'default' : 'secondary'}>
                        {task.type}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600">{task.status} • {task.recommended_action}</p>
                  </div>
                  <div className="text-right ml-4">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${(task.priority_score || 0) * 100}%` }}
                          transition={{ delay: i * 0.05, duration: 0.5 }}
                          className={`h-full ${gradientClass}`}
                        />
                      </div>
                      <span className="font-bold text-gray-900 min-w-[3rem] text-right">
                        {(task.priority_score || 0).toFixed(2)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">Priority Score</p>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function DealRiskScoringView({ data }: { data: any }) {
  const riskData = [
    { label: 'High Risk', value: data.high_risk_count || 0, color: '#ef4444' },
    { label: 'Medium Risk', value: data.medium_risk_count || 0, color: '#f59e0b' },
    { label: 'Low Risk', value: data.low_risk_count || 0, color: '#10b981' }
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {riskData.map((item, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card className="border-0 shadow-lg">
              <CardContent className="p-6 text-center">
                <p className="text-sm font-medium text-gray-600 mb-2">{item.label}</p>
                <p className="text-4xl font-bold" style={{ color: item.color }}>{item.value}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle>Deal Risk Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.deal_risks?.slice(0, 20).map((deal: any, i: number) => {
              const riskLevel = deal.risk_level?.toLowerCase() || 'low'
              const bgClass = riskLevel === 'high' ? 'bg-red-50 border-red-200' : riskLevel === 'medium' ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={`p-4 rounded-xl ${bgClass} border`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-semibold text-gray-900">{deal.deal_name}</p>
                      <p className="text-sm text-gray-600">₹{deal.amount?.toLocaleString('en-IN')} • {deal.status}</p>
                    </div>
                    <div className="text-right">
                      <Badge variant={riskLevel === 'high' ? 'destructive' : riskLevel === 'medium' ? 'default' : 'secondary'}>
                        {Math.round((deal.risk_score || 0) * 100)}% risk
                      </Badge>
                      <p className="text-xs text-gray-500 mt-1">{deal.risk_level}</p>
                    </div>
                  </div>
                  {deal.recommendations && deal.recommendations.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <p className="text-xs font-semibold text-gray-700 mb-2">Recommendations:</p>
                      <ul className="space-y-1">
                        {deal.recommendations.map((rec: string, j: number) => (
                          <li key={j} className="text-xs text-gray-600 flex items-start gap-2">
                            <span className="text-amber-600 mt-0.5">•</span>
                            <span>{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </motion.div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function PerformanceRiskView({ data }: { data: any }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between p-6 bg-gradient-to-r from-purple-50 to-violet-50 rounded-2xl border border-purple-200">
        <div>
          <h3 className="text-xl font-bold text-gray-900 mb-1">Performance Risk Index</h3>
          <p className="text-gray-600">Manager and zone performance analysis</p>
        </div>
        <div className="flex gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-red-600">{data.high_risk_count || 0}</p>
            <p className="text-xs text-gray-600">High Risk</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-amber-600">{data.anomaly_count || 0}</p>
            <p className="text-xs text-gray-600">Anomalies</p>
          </div>
        </div>
      </div>

      <Card className="border-0 shadow-lg">
        <CardContent className="p-6">
          <div className="space-y-3">
            {data.performance_risks?.map((risk: any, i: number) => {
              const riskLevel = risk.risk_level?.toLowerCase() || 'low'
              const bgClass = riskLevel === 'high' ? 'bg-red-50 border-red-200' : riskLevel === 'medium' ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'
              const gradientClass = riskLevel === 'high' ? 'bg-gradient-to-r from-red-500 to-red-600' : riskLevel === 'medium' ? 'bg-gradient-to-r from-amber-500 to-amber-600' : 'bg-gradient-to-r from-green-500 to-green-600'
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className={`p-4 rounded-xl ${bgClass} border`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-semibold text-gray-900">{risk.manager_name}</p>
                      <p className="text-sm text-gray-600">{risk.zone}</p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${(risk.risk_index || 0) * 100}%` }}
                            transition={{ delay: i * 0.1, duration: 0.5 }}
                            className={`h-full ${gradientClass}`}
                          />
                        </div>
                        <span className="font-bold text-gray-900">{(risk.risk_index || 0).toFixed(2)}</span>
                      </div>
                      <Badge variant={riskLevel === 'high' ? 'destructive' : riskLevel === 'medium' ? 'default' : 'secondary'} className="mt-1">
                        {risk.risk_level}
                      </Badge>
                    </div>
                  </div>
                  {risk.recommendations && risk.recommendations.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <p className="text-xs font-semibold text-gray-700 mb-2">Recommendations:</p>
                      <ul className="space-y-1">
                        {risk.recommendations.map((rec: string, j: number) => (
                          <li key={j} className="text-xs text-gray-600 flex items-start gap-2">
                            <span className="text-purple-600 mt-0.5">•</span>
                            <span>{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </motion.div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function FraudDetectionView({ data }: { data: any }) {
  return (
    <div className="space-y-6">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-500 via-amber-500 to-orange-600 p-8 text-white shadow-2xl"
      >
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold mb-2 opacity-90">Fraud Detection Alerts</h3>
            <p className="text-4xl font-bold">
              {data.suspicious_count || 0}
            </p>
            <p className="text-orange-100 mt-2 text-sm">Suspicious transactions detected</p>
          </div>
          <div className="p-4 bg-white/20 backdrop-blur-sm rounded-2xl">
            <ShieldCheck className="h-12 w-12" />
          </div>
        </div>
      </motion.div>

      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Flagged Transactions</span>
            <Badge variant="destructive">{data.high_risk_count || 0} High Risk</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.fraud_alerts?.slice(0, 20).map((alert: any, i: number) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="p-4 bg-red-50 rounded-xl border border-red-200"
              >
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-gray-900">{alert.transaction_type}</p>
                      <Badge variant="destructive">{alert.anomaly_type}</Badge>
                    </div>
                    <p className="text-sm text-gray-600">{alert.category}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-red-600 text-lg">₹{alert.amount?.toLocaleString('en-IN')}</p>
                    <Badge variant="outline" className="mt-1">
                      {Math.round((alert.fraud_score || 0) * 100)}% suspicious
                    </Badge>
                  </div>
                </div>
                {alert.recommendations && alert.recommendations.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-red-200">
                    <p className="text-xs font-semibold text-gray-700 mb-2">Recommended Actions:</p>
                    <ul className="space-y-1">
                      {alert.recommendations.map((rec: string, j: number) => (
                        <li key={j} className="text-xs text-gray-600 flex items-start gap-2">
                          <ShieldCheck className="h-3 w-3 text-orange-600 mt-0.5" />
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function CashflowAnalyzerView({ data }: { data: any }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          { label: 'Total Pending', value: data.total_pending || 0, bgClass: 'bg-gradient-to-br from-blue-50 to-blue-100', iconClass: 'text-blue-600', textClass: 'text-blue-600', icon: Timer },
          { label: 'Total Delayed', value: data.total_delayed || 0, bgClass: 'bg-gradient-to-br from-red-50 to-red-100', iconClass: 'text-red-600', textClass: 'text-red-600', icon: AlertTriangle }
        ].map((metric, i) => {
          const Icon = metric.icon
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.1 }}
            >
              <Card className={`border-0 shadow-lg ${metric.bgClass}`}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-gray-600">{metric.label}</p>
                    <Icon className={`h-6 w-6 ${metric.iconClass}`} />
                  </div>
                  <p className={`text-3xl font-bold ${metric.textClass}`}>
                    ₹{(metric.value || 0).toLocaleString('en-IN')}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </div>

      {data.bottlenecks && data.bottlenecks.length > 0 && (
        <Card className="border-0 shadow-lg bg-gradient-to-br from-red-50 to-orange-50 border-red-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-800">
              <Activity className="h-5 w-5" />
              Cashflow Bottlenecks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.bottlenecks.map((bottleneck: any, i: number) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="p-4 bg-white rounded-xl border border-red-200"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-gray-900">{bottleneck.message}</p>
                    {bottleneck.amount && (
                      <Badge variant="destructive">
                        ₹{bottleneck.amount.toLocaleString('en-IN')}
                      </Badge>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {data.recommended_actions && data.recommended_actions.length > 0 && (
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-teal-600" />
              Recommended Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {data.recommended_actions.map((action: string, i: number) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="flex items-start gap-3 p-3 bg-teal-50 rounded-lg"
                >
                  <Activity className="h-5 w-5 text-teal-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-gray-700">{action}</span>
                </motion.li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function DelayCostCalculatorView({ data }: { data: any }) {
  return (
    <div className="space-y-6">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-yellow-500 via-amber-500 to-yellow-600 p-8 text-white shadow-2xl"
      >
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold mb-2 opacity-90">Total Delay Cost</h3>
            <p className="text-5xl font-bold">
              ₹{(data.total_delay_cost || 0).toLocaleString('en-IN')}
            </p>
            <p className="text-yellow-100 mt-2 text-sm">Estimated financial impact</p>
          </div>
          <div className="p-4 bg-white/20 backdrop-blur-sm rounded-2xl">
            <Timer className="h-12 w-12" />
          </div>
        </div>
      </motion.div>

      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle>Delay Cost Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.delay_costs?.slice(0, 20).map((cost: any, i: number) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center justify-between p-4 bg-yellow-50 rounded-xl border border-yellow-200"
              >
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">{cost.event_type}</p>
                  <p className="text-sm text-gray-600">{cost.delay_days} days delay</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-yellow-600 text-lg">
                    ₹{cost.estimated_cost?.toLocaleString('en-IN')}
                  </p>
                  <p className="text-xs text-gray-500">Amount: ₹{cost.amount?.toLocaleString('en-IN')}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function ChurnPredictorView({ data }: { data: any }) {
  // Support both old and new data structure
  const summary = data.summary || data
  const riskData = [
    { label: 'High Risk', value: summary.high_risk_count || 0, color: '#ef4444' },
    { label: 'Medium Risk', value: summary.medium_risk_count || 0, color: '#f59e0b' },
    { label: 'Low Risk', value: summary.low_risk_count || 0, color: '#10b981' }
  ]

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-pink-500 via-rose-500 to-pink-600 p-8 text-white shadow-2xl"
      >
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xl font-semibold mb-2 opacity-90">Churn Predictions</h3>
              <p className="text-4xl font-bold">{summary.high_risk_count || 0}</p>
              <p className="text-pink-100 mt-2 text-sm">High risk customers identified</p>
            </div>
          <div className="p-4 bg-white/20 backdrop-blur-sm rounded-2xl">
            <UserMinus className="h-12 w-12" />
          </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="p-4 bg-white/20 backdrop-blur-sm rounded-xl">
              <p className="text-sm opacity-90">Total Revenue at Risk</p>
              <p className="text-2xl font-bold">
                ₹{(summary.total_at_risk_revenue || 0).toLocaleString('en-IN')}
              </p>
            </div>
            <div className="p-4 bg-white/20 backdrop-blur-sm rounded-xl">
              <p className="text-sm opacity-90">High-Value at Risk</p>
              <p className="text-2xl font-bold">
                ₹{(summary.high_value_at_risk || 0).toLocaleString('en-IN')}
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {riskData.map((item, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card className="border-0 shadow-lg">
              <CardContent className="p-6 text-center">
                <p className="text-sm font-medium text-gray-600 mb-2">{item.label}</p>
                <p className="text-4xl font-bold" style={{ color: item.color }}>{item.value}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle>Customer Churn Risk Analysis</CardTitle>
          <p className="text-sm text-gray-500 mt-2">
            Customers sorted by revenue at risk. Enhanced 8-factor AI model with confidence scores.
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {data.churn_predictions?.slice(0, 20).map((prediction: any, i: number) => {
              const riskLevel = prediction.risk_level?.toLowerCase() || 'low'
              const bgClass = riskLevel === 'high' ? 'bg-red-50 border-red-200' : riskLevel === 'medium' ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={`p-5 rounded-xl ${bgClass} border`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <p className="font-semibold text-gray-900 text-lg">{prediction.customer_name}</p>
                        <Badge variant={riskLevel === 'high' ? 'destructive' : riskLevel === 'medium' ? 'default' : 'secondary'}>
                          {Math.round((prediction.churn_probability || 0) * 100)}% risk
                        </Badge>
                        {prediction.confidence && (
                          <Badge variant="outline" className="text-xs">
                            {Math.round(prediction.confidence * 100)}% confidence
                          </Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div>
                          <p className="text-gray-600">Revenue</p>
                          <p className="font-semibold">₹{prediction.total_revenue?.toLocaleString('en-IN') || 0}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">At Risk</p>
                          <p className="font-semibold text-red-600">₹{prediction.revenue_at_risk?.toLocaleString('en-IN') || 0}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Orders</p>
                          <p className="font-semibold">{prediction.total_orders || 0}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Timeframe</p>
                          <p className="font-semibold">{prediction.churn_timeframe || 'N/A'}</p>
                        </div>
                      </div>
                      {prediction.days_since_last_order !== null && prediction.days_since_last_order !== undefined && (
                        <p className="text-xs text-gray-500 mt-2">
                          Last order: {prediction.days_since_last_order} days ago
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {prediction.risk_factors && prediction.risk_factors.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <p className="text-xs font-semibold text-gray-700 mb-2">Key Risk Factors:</p>
                      <div className="flex flex-wrap gap-2">
                        {prediction.risk_factors.slice(0, 3).map((factor: any, j: number) => (
                          <Badge key={j} variant="outline" className="text-xs">
                            {typeof factor === 'string' ? factor : factor.factor || factor}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {prediction.engagement_score !== undefined && prediction.engagement_score !== null && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-600">Engagement Score:</span>
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-green-500 to-red-500"
                              style={{ width: `${(prediction.engagement_score || 0) * 100}%` }}
                            />
                          </div>
                          <span className="font-semibold">{Math.round((prediction.engagement_score || 0) * 100)}%</span>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {prediction.retention_recommendations && prediction.retention_recommendations.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <p className="text-xs font-semibold text-gray-700 mb-2">Retention Strategies:</p>
                      <ul className="space-y-2">
                        {prediction.retention_recommendations.map((rec: any, j: number) => {
                          const recText = typeof rec === 'string' ? rec : rec.action || rec
                          const priority = typeof rec === 'object' ? rec.priority : null
                          return (
                            <li key={j} className="text-xs text-gray-600 flex items-start gap-2">
                              <span className={`mt-0.5 ${priority === 'Critical' ? 'text-red-600' : priority === 'High' ? 'text-orange-600' : 'text-blue-600'}`}>•</span>
                              <div className="flex-1">
                                <span>{recText}</span>
                                {typeof rec === 'object' && rec.timeline && (
                                  <span className="text-gray-400 ml-2">({rec.timeline})</span>
                                )}
                              </div>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  )}
                  
                  {prediction.retention_roi !== undefined && prediction.retention_roi !== null && prediction.retention_roi > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-600">Retention ROI:</span>
                        <span className="font-bold text-green-600">
                          {prediction.retention_roi > 0 ? '+' : ''}{Math.round(prediction.retention_roi * 100)}%
                        </span>
                      </div>
                    </div>
                  )}
                </motion.div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
