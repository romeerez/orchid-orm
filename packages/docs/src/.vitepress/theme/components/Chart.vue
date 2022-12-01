<template>
  <Bar
      :chart-options="chartOptions"
      :chart-data="chartData"
      :height="250"
  />
</template>

<script>
import { Bar } from 'vue-chartjs'
import { Chart as ChartJS, Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale } from 'chart.js/dist/chart.mjs'

ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale)

export default {
  name: 'BarChart',
  components: { Bar },
  props: {
    chartData: {
      type: Object,
      default: () => {}
    },
  },
  data() {
    if (typeof document !== 'undefined' && document.documentElement.classList.contains('dark')) {
      ChartJS.defaults.color = 'rgba(255, 255, 255, .8)'
      ChartJS.defaults.borderColor = 'rgba(0, 0, 0, .4)'
    }

    return {
      chartOptions: {
        responsive: true,
        plugins: {
          legend: {
            display: false,
          },
        },
      }
    }
  }
}
</script>