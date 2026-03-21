<script setup lang="ts">
import { ref } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { getStats, getQuestions, getReports } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Users, Swords, HelpCircle, Flag } from 'lucide-vue-next'

const flavorFilter = ref<string>('')

const { data: statsData } = useQuery({
  queryKey: ['stats', flavorFilter],
  queryFn: () => getStats(flavorFilter.value || undefined),
})

const { data: questionsData } = useQuery({
  queryKey: ['recent-questions'],
  queryFn: () => getQuestions({ limit: '5', offset: '0' }),
})

const { data: reportsData } = useQuery({
  queryKey: ['recent-reports'],
  queryFn: () => getReports({ limit: '5' }),
})

const stats = computed(() => statsData.value?.data)
const questions = computed(() => questionsData.value?.data ?? [])
const reports = computed(() => reportsData.value?.data ?? [])

import { computed } from 'vue'

const metricCards = computed(() => {
  const s = stats.value
  if (!s) return []
  return [
    { label: 'Joueurs actifs', value: s.activeToday, total: s.totalUsers, icon: Users, color: 'text-blue-500' },
    { label: 'Matchs aujourd\'hui', value: s.matchesToday, total: s.totalMatches, icon: Swords, color: 'text-green-500' },
    { label: 'Questions', value: s.totalQuestions, icon: HelpCircle, color: 'text-purple-500' },
    { label: 'Signalements', value: s.pendingReports, icon: Flag, color: 'text-orange-500' },
  ]
})

function difficultyColor(d: string) {
  if (d === 'easy') return 'bg-green-500/10 text-green-500'
  if (d === 'hard') return 'bg-red-500/10 text-red-500'
  return 'bg-yellow-500/10 text-yellow-500'
}

function successRate(played: number, correct: number) {
  if (!played) return '–'
  return Math.round((correct / played) * 100) + '%'
}
</script>

<template>
  <div class="p-8 space-y-8">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold">Dashboard</h1>
        <p class="text-muted-foreground text-sm">Vue d'ensemble de l'activité</p>
      </div>
      <Select v-model="flavorFilter">
        <SelectTrigger class="w-44">
          <SelectValue placeholder="Toutes les apps" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">Toutes les apps</SelectItem>
          <SelectItem value="ilmoo">Ilmoo</SelectItem>
          <SelectItem value="quizapp">QuizBattle</SelectItem>
        </SelectContent>
      </Select>
    </div>

    <!-- Metric cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card v-for="card in metricCards" :key="card.label">
        <CardContent class="pt-6">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-muted-foreground">{{ card.label }}</p>
              <p class="text-3xl font-bold mt-1">{{ card.value ?? '–' }}</p>
              <p v-if="card.total !== undefined" class="text-xs text-muted-foreground mt-1">
                {{ card.total }} au total
              </p>
            </div>
            <div :class="['rounded-lg p-3 bg-muted', card.color]">
              <component :is="card.icon" class="h-5 w-5" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Recent questions -->
      <Card>
        <CardHeader>
          <CardTitle class="text-lg">Questions récentes</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Question</TableHead>
                <TableHead>Catégorie</TableHead>
                <TableHead>Difficulté</TableHead>
                <TableHead class="text-right">Réussite</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="q in questions" :key="(q as any).id">
                <TableCell class="max-w-[200px] truncate">
                  {{ (q as any).question_text }}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{{ (q as any).category_name }}</Badge>
                </TableCell>
                <TableCell>
                  <span
                    class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                    :class="difficultyColor((q as any).difficulty)"
                  >
                    {{ (q as any).difficulty }}
                  </span>
                </TableCell>
                <TableCell class="text-right">
                  {{ successRate((q as any).times_played, (q as any).times_correct) }}
                </TableCell>
              </TableRow>
              <TableRow v-if="questions.length === 0">
                <TableCell colspan="4" class="text-center text-muted-foreground">
                  Aucune question
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <!-- Recent reports -->
      <Card>
        <CardHeader>
          <CardTitle class="text-lg">Signalements récents</CardTitle>
        </CardHeader>
        <CardContent>
          <div v-if="reports.length === 0" class="text-center text-muted-foreground py-8">
            Aucun signalement en attente
          </div>
          <div v-else class="space-y-3">
            <div
              v-for="r in reports"
              :key="(r as any).id"
              class="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
            >
              <Flag class="h-4 w-4 mt-0.5 text-orange-500 shrink-0" />
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium">{{ (r as any).report_type }}</p>
                <p class="text-xs text-muted-foreground truncate">
                  {{ (r as any).description || 'Pas de description' }}
                </p>
                <p class="text-xs text-muted-foreground mt-1">
                  par {{ (r as any).reporter_username || 'Anonyme' }}
                </p>
              </div>
              <Badge variant="outline" class="shrink-0">{{ (r as any).status }}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
