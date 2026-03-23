<script setup lang="ts">
import { ref, computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { getMatches } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

const filterType = ref('all')
const filterStatus = ref('all')
const page = ref(0)
const limit = 30

const queryParams = computed(() => {
  const p: Record<string, string> = { limit: String(limit), offset: String(page.value * limit) }
  if (filterType.value !== 'all') p.type = filterType.value
  if (filterStatus.value !== 'all') p.status = filterStatus.value
  return p
})

const { data, isLoading } = useQuery({
  queryKey: ['admin-matches', queryParams],
  queryFn: () => getMatches(queryParams.value),
})

const matches = computed(() => (data.value?.data ?? []) as MatchRow[])
const total = computed(() => data.value?.pagination?.total ?? 0)
const totalPages = computed(() => Math.ceil(total.value / limit))

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function statusColor(s: string) {
  if (s === 'completed') return 'default'
  if (s === 'in_progress') return 'secondary'
  return 'outline'
}

function typeLabel(t: string) {
  const labels: Record<string, string> = { ranked: 'Classé', friendly: 'Amical', solo: 'Solo', tournament: 'Tournoi' }
  return labels[t] ?? t
}

interface MatchRow {
  id: string
  match_type: string
  status: string
  player1_score: number
  player2_score: number
  player1_username: string | null
  player2_username: string | null
  category_name: string | null
  total_rounds: number
  created_at: string
}
</script>

<template>
  <div class="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
    <div class="px-4 lg:px-6">
      <h1 class="text-2xl font-bold tracking-tight">Matchs</h1>
      <p class="text-muted-foreground text-sm">{{ total }} matchs au total</p>
    </div>

    <div class="flex gap-3 px-4 lg:px-6">
      <Select v-model="filterType">
        <SelectTrigger class="w-36"><SelectValue placeholder="Type" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Type</SelectItem>
          <SelectItem value="ranked">Classé</SelectItem>
          <SelectItem value="friendly">Amical</SelectItem>
          <SelectItem value="solo">Solo</SelectItem>
          <SelectItem value="tournament">Tournoi</SelectItem>
        </SelectContent>
      </Select>
      <Select v-model="filterStatus">
        <SelectTrigger class="w-40"><SelectValue placeholder="Statut" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Statut</SelectItem>
          <SelectItem value="completed">Terminé</SelectItem>
          <SelectItem value="in_progress">En cours</SelectItem>
          <SelectItem value="cancelled">Annulé</SelectItem>
        </SelectContent>
      </Select>
    </div>

    <div class="px-4 lg:px-6">
      <Card>
        <CardContent class="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Joueur 1</TableHead>
                <TableHead class="text-center">Score</TableHead>
                <TableHead>Joueur 2</TableHead>
                <TableHead>Catégorie</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-if="isLoading">
                <TableCell colspan="7" class="text-center py-8 text-muted-foreground">Chargement...</TableCell>
              </TableRow>
              <TableRow v-else-if="matches.length === 0">
                <TableCell colspan="7" class="text-center py-8 text-muted-foreground">Aucun match</TableCell>
              </TableRow>
              <TableRow v-for="m in matches" :key="m.id">
                <TableCell class="font-medium">{{ m.player1_username || 'Anonyme' }}</TableCell>
                <TableCell class="text-center tabular-nums font-semibold">
                  {{ m.player1_score }} – {{ m.player2_score }}
                </TableCell>
                <TableCell class="font-medium">{{ m.player2_username || 'Bot' }}</TableCell>
                <TableCell>
                  <Badge variant="outline">{{ m.category_name || '–' }}</Badge>
                </TableCell>
                <TableCell class="text-sm">{{ typeLabel(m.match_type) }}</TableCell>
                <TableCell>
                  <Badge :variant="statusColor(m.status)">{{ m.status }}</Badge>
                </TableCell>
                <TableCell class="text-sm text-muted-foreground">{{ formatDate(m.created_at) }}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>

    <div v-if="totalPages > 1" class="flex items-center justify-between px-4 lg:px-6">
      <p class="text-sm text-muted-foreground">Page {{ page + 1 }} / {{ totalPages }}</p>
      <div class="flex gap-2">
        <Button variant="outline" size="sm" :disabled="page === 0" @click="page--">Précédent</Button>
        <Button variant="outline" size="sm" :disabled="page >= totalPages - 1" @click="page++">Suivant</Button>
      </div>
    </div>
  </div>
</template>
