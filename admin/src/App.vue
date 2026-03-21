<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import {
  LayoutDashboard,
  Smartphone,
  HelpCircle,
  FolderTree,
  Users,
  Swords,
  Flag,
  Trophy,
  Settings,
  LogOut,
} from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()
const { isAuthenticated, logout } = useAuth()

const showSidebar = computed(() => isAuthenticated.value && route.name !== 'login')

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/applications', label: 'Applications', icon: Smartphone },
  { to: '/questions', label: 'Questions', icon: HelpCircle },
  { to: '/categories', label: 'Catégories', icon: FolderTree },
  { to: '/users', label: 'Utilisateurs', icon: Users },
  { to: '/matches', label: 'Matchs', icon: Swords },
  { to: '/reports', label: 'Signalements', icon: Flag },
  { to: '/tournaments', label: 'Tournois', icon: Trophy },
  { to: '/settings', label: 'Paramètres', icon: Settings },
]

function handleLogout() {
  logout()
  router.push('/login')
}
</script>

<template>
  <div class="flex h-screen bg-background text-foreground">
    <!-- Sidebar -->
    <aside
      v-if="showSidebar"
      class="w-64 flex flex-col border-r border-border bg-card"
    >
      <!-- Logo -->
      <div class="px-6 py-5 border-b border-border">
        <h1 class="text-xl font-bold text-primary">Ilmoo Admin</h1>
        <p class="text-xs text-muted-foreground mt-0.5">Backoffice</p>
      </div>

      <!-- Navigation -->
      <nav class="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        <RouterLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
          :class="[
            route.path === item.to
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
          ]"
        >
          <component :is="item.icon" class="h-4 w-4" />
          {{ item.label }}
        </RouterLink>
      </nav>

      <!-- Logout -->
      <div class="p-3 border-t border-border">
        <button
          class="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
          @click="handleLogout"
        >
          <LogOut class="h-4 w-4" />
          Déconnexion
        </button>
      </div>
    </aside>

    <!-- Main content -->
    <main class="flex-1 overflow-y-auto">
      <RouterView />
    </main>
  </div>
</template>
