<script setup lang="ts">
import { ref, computed, h } from 'vue'
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import { getCategories, createCategory, updateCategory, deleteCategory, bulkUpdateCategoryFlavors } from '@/lib/api'
import { useToast } from '@/composables/useToast'
import { useFlavor, FLAVORS } from '@/composables/useFlavor'
import type { ColumnDef } from '@tanstack/vue-table'
import DataTable from '@/components/DataTable.vue'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Plus, Pencil, Trash2, FolderPlus } from 'lucide-vue-next'
import { Checkbox } from '@/components/ui/checkbox'

const toast = useToast()
const queryClient = useQueryClient()

const { data: categoriesData, isLoading } = useQuery({
  queryKey: ['categories-all'],
  queryFn: getCategories,
})

const allCategories = computed(() => (categoriesData.value?.data ?? []) as CategoryRow[])
const rootCategories = computed(() => allCategories.value.filter(c => !c.parent_id))

// ── Filters ──
const filterStatus = ref('all')   // all | active | inactive
const filterPremium = ref('all')  // all | premium | free
const filterLevel = ref('all')    // all | root | sub
const filterApp = ref('all')      // all | ilmoo | quizapp

// Flat list for the DataTable (root + subcategories interleaved)
const flatRows = computed<CategoryRow[]>(() => {
  const rows: CategoryRow[] = []
  for (const root of rootCategories.value) {
    const subs = allCategories.value.filter(c => c.parent_id === root.id)

    // Apply filters
    const matchRoot = matchesFilters(root)
    const matchingSubs = subs.filter(s => matchesFilters(s))

    // Show root if it matches, or if any of its subs match
    if (filterLevel.value === 'sub') {
      // Only show subs
      matchingSubs.forEach(s => rows.push(s))
    } else if (filterLevel.value === 'root') {
      if (matchRoot) rows.push(root)
    } else {
      if (matchRoot || matchingSubs.length > 0) {
        rows.push(root)
        if (matchRoot) {
          matchingSubs.forEach(s => rows.push(s))
        } else {
          matchingSubs.forEach(s => rows.push(s))
        }
      }
    }
  }
  return rows
})

function matchesFilters(cat: CategoryRow) {
  if (filterStatus.value === 'active' && !cat.is_active) return false
  if (filterStatus.value === 'inactive' && cat.is_active) return false
  if (filterPremium.value === 'premium' && !cat.is_premium) return false
  if (filterPremium.value === 'free' && cat.is_premium) return false
  if (filterApp.value !== 'all' && !(cat.flavor_slugs ?? []).includes(filterApp.value)) return false
  return true
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
      icon_name: form.value.icon_name || 'default',
      color: form.value.color,
      is_premium: form.value.is_premium,
      sort_order: form.value.sort_order,
    }
    if (form.value.parent_id && form.value.parent_id !== 'none') body.parent_id = form.value.parent_id
    if (editingId.value) return updateCategory(editingId.value, body)
    return createCategory(body)
  },
  onSuccess: () => {
    const isEdit = !!editingId.value
    showDialog.value = false
    editingId.value = null
    queryClient.invalidateQueries({ queryKey: ['categories-all'] })
    toast.success(isEdit ? 'Catégorie mise à jour' : 'Catégorie créée')
  },
  onError: (err: Error) => {
    toast.error('Erreur', err.message)
  },
})

// ── Delete ──
const deleteTarget = ref<CategoryRow | null>(null)

const deleteMutation = useMutation({
  mutationFn: (id: string) => deleteCategory(id),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['categories-all'] })
    toast.success('Catégorie supprimée')
    deleteTarget.value = null
  },
  onError: (err: Error) => {
    toast.error('Erreur', err.message)
    deleteTarget.value = null
  },
})

function confirmDelete() {
  const id = deleteTarget.value?.id
  if (!id) return
  deleteTarget.value = null
  deleteMutation.mutate(id)
}

// ── Toggle active ──
const toggleMutation = useMutation({
  mutationFn: ({ id, active }: { id: string; active: boolean }) =>
    updateCategory(id, { is_active: active }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['categories-all'] })
  },
})

// ── Category-Flavor toggle ──
const flavorToggleMutation = useMutation({
  mutationFn: ({ categoryId, flavorSlug, action }: { categoryId: string; flavorSlug: string; action: 'add' | 'remove' }) =>
    bulkUpdateCategoryFlavors([categoryId], action, [flavorSlug]),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['categories-all'] })
  },
  onError: (err: Error) => toast.error('Erreur', err.message),
})

function isCategoryInFlavor(cat: CategoryRow, flavorSlug: string): boolean {
  return (cat.flavor_slugs ?? []).includes(flavorSlug)
}

function toggleCategoryFlavor(cat: CategoryRow, flavorSlug: string) {
  const isIn = isCategoryInFlavor(cat, flavorSlug)
  flavorToggleMutation.mutate({
    categoryId: cat.id,
    flavorSlug,
    action: isIn ? 'remove' : 'add',
  })
}

// ── TanStack Table columns ──
const columns: ColumnDef<CategoryRow, unknown>[] = [
  {
    id: 'color',
    header: '',
    size: 40,
    cell: ({ row }) => h('div', {
      class: row.original.parent_id ? 'ml-4 w-4 h-4 rounded-full' : 'w-6 h-6 rounded-full',
      style: { backgroundColor: row.original.color ?? '#888' },
    }),
  },
  {
    accessorKey: 'name',
    header: 'Nom',
    cell: ({ row }) => h('span', {
      class: row.original.parent_id ? 'pl-6 text-sm' : 'font-semibold',
    }, (row.original.parent_id ? '└ ' : '') + row.original.name),
  },
  {
    accessorKey: 'slug',
    header: 'Slug',
    cell: ({ row }) => h('span', { class: 'text-muted-foreground text-sm' }, row.original.slug),
  },
  {
    accessorKey: 'question_count',
    header: 'Questions',
    meta: { align: 'right' },
    cell: ({ row }) => h('span', { class: 'text-right block' }, String(row.original.question_count)),
  },
  {
    id: 'premium',
    header: 'Premium',
    cell: ({ row }) => row.original.is_premium
      ? h(Badge, { variant: 'secondary' }, () => 'Premium')
      : null,
  },
  ...FLAVORS.map(flavor => ({
    id: `flavor-${flavor.slug}`,
    header: () => h('span', {
      class: 'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold text-white',
      style: { backgroundColor: flavor.color },
    }, flavor.initials),
    cell: ({ row }: { row: { original: CategoryRow } }) => h(Checkbox, {
      modelValue: isCategoryInFlavor(row.original, flavor.slug),
      'onUpdate:modelValue': () => toggleCategoryFlavor(row.original, flavor.slug),
    }),
    enableSorting: false,
  } as ColumnDef<CategoryRow, unknown>)),
  {
    id: 'active',
    header: 'Actif',
    cell: ({ row }) => h(Switch, {
      modelValue: row.original.is_active,
      'onUpdate:modelValue': (val: boolean) =>
        toggleMutation.mutate({ id: row.original.id, active: val }),
    }),
  },
  {
    id: 'actions',
    header: '',
    cell: ({ row }) => {
      const cat = row.original
      const btns = []
      if (!cat.parent_id) {
        btns.push(h(Button, {
          variant: 'ghost', size: 'icon', class: 'cursor-pointer', title: 'Ajouter sous-catégorie',
          onClick: () => openCreate(cat.id),
        }, () => h(FolderPlus, { class: 'h-4 w-4' })))
      }
      btns.push(
        h(Button, { variant: 'ghost', size: 'icon', class: 'cursor-pointer', onClick: () => openEdit(cat) },
          () => h(Pencil, { class: 'h-4 w-4' })),
        h(Button, { variant: 'ghost', size: 'icon', class: 'cursor-pointer', onClick: () => { deleteTarget.value = cat } },
          () => h(Trash2, { class: 'h-4 w-4 text-destructive' })),
      )
      return h('div', { class: 'flex justify-end gap-1' }, btns)
    },
  },
]

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
  flavor_slugs?: string[]
}
</script>

<template>
  <div class="p-8 space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold">Catégories</h1>
        <p class="text-muted-foreground text-sm mt-1">
          {{ rootCategories.length }} catégories · {{ allCategories.length - rootCategories.length }} sous-catégories
        </p>
      </div>
      <Button @click="openCreate()" class="cursor-pointer">
        <Plus class="h-4 w-4 mr-2" /> Ajouter une catégorie
      </Button>
    </div>

    <DataTable
      :data="flatRows"
      :columns="columns"
      :loading="isLoading"
      search-placeholder="Rechercher une catégorie..."
    >
      <template #filters>
          <Select v-model="filterApp">
            <SelectTrigger class="w-36"><SelectValue placeholder="Application" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les apps</SelectItem>
              <SelectItem v-for="f in FLAVORS" :key="f.slug" :value="f.slug">{{ f.label }}</SelectItem>
            </SelectContent>
          </Select>
          <Select v-model="filterStatus">
            <SelectTrigger class="w-36"><SelectValue placeholder="Statut" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="active">Actif</SelectItem>
              <SelectItem value="inactive">Inactif</SelectItem>
            </SelectContent>
          </Select>
          <Select v-model="filterPremium">
            <SelectTrigger class="w-36"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les types</SelectItem>
              <SelectItem value="premium">Premium</SelectItem>
              <SelectItem value="free">Gratuit</SelectItem>
            </SelectContent>
          </Select>
          <Select v-model="filterLevel">
            <SelectTrigger class="w-44"><SelectValue placeholder="Niveau" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Catégories et sous</SelectItem>
              <SelectItem value="root">Catégories racines</SelectItem>
              <SelectItem value="sub">Sous-catégories</SelectItem>
            </SelectContent>
          </Select>
      </template>
    </DataTable>

    <!-- ══ Create/Edit Dialog ══ -->
    <Dialog v-model:open="showDialog">
      <DialogContent class="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {{ editingId ? 'Modifier la catégorie' : (form.parent_id !== 'none' ? 'Nouvelle sous-catégorie' : 'Nouvelle catégorie') }}
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
    <AlertDialog :open="!!deleteTarget" @update:open="(v: boolean) => { if (!v) deleteTarget = null }">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer « {{ deleteTarget?.name }} » ?</AlertDialogTitle>
          <AlertDialogDescription>
            <template v-if="!deleteTarget?.parent_id">
              Cette catégorie racine et toutes ses sous-catégories seront supprimées.
            </template>
            <template v-else>
              Cette sous-catégorie sera supprimée.
            </template>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <Button variant="destructive" @click="confirmDelete">Supprimer</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
