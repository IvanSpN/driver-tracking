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
  <div class="shell" :class="{ 'shell-drivers': $route.name === 'drivers' }">
    <aside class="sidebar">
      <nav class="nav" aria-label="Основная навигация">
        <RouterLink to="/" class="nav-link">Дашборд</RouterLink>
        <RouterLink
          to="/drivers"
          class="nav-link"
          :class="{ 'section-active': $route.name === 'driver-detail' }"
          >Водители</RouterLink
        >
        <RouterLink to="/settings" class="nav-link">Настройки</RouterLink>
      </nav>

      <div class="user-block">
        <div class="user-name">{{ auth.user?.fullName }}</div>
        <LoadingButton
          class="btn-secondary logout-btn"
          :loading="loggingOut"
          loading-text="Выходим…"
          @click="handleLogout"
          >Выйти</LoadingButton
        >
      </div>
      <p v-if="error" class="error-message logout-error" role="alert">{{ error }}</p>
    </aside>

    <main class="content">
      <RouterView :key="$route.fullPath" />
    </main>
  </div>
</template>

<style scoped>
.shell {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  min-height: 100dvh;
}

.shell-drivers {
  height: 100vh;
  height: 100dvh;
  min-height: 0;
  overflow: hidden;
}

.shell-drivers .content {
  display: flex;
  min-height: 0;
  overflow: hidden;
}

.sidebar {
  flex-shrink: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 16px 12px;
  padding: max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) 16px
    max(16px, env(safe-area-inset-left));
  background: var(--surface);
  border-bottom: 1px solid var(--border);
}

.nav {
  grid-column: 1 / -1;
  grid-row: 2;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}

.nav-link {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  min-height: var(--control-height);
  padding: 10px 6px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text);
  text-decoration: none;
  text-align: center;
  font-size: 15px;
  font-weight: 600;
}

.nav-link.section-active,
.nav-link.router-link-exact-active {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--accent-fg);
}

.user-block {
  grid-column: 2;
  grid-row: 1;
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 12px;
}

.user-name {
  display: none;
  color: var(--text-muted);
  font-size: 16px;
}

.logout-btn {
  padding-inline: 12px;
}

.logout-error {
  grid-column: 1 / -1;
  margin: 0;
}

.content {
  min-width: 0;
  flex: 1;
  padding: 24px max(16px, env(safe-area-inset-right)) max(32px, env(safe-area-inset-bottom))
    max(16px, env(safe-area-inset-left));
}

/* Include the page gutters and safe areas; the theme disappears with the view. */
.content:has(> .driver-detail-official) {
  background: var(--surface);
}

.content:has(> .driver-detail-unofficial) {
  background: var(--driver-unofficial-surface);
}

@media (hover: hover) {
  .nav-link:hover {
    box-shadow: inset 0 0 0 1px currentColor;
  }
}

.nav-link:active {
  box-shadow: inset 0 0 0 2px currentColor;
}

@media (max-height: 500px) and (max-width: 959px) {
  .shell-drivers .sidebar {
    padding-block: max(8px, env(safe-area-inset-top)) 8px;
    gap: 8px;
    max-height: 35%;
    overflow-y: auto;
  }

  .shell-drivers .nav {
    grid-column: 1;
    grid-row: 1;
  }

  .shell-drivers .content {
    padding-block: 12px max(12px, env(safe-area-inset-bottom));
  }
}

@media (min-width: 960px) {
  .shell {
    flex-direction: row;
  }

  .sidebar {
    width: 240px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 24px;
    padding: max(24px, env(safe-area-inset-top)) 16px max(24px, env(safe-area-inset-bottom))
      max(16px, env(safe-area-inset-left));
    border-right: 1px solid var(--border);
    border-bottom: 0;
  }

  .nav {
    grid-template-columns: minmax(0, 1fr);
    align-content: start;
    flex: 1;
  }

  .nav-link {
    justify-content: flex-start;
    padding-inline: 14px;
    font-size: 16px;
  }

  .user-block {
    border-top: 1px solid var(--border);
    padding-top: 20px;
  }

  .user-name {
    display: block;
  }

  .content {
    padding: 36px max(32px, env(safe-area-inset-right)) max(36px, env(safe-area-inset-bottom)) 32px;
  }
}
</style>
