<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import { getFlavors, getFlavor, updateFlavor, getCategories, bulkUpdateCategoryFlavors } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { ArrowLeft, Smartphone, Palette, Gamepad2, Trophy, Type, Settings, ChevronRight } from 'lucide-vue-next'

const queryClient = useQueryClient()

// ── State ──
const editingSlug = ref<string | null>(null)

const { data: flavorsData } = useQuery({
  queryKey: ['flavors'],
  queryFn: getFlavors,
})

const { data: categoriesData } = useQuery({
  queryKey: ['categories-all'],
  queryFn: getCategories,
})

const flavors = computed(() => (flavorsData.value?.data ?? []) as FlavorRow[])
const allCategories = computed(() => (categoriesData.value?.data ?? []) as CategoryRow[])

// ── Editing state ──
const form = ref<Record<string, unknown>>({})

const { data: flavorDetail } = useQuery({
  queryKey: ['flavor', editingSlug],
  queryFn: () => editingSlug.value ? getFlavor(editingSlug.value) : null,
  enabled: () => !!editingSlug.value,
})

watch(flavorDetail, (val) => {
  if (val?.data) {
    form.value = { ...(val.data as Record<string, unknown>) }
  }
})

const saveMutation = useMutation({
  mutationFn: () => updateFlavor(editingSlug.value!, form.value),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['flavors'] })
    queryClient.invalidateQueries({ queryKey: ['flavor', editingSlug.value] })
    editingSlug.value = null
  },
})

function startEdit(slug: string) {
  editingSlug.value = slug
}

function cancelEdit() {
  editingSlug.value = null
  form.value = {}
}

// ── Category checkboxes (using category_flavors) ──
const flavorCategories = computed(() => {
  if (!editingSlug.value) return []
  return allCategories.value.filter(c => (c.flavor_slugs ?? []).includes(editingSlug.value!))
})

function isCatEnabled(catId: string) {
  return flavorCategories.value.some(c => c.id === catId)
}

const categoryFlavorMutation = useMutation({
  mutationFn: ({ categoryId, action }: { categoryId: string; action: 'add' | 'remove' }) =>
    bulkUpdateCategoryFlavors([categoryId], action, [editingSlug.value!]),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['categories-all'] })
  },
})

function toggleCategory(catId: string) {
  const action = isCatEnabled(catId) ? 'remove' : 'add'
  categoryFlavorMutation.mutate({ categoryId: catId, action })
}

async function selectAllCats() {
  const rootIds = allCategories.value.filter(c => !c.parent_id).map(c => c.id)
  const subIds = allCategories.value.filter(c => c.parent_id).map(c => c.id)
  const allIds = [...rootIds, ...subIds]
  const toAdd = allIds.filter(id => !isCatEnabled(id))
  if (toAdd.length > 0) {
    await bulkUpdateCategoryFlavors(toAdd, 'add', [editingSlug.value!])
    queryClient.invalidateQueries({ queryKey: ['categories-all'] })
  }
}

async function deselectAllCats() {
  const enabledIds = flavorCategories.value.map(c => c.id)
  if (enabledIds.length > 0) {
    await bulkUpdateCategoryFlavors(enabledIds, 'remove', [editingSlug.value!])
    queryClient.invalidateQueries({ queryKey: ['categories-all'] })
  }
}

// ── Text keys ──
const textKeys = [
  'matchWin',
  'matchLose',
  'matchDraw',
  'matchmakingSearching',
  'matchmakingTimeout',
  'dailyLimitReached',
  'dailyLimitCta',
  'linkAccountPrompt',
  'linkAccountLeaderboard',
  'linkAccountFriends',
  'linkAccountProfile',
  'maintenanceDefault',
  'updateRequired',
  'welcomeMessage',
  'premiumCta',
  'premiumDescription',
]

// ── Types ──
interface FlavorRow {
  id: string
  slug: string
  app_name: string
  app_description: string | null
  primary_color: string
  primary_dark: string
  accent_positive: string
  accent_negative: string
  is_active: boolean
  ads_enabled: boolean
  premium_enabled: boolean
  tournaments_enabled: boolean
  friends_enabled: boolean
}

interface CategoryRow {
  id: string
  name: string
  slug: string
  parent_id: string | null
  question_count: number
  flavor_slugs?: string[]
}
</script>

<template>
  <div class="p-8">
    <!-- ══ List view ══ -->
    <template v-if="!editingSlug">
      <div class="mb-6">
        <h1 class="text-2xl font-bold">Applications</h1>
        <p class="text-muted-foreground text-sm mt-1">Gérer les flavors de l'application</p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card
          v-for="flavor in flavors"
          :key="flavor.slug"
          class="cursor-pointer hover:border-primary/50 transition-colors"
          @click="startEdit(flavor.slug)"
        >
          <CardHeader>
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div
                  class="w-10 h-10 rounded-lg"
                  :style="{ background: `linear-gradient(135deg, ${flavor.primary_color}, ${flavor.primary_dark})` }"
                />
                <div>
                  <CardTitle>{{ flavor.app_name }}</CardTitle>
                  <CardDescription>{{ flavor.slug }}</CardDescription>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <Badge :variant="flavor.is_active ? 'default' : 'destructive'">
                  {{ flavor.is_active ? 'Actif' : 'Maintenance' }}
                </Badge>
                <ChevronRight class="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p class="text-sm text-muted-foreground mb-3">{{ flavor.app_description }}</p>
            <div class="flex gap-2">
              <div
                class="w-6 h-6 rounded-full border border-border"
                :style="{ backgroundColor: flavor.primary_color }"
                :title="'Primary: ' + flavor.primary_color"
              />
              <div
                class="w-6 h-6 rounded-full border border-border"
                :style="{ backgroundColor: flavor.accent_positive }"
                :title="'Accent+: ' + flavor.accent_positive"
              />
              <div
                class="w-6 h-6 rounded-full border border-border"
                :style="{ backgroundColor: flavor.accent_negative }"
                :title="'Accent-: ' + flavor.accent_negative"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </template>

    <!-- ══ Edit view ══ -->
    <template v-else>
      <div class="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" @click="cancelEdit">
          <ArrowLeft class="h-4 w-4" />
        </Button>
        <div>
          <h1 class="text-2xl font-bold">{{ (form.app_name as string) || editingSlug }}</h1>
          <p class="text-muted-foreground text-sm">Modifier la configuration du flavor</p>
        </div>
      </div>

      <div class="space-y-6 max-w-3xl">
        <!-- Identité -->
        <Card>
          <CardHeader>
            <CardTitle class="flex items-center gap-2"><Smartphone class="h-4 w-4" /> Identité</CardTitle>
          </CardHeader>
          <CardContent class="space-y-4">
            <div class="grid grid-cols-2 gap-4">
              <div class="space-y-2">
                <Label>Nom de l'app</Label>
                <Input v-model="(form.app_name as string)" />
              </div>
              <div class="space-y-2">
                <Label>Email support</Label>
                <Input v-model="(form.support_email as string)" />
              </div>
            </div>
            <div class="space-y-2">
              <Label>Description</Label>
              <Textarea v-model="(form.app_description as string)" :rows="2" />
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div class="space-y-2">
                <Label>URL App Store</Label>
                <Input v-model="(form.app_store_url as string)" placeholder="https://..." />
              </div>
              <div class="space-y-2">
                <Label>URL Play Store</Label>
                <Input v-model="(form.play_store_url as string)" placeholder="https://..." />
              </div>
            </div>
          </CardContent>
        </Card>

        <!-- Thème -->
        <Card>
          <CardHeader>
            <CardTitle class="flex items-center gap-2"><Palette class="h-4 w-4" /> Thème</CardTitle>
          </CardHeader>
          <CardContent>
            <div class="grid grid-cols-2 gap-4">
              <div class="space-y-2">
                <Label>Couleur primaire</Label>
                <div class="flex items-center gap-2">
                  <input type="color" :value="(form.primary_color as string)" @input="form.primary_color = ($event.target as HTMLInputElement).value" class="w-10 h-10 rounded cursor-pointer border-0" />
                  <Input v-model="(form.primary_color as string)" class="flex-1" />
                </div>
              </div>
              <div class="space-y-2">
                <Label>Couleur sombre</Label>
                <div class="flex items-center gap-2">
                  <input type="color" :value="(form.primary_dark as string)" @input="form.primary_dark = ($event.target as HTMLInputElement).value" class="w-10 h-10 rounded cursor-pointer border-0" />
                  <Input v-model="(form.primary_dark as string)" class="flex-1" />
                </div>
              </div>
              <div class="space-y-2">
                <Label>Accent positif</Label>
                <div class="flex items-center gap-2">
                  <input type="color" :value="(form.accent_positive as string)" @input="form.accent_positive = ($event.target as HTMLInputElement).value" class="w-10 h-10 rounded cursor-pointer border-0" />
                  <Input v-model="(form.accent_positive as string)" class="flex-1" />
                </div>
              </div>
              <div class="space-y-2">
                <Label>Accent négatif</Label>
                <div class="flex items-center gap-2">
                  <input type="color" :value="(form.accent_negative as string)" @input="form.accent_negative = ($event.target as HTMLInputElement).value" class="w-10 h-10 rounded cursor-pointer border-0" />
                  <Input v-model="(form.accent_negative as string)" class="flex-1" />
                </div>
              </div>
            </div>
            <!-- Preview -->
            <div
              class="mt-4 rounded-xl p-6 text-center"
              :style="{ background: `linear-gradient(180deg, ${form.primary_color}, ${form.primary_dark})` }"
            >
              <span class="text-2xl font-bold" :style="{ color: (form.accent_positive as string) }">
                {{ form.app_name }}
              </span>
            </div>
          </CardContent>
        </Card>

        <!-- Catégories -->
        <Card>
          <CardHeader>
            <div class="flex items-center justify-between">
              <CardTitle>Catégories activées</CardTitle>
              <div class="flex gap-2">
                <Button variant="outline" size="sm" @click="selectAllCats">Tout cocher</Button>
                <Button variant="outline" size="sm" @click="deselectAllCats">Tout décocher</Button>
              </div>
            </div>
            <CardDescription>
              {{ flavorCategories.length }} catégorie(s) / sous-catégorie(s) activée(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div class="space-y-1">
              <template v-for="cat in allCategories.filter(c => !c.parent_id)" :key="cat.id">
                <!-- Root category -->
                <label
                  class="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 cursor-pointer"
                >
                  <div class="flex items-center gap-3">
                    <Checkbox
                      :checked="isCatEnabled(cat.id)"
                      @update:checked="toggleCategory(cat.id)"
                    />
                    <span class="text-sm font-medium">{{ cat.name }}</span>
                  </div>
                  <span class="text-xs text-muted-foreground">{{ cat.question_count }} questions</span>
                </label>
                <!-- Subcategories -->
                <label
                  v-for="sub in allCategories.filter(c => c.parent_id === cat.id)"
                  :key="sub.id"
                  class="flex items-center justify-between pl-10 pr-3 py-2 rounded-lg hover:bg-muted/50 cursor-pointer"
                >
                  <div class="flex items-center gap-3">
                    <Checkbox
                      :checked="isCatEnabled(sub.id)"
                      @update:checked="toggleCategory(sub.id)"
                    />
                    <span class="text-sm text-muted-foreground">└ {{ sub.name }}</span>
                  </div>
                  <span class="text-xs text-muted-foreground">{{ sub.question_count }} questions</span>
                </label>
              </template>
            </div>
          </CardContent>
        </Card>

        <!-- Fonctionnalités -->
        <Card>
          <CardHeader>
            <CardTitle class="flex items-center gap-2"><Settings class="h-4 w-4" /> Fonctionnalités</CardTitle>
          </CardHeader>
          <CardContent class="space-y-4">
            <div class="flex items-center justify-between">
              <Label>Publicités</Label>
              <Switch :model-value="(form.ads_enabled as boolean)" @update:model-value="form.ads_enabled = $event" />
            </div>
            <div class="flex items-center justify-between">
              <Label>Abonnement premium</Label>
              <Switch :model-value="(form.premium_enabled as boolean)" @update:model-value="form.premium_enabled = $event" />
            </div>
            <div class="flex items-center justify-between">
              <Label>Tournois</Label>
              <Switch :model-value="(form.tournaments_enabled as boolean)" @update:model-value="form.tournaments_enabled = $event" />
            </div>
            <div class="flex items-center justify-between">
              <Label>Amis</Label>
              <Switch :model-value="(form.friends_enabled as boolean)" @update:model-value="form.friends_enabled = $event" />
            </div>
          </CardContent>
        </Card>

        <!-- Gameplay -->
        <Card>
          <CardHeader>
            <CardTitle class="flex items-center gap-2"><Gamepad2 class="h-4 w-4" /> Gameplay</CardTitle>
          </CardHeader>
          <CardContent>
            <div class="grid grid-cols-2 gap-4">
              <div class="space-y-2">
                <Label>Matchs gratuits / jour</Label>
                <Input type="number" :model-value="(form.free_daily_matches as number)" @update:model-value="form.free_daily_matches = Number($event)" min="1" />
              </div>
              <div class="space-y-2">
                <Label>Rounds par match</Label>
                <Input type="number" :model-value="(form.round_count as number)" @update:model-value="form.round_count = Number($event)" min="1" max="20" />
              </div>
              <div class="space-y-2">
                <Label>Timer (secondes)</Label>
                <Input type="number" :model-value="(form.timer_seconds as number)" @update:model-value="form.timer_seconds = Number($event)" min="5" max="60" />
              </div>
              <div class="space-y-2">
                <Label>Timeout matchmaking (s)</Label>
                <Input type="number" :model-value="(form.matchmaking_timeout_seconds as number)" @update:model-value="form.matchmaking_timeout_seconds = Number($event)" min="5" max="120" />
              </div>
            </div>
            <div class="flex items-center justify-between mt-4">
              <Label>Round bonus activé</Label>
              <Switch :model-value="(form.bonus_round_enabled as boolean)" @update:model-value="form.bonus_round_enabled = $event" />
            </div>
          </CardContent>
        </Card>

        <!-- Scoring -->
        <Card>
          <CardHeader>
            <CardTitle class="flex items-center gap-2"><Trophy class="h-4 w-4" /> Scoring</CardTitle>
          </CardHeader>
          <CardContent>
            <div class="grid grid-cols-2 gap-4">
              <div class="space-y-2">
                <Label>Points par round</Label>
                <Input type="number" :model-value="(form.points_per_round as number)" @update:model-value="form.points_per_round = Number($event)" min="1" />
              </div>
              <div class="space-y-2">
                <Label>Points round bonus</Label>
                <Input type="number" :model-value="(form.points_bonus_round as number)" @update:model-value="form.points_bonus_round = Number($event)" min="1" />
              </div>
              <div class="space-y-2">
                <Label>Poids vitesse (0-1)</Label>
                <Input type="number" :model-value="(form.speed_weight as number)" @update:model-value="form.speed_weight = Number($event)" min="0" max="1" step="0.05" />
              </div>
              <div class="space-y-2">
                <Label>Poids base (0-1)</Label>
                <Input type="number" :model-value="(form.base_weight as number)" @update:model-value="form.base_weight = Number($event)" min="0" max="1" step="0.05" />
              </div>
              <div class="space-y-2">
                <Label>Points minimum si correct</Label>
                <Input type="number" :model-value="(form.min_correct_points as number)" @update:model-value="form.min_correct_points = Number($event)" min="0" />
              </div>
            </div>
          </CardContent>
        </Card>

        <!-- Progression -->
        <Card>
          <CardHeader>
            <CardTitle>Progression</CardTitle>
          </CardHeader>
          <CardContent>
            <div class="grid grid-cols-2 gap-4">
              <div class="space-y-2">
                <Label>XP base par match</Label>
                <Input type="number" :model-value="(form.xp_base_match as number)" @update:model-value="form.xp_base_match = Number($event)" min="0" />
              </div>
              <div class="space-y-2">
                <Label>XP bonus victoire</Label>
                <Input type="number" :model-value="(form.xp_win_bonus as number)" @update:model-value="form.xp_win_bonus = Number($event)" min="0" />
              </div>
              <div class="space-y-2">
                <Label>XP bonus perfect</Label>
                <Input type="number" :model-value="(form.xp_perfect_bonus as number)" @update:model-value="form.xp_perfect_bonus = Number($event)" min="0" />
              </div>
              <div class="space-y-2">
                <Label>Multiplicateur streak</Label>
                <Input type="number" :model-value="(form.xp_streak_multiplier as number)" @update:model-value="form.xp_streak_multiplier = Number($event)" min="0" />
              </div>
              <div class="space-y-2">
                <Label>Diviseur niveau</Label>
                <Input type="number" :model-value="(form.level_formula_divisor as number)" @update:model-value="form.level_formula_divisor = Number($event)" min="1" />
              </div>
            </div>
            <Separator class="my-4" />
            <p class="text-sm font-medium mb-3">Seuils de badges (XP par catégorie)</p>
            <div class="grid grid-cols-5 gap-3">
              <div v-for="tier in ['bronze', 'silver', 'gold', 'expert', 'grand_master']" :key="tier" class="space-y-1">
                <Label class="text-xs capitalize">{{ tier.replace('_', ' ') }}</Label>
                <Input
                  type="number"
                  :model-value="(form.badge_thresholds as Record<string, number>)?.[tier]"
                  @update:model-value="((form.badge_thresholds as Record<string, number>) ??= {})[tier] = Number($event)"
                  min="0"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <!-- Textes -->
        <Card>
          <CardHeader>
            <CardTitle class="flex items-center gap-2"><Type class="h-4 w-4" /> Textes personnalisables</CardTitle>
          </CardHeader>
          <CardContent class="space-y-3">
            <div
              v-for="key in textKeys"
              :key="key"
              class="space-y-1"
            >
              <Label class="text-xs text-muted-foreground">{{ key }}</Label>
              <Input
                :model-value="(form.custom_texts as Record<string, string>)?.[key] ?? ''"
                @update:model-value="((form.custom_texts as Record<string, string>) ??= {})[key] = ($event as string)"
              />
            </div>
          </CardContent>
        </Card>

        <!-- Maintenance -->
        <Card>
          <CardHeader>
            <CardTitle>Maintenance</CardTitle>
          </CardHeader>
          <CardContent class="space-y-4">
            <div class="flex items-center justify-between">
              <div>
                <Label>App active</Label>
                <p class="text-xs text-muted-foreground">Désactiver met l'app en mode maintenance</p>
              </div>
              <Switch :model-value="(form.is_active as boolean)" @update:model-value="form.is_active = $event" />
            </div>
            <div class="space-y-2">
              <Label>Message de maintenance</Label>
              <Textarea v-model="(form.maintenance_message as string)" placeholder="L'app est en maintenance..." :rows="2" />
            </div>
            <div class="space-y-2">
              <Label>Version minimum</Label>
              <Input v-model="(form.min_app_version as string)" placeholder="1.0.0" />
            </div>
          </CardContent>
        </Card>

        <!-- Save -->
        <div class="flex gap-3 pb-8">
          <Button @click="saveMutation.mutate()" :disabled="saveMutation.isPending.value">
            {{ saveMutation.isPending.value ? 'Enregistrement...' : 'Enregistrer' }}
          </Button>
          <Button variant="outline" @click="cancelEdit">Annuler</Button>
        </div>
      </div>
    </template>
  </div>
</template>
