<script setup lang="ts">
import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { getStats, getQuestions, getReports } from '@/lib/api'
import { useFlavor } from '@/composables/useFlavor'
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
import { Separator } from '@/components/ui/separator'
import { Users, Swords, HelpCircle, Flag, TrendingUp } from 'lucide-vue-next'

const { activeFlavor } = useFlavor()

const { data: statsData } = useQuery({
  queryKey: ['stats', activeFlavor],
  queryFn: () => getStats(activeFlavor.value),
})

const { data: questionsData } = useQuery({
  queryKey: ['recent-questions'],
  queryFn: () => getQuestions({ limit: '8', offset: '0' }),
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
    { label: 'Signalements', value: s.pendingReports, subtitle: 'En attente', icon: Flag },
  ]
})

function difficultyLabel(d: string) {
  if (d === 'easy') return 'Facile'
  if (d === 'hard') return 'Difficile'
  return 'Moyen'
}

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
  <div class="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
    <!-- Header with tabs -->
    <div class="px-4 lg:px-6">
      <h1 class="text-2xl font-bold tracking-tight">Tableau de bord</h1>
      <p class="text-muted-foreground text-sm">Vue d'ensemble de l'activité</p>
    </div>

    <Separator />

    <!-- Metric cards -->
    <div class="grid grid-cols-1 gap-4 px-4 sm:grid-cols-2 lg:grid-cols-4 lg:px-6 *:data-[slot=card]:shadow-xs">
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
          <div class="line-clamp-1 flex gap-2 font-medium">
            {{ card.subtitle }}
            <TrendingUp class="size-4" />
          </div>
        </CardFooter>
      </Card>
    </div>

    <!-- Content -->
    <div class="grid grid-cols-1 gap-4 px-4 lg:grid-cols-3 lg:px-6">
      <!-- Recent questions (2/3) -->
      <Card class="lg:col-span-2">
        <CardHeader>
          <CardTitle>Questions récentes</CardTitle>
          <CardDescription>Dernières questions ajoutées</CardDescription>
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
                <TableCell class="max-w-64 truncate font-medium">
                  {{ (q as any).question_text }}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{{ (q as any).category_name }}</Badge>
                </TableCell>
                <TableCell>
                  <span
                    class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                    :class="difficultyColor((q as any).difficulty)"
                  >
                    {{ difficultyLabel((q as any).difficulty) }}
                  </span>
                </TableCell>
                <TableCell class="text-right tabular-nums">
                  {{ successRate((q as any).times_played, (q as any).times_correct) }}
                </TableCell>
              </TableRow>
              <TableRow v-if="questions.length === 0">
                <TableCell colspan="4" class="text-center text-muted-foreground py-8">
                  Aucune question
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <!-- Recent reports (1/3) -->
      <Card>
        <CardHeader>
          <CardTitle>Signalements</CardTitle>
          <CardDescription>En attente de traitement</CardDescription>
        </CardHeader>
        <CardContent>
          <div v-if="reports.length === 0" class="flex flex-col items-center justify-center py-8 text-center">
            <Flag class="size-8 text-muted-foreground/50 mb-2" />
            <p class="text-sm text-muted-foreground">Aucun signalement en attente</p>
          </div>
          <div v-else class="space-y-4">
            <div
              v-for="r in reports"
              :key="(r as any).id"
              class="flex items-start gap-3"
            >
              <div class="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-orange-500/10">
                <Flag class="size-4 text-orange-500" />
              </div>
              <div class="flex-1 min-w-0 space-y-1">
                <p class="text-sm font-medium leading-none">{{ (r as any).report_type }}</p>
                <p class="text-xs text-muted-foreground line-clamp-1">
                  {{ (r as any).description || 'Pas de description' }}
                </p>
                <p class="text-xs text-muted-foreground">
                  par {{ (r as any).reporter_username || 'Anonyme' }}
                </p>
              </div>
              <Badge variant="secondary" class="shrink-0 text-xs">{{ (r as any).status }}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
