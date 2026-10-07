import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { setSessionExpiredHandler } from './api/client'
import { useAuthStore } from './stores/auth'
import './styles/base.css'
import './styles/forms.css'

const app = createApp(App)

const pinia = createPinia()
app.use(pinia)
setSessionExpiredHandler(() => {
  const auth = useAuthStore(pinia)
  auth.clearSession()
  // Initial navigation already handles a missing session in the router guard.
  if (auth.ready && router.currentRoute.value.name !== 'login') {
    void router.replace({ name: 'login' })
  }
})
app.use(router)

app.mount('#app')
