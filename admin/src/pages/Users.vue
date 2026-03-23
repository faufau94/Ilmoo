<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import { getUsers, updateUserStatus } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Search, Ban, ShieldCheck, Pause } from 'lucide-vue-next'

const queryClient = useQueryClient()

const search = ref('')
const filterStatus = ref('all')
const filterRole = ref('all')
const filterFlavor = ref('all')
const page = ref(0)
const limit = 30

const queryParams = computed(() => {
  const p: Record<string, string> = { limit: String(limit), offset: String(page.value * limit) }
  if (search.value) p.search = search.value
  if (filterStatus.value !== 'all') p.status = filterStatus.value
  if (filterRole.value !== 'all') p.role = filterRole.value
  if (filterFlavor.value !== 'all') p.flavor = filterFlavor.value
  return p
})

const { data, isLoading } = useQuery({
  queryKey: ['admin-users', queryParams],
  queryFn: () => getUsers(queryParams.value),
})

const users = computed(() => (data.value?.data ?? []) as UserRow[])
const total = computed(() => data.value?.pagination?.total ?? 0)
const totalPages = computed(() => Math.ceil(total.value / limit))

watch([filterStatus, filterRole, filterFlavor, search], () => { page.value = 0 })

// Status change
const statusAction = ref<{ id: string; status: string; username: string } | null>(null)

const statusMutation = useMutation({
  mutationFn: () => updateUserStatus(statusAction.value!.id, statusAction.value!.status),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    statusAction.value = null
  },
})

function statusBadge(s: string) {
  if (s === 'active') return 'default'
  if (s === 'suspended') return 'secondary'
  return 'destructive'
}

function formatDate(d: string | null) {
  if (!d) return '–'
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

interface UserRow {
  id: string
  username: string | null
  email: string | null
  role: string
  status: string
  subscription: string
  is_anonymous: boolean
  app_flavor: string | null
  total_matches: number
  total_wins: number
  total_xp: number
  level: number
  created_at: string
  last_login_at: string | null
}
</script>

<template>
  <div class="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
    <div class="px-4 lg:px-6">
      <h1 class="text-2xl font-bold tracking-tight">Utilisateurs</h1>
      <p class="text-muted-foreground text-sm">{{ total }} utilisateurs au total</p>
    </div>

    <!-- Filters -->
    <div class="flex gap-3 px-4 lg:px-6 flex-wrap">
      <div class="relative flex-1 max-w-sm">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input v-model="search" placeholder="Rechercher..." class="pl-9" />
      </div>
      <Select v-model="filterStatus">
        <SelectTrigger class="w-36"><SelectValue placeholder="Statut" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Statut</SelectItem>
          <SelectItem value="active">Actif</SelectItem>
          <SelectItem value="suspended">Suspendu</SelectItem>
          <SelectItem value="banned">Banni</SelectItem>
        </SelectContent>
      </Select>
      <Select v-model="filterRole">
        <SelectTrigger class="w-32"><SelectValue placeholder="Rôle" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Rôle</SelectItem>
          <SelectItem value="player">Joueur</SelectItem>
          <SelectItem value="admin">Admin</SelectItem>
        </SelectContent>
      </Select>
      <Select v-model="filterFlavor">
        <SelectTrigger class="w-36"><SelectValue placeholder="App" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">App</SelectItem>
          <SelectItem value="ilmoo">Ilmoo</SelectItem>
          <SelectItem value="quizapp">QuizBattle</SelectItem>
        </SelectContent>
      </Select>
    </div>

    <!-- Table -->
    <div class="px-4 lg:px-6">
      <Card>
        <CardContent class="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Utilisateur</TableHead>
                <TableHead>App</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Abo</TableHead>
                <TableHead class="text-right">Matchs</TableHead>
                <TableHead class="text-right">XP</TableHead>
                <TableHead class="text-right">Niveau</TableHead>
                <TableHead>Inscrit le</TableHead>
                <TableHead class="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-if="isLoading">
                <TableCell colspan="9" class="text-center py-8 text-muted-foreground">Chargement...</TableCell>
              </TableRow>
              <TableRow v-else-if="users.length === 0">
                <TableCell colspan="9" class="text-center py-8 text-muted-foreground">Aucun utilisateur</TableCell>
              </TableRow>
              <TableRow v-for="u in users" :key="u.id">
                <TableCell>
                  <div>
                    <span class="font-medium">{{ u.username || 'Anonyme' }}</span>
                    <p v-if="u.email" class="text-xs text-muted-foreground">{{ u.email }}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{{ u.app_flavor || '–' }}</Badge>
                </TableCell>
                <TableCell>
                  <Badge :variant="statusBadge(u.status)">{{ u.status }}</Badge>
                </TableCell>
                <TableCell>
                  <Badge v-if="u.subscription === 'premium'" class="bg-amber-500/10 text-amber-600">Premium</Badge>
                  <span v-else class="text-muted-foreground text-sm">Free</span>
                </TableCell>
                <TableCell class="text-right tabular-nums">{{ u.total_matches }}</TableCell>
                <TableCell class="text-right tabular-nums">{{ u.total_xp }}</TableCell>
                <TableCell class="text-right tabular-nums">{{ u.level }}</TableCell>
                <TableCell class="text-sm text-muted-foreground">{{ formatDate(u.created_at) }}</TableCell>
                <TableCell class="text-right">
                  <div class="flex justify-end gap-1">
                    <Button
                      v-if="u.status !== 'active'"
                      variant="ghost" size="icon" title="Activer"
                      @click="statusAction = { id: u.id, status: 'active', username: u.username || 'Anonyme' }"
                    >
                      <ShieldCheck class="h-4 w-4 text-green-500" />
                    </Button>
                    <Button
                      v-if="u.status !== 'suspended'"
                      variant="ghost" size="icon" title="Suspendre"
                      @click="statusAction = { id: u.id, status: 'suspended', username: u.username || 'Anonyme' }"
                    >
                      <Pause class="h-4 w-4 text-yellow-500" />
                    </Button>
                    <Button
                      v-if="u.status !== 'banned'"
                      variant="ghost" size="icon" title="Bannir"
                      @click="statusAction = { id: u.id, status: 'banned', username: u.username || 'Anonyme' }"
                    >
                      <Ban class="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>

    <!-- Pagination -->
    <div v-if="totalPages > 1" class="flex items-center justify-between px-4 lg:px-6">
      <p class="text-sm text-muted-foreground">Page {{ page + 1 }} / {{ totalPages }}</p>
      <div class="flex gap-2">
        <Button variant="outline" size="sm" :disabled="page === 0" @click="page--">Précédent</Button>
        <Button variant="outline" size="sm" :disabled="page >= totalPages - 1" @click="page++">Suivant</Button>
      </div>
    </div>

    <!-- Status confirmation -->
    <AlertDialog :open="!!statusAction" @update:open="statusAction = null">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {{ statusAction?.status === 'banned' ? 'Bannir' : statusAction?.status === 'suspended' ? 'Suspendre' : 'Activer' }}
            {{ statusAction?.username }} ?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Cette action changera le statut de l'utilisateur.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction @click="statusMutation.mutate()">Confirmer</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
