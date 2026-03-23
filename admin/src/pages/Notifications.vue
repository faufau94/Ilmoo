<script setup lang="ts">
import { ref } from 'vue'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Bell, BellOff } from 'lucide-vue-next'

const prefs = ref({
  newReport: true,
  newUser: false,
  matchAnomaly: true,
  systemAlert: true,
  weeklyDigest: false,
})

// Fake recent notifications
const notifications = ref([
  { id: 1, type: 'report', message: 'Nouveau signalement sur la question "Quelle est la capitale..."', time: 'il y a 5 min', read: false },
  { id: 2, type: 'system', message: 'Backup PostgreSQL effectué avec succès', time: 'il y a 1h', read: false },
  { id: 3, type: 'user', message: '24 nouveaux joueurs inscrits aujourd\'hui', time: 'il y a 3h', read: true },
  { id: 4, type: 'report', message: 'Signalement résolu : doublon de question', time: 'hier', read: true },
  { id: 5, type: 'system', message: 'Mise à jour de l\'API disponible (v2.1.0)', time: 'il y a 2 jours', read: true },
])

function markAllRead() {
  notifications.value.forEach(n => { n.read = true })
}

const unreadCount = () => notifications.value.filter(n => !n.read).length

function typeColor(type: string) {
  if (type === 'report') return 'bg-red-500/10 text-red-500'
  if (type === 'system') return 'bg-blue-500/10 text-blue-500'
  return 'bg-green-500/10 text-green-500'
}

function typeLabel(type: string) {
  if (type === 'report') return 'Signalement'
  if (type === 'system') return 'Système'
  return 'Utilisateurs'
}
</script>

<template>
  <div class="flex flex-col gap-6 py-6 px-4 lg:px-6 max-w-3xl">
    <div>
      <h1 class="text-2xl font-bold tracking-tight">Notifications</h1>
      <p class="text-muted-foreground text-sm">Centre de notifications et préférences</p>
    </div>

    <!-- Recent notifications -->
    <Card>
      <CardHeader>
        <div class="flex items-center justify-between">
          <div>
            <CardTitle class="flex items-center gap-2">
              <Bell class="h-4 w-4" />
              Récentes
              <Badge v-if="unreadCount() > 0" variant="destructive" class="text-xs">{{ unreadCount() }}</Badge>
            </CardTitle>
            <CardDescription>Activité récente du backoffice</CardDescription>
          </div>
          <button
            v-if="unreadCount() > 0"
            class="text-xs text-muted-foreground hover:text-foreground transition-colors"
            @click="markAllRead"
          >
            Tout marquer comme lu
          </button>
        </div>
      </CardHeader>
      <CardContent class="p-0">
        <div v-if="notifications.length === 0" class="px-6 py-8 text-center text-muted-foreground text-sm">
          <BellOff class="h-8 w-8 mx-auto mb-2 opacity-40" />
          Aucune notification
        </div>
        <div
          v-for="(notif, i) in notifications"
          :key="notif.id"
          class="flex items-start gap-3 px-6 py-4 transition-colors"
          :class="notif.read ? '' : 'bg-muted/30'"
        >
          <span
            class="mt-0.5 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium shrink-0"
            :class="typeColor(notif.type)"
          >{{ typeLabel(notif.type) }}</span>
          <div class="flex-1 min-w-0">
            <p class="text-sm" :class="notif.read ? 'text-muted-foreground' : 'font-medium'">
              {{ notif.message }}
            </p>
            <p class="text-xs text-muted-foreground mt-0.5">{{ notif.time }}</p>
          </div>
          <div v-if="!notif.read" class="size-2 rounded-full bg-primary mt-1.5 shrink-0" />
        </div>
      </CardContent>
    </Card>

    <!-- Preferences -->
    <Card>
      <CardHeader>
        <CardTitle>Préférences</CardTitle>
        <CardDescription>Choisissez les événements pour lesquels vous souhaitez être notifié</CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <div class="flex items-center justify-between">
          <Label>Nouveaux signalements</Label>
          <Switch v-model:model-value="prefs.newReport" />
        </div>
        <Separator />
        <div class="flex items-center justify-between">
          <Label>Nouveaux utilisateurs (pic)</Label>
          <Switch v-model:model-value="prefs.newUser" />
        </div>
        <Separator />
        <div class="flex items-center justify-between">
          <Label>Anomalies de matchs</Label>
          <Switch v-model:model-value="prefs.matchAnomaly" />
        </div>
        <Separator />
        <div class="flex items-center justify-between">
          <Label>Alertes système</Label>
          <Switch v-model:model-value="prefs.systemAlert" />
        </div>
        <Separator />
        <div class="flex items-center justify-between">
          <Label>Résumé hebdomadaire (e-mail)</Label>
          <Switch v-model:model-value="prefs.weeklyDigest" />
        </div>
      </CardContent>
    </Card>
  </div>
</template>
