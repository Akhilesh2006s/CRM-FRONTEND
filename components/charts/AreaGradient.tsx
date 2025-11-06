'use client'

import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
  Legend,
} from 'chart.js'
import { useMemo } from 'react'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler, Legend)

type Props = {
  labels: string[]
  values: number[]
}

export default function AreaGradient({ labels, values }: Props) {
  const data = useMemo(() => ({
    labels,
    datasets: [
      {
        label: 'Revenue',
        data: values,
        borderColor: '#0891b2',
        pointBackgroundColor: '#0891b2',
        pointBorderColor: '#ffffff',
        pointRadius: 3,
        tension: 0.35,
        fill: true,
        backgroundColor: (ctx: any) => {
          const { chart } = ctx
          const { ctx: c, chartArea } = chart
          if (!chartArea) return '#06b6d433'
          const gradient = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom)
          gradient.addColorStop(0, '#06b6d480')
          gradient.addColorStop(1, '#06b6d400')
          return gradient
        },
      },
    ],
  }), [labels, values])

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { intersect: false, mode: 'index' as const } },
    scales: {
      x: { grid: { color: '#eceff1' }, ticks: { color: '#6b7280' } },
      y: { grid: { color: '#eceff1' }, ticks: { color: '#6b7280' } },
    },
  }

  return <Line data={data} options={options} />
}





