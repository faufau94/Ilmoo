<script setup lang="ts">
import { ref, computed, watch } from 'vue'
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

const modalTab = ref<'create' | 'import'>('create')
const form = ref(emptyForm())

function emptyForm() {
  return {
    question_text: '',
    answers: ['', '', '', ''],
    correct_index: 0,
    category_id: '',
    difficulty: 'medium' as string,
    explanation: '',
    flavor_ids: [activeFlavor.value] as string[],
  }
}

watch(showCreate, (v) => {
  if (v) { form.value = emptyForm(); modalTab.value = 'create' }
})
watch(showImport, (v) => {
  if (v) { modalTab.value = 'import' }
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
</script>

<template>
  <Dialog v-model:open="showModal">
    <DialogContent class="max-w-2xl">
      <DialogHeader>
        <DialogTitle>Nouvelle question</DialogTitle>
        <DialogDescription>Créez ou importez des questions</DialogDescription>
      </DialogHeader>

      <Tabs v-model="modalTab" class="w-full">
        <TabsList class="grid w-full grid-cols-2">
          <TabsTrigger value="create">Créer</TabsTrigger>
          <TabsTrigger value="import">Importer (JSON)</TabsTrigger>
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
                    :checked="form.flavor_ids.includes(f.slug)"
                    @update:checked="form.flavor_ids = form.flavor_ids.includes(f.slug) ? form.flavor_ids.filter(s => s !== f.slug) : [...form.flavor_ids, f.slug]"
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

        <TabsContent value="import">
          <div class="space-y-4 pt-2">
            <Textarea
              v-model="importJson"
              :rows="12"
              placeholder='[{"question_text": "...", "answers": ["A", "B", "C", "D"], "correct_index": 0, "category_id": "...", "difficulty": "medium"}]'
              class="font-mono text-sm"
            />
            <p v-if="importError" class="text-sm text-destructive">{{ importError }}</p>
            <DialogFooter>
              <Button variant="outline" @click="showModal = false">Annuler</Button>
              <Button @click="importMutation.mutate()" :disabled="importMutation.isPending.value || !importJson.trim()">
                {{ importMutation.isPending.value ? 'Import...' : 'Importer' }}
              </Button>
            </DialogFooter>
          </div>
        </TabsContent>
      </Tabs>
    </DialogContent>
  </Dialog>
</template>
