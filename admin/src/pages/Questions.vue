<script setup lang="ts">
import { ref, computed, h, watch } from 'vue'
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import {
  getQuestions, getCategories, updateQuestion, deleteQuestion,
  bulkUpdateQuestionFlavors,
} from '@/lib/api'
import { useToast } from '@/composables/useToast'
import { useFlavor, FLAVORS } from '@/composables/useFlavor'
import type { ColumnDef } from '@tanstack/vue-table'
import DataTable from '@/components/DataTable.vue'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import SelectSearch from '@/components/ui/select/SelectSearch.vue'
import { Checkbox } from '@/components/ui/checkbox'
import { Pencil, Trash2, Plus, Minus } from 'lucide-vue-next'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const toast = useToast()
const queryClient = useQueryClient()
const { activeFlavor } = useFlavor()

const PAGE_SIZE = 50

// ── Server-side filters + pagination ──
const filterFlavor = ref<string>(activeFlavor.value)
const filterCategory = ref('all')
const filterDifficulty = ref('all')

// Sync filterFlavor when activeFlavor changes globally
watch(activeFlavor, (newFlavor) => {
  filterFlavor.value = newFlavor
})
const filterVerified = ref('all')
const filterPlayed = ref('all')
const filterSuccess = ref('all')
const currentPage = ref(0)

// Reset page when filters change
watch([filterFlavor, filterCategory, filterDifficulty, filterVerified, filterPlayed, filterSuccess], () => {
  currentPage.value = 0
})

const queryParams = computed(() => {
  const p: Record<string, string> = {
    limit: String(PAGE_SIZE),
    offset: String(currentPage.value * PAGE_SIZE),
  }
  if (filterFlavor.value !== 'all') p.flavorSlug = filterFlavor.value
  if (filterCategory.value !== 'all') p.categoryId = filterCategory.value
  if (filterDifficulty.value !== 'all') p.difficulty = filterDifficulty.value
  if (filterVerified.value !== 'all') p.isVerified = filterVerified.value
  if (filterPlayed.value !== 'all') p.minPlayed = filterPlayed.value
  if (filterSuccess.value === 'low') p.maxSuccessRate = '40'
  if (filterSuccess.value === 'high') p.minSuccessRate = '80'
  return p
})

const { data: questionsData, isLoading } = useQuery({
  queryKey: ['questions', queryParams],
  queryFn: () => getQuestions(queryParams.value),
})

const { data: categoriesData } = useQuery({
  queryKey: ['categories-all'],
  queryFn: getCategories,
})

const questions = computed(() => (questionsData.value?.data ?? []) as QuestionRow[])
const categories = computed(() => (categoriesData.value?.data ?? []) as CategoryRow[])
const total = computed(() => questionsData.value?.pagination?.total ?? 0)
const pageCount = computed(() => Math.ceil(total.value / PAGE_SIZE))

const categoryOptions = computed(() => [
  { value: 'all', label: 'Toutes catégories' },
  ...categories.value.map(c => ({ value: c.id, label: (c.parent_id ? '└ ' : '') + c.name })),
])

// ── Selection ──
const selectedIds = ref<Set<string>>(new Set())
const allOnPageSelected = computed(() =>
  questions.value.length > 0 && questions.value.every(q => selectedIds.value.has(q.id)),
)
function toggleAll() {
  if (allOnPageSelected.value) {
    questions.value.forEach(q => selectedIds.value.delete(q.id))
  } else {
    questions.value.forEach(q => selectedIds.value.add(q.id))
  }
}
function toggleOne(id: string) {
  if (selectedIds.value.has(id)) selectedIds.value.delete(id)
  else selectedIds.value.add(id)
}

const bulkFlavorMutation = useMutation({
  mutationFn: ({ action, slugs }: { action: 'add' | 'remove'; slugs: string[] }) =>
    bulkUpdateQuestionFlavors([...selectedIds.value], action, slugs),
  onSuccess: (_, { action, slugs }) => {
    queryClient.invalidateQueries({ queryKey: ['questions'] })
    const label = slugs.map(s => FLAVORS.find(f => f.slug === s)?.label ?? s).join(', ')
    toast.success(action === 'add'
      ? `${selectedIds.value.size} questions ajoutées à ${label}`
      : `${selectedIds.value.size} questions retirées de ${label}`)
    selectedIds.value = new Set()
  },
  onError: (err: Error) => toast.error('Erreur', err.message),
})

// ── Edit Dialog ──
const editingId = ref<string | null>(null)
const showEdit = ref(false)
const form = ref({
  question_text: '',
  answers: ['', '', '', ''],
  correct_index: 0,
  category_id: '',
  difficulty: 'medium' as string,
  explanation: '',
  flavor_ids: [] as string[],
})

function openEdit(q: QuestionRow) {
  editingId.value = q.id
  form.value = {
    question_text: q.question_text,
    answers: [...q.answers],
    correct_index: q.correct_index,
    category_id: q.category_id,
    difficulty: q.difficulty,
    explanation: q.explanation ?? '',
    flavor_ids: [...(q.flavor_slugs ?? [])],
  }
  showEdit.value = true
}

const saveMutation = useMutation({
  mutationFn: () => updateQuestion(editingId.value!, { ...form.value }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['questions'] })
    showEdit.value = false
    editingId.value = null
    toast.success('Question mise à jour')
  },
  onError: (err: Error) => {
    toast.error('Erreur', err.message)
  },
})

// ── Delete ──
const deleteId = ref<string | null>(null)

function openDelete(id: string) {
  deleteId.value = id
}
function closeDelete() {
  deleteId.value = null
}
function confirmDelete() {
  const id = deleteId.value
  if (!id) return
  deleteId.value = null
  deleteMutation.mutate(id)
}

const deleteMutation = useMutation({
  mutationFn: (id: string) => deleteQuestion(id),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['questions'] })
    toast.success('Question supprimée')
    deleteId.value = null
  },
  onError: (err: Error) => {
    toast.error('Erreur', err.message)
    deleteId.value = null
  },
})

// ── Verified toggle ──
const verifyMutation = useMutation({
  mutationFn: ({ id, verified }: { id: string; verified: boolean }) =>
    updateQuestion(id, { is_verified: verified }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['questions'] })
  },
})

// ── Helpers ──
function successRate(played: number, correct: number) {
  if (!played) return '–'
  return Math.round((correct / played) * 100) + '%'
}
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
function categoryName(id: string) {
  return categories.value.find(c => c.id === id)?.name ?? '–'
}

// ── TanStack columns ──
const columns: ColumnDef<QuestionRow, unknown>[] = [
  {
    id: 'select',
    header: () => h(Checkbox, {
      modelValue: allOnPageSelected.value,
      'onUpdate:modelValue': () => toggleAll(),
    }),
    cell: ({ row }) => h(Checkbox, {
      modelValue: selectedIds.value.has(row.original.id),
      'onUpdate:modelValue': () => toggleOne(row.original.id),
    }),
    enableSorting: false,
  },
  {
    accessorKey: 'question_text',
    header: 'Question',
    cell: ({ row }) => h('span', { class: 'font-medium line-clamp-2 max-w-xs block' }, row.original.question_text),
  },
  {
    id: 'category',
    header: 'Catégorie',
    accessorFn: (row) => row.category_name ?? categoryName(row.category_id),
    cell: ({ getValue }) => h(Badge, { variant: 'outline' }, () => getValue() as string),
  },
  {
    accessorKey: 'difficulty',
    header: 'Difficulté',
    cell: ({ row }) => h('span', {
      class: 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ' + difficultyColor(row.original.difficulty),
    }, difficultyLabel(row.original.difficulty)),
  },
  {
    accessorKey: 'times_played',
    header: 'Popularité',
    cell: ({ row }) => h('span', { class: 'text-right block' }, String(row.original.times_played)),
  },
  {
    id: 'success_rate',
    header: 'Réussite',
    cell: ({ row }) => h('span', { class: 'text-right block' }, successRate(row.original.times_played, row.original.times_correct)),
  },
  {
    id: 'apps',
    header: 'Apps',
    cell: ({ row }) => {
      const slugs = row.original.flavor_slugs ?? []
      if (slugs.length === 0) return h('span', { class: 'text-muted-foreground text-xs' }, 'Aucune')
      return h('div', { class: 'flex gap-1' },
        slugs.map(s => {
          const f = FLAVORS.find(fl => fl.slug === s)
          return h('span', {
            class: 'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold text-white',
            style: { backgroundColor: f?.color ?? '#666' },
          }, f?.initials ?? s)
        }),
      )
    },
  },
  {
    id: 'verified',
    header: 'Vérifié',
    cell: ({ row }) => h(Switch, {
      modelValue: row.original.is_verified,
      'onUpdate:modelValue': (val: boolean) =>
        verifyMutation.mutate({ id: row.original.id, verified: val }),
    }),
  },
  {
    id: 'actions',
    header: '',
    cell: ({ row }) => h('div', { class: 'flex justify-end gap-1' }, [
      h(Button, { variant: 'ghost', size: 'icon', onClick: () => openEdit(row.original) },
        () => h(Pencil, { class: 'h-4 w-4' })),
      h(Button, { variant: 'ghost', size: 'icon', onClick: () => openDelete(row.original.id) },
        () => h(Trash2, { class: 'h-4 w-4 text-destructive' })),
    ]),
  },
]

// ── Types ──
interface QuestionRow {
  id: string
  category_id: string
  question_text: string
  answers: string[]
  correct_index: number
  difficulty: string
  explanation: string | null
  times_played: number
  times_correct: number
  is_active: boolean
  is_verified: boolean
  category_name?: string
  flavor_slugs?: string[]
}
interface CategoryRow {
  id: string; name: string; slug: string; parent_id: string | null
}
</script>

<template>
  <div class="p-8 space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold">Questions</h1>
        <p class="text-muted-foreground text-sm mt-1">{{ total }} questions</p>
      </div>

      <!-- Bulk actions bar -->
      <div v-if="selectedIds.size > 0" class="flex items-center gap-2">
        <span class="text-sm text-muted-foreground">{{ selectedIds.size }} sélectionnée(s)</span>
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button size="sm"><Plus class="h-4 w-4 mr-1" /> Ajouter à une app</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem
              v-for="f in FLAVORS" :key="f.slug"
              @click="bulkFlavorMutation.mutate({ action: 'add', slugs: [f.slug] })"
            >{{ f.label }}</DropdownMenuItem>
            <DropdownMenuItem
              @click="bulkFlavorMutation.mutate({ action: 'add', slugs: FLAVORS.map(f => f.slug) })"
            >Toutes les apps</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button size="sm" variant="outline"><Minus class="h-4 w-4 mr-1" /> Retirer d'une app</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem
              v-for="f in FLAVORS" :key="f.slug"
              @click="bulkFlavorMutation.mutate({ action: 'remove', slugs: [f.slug] })"
            >{{ f.label }}</DropdownMenuItem>
            <DropdownMenuItem
              @click="bulkFlavorMutation.mutate({ action: 'remove', slugs: FLAVORS.map(f => f.slug) })"
            >Toutes les apps</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button size="sm" variant="ghost" @click="selectedIds = new Set()">Désélectionner</Button>
      </div>
    </div>

    <DataTable
      :data="questions"
      :columns="columns"
      :loading="isLoading"
      search-placeholder="Rechercher une question..."
      :page-size="PAGE_SIZE"
      :server-page="currentPage"
      :server-page-count="pageCount"
      @update:server-page="currentPage = $event"
    >
      <template #filters>
          <Select v-model="filterFlavor">
            <SelectTrigger class="w-36"><SelectValue placeholder="Application" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les apps</SelectItem>
              <SelectItem v-for="f in FLAVORS" :key="f.slug" :value="f.slug">{{ f.label }}</SelectItem>
            </SelectContent>
          </Select>
          <SelectSearch v-model="filterCategory" :options="categoryOptions" placeholder="Catégorie" trigger-class="w-48" />
          <Select v-model="filterDifficulty">
            <SelectTrigger class="w-36"><SelectValue placeholder="Difficulté" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Difficulté</SelectItem>
              <SelectItem value="easy">Facile</SelectItem>
              <SelectItem value="medium">Moyen</SelectItem>
              <SelectItem value="hard">Difficile</SelectItem>
            </SelectContent>
          </Select>
          <Select v-model="filterVerified">
            <SelectTrigger class="w-36"><SelectValue placeholder="Vérification" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Vérification</SelectItem>
              <SelectItem value="true">Vérifiée</SelectItem>
              <SelectItem value="false">Non vérifiée</SelectItem>
            </SelectContent>
          </Select>
          <Select v-model="filterPlayed">
            <SelectTrigger class="w-44"><SelectValue placeholder="Popularité" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toute popularité</SelectItem>
              <SelectItem value="1">Jouée au moins 1×</SelectItem>
              <SelectItem value="10">Jouée au moins 10×</SelectItem>
              <SelectItem value="50">Jouée au moins 50×</SelectItem>
            </SelectContent>
          </Select>
          <Select v-model="filterSuccess">
            <SelectTrigger class="w-40"><SelectValue placeholder="Taux réussite" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Taux réussite</SelectItem>
              <SelectItem value="low">Difficile (≤ 40%)</SelectItem>
              <SelectItem value="high">Facile (≥ 80%)</SelectItem>
            </SelectContent>
          </Select>
      </template>
    </DataTable>

    <!-- ══ Edit Dialog ══ -->
    <Dialog v-model:open="showEdit">
      <DialogContent class="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Modifier la question</DialogTitle>
          <DialogDescription>Modifiez les champs puis enregistrez</DialogDescription>
        </DialogHeader>
        <form class="space-y-4 pt-2" @submit.prevent="saveMutation.mutate()">
          <div class="space-y-2">
            <Label>Question</Label>
            <Textarea v-model="form.question_text" :rows="3" required />
          </div>
          <div class="space-y-3">
            <Label>Réponses</Label>
            <div v-for="(_, i) in form.answers" :key="i" class="flex items-center gap-2">
              <div
                class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 cursor-pointer transition-colors"
                :class="form.correct_index === i ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'"
                @click="form.correct_index = i"
              >{{ String.fromCharCode(65 + i) }}</div>
              <Input v-model="form.answers[i]" :placeholder="`Réponse ${String.fromCharCode(65 + i)}`" required />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-2">
              <Label>Catégorie</Label>
              <SelectSearch
                v-model="form.category_id"
                :options="categories.map(c => ({ value: c.id, label: (c.parent_id ? '└ ' : '') + c.name }))"
                placeholder="Choisir..."
                trigger-class="w-full"
              />
            </div>
            <div class="space-y-2">
              <Label>Difficulté</Label>
              <Select v-model="form.difficulty">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Facile</SelectItem>
                  <SelectItem value="medium">Moyen</SelectItem>
                  <SelectItem value="hard">Difficile</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div class="space-y-2">
            <Label>Explication (optionnel)</Label>
            <Textarea v-model="form.explanation" :rows="2" />
          </div>
          <div class="space-y-2">
            <Label>Applications</Label>
            <div class="flex gap-4">
              <label v-for="f in FLAVORS" :key="f.slug" class="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  :model-value="form.flavor_ids.includes(f.slug)"
                  @update:model-value="form.flavor_ids = form.flavor_ids.includes(f.slug) ? form.flavor_ids.filter(s => s !== f.slug) : [...form.flavor_ids, f.slug]"
                />
                <span class="text-sm">{{ f.label }}</span>
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" @click="showEdit = false">Annuler</Button>
            <Button type="submit" :disabled="saveMutation.isPending.value">
              {{ saveMutation.isPending.value ? 'Enregistrement...' : 'Enregistrer' }}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <!-- ══ Delete confirmation ══ -->
    <AlertDialog :open="!!deleteId" @update:open="(v) => { if (!v) closeDelete() }">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer cette question ?</AlertDialogTitle>
          <AlertDialogDescription>Elle n'apparaîtra plus dans les matchs.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <Button variant="destructive" @click="confirmDelete">Supprimer</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
