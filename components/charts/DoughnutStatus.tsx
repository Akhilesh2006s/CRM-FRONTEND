'use client'

import { Doughnut } from 'react-chartjs-2'
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'
import { useMemo } from 'react'

ChartJS.register(ArcElement, Tooltip, Legend)

type Slice = { label: string; value: number; color: string }

export default function DoughnutStatus({ slices }: { slices: Slice[] }) {
  const data = useMemo(() => ({
    labels: slices.map((s) => s.label),
    datasets: [
      {
        data: slices.map((s) => s.value),
        backgroundColor: slices.map((s) => s.color),
        borderColor: '#ffffff',
        borderWidth: 2,
        cutout: '62%',
      },
    ],
  }), [slices])

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { intersect: false } },
  }

  return <Doughnut data={data} options={options} />
}





