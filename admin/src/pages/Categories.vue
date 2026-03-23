<script setup lang="ts">
import { ref, computed } from 'vue'
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import { getCategories, createCategory, updateCategory, deleteCategory } from '@/lib/api'
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
import { Plus, Pencil, Trash2, FolderPlus } from 'lucide-vue-next'

const queryClient = useQueryClient()

const { data: categoriesData, isLoading } = useQuery({
  queryKey: ['categories-all'],
  queryFn: getCategories,
})

const allCategories = computed(() => (categoriesData.value?.data ?? []) as CategoryRow[])
const rootCategories = computed(() => allCategories.value.filter(c => !c.parent_id))

function subcategoriesOf(parentId: string) {
  return allCategories.value.filter(c => c.parent_id === parentId)
}

// ── CRUD Dialog ──
const showDialog = ref(false)
const editingId = ref<string | null>(null)
const form = ref(emptyForm())

function emptyForm() {
  return {
    name: '',
    slug: '',
    description: '',
    icon_name: '',
    color: '#52B788',
    parent_id: 'none' as string,
    is_premium: false,
    sort_order: 0,
  }
}

function autoSlug(name: string) {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function openCreate(parentId?: string) {
  editingId.value = null
  form.value = emptyForm()
  if (parentId) form.value.parent_id = parentId
  showDialog.value = true
}

function openEdit(cat: CategoryRow) {
  editingId.value = cat.id
  form.value = {
    name: cat.name,
    slug: cat.slug,
    description: cat.description ?? '',
    icon_name: cat.icon_name ?? '',
    color: cat.color ?? '#52B788',
    parent_id: cat.parent_id ?? 'none',
    is_premium: cat.is_premium,
    sort_order: cat.sort_order,
  }
  showDialog.value = true
}

const saveMutation = useMutation({
  mutationFn: () => {
    const body: Record<string, unknown> = {
      name: form.value.name,
      slug: form.value.slug,
      description: form.value.description || null,
      icon_name: form.value.icon_name || null,
      color: form.value.color,
      is_premium: form.value.is_premium,
      sort_order: form.value.sort_order,
    }
    if (form.value.parent_id && form.value.parent_id !== 'none') body.parent_id = form.value.parent_id
    if (editingId.value) {
      return updateCategory(editingId.value, body)
    }
    return createCategory(body)
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['categories-all'] })
    showDialog.value = false
  },
})

// ── Delete ──
const deleteTarget = ref<CategoryRow | null>(null)

const deleteMutation = useMutation({
  mutationFn: () => deleteCategory(deleteTarget.value!.id),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['categories-all'] })
    deleteTarget.value = null
  },
})

// ── Toggle active ──
const toggleMutation = useMutation({
  mutationFn: ({ id, active }: { id: string; active: boolean }) =>
    updateCategory(id, { is_active: active }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['categories-all'] })
  },
})

// ── Types ──
interface CategoryRow {
  id: string
  name: string
  slug: string
  description: string | null
  icon_name: string | null
  color: string | null
  parent_id: string | null
  is_premium: boolean
  is_active: boolean
  sort_order: number
  question_count: number
}
</script>

<template>
  <div class="p-8 space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold">Catégories</h1>
        <p class="text-muted-foreground text-sm mt-1">
          {{ rootCategories.length }} catégories au total · {{ allCategories.length - rootCategories.length }} sous-catégories
        </p>
      </div>
      <Button @click="openCreate()">
        <Plus class="h-4 w-4 mr-2" /> Ajouter une catégorie
      </Button>
    </div>

    <!-- Table -->
    <Card>
      <CardContent class="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead class="w-12"></TableHead>
              <TableHead>Nom</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead class="text-right">Questions</TableHead>
              <TableHead class="text-center">Premium</TableHead>
              <TableHead class="text-center">Actif</TableHead>
              <TableHead class="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <template v-if="isLoading">
              <TableRow>
                <TableCell colspan="7" class="text-center py-8 text-muted-foreground">
                  Chargement...
                </TableCell>
              </TableRow>
            </template>
            <template v-else-if="rootCategories.length === 0">
              <TableRow>
                <TableCell colspan="7" class="text-center py-8 text-muted-foreground">
                  Aucune catégorie
                </TableCell>
              </TableRow>
            </template>
            <template v-else v-for="root in rootCategories" :key="root.id">
              <!-- Root category -->
              <TableRow class="bg-muted/30">
                <TableCell>
                  <div
                    class="w-6 h-6 rounded-full"
                    :style="{ backgroundColor: root.color ?? '#888' }"
                  />
                </TableCell>
                <TableCell class="font-semibold">{{ root.name }}</TableCell>
                <TableCell class="text-muted-foreground text-sm">{{ root.slug }}</TableCell>
                <TableCell class="text-right">{{ root.question_count }}</TableCell>
                <TableCell class="text-center">
                  <Badge v-if="root.is_premium" variant="secondary">Premium</Badge>
                </TableCell>
                <TableCell class="text-center">
                  <Switch
                    :model-value="root.is_active"
                    @update:model-value="toggleMutation.mutate({ id: root.id, active: $event as boolean })"
                  />
                </TableCell>
                <TableCell class="text-right">
                  <div class="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" title="Ajouter sous-catégorie" @click="openCreate(root.id)">
                      <FolderPlus class="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" @click="openEdit(root)">
                      <Pencil class="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" @click="deleteTarget = root">
                      <Trash2 class="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
              <!-- Subcategories -->
              <TableRow v-for="sub in subcategoriesOf(root.id)" :key="sub.id">
                <TableCell>
                  <div class="ml-4 w-4 h-4 rounded-full" :style="{ backgroundColor: sub.color ?? root.color ?? '#888' }" />
                </TableCell>
                <TableCell class="pl-8 text-sm">└ {{ sub.name }}</TableCell>
                <TableCell class="text-muted-foreground text-sm">{{ sub.slug }}</TableCell>
                <TableCell class="text-right">{{ sub.question_count }}</TableCell>
                <TableCell class="text-center">
                  <Badge v-if="sub.is_premium" variant="secondary">Premium</Badge>
                </TableCell>
                <TableCell class="text-center">
                  <Switch
                    :model-value="sub.is_active"
                    @update:model-value="toggleMutation.mutate({ id: sub.id, active: $event as boolean })"
                  />
                </TableCell>
                <TableCell class="text-right">
                  <div class="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" @click="openEdit(sub)">
                      <Pencil class="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" @click="deleteTarget = sub">
                      <Trash2 class="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            </template>
          </TableBody>
        </Table>
      </CardContent>
    </Card>

    <!-- ══ Create/Edit Dialog ══ -->
    <Dialog v-model:open="showDialog">
      <DialogContent class="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {{ editingId ? 'Modifier la catégorie' : (form.parent_id ? 'Nouvelle sous-catégorie' : 'Nouvelle catégorie') }}
          </DialogTitle>
        </DialogHeader>

        <form class="space-y-4" @submit.prevent="saveMutation.mutate()">
          <div class="space-y-2">
            <Label>Parent</Label>
            <Select v-model="form.parent_id" :disabled="!!editingId">
              <SelectTrigger>
                <SelectValue placeholder="Aucun (catégorie racine)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Aucun (racine)</SelectItem>
                <SelectItem v-for="cat in rootCategories" :key="cat.id" :value="cat.id">
                  {{ cat.name }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-2">
              <Label>Nom</Label>
              <Input
                v-model="form.name"
                required
                @input="!editingId && (form.slug = autoSlug(form.name))"
              />
            </div>
            <div class="space-y-2">
              <Label>Slug</Label>
              <Input v-model="form.slug" required />
            </div>
          </div>

          <div class="space-y-2">
            <Label>Description</Label>
            <Textarea v-model="form.description" :rows="2" />
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-2">
              <Label>Icône</Label>
              <Input v-model="form.icon_name" placeholder="ex: science, geography" />
            </div>
            <div class="space-y-2">
              <Label>Couleur</Label>
              <div class="flex items-center gap-2">
                <input
                  type="color"
                  :value="form.color"
                  @input="form.color = ($event.target as HTMLInputElement).value"
                  class="w-10 h-10 rounded cursor-pointer border-0"
                />
                <Input v-model="form.color" class="flex-1" />
              </div>
            </div>
          </div>

          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <Switch v-model:model-value="form.is_premium" />
              <Label>Catégorie premium</Label>
            </div>
            <div class="space-y-1">
              <Label class="text-xs text-muted-foreground">Ordre d'affichage</Label>
              <Input type="number" v-model.number="form.sort_order" class="w-20" min="0" />
            </div>
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
    <AlertDialog :open="!!deleteTarget" @update:open="deleteTarget = null">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer « {{ deleteTarget?.name }} » ?</AlertDialogTitle>
          <AlertDialogDescription>
            <template v-if="!deleteTarget?.parent_id">
              Cette catégorie racine et toutes ses sous-catégories seront supprimées.
              Les questions associées ne seront pas supprimées mais ne seront plus rattachées.
            </template>
            <template v-else>
              Cette sous-catégorie sera supprimée.
            </template>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction @click="deleteMutation.mutate()">Supprimer</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
