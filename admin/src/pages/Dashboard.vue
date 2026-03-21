<script setup lang="ts">
import { ref, computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { getStats, getQuestions, getReports } from '@/lib/api'
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  CardContent,
} from '@/components/ui/card'
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

const flavorFilter = ref<string>('all')

const { data: statsData } = useQuery({
  queryKey: ['stats', flavorFilter],
  queryFn: () => getStats(flavorFilter.value === 'all' ? undefined : flavorFilter.value),
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

const metricCards = computed(() => {
  const s = stats.value
  if (!s) return []
  return [
    { label: 'Joueurs actifs', value: s.activeToday, subtitle: `${s.totalUsers} au total`, icon: Users },
    { label: 'Matchs aujourd\'hui', value: s.matchesToday, subtitle: `${s.totalMatches} au total`, icon: Swords },
    { label: 'Questions', value: s.totalQuestions, subtitle: 'Questions actives', icon: HelpCircle },
    { label: 'Signalements', value: s.pendingReports, subtitle: 'En attente de traitement', icon: Flag },
  ]
})

function difficultyColor(d: string) {
  if (d === 'easy') return 'bg-green-500/10 text-green-500'
  if (d === 'hard') return 'bg-red-500/10 text-red-500'
  return 'bg-yellow-500/10 text-yellow-500'
}

function difficultyLabel(d: string) {
  if (d === 'easy') return 'Facile'
  if (d === 'hard') return 'Difficile'
  return 'Moyen'
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
          <SelectItem value="all">Toutes les apps</SelectItem>
          <SelectItem value="ilmoo">Ilmoo</SelectItem>
          <SelectItem value="quizapp">QuizBattle</SelectItem>
        </SelectContent>
      </Select>
    </div>

    <!-- Metric cards -->
    <div class="grid grid-cols-1 gap-4 *:data-[slot=card]:shadow-xs sm:grid-cols-2 lg:grid-cols-4">
      <Card v-for="card in metricCards" :key="card.label" class="@container/card">
        <CardHeader>
          <CardDescription>{{ card.label }}</CardDescription>
          <CardTitle class="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {{ card.value ?? '–' }}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <component :is="card.icon" class="size-3" />
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter class="flex-col items-start gap-1.5 text-sm">
          <div class="text-muted-foreground">
            {{ card.subtitle }}
          </div>
        </CardFooter>
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
                <TableCell class="max-w-50 truncate">
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
                    {{ difficultyLabel((q as any).difficulty) }}
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
