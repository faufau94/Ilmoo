<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import { getFlavor, updateFlavor, getCategories, changeAdminPassword } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useToast } from '@/composables/useToast'
import { useAuth } from '@/composables/useAuth'
import { useFlavor } from '@/composables/useFlavor'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Shield, Key, Database, Smartphone, Palette, Gamepad2, Trophy, Type, Settings as SettingsIcon,
} from 'lucide-vue-next'

// ── General / session ──
const { token } = useAuth()
const { activeFlavor } = useFlavor()
const slug = computed(() => activeFlavor.value)
const currentFlavorLabel = computed(() => activeFlavor.value === 'ilmoo' ? 'Ilmoo' : 'QuizBattle')

// ── Flavor editing ──
const queryClient = useQueryClient()

const { data: categoriesData } = useQuery({
  queryKey: ['categories-all'],
  queryFn: getCategories,
})
const allCategories = computed(() => (categoriesData.value?.data ?? []) as CategoryRow[])

// Forms keyed by slug
const forms = ref<Record<string, Record<string, unknown>>>({ ilmoo: {}, quizapp: {} })

const { data: ilmooData } = useQuery({ queryKey: ['flavor', 'ilmoo'], queryFn: () => getFlavor('ilmoo') })
const { data: quizappData } = useQuery({ queryKey: ['flavor', 'quizapp'], queryFn: () => getFlavor('quizapp') })

watch(ilmooData, (v) => { if (v?.data) forms.value.ilmoo = { ...(v.data as Record<string, unknown>) } })
watch(quizappData, (v) => { if (v?.data) forms.value.quizapp = { ...(v.data as Record<string, unknown>) } })

const toast = useToast()

function makeSaveMutation(s: string) {
  return useMutation({
    mutationFn: () => updateFlavor(s, forms.value[s]!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flavor', s] })
      toast.success('Paramètres enregistrés')
    },
    onError: (err: Error) => { toast.error('Erreur', err.message) },
  })
}

const saveMutations: Record<string, ReturnType<typeof makeSaveMutation>> = {
  ilmoo: makeSaveMutation('ilmoo'),
  quizapp: makeSaveMutation('quizapp'),
}

// Category helpers per slug
function getEnabledCatIds(slug: string): string[] | null {
  return (forms.value[slug]?.enabled_category_ids as string[] | null) ?? null
}
function setEnabledCatIds(slug: string, val: string[] | null) {
  forms.value[slug]!.enabled_category_ids = val
}
function isCatEnabled(slug: string, catId: string) {
  const ids = getEnabledCatIds(slug)
  return ids === null || ids.includes(catId)
}
function toggleCategory(slug: string, catId: string) {
  const current = getEnabledCatIds(slug)
  const rootIds = allCategories.value.filter(c => !c.parent_id).map(c => c.id)
  if (current === null) {
    setEnabledCatIds(slug, rootIds.filter(id => id !== catId))
  } else if (current.includes(catId)) {
    const newList = current.filter(id => id !== catId)
    setEnabledCatIds(slug, newList.length === 0 ? [] : newList)
  } else {
    const newList = [...current, catId]
    setEnabledCatIds(slug, rootIds.every(id => newList.includes(id)) ? null : newList)
  }
}

const textKeys = [
  'matchWin', 'matchLose', 'matchDraw', 'matchmakingSearching', 'matchmakingTimeout',
  'dailyLimitReached', 'dailyLimitCta', 'linkAccountPrompt', 'linkAccountLeaderboard',
  'linkAccountFriends', 'linkAccountProfile', 'maintenanceDefault', 'updateRequired',
  'welcomeMessage', 'premiumCta', 'premiumDescription',
]

// ── General ──
const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')

const passwordMutation = useMutation({
  mutationFn: () => {
    if (newPassword.value.length < 8) throw new Error('Au moins 8 caractères')
    if (newPassword.value !== confirmPassword.value) throw new Error('Les mots de passe ne correspondent pas')
    return changeAdminPassword(currentPassword.value, newPassword.value)
  },
  onSuccess: () => {
    toast.success('Mot de passe modifié')
    currentPassword.value = ''; newPassword.value = ''; confirmPassword.value = ''
  },
  onError: (err: Error) => { toast.error('Erreur', err.message) },
})

interface CategoryRow { id: string; name: string; slug: string; parent_id: string | null; question_count: number }
</script>

<template>
  <div class="flex flex-col gap-6 py-6 px-4 lg:px-6">
    <div>
      <h1 class="text-2xl font-bold tracking-tight">Paramètres</h1>
      <p class="text-muted-foreground text-sm">Configuration du backoffice et de {{ currentFlavorLabel }}</p>
    </div>

    <Tabs default-value="general" class="w-full">
      <TabsList>
        <TabsTrigger value="general">Général</TabsTrigger>
        <TabsTrigger value="flavor">{{ currentFlavorLabel }}</TabsTrigger>
      </TabsList>

      <TabsContent value="general" class="mt-6">
    <div class="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
      <Card>
        <CardHeader>
          <CardTitle class="flex items-center gap-2"><Key class="h-4 w-4" /> Mot de passe</CardTitle>
        </CardHeader>
        <CardContent>
          <form class="space-y-4" @submit.prevent="passwordMutation.mutate()">
            <div class="space-y-2"><Label>Actuel</Label><Input type="password" v-model="currentPassword" required /></div>
            <div class="space-y-2"><Label>Nouveau</Label><Input type="password" v-model="newPassword" required /></div>
            <div class="space-y-2"><Label>Confirmer</Label><Input type="password" v-model="confirmPassword" required /></div>
            <Button type="submit" :disabled="passwordMutation.isPending.value">
              {{ passwordMutation.isPending.value ? 'Modification...' : 'Mettre à jour' }}
            </Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle class="flex items-center gap-2"><Shield class="h-4 w-4" /> Session</CardTitle></CardHeader>
        <CardContent class="space-y-3">
          <div class="flex items-center justify-between text-sm">
            <span class="text-muted-foreground">Token</span>
            <code class="text-xs bg-muted px-2 py-1 rounded">{{ token ? token.substring(0, 16) + '...' : '–' }}</code>
          </div>
          <Separator />
          <div class="flex items-center justify-between text-sm">
            <span class="text-muted-foreground">Expiration</span><span>7 jours</span>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle class="flex items-center gap-2"><Database class="h-4 w-4" /> Système</CardTitle></CardHeader>
        <CardContent class="space-y-3">
          <div class="flex items-center justify-between text-sm"><span class="text-muted-foreground">Backend</span><span>Fastify + Socket.io</span></div>
          <Separator />
          <div class="flex items-center justify-between text-sm"><span class="text-muted-foreground">Base de données</span><span>PostgreSQL 16</span></div>
          <Separator />
          <div class="flex items-center justify-between text-sm"><span class="text-muted-foreground">Cache</span><span>Redis 7</span></div>
          <Separator />
          <div class="flex items-center justify-between text-sm"><span class="text-muted-foreground">Admin</span><span>Vue 3 + shadcn-vue</span></div>
        </CardContent>
      </Card>
    </div>

      </TabsContent>

      <TabsContent value="flavor" class="mt-6">
    <div class="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
      <!-- LEFT -->
      <div class="space-y-6">
        <Card>
          <CardHeader><CardTitle class="flex items-center gap-2"><Smartphone class="h-4 w-4" /> Identité</CardTitle></CardHeader>
          <CardContent class="space-y-4">
            <div class="grid grid-cols-2 gap-4">
              <div class="space-y-2"><Label>Nom</Label><Input v-model="(forms[slug].app_name as string)" /></div>
              <div class="space-y-2"><Label>Email support</Label><Input v-model="(forms[slug].support_email as string)" /></div>
            </div>
            <div class="space-y-2"><Label>Description</Label><Textarea v-model="(forms[slug].app_description as string)" :rows="2" /></div>
            <div class="grid grid-cols-2 gap-4">
              <div class="space-y-2"><Label>App Store</Label><Input v-model="(forms[slug].app_store_url as string)" placeholder="https://..." /></div>
              <div class="space-y-2"><Label>Play Store</Label><Input v-model="(forms[slug].play_store_url as string)" placeholder="https://..." /></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle class="flex items-center gap-2"><Palette class="h-4 w-4" /> Thème</CardTitle></CardHeader>
          <CardContent>
            <div class="grid grid-cols-2 gap-4">
              <div v-for="[field, label] in [['primary_color','Primaire'],['primary_dark','Sombre'],['accent_positive','Accent +'],['accent_negative','Accent -']]" :key="field" class="space-y-2">
                <Label>{{ label }}</Label>
                <div class="flex items-center gap-2">
                  <input type="color" :value="(forms[slug][field] as string)" @input="forms[slug][field] = ($event.target as HTMLInputElement).value" class="w-10 h-10 rounded cursor-pointer border-0" />
                  <Input :model-value="(forms[slug][field] as string)" @update:model-value="forms[slug][field] = $event" class="flex-1" />
                </div>
              </div>
            </div>
            <div class="mt-4 rounded-xl p-6 text-center" :style="{ background: `linear-gradient(180deg, ${forms[slug].primary_color}, ${forms[slug].primary_dark})` }">
              <span class="text-2xl font-bold" :style="{ color: (forms[slug].accent_positive as string) }">{{ forms[slug].app_name }}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div class="flex items-center justify-between">
              <div><CardTitle>Catégories activées</CardTitle><CardDescription>{{ getEnabledCatIds(slug) === null ? 'Toutes' : `${getEnabledCatIds(slug)?.length}` }}</CardDescription></div>
              <div class="flex gap-2"><Button variant="outline" size="sm" @click="setEnabledCatIds(slug, null)">Tout</Button><Button variant="outline" size="sm" @click="setEnabledCatIds(slug, [])">Aucune</Button></div>
            </div>
          </CardHeader>
          <CardContent>
            <div class="space-y-1">
              <label v-for="cat in allCategories.filter(c => !c.parent_id)" :key="cat.id" class="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 cursor-pointer">
                <div class="flex items-center gap-3"><Checkbox :checked="isCatEnabled(slug, cat.id)" @update:checked="toggleCategory(slug, cat.id)" /><span class="text-sm font-medium">{{ cat.name }}</span></div>
                <span class="text-xs text-muted-foreground">{{ cat.question_count }} questions</span>
              </label>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle class="flex items-center gap-2"><SettingsIcon class="h-4 w-4" /> Fonctionnalités</CardTitle></CardHeader>
          <CardContent class="space-y-4">
            <div v-for="[field, label] in [['ads_enabled','Publicités'],['premium_enabled','Premium'],['tournaments_enabled','Tournois'],['friends_enabled','Amis']]" :key="field" class="flex items-center justify-between">
              <Label>{{ label }}</Label>
              <Switch :model-value="(forms[slug][field] as boolean)" @update:model-value="forms[slug][field] = $event" />
            </div>
          </CardContent>
        </Card>
      </div>

      <!-- RIGHT -->
      <div class="space-y-6">
        <Card>
          <CardHeader><CardTitle class="flex items-center gap-2"><Gamepad2 class="h-4 w-4" /> Gameplay</CardTitle></CardHeader>
          <CardContent>
            <div class="grid grid-cols-2 gap-4">
              <div v-for="[field, label, min, max] in [['free_daily_matches','Matchs/jour',1,100],['round_count','Rounds',1,20],['timer_seconds','Timer (s)',5,60],['matchmaking_timeout_seconds','Timeout (s)',5,120]]" :key="field" class="space-y-2">
                <Label>{{ label }}</Label>
                <Input type="number" :model-value="(forms[slug][field] as number)" @update:model-value="forms[slug][field] = Number($event)" :min="min" :max="max" />
              </div>
            </div>
            <div class="flex items-center justify-between mt-4"><Label>Round bonus</Label><Switch :model-value="(forms[slug].bonus_round_enabled as boolean)" @update:model-value="forms[slug].bonus_round_enabled = $event" /></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle class="flex items-center gap-2"><Trophy class="h-4 w-4" /> Scoring</CardTitle></CardHeader>
          <CardContent>
            <div class="grid grid-cols-2 gap-4">
              <div v-for="[field, label] in [['points_per_round','Pts/round'],['points_bonus_round','Pts bonus'],['speed_weight','Vitesse (0-1)'],['base_weight','Base (0-1)'],['min_correct_points','Min correct']]" :key="field" class="space-y-2">
                <Label>{{ label }}</Label>
                <Input type="number" :model-value="(forms[slug][field] as number)" @update:model-value="forms[slug][field] = Number($event)" min="0" step="0.05" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Progression & XP</CardTitle></CardHeader>
          <CardContent>
            <div class="grid grid-cols-2 gap-4">
              <div v-for="[field, label] in [['xp_base_match','XP base'],['xp_win_bonus','XP victoire'],['xp_perfect_bonus','XP perfect'],['xp_streak_multiplier','Streak ×'],['level_formula_divisor','Diviseur']]" :key="field" class="space-y-2">
                <Label>{{ label }}</Label>
                <Input type="number" :model-value="(forms[slug][field] as number)" @update:model-value="forms[slug][field] = Number($event)" min="0" />
              </div>
            </div>
            <Separator class="my-4" />
            <p class="text-sm font-medium mb-3">Seuils de badges</p>
            <div class="grid grid-cols-5 gap-3">
              <div v-for="tier in ['bronze','silver','gold','expert','grand_master']" :key="tier" class="space-y-1">
                <Label class="text-xs capitalize">{{ tier.replace('_',' ') }}</Label>
                <Input type="number" :model-value="(forms[slug].badge_thresholds as Record<string,number>)?.[tier]" @update:model-value="((forms[slug].badge_thresholds as Record<string,number>) ??= {})[tier] = Number($event)" min="0" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle class="flex items-center gap-2"><Type class="h-4 w-4" /> Textes</CardTitle></CardHeader>
          <CardContent class="space-y-3">
            <div v-for="key in textKeys" :key="key" class="space-y-1">
              <Label class="text-xs text-muted-foreground">{{ key }}</Label>
              <Input :model-value="(forms[slug].custom_texts as Record<string,string>)?.[key] ?? ''" @update:model-value="((forms[slug].custom_texts as Record<string,string>) ??= {})[key] = ($event as string)" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Maintenance</CardTitle></CardHeader>
          <CardContent class="space-y-4">
            <div class="flex items-center justify-between">
              <div><Label>App active</Label><p class="text-xs text-muted-foreground">Désactiver = maintenance</p></div>
              <Switch :model-value="(forms[slug].is_active as boolean)" @update:model-value="forms[slug].is_active = $event" />
            </div>
            <div class="space-y-2"><Label>Message</Label><Textarea v-model="(forms[slug].maintenance_message as string)" placeholder="L'app est en maintenance..." :rows="2" /></div>
            <div class="space-y-2"><Label>Version minimum</Label><Input v-model="(forms[slug].min_app_version as string)" placeholder="1.0.0" /></div>
          </CardContent>
        </Card>
        <div class="flex gap-3 pb-8">
          <Button @click="saveMutations[slug].mutate()" :disabled="saveMutations[slug].isPending.value">
            {{ saveMutations[slug].isPending.value ? 'Enregistrement...' : 'Enregistrer' }}
          </Button>
        </div>
      </div>
    </div>
      </TabsContent>
    </Tabs>
  </div>
</template>
