<script setup lang="ts">
import { ref, computed, watch, watchEffect } from 'vue'
import { useRouter } from 'vue-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import { getCategories, createQuestion, importQuestions } from '@/lib/api'
import { useQuestionDialog } from '@/composables/useQuestionDialog'
import { useFlavor, FLAVORS } from '@/composables/useFlavor'
import { useToast } from '@/composables/useToast'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import SelectSearch from '@/components/ui/select/SelectSearch.vue'
import { Checkbox } from '@/components/ui/checkbox'

const router = useRouter()
const toast = useToast()
const queryClient = useQueryClient()
const { showCreate, showImport, closeCreate, closeImport } = useQuestionDialog()
const { activeFlavor } = useFlavor()

const { data: categoriesData } = useQuery({
  queryKey: ['categories-all'],
  queryFn: getCategories,
})
const categories = computed(() => (categoriesData.value?.data ?? []) as { id: string; name: string; slug: string; parent_id: string | null }[])

const modalTab = ref<'create' | 'import-json' | 'import-csv'>('create')
const form = ref(emptyForm())

function emptyForm() {
  const flavor = activeFlavor.value || 'ilmoo'
  return {
    question_text: '',
    answers: ['', '', '', ''],
    correct_index: 0,
    category_id: '',
    difficulty: 'medium' as string,
    explanation: '',
    flavor_ids: [flavor] as string[],
  }
}

watch(showCreate, (v) => {
  if (v) { form.value = emptyForm(); modalTab.value = 'create' }
})
watch(showImport, (v) => {
  if (v) { modalTab.value = 'import-json' }
})
// When activeFlavor changes while form is open, update the default selection
watch(activeFlavor, (newFlavor) => {
  if (showCreate.value) {
    form.value.flavor_ids = [newFlavor]
  }
  if (showModal.value) {
    importFlavorIds.value = [newFlavor]
  }
})

const showModal = computed({
  get: () => showCreate.value || showImport.value,
  set: (v) => { if (!v) { closeCreate(); closeImport() } },
})

const saveMutation = useMutation({
  mutationFn: () => createQuestion({ ...form.value }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['questions'] })
    closeCreate()
    toast.success('Question créée')
    if (router.currentRoute.value.path !== '/questions') {
      router.push('/questions')
    }
  },
  onError: (err: Error) => {
    toast.error('Erreur', err.message)
  },
})

// ── Import shared state ──
const importFlavorIds = ref<string[]>([activeFlavor.value])

// ── JSON import ──
const importJson = ref('')
const importError = ref('')

function downloadJsonTemplate() {
  const template = [
    {
      question_text: 'Quelle est la capitale de la France ?',
      answers: ['Paris', 'Lyon', 'Marseille', 'Bordeaux'],
      correct_index: 0,
      category_id: 'UUID-de-la-categorie',
      difficulty: 'easy',
      explanation: 'Paris est la capitale et la plus grande ville de France.',
    },
  ]
  const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'questions_modele.json'
  a.click()
  URL.revokeObjectURL(url)
}

const importJsonMutation = useMutation({
  mutationFn: () => {
    const parsed = JSON.parse(importJson.value)
    if (!Array.isArray(parsed)) throw new Error('Le JSON doit être un tableau')
    return importQuestions(parsed, importFlavorIds.value)
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['questions'] })
    closeImport()
    importJson.value = ''
    importError.value = ''
    toast.success('Import réussi')
    if (router.currentRoute.value.path !== '/questions') {
      router.push('/questions')
    }
  },
  onError: (err: Error) => {
    importError.value = err.message
    toast.error('Erreur d\'import', err.message)
  },
})

// ── CSV import ──
const csvFile = ref<File | null>(null)
const csvPreview = ref<Record<string, unknown>[]>([])
const csvError = ref('')

function downloadCsvTemplate() {
  const header = 'question_text;answer_a;answer_b;answer_c;answer_d;correct_index;category_id;difficulty;explanation'
  const example = 'Quelle est la capitale de la France ?;Paris;Lyon;Marseille;Bordeaux;0;UUID-de-la-categorie;easy;Paris est la capitale de France.'
  const content = header + '\n' + example + '\n'
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'questions_modele.csv'
  a.click()
  URL.revokeObjectURL(url)
}

function parseCsv(text: string): Record<string, unknown>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) throw new Error('Le CSV doit contenir au moins un en-tête et une ligne de données')

  const headers = lines[0]!.split(';').map((h) => h.trim())
  const required = ['question_text', 'answer_a', 'answer_b', 'answer_c', 'answer_d', 'correct_index', 'category_id']
  for (const r of required) {
    if (!headers.includes(r)) throw new Error(`Colonne manquante : ${r}`)
  }

  const result: Record<string, unknown>[] = []
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i]!.split(';').map((v) => v.trim())
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => { row[h] = values[idx] ?? '' })

    result.push({
      question_text: row['question_text'],
      answers: [row['answer_a'], row['answer_b'], row['answer_c'], row['answer_d']],
      correct_index: parseInt(row['correct_index'] ?? '0', 10),
      category_id: row['category_id'],
      difficulty: row['difficulty'] || 'medium',
      explanation: row['explanation'] || undefined,
    })
  }
  return result
}

async function handleCsvFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  csvFile.value = file
  csvError.value = ''
  csvPreview.value = []

  try {
    const text = await file.text()
    csvPreview.value = parseCsv(text)
  } catch (err) {
    csvError.value = (err as Error).message
    csvPreview.value = []
  }
}

const importCsvMutation = useMutation({
  mutationFn: () => {
    if (csvPreview.value.length === 0) throw new Error('Aucune question à importer')
    return importQuestions(csvPreview.value, importFlavorIds.value)
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['questions'] })
    closeImport()
    csvFile.value = null
    csvPreview.value = []
    csvError.value = ''
    toast.success('Import CSV réussi')
    if (router.currentRoute.value.path !== '/questions') {
      router.push('/questions')
    }
  },
  onError: (err: Error) => {
    csvError.value = err.message
    toast.error('Erreur d\'import CSV', err.message)
  },
})
</script>

<template>
  <Dialog v-model:open="showModal">
    <DialogContent class="max-w-2xl">
      <DialogHeader>
        <DialogTitle>Nouvelle question</DialogTitle>
        <DialogDescription>Créez ou importez des questions</DialogDescription>
      </DialogHeader>

      <Tabs v-model="modalTab" class="w-full">
        <TabsList class="grid w-full grid-cols-3">
          <TabsTrigger value="create">Créer</TabsTrigger>
          <TabsTrigger value="import-json">Import JSON</TabsTrigger>
          <TabsTrigger value="import-csv">Import CSV</TabsTrigger>
        </TabsList>

        <TabsContent value="create">
          <form class="space-y-4 pt-2" @submit.prevent="saveMutation.mutate()">
            <div class="space-y-2">
              <Label>Question</Label>
              <Textarea v-model="form.question_text" :rows="3" required />
            </div>
            <div class="space-y-3">
              <Label>Réponses (4 obligatoires)</Label>
              <div v-for="(_, i) in form.answers" :key="i" class="flex items-center gap-2">
                <div
                  class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 cursor-pointer transition-colors"
                  :class="form.correct_index === i ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'"
                  @click="form.correct_index = i"
                >{{ String.fromCharCode(65 + i) }}</div>
                <Input v-model="form.answers[i]" :placeholder="`Réponse ${String.fromCharCode(65 + i)}`" required />
              </div>
              <p class="text-xs text-muted-foreground">Cliquez sur la lettre pour choisir la bonne réponse</p>
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
                  <SelectTrigger class="cursor-pointer"><SelectValue /></SelectTrigger>
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
              <Button variant="outline" type="button" @click="showModal = false">Annuler</Button>
              <Button type="submit" :disabled="saveMutation.isPending.value">
                {{ saveMutation.isPending.value ? 'Enregistrement...' : 'Enregistrer' }}
              </Button>
            </DialogFooter>
          </form>
        </TabsContent>

        <!-- JSON Import -->
        <TabsContent value="import-json">
          <div class="space-y-4 pt-2">
            <div class="flex items-center justify-between">
              <div class="space-y-1">
                <Label>Applications cibles</Label>
                <div class="flex gap-4">
                  <label v-for="f in FLAVORS" :key="f.slug" class="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      :model-value="importFlavorIds.includes(f.slug)"
                      @update:model-value="importFlavorIds = importFlavorIds.includes(f.slug) ? importFlavorIds.filter(s => s !== f.slug) : [...importFlavorIds, f.slug]"
                    />
                    <span class="text-sm">{{ f.label }}</span>
                  </label>
                </div>
              </div>
              <Button variant="outline" size="sm" type="button" @click="downloadJsonTemplate">
                Télécharger le modèle
              </Button>
            </div>
            <Textarea
              v-model="importJson"
              :rows="10"
              placeholder='[{"question_text": "...", "answers": ["A", "B", "C", "D"], "correct_index": 0, "category_id": "...", "difficulty": "medium"}]'
              class="font-mono text-sm"
            />
            <p v-if="importError" class="text-sm text-destructive">{{ importError }}</p>
            <DialogFooter>
              <Button variant="outline" @click="showModal = false">Annuler</Button>
              <Button @click="importJsonMutation.mutate()" :disabled="importJsonMutation.isPending.value || !importJson.trim()">
                {{ importJsonMutation.isPending.value ? 'Import...' : 'Importer' }}
              </Button>
            </DialogFooter>
          </div>
        </TabsContent>

        <!-- CSV Import -->
        <TabsContent value="import-csv">
          <div class="space-y-4 pt-2">
            <div class="flex items-center justify-between">
              <div class="space-y-1">
                <Label>Applications cibles</Label>
                <div class="flex gap-4">
                  <label v-for="f in FLAVORS" :key="f.slug" class="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      :model-value="importFlavorIds.includes(f.slug)"
                      @update:model-value="importFlavorIds = importFlavorIds.includes(f.slug) ? importFlavorIds.filter(s => s !== f.slug) : [...importFlavorIds, f.slug]"
                    />
                    <span class="text-sm">{{ f.label }}</span>
                  </label>
                </div>
              </div>
              <Button variant="outline" size="sm" type="button" @click="downloadCsvTemplate">
                Télécharger le modèle CSV
              </Button>
            </div>

            <div>
              <Label>Fichier CSV (séparateur : point-virgule)</Label>
              <Input type="file" accept=".csv" class="mt-1" @change="handleCsvFile" />
              <p class="text-xs text-muted-foreground mt-1">
                Colonnes : question_text ; answer_a ; answer_b ; answer_c ; answer_d ; correct_index ; category_id ; difficulty ; explanation
              </p>
            </div>

            <div v-if="csvPreview.length > 0" class="rounded border p-3 bg-muted/30 text-sm">
              <p class="font-medium mb-1">{{ csvPreview.length }} question(s) détectée(s)</p>
              <p class="text-muted-foreground truncate">{{ (csvPreview[0] as Record<string, unknown>)?.question_text }}</p>
              <p v-if="csvPreview.length > 1" class="text-muted-foreground">...et {{ csvPreview.length - 1 }} autre(s)</p>
            </div>

            <p v-if="csvError" class="text-sm text-destructive">{{ csvError }}</p>

            <DialogFooter>
              <Button variant="outline" @click="showModal = false">Annuler</Button>
              <Button @click="importCsvMutation.mutate()" :disabled="importCsvMutation.isPending.value || csvPreview.length === 0">
                {{ importCsvMutation.isPending.value ? 'Import...' : `Importer ${csvPreview.length} question(s)` }}
              </Button>
            </DialogFooter>
          </div>
        </TabsContent>
      </Tabs>
    </DialogContent>
  </Dialog>
</template>
