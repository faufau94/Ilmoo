<script setup lang="ts">
import { ref, computed } from 'vue'
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import { getTournaments, createTournament, updateTournament } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Plus, Pencil, Trophy } from 'lucide-vue-next'

const queryClient = useQueryClient()

const { data, isLoading } = useQuery({
  queryKey: ['admin-tournaments'],
  queryFn: getTournaments,
})

const tournaments = computed(() => (data.value?.data ?? []) as TournamentRow[])

// Dialog
const showDialog = ref(false)
const editingId = ref<string | null>(null)
const form = ref(emptyForm())

function emptyForm() {
  return {
    name: '',
    description: '',
    status: 'draft',
    max_players: 100,
    start_date: '',
    end_date: '',
    sponsor_name: '',
  }
}

function openCreate() {
  editingId.value = null
  form.value = emptyForm()
  showDialog.value = true
}

function openEdit(t: TournamentRow) {
  editingId.value = t.id
  form.value = {
    name: t.name,
    description: t.description ?? '',
    status: t.status,
    max_players: t.max_players,
    start_date: t.start_date?.split('T')[0] ?? '',
    end_date: t.end_date?.split('T')[0] ?? '',
    sponsor_name: t.sponsor_name ?? '',
  }
  showDialog.value = true
}

const saveMutation = useMutation({
  mutationFn: () => {
    const body = {
      ...form.value,
      max_players: Number(form.value.max_players),
      start_date: form.value.start_date || null,
      end_date: form.value.end_date || null,
      sponsor_name: form.value.sponsor_name || null,
      description: form.value.description || null,
    }
    if (editingId.value) return updateTournament(editingId.value, body)
    return createTournament(body)
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['admin-tournaments'] })
    showDialog.value = false
  },
})

function statusColor(s: string) {
  if (s === 'active') return 'default'
  if (s === 'completed') return 'secondary'
  if (s === 'draft') return 'outline'
  return 'destructive'
}

function formatDate(d: string | null) {
  if (!d) return '–'
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

interface TournamentRow {
  id: string
  name: string
  description: string | null
  status: string
  max_players: number
  start_date: string | null
  end_date: string | null
  sponsor_name: string | null
  created_at: string
}
</script>

<template>
  <div class="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
    <div class="flex items-center justify-between px-4 lg:px-6">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">Tournois</h1>
        <p class="text-muted-foreground text-sm">Gestion des événements et tournois</p>
      </div>
      <Button @click="openCreate">
        <Plus class="h-4 w-4 mr-2" /> Nouveau tournoi
      </Button>
    </div>

    <div class="px-4 lg:px-6">
      <div v-if="isLoading" class="text-center py-8 text-muted-foreground">Chargement...</div>
      <div v-else-if="tournaments.length === 0" class="text-center py-16">
        <Trophy class="size-12 text-muted-foreground/50 mx-auto mb-3" />
        <p class="text-muted-foreground">Aucun tournoi créé</p>
        <Button class="mt-4" @click="openCreate">Créer le premier tournoi</Button>
      </div>
      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card v-for="t in tournaments" :key="t.id" class="cursor-pointer hover:border-primary/50 transition-colors" @click="openEdit(t)">
          <CardHeader>
            <div class="flex items-center justify-between">
              <CardTitle class="text-base">{{ t.name }}</CardTitle>
              <Badge :variant="statusColor(t.status)">{{ t.status }}</Badge>
            </div>
            <CardDescription v-if="t.description" class="line-clamp-2">{{ t.description }}</CardDescription>
          </CardHeader>
          <CardContent class="space-y-2 text-sm text-muted-foreground">
            <div class="flex justify-between">
              <span>Max joueurs</span>
              <span class="font-medium text-foreground">{{ t.max_players }}</span>
            </div>
            <div class="flex justify-between">
              <span>Début</span>
              <span>{{ formatDate(t.start_date) }}</span>
            </div>
            <div class="flex justify-between">
              <span>Fin</span>
              <span>{{ formatDate(t.end_date) }}</span>
            </div>
            <div v-if="t.sponsor_name" class="flex justify-between">
              <span>Sponsor</span>
              <span class="font-medium text-foreground">{{ t.sponsor_name }}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>

    <!-- Dialog -->
    <Dialog v-model:open="showDialog">
      <DialogContent class="max-w-lg">
        <DialogHeader>
          <DialogTitle>{{ editingId ? 'Modifier le tournoi' : 'Nouveau tournoi' }}</DialogTitle>
        </DialogHeader>
        <form class="space-y-4" @submit.prevent="saveMutation.mutate()">
          <div class="space-y-2">
            <Label>Nom</Label>
            <Input v-model="form.name" required />
          </div>
          <div class="space-y-2">
            <Label>Description</Label>
            <Textarea v-model="form.description" :rows="2" />
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-2">
              <Label>Statut</Label>
              <Select v-model="form.status">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Brouillon</SelectItem>
                  <SelectItem value="active">Actif</SelectItem>
                  <SelectItem value="completed">Terminé</SelectItem>
                  <SelectItem value="cancelled">Annulé</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div class="space-y-2">
              <Label>Max joueurs</Label>
              <Input type="number" v-model.number="form.max_players" min="2" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-2">
              <Label>Date début</Label>
              <Input type="date" v-model="form.start_date" />
            </div>
            <div class="space-y-2">
              <Label>Date fin</Label>
              <Input type="date" v-model="form.end_date" />
            </div>
          </div>
          <div class="space-y-2">
            <Label>Nom du sponsor (optionnel)</Label>
            <Input v-model="form.sponsor_name" placeholder="Marque, organisation..." />
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" @click="showDialog = false">Annuler</Button>
            <Button type="submit" :disabled="saveMutation.isPending.value">
              {{ saveMutation.isPending.value ? 'Enregistrement...' : 'Enregistrer' }}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </div>
</template>
