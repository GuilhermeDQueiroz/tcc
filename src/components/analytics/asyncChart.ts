import {defineAsyncComponent} from 'vue'
import LoadingState from '../ui/LoadingState.vue'

export const AnalyticChart=defineAsyncComponent({
  loader:()=>import('./AnalyticChart.vue'),
  loadingComponent:LoadingState,
  delay:150,
})
