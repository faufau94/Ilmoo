<script setup lang="ts">
import { ref, computed } from 'vue'
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import { getReports, resolveReport } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Check, X } from 'lucide-vue-next'

const queryClient = useQueryClient()
const filterStatus = ref('pending')

const { data, isLoading } = useQuery({
  queryKey: ['admin-reports', filterStatus],
  queryFn: () => getReports({ status: filterStatus.value }),
})

const reports = computed(() => (data.value?.data ?? []) as ReportRow[])

// Resolve dialog
const resolving = ref<ReportRow | null>(null)
const resolveStatus = ref<'resolved' | 'rejected'>('resolved')
const adminNote = ref('')

function openResolve(report: ReportRow, status: 'resolved' | 'rejected') {
  resolving.value = report
  resolveStatus.value = status
  adminNote.value = ''
}

const resolveMutation = useMutation({
  mutationFn: () => resolveReport(resolving.value!.id, {
    status: resolveStatus.value,
    admin_note: adminNote.value || undefined,
  }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['admin-reports'] })
    resolving.value = null
  },
})

function typeLabel(t: string) {
  const labels: Record<string, string> = {
    wrong_answer: 'Réponse incorrecte',
    duplicate: 'Doublon',
    inappropriate: 'Contenu inapproprié',
    other: 'Autre',
  }
  return labels[t] ?? t
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

interface ReportRow {
  id: string
  report_type: string
  status: string
  description: string | null
  reporter_username: string | null
  reported_question_text: string | null
  reported_username: string | null
  admin_note: string | null
  created_at: string
}
</script>

<template>
  <div class="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
    <div class="px-4 lg:px-6">
      <h1 class="text-2xl font-bold tracking-tight">Signalements</h1>
      <p class="text-muted-foreground text-sm">Gestion des signalements utilisateurs</p>
    </div>

    <div class="flex gap-3 px-4 lg:px-6">
      <Select v-model="filterStatus">
        <SelectTrigger class="w-40"><SelectValue placeholder="Statut" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="pending">En attente</SelectItem>
          <SelectItem value="resolved">Résolus</SelectItem>
          <SelectItem value="rejected">Rejetés</SelectItem>
        </SelectContent>
      </Select>
    </div>

    <div class="px-4 lg:px-6">
      <Card>
        <CardContent class="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Question / Utilisateur</TableHead>
                <TableHead>Signalé par</TableHead>
                <TableHead>Date</TableHead>
                <TableHead class="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-if="isLoading">
                <TableCell colspan="6" class="text-center py-8 text-muted-foreground">Chargement...</TableCell>
              </TableRow>
              <TableRow v-else-if="reports.length === 0">
                <TableCell colspan="6" class="text-center py-8 text-muted-foreground">Aucun signalement</TableCell>
              </TableRow>
              <TableRow v-for="r in reports" :key="r.id">
                <TableCell>
                  <Badge variant="outline">{{ typeLabel(r.report_type) }}</Badge>
                </TableCell>
                <TableCell class="max-w-48 truncate text-sm">
                  {{ r.description || '–' }}
                </TableCell>
                <TableCell class="text-sm">
                  <span v-if="r.reported_question_text" class="truncate block max-w-40">{{ r.reported_question_text }}</span>
                  <span v-else-if="r.reported_username">{{ r.reported_username }}</span>
                  <span v-else class="text-muted-foreground">–</span>
                </TableCell>
                <TableCell class="text-sm">{{ r.reporter_username || 'Anonyme' }}</TableCell>
                <TableCell class="text-sm text-muted-foreground">{{ formatDate(r.created_at) }}</TableCell>
                <TableCell class="text-right">
                  <div v-if="r.status === 'pending'" class="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" title="Résoudre" @click="openResolve(r, 'resolved')">
                      <Check class="h-4 w-4 text-green-500" />
                    </Button>
                    <Button variant="ghost" size="icon" title="Rejeter" @click="openResolve(r, 'rejected')">
                      <X class="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  <Badge v-else :variant="r.status === 'resolved' ? 'default' : 'secondary'">
                    {{ r.status === 'resolved' ? 'Résolu' : 'Rejeté' }}
                  </Badge>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>

    <!-- Resolve dialog -->
    <Dialog :open="!!resolving" @update:open="resolving = null">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{ resolveStatus === 'resolved' ? 'Résoudre' : 'Rejeter' }} le signalement</DialogTitle>
        </DialogHeader>
        <div class="space-y-4">
          <div class="text-sm">
            <span class="font-medium">Type :</span> {{ resolving ? typeLabel(resolving.report_type) : '' }}
          </div>
          <div v-if="resolving?.description" class="text-sm">
            <span class="font-medium">Description :</span> {{ resolving.description }}
          </div>
          <div class="space-y-2">
            <Label>Note admin (optionnel)</Label>
            <Textarea v-model="adminNote" :rows="3" placeholder="Action prise, commentaire..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="resolving = null">Annuler</Button>
          <Button
            :variant="resolveStatus === 'resolved' ? 'default' : 'destructive'"
            @click="resolveMutation.mutate()"
            :disabled="resolveMutation.isPending.value"
          >
            {{ resolveStatus === 'resolved' ? 'Résoudre' : 'Rejeter' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
