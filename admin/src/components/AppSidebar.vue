<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { useFlavor, FLAVORS, type FlavorSlug } from '@/composables/useFlavor'
import { useQuestionDialog } from '@/composables/useQuestionDialog'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from '@/components/ui/sidebar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  LayoutDashboard,
  HelpCircle,
  FolderTree,
  Users,
  Swords,
  Flag,
  Trophy,
  Settings,
  LogOut,
  Moon,
  Sun,
  ChevronsUpDown,
  Check,
  Plus,
  Bell,
  CircleUserRound,
} from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()
const { isAuthenticated, logout } = useAuth()
const { activeFlavor, currentFlavor, setFlavor } = useFlavor()
const { openCreate } = useQuestionDialog()

function handleAddQuestion() {
  openCreate()
}

// Dark mode
const isDark = ref(false)
onMounted(() => {
  isDark.value = document.documentElement.classList.contains('dark')
    || localStorage.getItem('theme') === 'dark'
  if (isDark.value) document.documentElement.classList.add('dark')
})
function toggleDarkMode() {
  isDark.value = !isDark.value
  document.documentElement.classList.toggle('dark', isDark.value)
  localStorage.setItem('theme', isDark.value ? 'dark' : 'light')
}

const mainNavItems = [
  { to: '/dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
  { to: '/questions', label: 'Questions', icon: HelpCircle },
  { to: '/categories', label: 'Catégories', icon: FolderTree },
  { to: '/users', label: 'Utilisateurs', icon: Users },
  { to: '/matches', label: 'Matchs', icon: Swords },
  { to: '/reports', label: 'Signalements', icon: Flag },
  { to: '/tournaments', label: 'Tournois', icon: Trophy },
]

function handleLogout() {
  logout()
  router.push('/login')
}

function goToProfile() { router.push('/profile') }
function goToNotifications() { router.push('/notifications') }

const flavorColors: Record<FlavorSlug, string> = {
  ilmoo: '#1B4332',
  quizapp: '#1A365D',
}
</script>

<template>
  <Sidebar collapsible="icon" v-if="isAuthenticated">
    <!-- ── Header : flavor switcher ── -->
    <SidebarHeader>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <SidebarMenuButton
                size="lg"
                class="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              >
                <div
                  class="flex aspect-square size-8 items-center justify-center rounded-lg text-white text-xs font-bold shrink-0"
                  :style="{ backgroundColor: flavorColors[activeFlavor] }"
                >
                  {{ currentFlavor.initials }}
                </div>
                <div class="grid flex-1 text-left text-sm leading-tight">
                  <span class="truncate font-semibold">{{ currentFlavor.label }}</span>
                  <span class="truncate text-xs text-muted-foreground">Admin</span>
                </div>
                <ChevronsUpDown class="ml-auto size-4 shrink-0" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent class="w-56" align="start" side="bottom" :side-offset="4">
              <DropdownMenuLabel class="text-xs text-muted-foreground">Applications</DropdownMenuLabel>
              <DropdownMenuItem
                v-for="flavor in FLAVORS"
                :key="flavor.slug"
                @click="setFlavor(flavor.slug)"
                class="gap-2 p-2"
              >
                <div
                  class="flex size-6 items-center justify-center rounded-sm text-white text-xs font-bold shrink-0"
                  :style="{ backgroundColor: flavor.color }"
                >
                  {{ flavor.initials }}
                </div>
                {{ flavor.label }}
                <Check v-if="activeFlavor === flavor.slug" class="ml-auto size-4" />
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarHeader>

    <!-- ── Content ── -->
    <SidebarContent>
      <!-- Quick-create button -->
      <SidebarGroup>
        <SidebarGroupContent>
          <div class="px-1 overflow-hidden group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
            <Button
              class="w-full cursor-pointer group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:p-0"
              @click="handleAddQuestion"
            >
              <Plus class="size-4 shrink-0" />
              <span class="group-data-[collapsible=icon]:hidden">Question</span>
            </Button>
          </div>
        </SidebarGroupContent>
      </SidebarGroup>

      <SidebarSeparator />

      <!-- Main nav -->
      <SidebarGroup>
        <SidebarGroupLabel>Navigation</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem v-for="item in mainNavItems" :key="item.to">
              <SidebarMenuButton as-child :is-active="route.path === item.to">
                <RouterLink :to="item.to">
                  <component :is="item.icon" />
                  <span>{{ item.label }}</span>
                </RouterLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarContent>

    <!-- ── Footer : Settings + User ── -->
    <SidebarFooter>
      <SidebarMenu>
        <!-- Settings -->
        <SidebarMenuItem>
          <SidebarMenuButton as-child :is-active="route.path === '/settings'">
            <RouterLink to="/settings">
              <Settings />
              <span>Paramètres</span>
            </RouterLink>
          </SidebarMenuButton>
        </SidebarMenuItem>

        <!-- User dropdown -->
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <SidebarMenuButton
                size="lg"
                class="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              >
                <Avatar class="size-8 rounded-lg shrink-0">
                  <AvatarFallback class="rounded-lg bg-primary text-primary-foreground text-xs">
                    AD
                  </AvatarFallback>
                </Avatar>
                <div class="grid flex-1 text-left text-sm leading-tight">
                  <span class="truncate font-semibold">Admin</span>
                  <span class="truncate text-xs text-muted-foreground">admin@ilmoo.com</span>
                </div>
                <ChevronsUpDown class="ml-auto size-4 shrink-0" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent class="w-56" align="start" side="top" :side-offset="4">
              <DropdownMenuLabel class="text-xs text-muted-foreground">Mon compte</DropdownMenuLabel>
              <DropdownMenuItem class="gap-2" @click="goToProfile">
                <CircleUserRound class="size-4" />
                Profil
              </DropdownMenuItem>
              <DropdownMenuItem class="gap-2" @click="goToNotifications">
                <Bell class="size-4" />
                Notifications
              </DropdownMenuItem>
              <DropdownMenuItem class="gap-2" @click="toggleDarkMode">
                <Sun v-if="isDark" class="size-4" />
                <Moon v-else class="size-4" />
                {{ isDark ? 'Mode clair' : 'Mode sombre' }}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem class="gap-2 text-destructive focus:text-destructive" @click="handleLogout">
                <LogOut class="size-4" />
                Déconnexion
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarFooter>

    <SidebarRail />
  </Sidebar>
</template>
