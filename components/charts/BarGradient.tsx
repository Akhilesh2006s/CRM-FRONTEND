'use client'

import { Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from 'chart.js'
import { useMemo } from 'react'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

type Props = {
  labels: string[]
  values: number[]
}

export default function BarGradient({ labels, values }: Props) {
  const data = useMemo(() => {
    return {
      labels,
      datasets: [
        {
          label: 'Leads',
          data: values,
          borderRadius: 8,
          backgroundColor: (ctx: any) => {
            const { chart } = ctx
            const { ctx: c, chartArea } = chart
            if (!chartArea) return '#f59e0b'
            const gradient = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom)
            gradient.addColorStop(0, '#f59e0b')
            gradient.addColorStop(1, '#f59e0b88')
            return gradient
          },
          hoverBackgroundColor: '#f59e0b',
          barPercentage: 0.7,
          categoryPercentage: 0.8,
        },
      ],
    }
  }, [labels, values])

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { intersect: false, mode: 'index' as const },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#6b7280' },
      },
      y: {
        grid: { color: '#eceff1' },
        ticks: { color: '#6b7280' },
      },
    },
  }

  return <Bar data={data} options={options} />
}





