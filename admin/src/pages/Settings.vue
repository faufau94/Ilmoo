<script setup lang="ts">
import { ref } from 'vue'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { useAuth } from '@/composables/useAuth'
import { Shield, Key, Database } from 'lucide-vue-next'

const { token } = useAuth()

const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const passwordError = ref('')
const passwordSuccess = ref(false)

async function changePassword() {
  passwordError.value = ''
  passwordSuccess.value = false

  if (newPassword.value.length < 8) {
    passwordError.value = 'Le mot de passe doit contenir au moins 8 caractères'
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    passwordError.value = 'Les mots de passe ne correspondent pas'
    return
  }

  // TODO: call backend to change password
  passwordSuccess.value = true
  currentPassword.value = ''
  newPassword.value = ''
  confirmPassword.value = ''
}
</script>

<template>
  <div class="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
    <div class="px-4 lg:px-6">
      <h1 class="text-2xl font-bold tracking-tight">Paramètres</h1>
      <p class="text-muted-foreground text-sm">Configuration du backoffice</p>
    </div>

    <div class="px-4 lg:px-6 space-y-6 max-w-2xl">
      <!-- Security -->
      <Card>
        <CardHeader>
          <CardTitle class="flex items-center gap-2"><Key class="h-4 w-4" /> Changer le mot de passe</CardTitle>
          <CardDescription>Modifiez le mot de passe du compte admin</CardDescription>
        </CardHeader>
        <CardContent>
          <form class="space-y-4" @submit.prevent="changePassword">
            <div class="space-y-2">
              <Label>Mot de passe actuel</Label>
              <Input type="password" v-model="currentPassword" required />
            </div>
            <div class="space-y-2">
              <Label>Nouveau mot de passe</Label>
              <Input type="password" v-model="newPassword" required />
            </div>
            <div class="space-y-2">
              <Label>Confirmer le nouveau mot de passe</Label>
              <Input type="password" v-model="confirmPassword" required />
            </div>
            <p v-if="passwordError" class="text-sm text-destructive">{{ passwordError }}</p>
            <p v-if="passwordSuccess" class="text-sm text-green-600">Mot de passe modifié avec succès</p>
            <Button type="submit">Mettre à jour</Button>
          </form>
        </CardContent>
      </Card>

      <!-- Session info -->
      <Card>
        <CardHeader>
          <CardTitle class="flex items-center gap-2"><Shield class="h-4 w-4" /> Session</CardTitle>
          <CardDescription>Informations sur la session en cours</CardDescription>
        </CardHeader>
        <CardContent class="space-y-3">
          <div class="flex items-center justify-between text-sm">
            <span class="text-muted-foreground">Token de session</span>
            <code class="text-xs bg-muted px-2 py-1 rounded">{{ token ? token.substring(0, 16) + '...' : '–' }}</code>
          </div>
          <Separator />
          <div class="flex items-center justify-between text-sm">
            <span class="text-muted-foreground">Expiration</span>
            <span>7 jours après connexion</span>
          </div>
        </CardContent>
      </Card>

      <!-- System info -->
      <Card>
        <CardHeader>
          <CardTitle class="flex items-center gap-2"><Database class="h-4 w-4" /> Système</CardTitle>
          <CardDescription>Informations techniques</CardDescription>
        </CardHeader>
        <CardContent class="space-y-3">
          <div class="flex items-center justify-between text-sm">
            <span class="text-muted-foreground">Backend</span>
            <span>Fastify + Socket.io</span>
          </div>
          <Separator />
          <div class="flex items-center justify-between text-sm">
            <span class="text-muted-foreground">Base de données</span>
            <span>PostgreSQL 16</span>
          </div>
          <Separator />
          <div class="flex items-center justify-between text-sm">
            <span class="text-muted-foreground">Cache</span>
            <span>Redis 7</span>
          </div>
          <Separator />
          <div class="flex items-center justify-between text-sm">
            <span class="text-muted-foreground">Admin</span>
            <span>Vue 3 + shadcn-vue</span>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
