<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import AppSidebar from '@/components/AppSidebar.vue'
import QuestionDialog from '@/components/QuestionDialog.vue'
import { Toaster } from 'vue-sonner'

const route = useRoute()
const { isAuthenticated } = useAuth()

const showSidebar = computed(() => isAuthenticated.value && route.name !== 'login')

const pageTitle = computed(() => {
  const map: Record<string, string> = {
    '/dashboard': 'Tableau de bord',
    '/questions': 'Questions',
    '/categories': 'Catégories',
    '/users': 'Utilisateurs',
    '/matches': 'Matchs',
    '/reports': 'Signalements',
    '/tournaments': 'Tournois',
    '/settings': 'Paramètres',
    '/profile': 'Profil',
    '/notifications': 'Notifications',
  }
  return map[route.path] ?? ''
})
</script>

<template>
  <Toaster position="top-right" rich-colors close-button />

  <!-- Not authenticated: just render the page (login) -->
  <div v-if="!showSidebar" class="h-screen bg-background text-foreground">
    <RouterView />
  </div>

  <!-- Authenticated: full sidebar layout -->
  <SidebarProvider v-else storage-key="ilmoo-sidebar">
    <AppSidebar />
    <SidebarInset>
      <header class="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger class="-ml-1" />
        <Separator orientation="vertical" class="mr-2 h-4" />
        <span class="text-sm font-medium text-muted-foreground">{{ pageTitle }}</span>
      </header>

      <main class="flex-1 overflow-y-auto">
        <RouterView />
      </main>
    </SidebarInset>

    <!-- Global question create/import dialog (works from any page) -->
    <QuestionDialog />
  </SidebarProvider>
</template>
