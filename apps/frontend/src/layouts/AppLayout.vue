<script setup lang="ts">
import { RouterLink, RouterView, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import LoadingButton from '../components/LoadingButton.vue'
import { useAsyncAction } from '../composables/useAsyncAction'

const auth = useAuthStore()
const router = useRouter()
const { pending: loggingOut, error, run } = useAsyncAction()

async function handleLogout() {
  await run('logout', async () => {
    await auth.logout()
    await router.push({ name: 'login' })
  })
}
</script>

<template>
  <div class="shell">
    <aside class="sidebar">
      <div class="brand">Driver Tracking</div>

      <nav class="nav">
        <RouterLink to="/" class="nav-link">Дашборд</RouterLink>
        <RouterLink to="/drivers" class="nav-link">Водители</RouterLink>
        <RouterLink to="/settings" class="nav-link">Настройки</RouterLink>
      </nav>

      <div class="user-block">
        <div class="user-name">{{ auth.user?.fullName }}</div>
        <LoadingButton
          class="logout-btn"
          :loading="loggingOut"
          loading-text="Выходим…"
          @click="handleLogout"
          >Выйти</LoadingButton
        >
        <p v-if="error" class="error-message" role="alert">{{ error }}</p>
      </div>
    </aside>

    <main class="content">
      <RouterView :key="$route.fullPath" />
    </main>
  </div>
</template>

<style scoped>
.shell {
  display: flex;
  min-height: 100vh;
}

.sidebar {
  width: 220px;
  flex-shrink: 0;
  background: var(--surface);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  padding: 20px 12px;
}

.brand {
  font-weight: 600;
  padding: 0 8px 20px;
}

.nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
}

.nav-link {
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  color: var(--text);
  text-decoration: none;
  font-size: 14px;
}

.nav-link:hover {
  background: var(--surface-hover);
}

.nav-link.router-link-exact-active {
  background: var(--accent);
  color: var(--accent-fg);
}

.user-block {
  border-top: 1px solid var(--border);
  padding-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.user-name {
  font-size: 13px;
  color: var(--text-muted);
  padding: 0 8px;
}

.logout-btn {
  border: 1px solid var(--border);
  background: var(--bg);
  border-radius: var(--radius-sm);
  padding: 8px 10px;
  cursor: pointer;
  font-size: 14px;
}

.logout-btn:hover {
  background: var(--surface-hover);
}

.content {
  flex: 1;
  padding: 32px;
}

@media (max-width: 768px) {
  .shell {
    flex-direction: column;
  }

  .sidebar {
    width: 100%;
    flex-direction: row;
    align-items: center;
    border-right: none;
    border-bottom: 1px solid var(--border);
  }

  .nav {
    flex-direction: row;
  }

  .user-block {
    flex-direction: row;
    border-top: none;
    padding-top: 0;
  }

  .user-name {
    display: none;
  }

  .content {
    padding: 16px;
  }
}
</style>
