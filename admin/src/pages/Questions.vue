<script setup lang="ts">
import { ref, computed, h, watch } from 'vue'
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import {
  getQuestions, getCategories, updateQuestion, deleteQuestion,
  bulkUpdateQuestionFlavors, bulkDeleteQuestions, getQuestionIds,
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
import { Pencil, Trash2, Plus, Minus, Check, Eye, BarChart3, Tag, Layers, BookOpen, Calendar } from 'lucide-vue-next'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'

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
const allFilteredSelected = ref(false)
const selectingAll = ref(false)

const allOnPageSelected = computed(() =>
  questions.value.length > 0 && questions.value.every(q => selectedIds.value.has(q.id)),
)
function toggleAll() {
  if (allOnPageSelected.value) {
    questions.value.forEach(q => selectedIds.value.delete(q.id))
    allFilteredSelected.value = false
  } else {
    questions.value.forEach(q => selectedIds.value.add(q.id))
  }
}
function toggleOne(id: string) {
  if (selectedIds.value.has(id)) selectedIds.value.delete(id)
  else selectedIds.value.add(id)
  allFilteredSelected.value = false
}
function clearSelection() {
  selectedIds.value = new Set()
  allFilteredSelected.value = false
}

async function selectAllFiltered() {
  selectingAll.value = true
  try {
    // Build params without limit/offset
    const p: Record<string, string> = {}
    if (filterFlavor.value !== 'all') p.flavorSlug = filterFlavor.value
    if (filterCategory.value !== 'all') p.categoryId = filterCategory.value
    if (filterDifficulty.value !== 'all') p.difficulty = filterDifficulty.value
    if (filterVerified.value !== 'all') p.isVerified = filterVerified.value
    if (filterPlayed.value !== 'all') p.minPlayed = filterPlayed.value
    if (filterSuccess.value === 'low') p.maxSuccessRate = '40'
    if (filterSuccess.value === 'high') p.minSuccessRate = '80'

    const result = await getQuestionIds(p)
    const ids = result.data ?? []
    selectedIds.value = new Set(ids)
    allFilteredSelected.value = true
  } catch (err) {
    toast.error('Erreur', (err as Error).message)
  } finally {
    selectingAll.value = false
  }
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
    clearSelection()
  },
  onError: (err: Error) => toast.error('Erreur', err.message),
})

// ── Bulk delete ──
const showBulkDelete = ref(false)
const bulkDeleteMutation = useMutation({
  mutationFn: () => bulkDeleteQuestions([...selectedIds.value]),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['questions'] })
    toast.success(`${selectedIds.value.size} questions supprimées`)
    clearSelection()
    showBulkDelete.value = false
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

// ── Detail Sidebar ──
const showDetail = ref(false)
const detailQuestion = ref<QuestionRow | null>(null)

function openDetail(row: Record<string, unknown>, event: MouseEvent) {
  // Don't open sidebar if clicking on interactive elements (buttons, switches, checkboxes, dropdowns)
  const target = event.target as HTMLElement
  if (target.closest('button, [role="checkbox"], [role="switch"], [data-slot="switch"]')) return
  detailQuestion.value = row as unknown as QuestionRow
  showDetail.value = true
}

function parentCategory(categoryId: string) {
  const cat = categories.value.find(c => c.id === categoryId)
  if (!cat || !cat.parent_id) return null
  return categories.value.find(c => c.id === cat.parent_id) ?? null
}

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return '–'
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
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
  created_at?: string
  category_name?: string
  category_slug?: string
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
        <span class="text-sm text-muted-foreground">
          {{ selectedIds.size }} sélectionnée(s)
          <template v-if="allFilteredSelected"> (toutes)</template>
        </span>

        <template v-if="!allFilteredSelected && total > PAGE_SIZE">
          <Button size="sm" variant="link" @click="selectAllFiltered" :disabled="selectingAll">
            {{ selectingAll ? 'Chargement...' : `Sélectionner les ${total} questions filtrées` }}
          </Button>
        </template>

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
        <Button size="sm" variant="destructive" @click="showBulkDelete = true">
          <Trash2 class="h-4 w-4 mr-1" /> Supprimer
        </Button>
        <Button size="sm" variant="ghost" @click="clearSelection">Désélectionner</Button>
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
      @row-click="openDetail"
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

    <!-- ══ Bulk Delete confirmation ══ -->
    <AlertDialog :open="showBulkDelete" @update:open="(v) => { if (!v) showBulkDelete = false }">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer {{ selectedIds.size }} questions ?</AlertDialogTitle>
          <AlertDialogDescription>
            Ces questions n'apparaîtront plus dans les matchs. Cette action est irréversible.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <Button variant="destructive" @click="bulkDeleteMutation.mutate()" :disabled="bulkDeleteMutation.isPending.value">
            {{ bulkDeleteMutation.isPending.value ? 'Suppression...' : 'Supprimer' }}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <!-- ══ Detail Sidebar (Sheet) ══ -->
    <Sheet v-model:open="showDetail">
      <SheetContent side="right" class="sm:max-w-xl w-full overflow-y-auto p-6">
        <SheetHeader>
          <SheetTitle>Détail de la question</SheetTitle>
          <SheetDescription>Toutes les informations liées à cette question</SheetDescription>
        </SheetHeader>

        <template v-if="detailQuestion">
          <div class="space-y-6 pt-4">
            <!-- Question text -->
            <div class="space-y-2">
              <div class="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <BookOpen class="h-4 w-4" />
                Question
              </div>
              <p class="text-base leading-relaxed">{{ detailQuestion.question_text }}</p>
            </div>

            <Separator />

            <!-- Answers -->
            <div class="space-y-2">
              <div class="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Layers class="h-4 w-4" />
                Réponses
              </div>
              <div class="space-y-2">
                <div
                  v-for="(answer, i) in detailQuestion.answers"
                  :key="i"
                  class="flex items-start gap-3 rounded-lg border px-3 py-2.5 text-sm"
                  :class="i === detailQuestion.correct_index
                    ? 'border-green-500/50 bg-green-500/5'
                    : 'border-border'"
                >
                  <span
                    class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                    :class="i === detailQuestion.correct_index
                      ? 'bg-green-500 text-white'
                      : 'bg-muted text-muted-foreground'"
                  >
                    {{ String.fromCharCode(65 + i) }}
                  </span>
                  <span class="flex-1 pt-0.5">{{ answer }}</span>
                  <Check v-if="i === detailQuestion.correct_index" class="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                </div>
              </div>
            </div>

            <Separator />

            <!-- Metadata grid -->
            <div class="grid grid-cols-2 gap-4">
              <!-- Category -->
              <div class="space-y-1">
                <div class="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Tag class="h-3.5 w-3.5" />
                  Catégorie
                </div>
                <div>
                  <template v-if="parentCategory(detailQuestion.category_id)">
                    <Badge variant="outline" class="text-xs">{{ parentCategory(detailQuestion.category_id)!.name }}</Badge>
                    <span class="text-muted-foreground mx-1">›</span>
                  </template>
                  <Badge variant="secondary" class="text-xs">{{ detailQuestion.category_name ?? categoryName(detailQuestion.category_id) }}</Badge>
                </div>
              </div>

              <!-- Difficulty -->
              <div class="space-y-1">
                <div class="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <BarChart3 class="h-3.5 w-3.5" />
                  Difficulté
                </div>
                <span
                  class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                  :class="difficultyColor(detailQuestion.difficulty)"
                >{{ difficultyLabel(detailQuestion.difficulty) }}</span>
              </div>

              <!-- Times played -->
              <div class="space-y-1">
                <div class="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Eye class="h-3.5 w-3.5" />
                  Fois jouée
                </div>
                <p class="text-sm font-medium">{{ detailQuestion.times_played }}</p>
              </div>

              <!-- Success rate -->
              <div class="space-y-1">
                <div class="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <BarChart3 class="h-3.5 w-3.5" />
                  Taux de réussite
                </div>
                <p class="text-sm font-medium">{{ successRate(detailQuestion.times_played, detailQuestion.times_correct) }}</p>
              </div>

              <!-- Verified -->
              <div class="space-y-1">
                <div class="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Check class="h-3.5 w-3.5" />
                  Vérifiée
                </div>
                <Badge :variant="detailQuestion.is_verified ? 'default' : 'outline'" class="text-xs">
                  {{ detailQuestion.is_verified ? 'Oui' : 'Non' }}
                </Badge>
              </div>

              <!-- Created at -->
              <div class="space-y-1">
                <div class="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Calendar class="h-3.5 w-3.5" />
                  Créée le
                </div>
                <p class="text-sm">{{ formatDate(detailQuestion.created_at) }}</p>
              </div>
            </div>

            <Separator />

            <!-- Apps -->
            <div class="space-y-2">
              <div class="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Tag class="h-4 w-4" />
                Applications
              </div>
              <div class="flex flex-wrap gap-2">
                <template v-if="(detailQuestion.flavor_slugs ?? []).length > 0">
                  <span
                    v-for="s in detailQuestion.flavor_slugs"
                    :key="s"
                    class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold text-white"
                    :style="{ backgroundColor: FLAVORS.find(f => f.slug === s)?.color ?? '#666' }"
                  >
                    {{ FLAVORS.find(f => f.slug === s)?.label ?? s }}
                  </span>
                </template>
                <span v-else class="text-sm text-muted-foreground italic">Aucune application associée</span>
              </div>
            </div>

            <!-- Explanation -->
            <template v-if="detailQuestion.explanation">
              <Separator />
              <div class="space-y-2">
                <div class="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <BookOpen class="h-4 w-4" />
                  Explication
                </div>
                <p class="text-sm leading-relaxed text-muted-foreground bg-muted/50 rounded-lg p-3">
                  {{ detailQuestion.explanation }}
                </p>
              </div>
            </template>

            <!-- ID -->
            <Separator />
            <div class="space-y-1">
              <div class="text-xs font-medium text-muted-foreground">ID</div>
              <p class="text-xs text-muted-foreground font-mono select-all">{{ detailQuestion.id }}</p>
            </div>

            <!-- Actions -->
            <div class="flex gap-2 pt-2">
              <Button size="sm" @click="showDetail = false; openEdit(detailQuestion!)">
                <Pencil class="h-4 w-4 mr-1" /> Modifier
              </Button>
              <Button size="sm" variant="destructive" @click="showDetail = false; openDelete(detailQuestion!.id)">
                <Trash2 class="h-4 w-4 mr-1" /> Supprimer
              </Button>
            </div>
          </div>
        </template>
      </SheetContent>
    </Sheet>
  </div>
</template>
