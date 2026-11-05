import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './styles/index.css'
import { installEntranceEffects } from './entranceEffects'
const app=createApp(App).use(createPinia()).use(router)
// Resolve the initial lazy route before exposing navigation and filter actions.
// Otherwise a click during bootstrap can target the previous area's state.
void router.isReady().then(()=>{
 app.mount('#app')
 installEntranceEffects(document.getElementById('app')!)
})
