<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import {
  getQuestions,
  getCategories,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  importQuestions,
} from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Pencil, Trash2, Upload, Search } from 'lucide-vue-next'

const queryClient = useQueryClient()

// ── Filters ──
const search = ref('')
const filterCategory = ref('all')
const filterDifficulty = ref('all')
const filterVerified = ref('all')   // 'all' | 'true' | 'false'
const filterPlayed = ref('all')     // 'all' | '1' | '10' | '50'
const filterSuccess = ref('all')    // 'all' | 'low' (<=40%) | 'high' (>=80%)
const page = ref(0)
const limit = 20

const queryParams = computed(() => {
  const p: Record<string, string> = { limit: String(limit), offset: String(page.value * limit) }
  if (filterCategory.value !== 'all') p.categoryId = filterCategory.value
  if (filterDifficulty.value !== 'all') p.difficulty = filterDifficulty.value
  if (search.value.trim()) p.search = search.value.trim()
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
const totalQuestions = computed(() => questionsData.value?.pagination?.total ?? 0)
const categories = computed(() => (categoriesData.value?.data ?? []) as CategoryRow[])
const totalPages = computed(() => Math.ceil(totalQuestions.value / limit))

watch([filterCategory, filterDifficulty, filterVerified, filterPlayed, filterSuccess, search], () => { page.value = 0 })

// ── CRUD Dialog ──
const showDialog = ref(false)
const editingId = ref<string | null>(null)
const form = ref(emptyForm())

function emptyForm() {
  return {
    question_text: '',
    answers: ['', '', '', ''],
    correct_index: 0,
    category_id: '',
    difficulty: 'medium' as string,
    explanation: '',
  }
}

function openCreate() {
  editingId.value = null
  form.value = emptyForm()
  showDialog.value = true
}

function openEdit(q: QuestionRow) {
  editingId.value = q.id
  form.value = {
    question_text: q.question_text,
    answers: [...q.answers],
    correct_index: q.correct_index,
    category_id: q.category_id,
    difficulty: q.difficulty,
    explanation: q.explanation ?? '',
  }
  showDialog.value = true
}

const saveMutation = useMutation({
  mutationFn: () => {
    const body = { ...form.value }
    if (editingId.value) {
      return updateQuestion(editingId.value, body)
    }
    return createQuestion(body)
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['questions'] })
    showDialog.value = false
  },
})

// ── Delete ──
const deleteId = ref<string | null>(null)

const deleteMutation = useMutation({
  mutationFn: () => deleteQuestion(deleteId.value!),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['questions'] })
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

// ── Import ──
const showImport = ref(false)
const importJson = ref('')
const importError = ref('')

const importMutation = useMutation({
  mutationFn: () => {
    const parsed = JSON.parse(importJson.value)
    if (!Array.isArray(parsed)) throw new Error('Le JSON doit être un tableau')
    return importQuestions(parsed)
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['questions'] })
    showImport.value = false
    importJson.value = ''
    importError.value = ''
  },
  onError: (err: Error) => {
    importError.value = err.message
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
}

interface CategoryRow {
  id: string
  name: string
  slug: string
  parent_id: string | null
}
</script>

<template>
  <div class="p-8 space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold">Questions</h1>
        <p class="text-muted-foreground text-sm mt-1">{{ totalQuestions }} questions au total</p>
      </div>
      <div class="flex gap-2">
        <Button variant="outline" @click="showImport = true">
          <Upload class="h-4 w-4 mr-2" /> Importer
        </Button>
        <Button @click="openCreate">
          <Plus class="h-4 w-4 mr-2" /> Ajouter
        </Button>
      </div>
    </div>

    <!-- Filters -->
    <div class="flex flex-wrap gap-3">
      <div class="relative flex-1 min-w-50 max-w-sm">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input v-model="search" placeholder="Rechercher une question..." class="pl-9" />
      </div>
      <Select v-model="filterCategory">
        <SelectTrigger class="w-44">
          <SelectValue placeholder="Catégorie" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Toutes catégories</SelectItem>
          <SelectItem v-for="cat in categories" :key="cat.id" :value="cat.id">
            {{ cat.parent_id ? '└ ' : '' }}{{ cat.name }}
          </SelectItem>
        </SelectContent>
      </Select>
      <Select v-model="filterDifficulty">
        <SelectTrigger class="w-36">
          <SelectValue placeholder="Difficulté" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Difficulté</SelectItem>
          <SelectItem value="easy">Facile</SelectItem>
          <SelectItem value="medium">Moyen</SelectItem>
          <SelectItem value="hard">Difficile</SelectItem>
        </SelectContent>
      </Select>
      <Select v-model="filterVerified">
        <SelectTrigger class="w-36">
          <SelectValue placeholder="Vérifiée" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Vérification</SelectItem>
          <SelectItem value="true">Vérifiée</SelectItem>
          <SelectItem value="false">Non vérifiée</SelectItem>
        </SelectContent>
      </Select>
      <Select v-model="filterPlayed">
        <SelectTrigger class="w-36">
          <SelectValue placeholder="Jouée" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Fois jouée</SelectItem>
          <SelectItem value="1">Jouée ≥ 1×</SelectItem>
          <SelectItem value="10">Jouée ≥ 10×</SelectItem>
          <SelectItem value="50">Jouée ≥ 50×</SelectItem>
        </SelectContent>
      </Select>
      <Select v-model="filterSuccess">
        <SelectTrigger class="w-40">
          <SelectValue placeholder="Réussite" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Taux réussite</SelectItem>
          <SelectItem value="low">Difficile (≤ 40%)</SelectItem>
          <SelectItem value="high">Facile (≥ 80%)</SelectItem>
        </SelectContent>
      </Select>
    </div>

    <!-- Table -->
    <Card>
      <CardContent class="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead class="w-[40%]">Question</TableHead>
              <TableHead>Catégorie</TableHead>
              <TableHead>Difficulté</TableHead>
              <TableHead class="text-right">Jouée</TableHead>
              <TableHead class="text-right">Réussite</TableHead>
              <TableHead class="text-center">Vérifié</TableHead>
              <TableHead class="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-if="isLoading">
              <TableCell colspan="7" class="text-center py-8 text-muted-foreground">
                Chargement...
              </TableCell>
            </TableRow>
            <TableRow v-else-if="questions.length === 0">
              <TableCell colspan="7" class="text-center py-8 text-muted-foreground">
                Aucune question trouvée
              </TableCell>
            </TableRow>
            <TableRow v-for="q in questions" :key="q.id">
              <TableCell class="max-w-[300px] truncate font-medium">
                {{ q.question_text }}
              </TableCell>
              <TableCell>
                <Badge variant="outline">{{ q.category_name || categoryName(q.category_id) }}</Badge>
              </TableCell>
              <TableCell>
                <span
                  class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                  :class="difficultyColor(q.difficulty)"
                >
                  {{ difficultyLabel(q.difficulty) }}
                </span>
              </TableCell>
              <TableCell class="text-right">{{ q.times_played }}</TableCell>
              <TableCell class="text-right">{{ successRate(q.times_played, q.times_correct) }}</TableCell>
              <TableCell class="text-center">
                <Switch
                  :model-value="q.is_verified"
                  @update:model-value="verifyMutation.mutate({ id: q.id, verified: $event as boolean })"
                />
              </TableCell>
              <TableCell class="text-right">
                <div class="flex justify-end gap-1">
                  <Button variant="ghost" size="icon" @click="openEdit(q)">
                    <Pencil class="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" @click="deleteId = q.id">
                    <Trash2 class="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>

    <!-- Pagination -->
    <div v-if="totalPages > 1" class="flex items-center justify-between">
      <p class="text-sm text-muted-foreground">
        Page {{ page + 1 }} / {{ totalPages }}
      </p>
      <div class="flex gap-2">
        <Button variant="outline" size="sm" :disabled="page === 0" @click="page--">
          Précédent
        </Button>
        <Button variant="outline" size="sm" :disabled="page >= totalPages - 1" @click="page++">
          Suivant
        </Button>
      </div>
    </div>

    <!-- ══ Create/Edit Dialog ══ -->
    <Dialog v-model:open="showDialog">
      <DialogContent class="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{{ editingId ? 'Modifier la question' : 'Nouvelle question' }}</DialogTitle>
        </DialogHeader>

        <form class="space-y-4" @submit.prevent="saveMutation.mutate()">
          <div class="space-y-2">
            <Label>Question</Label>
            <Textarea v-model="form.question_text" :rows="3" required />
          </div>

          <div class="space-y-3">
            <Label>Réponses (4 obligatoires)</Label>
            <div v-for="(_, i) in form.answers" :key="i" class="flex items-center gap-2">
              <div
                class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 cursor-pointer transition-colors"
                :class="form.correct_index === i
                  ? 'bg-green-500 text-white'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'"
                @click="form.correct_index = i"
                title="Marquer comme bonne réponse"
              >
                {{ String.fromCharCode(65 + i) }}
              </div>
              <Input v-model="form.answers[i]" :placeholder="`Réponse ${String.fromCharCode(65 + i)}`" required />
            </div>
            <p class="text-xs text-muted-foreground">Cliquez sur la lettre pour choisir la bonne réponse</p>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-2">
              <Label>Catégorie</Label>
              <Select v-model="form.category_id" required>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="cat in categories" :key="cat.id" :value="cat.id">
                    {{ cat.parent_id ? '  └ ' : '' }}{{ cat.name }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div class="space-y-2">
              <Label>Difficulté</Label>
              <Select v-model="form.difficulty">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
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
            <Textarea v-model="form.explanation" :rows="2" placeholder="Explication affichée après la réponse..." />
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

    <!-- ══ Delete confirmation ══ -->
    <AlertDialog :open="!!deleteId" @update:open="deleteId = null">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer cette question ?</AlertDialogTitle>
          <AlertDialogDescription>
            La question sera désactivée (soft delete). Elle n'apparaîtra plus dans les matchs.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction @click="deleteMutation.mutate()">Supprimer</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <!-- ══ Import Dialog ══ -->
    <Dialog v-model:open="showImport">
      <DialogContent class="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importer des questions (JSON)</DialogTitle>
        </DialogHeader>

        <div class="space-y-4">
          <Textarea
            v-model="importJson"
            :rows="12"
            placeholder='[{"question_text": "...", "answers": ["A", "B", "C", "D"], "correct_index": 0, "category_id": "...", "difficulty": "medium"}]'
            class="font-mono text-sm"
          />
          <p v-if="importError" class="text-sm text-destructive">{{ importError }}</p>

          <DialogFooter>
            <Button variant="outline" @click="showImport = false">Annuler</Button>
            <Button @click="importMutation.mutate()" :disabled="importMutation.isPending.value || !importJson.trim()">
              {{ importMutation.isPending.value ? 'Import...' : 'Importer' }}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>
