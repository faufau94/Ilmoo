<script setup lang="ts">
import { ref, watch } from 'vue'
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import { getAdminProfile, updateAdminProfile, changeAdminPassword } from '@/lib/api'
import { useToast } from '@/composables/useToast'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { CircleUserRound } from 'lucide-vue-next'

const toast = useToast()
const queryClient = useQueryClient()

const { data: profileData } = useQuery({
  queryKey: ['admin-profile'],
  queryFn: getAdminProfile,
})

const name = ref('')
const email = ref('')

watch(profileData, (v) => {
  if (v?.data) {
    name.value = v.data.username ?? ''
    email.value = v.data.email ?? ''
  }
}, { immediate: true })

const profileMutation = useMutation({
  mutationFn: () => updateAdminProfile({ username: name.value, email: email.value }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['admin-profile'] })
    toast.success('Profil mis à jour')
  },
  onError: (err: Error) => { toast.error('Erreur', err.message) },
})

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
    currentPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
  },
  onError: (err: Error) => { toast.error('Erreur', err.message) },
})

const initials = ref('AD')
watch(name, (v) => {
  if (v) initials.value = v.substring(0, 2).toUpperCase()
})
</script>

<template>
  <div class="flex flex-col gap-6 py-6 px-4 lg:px-6">
    <div>
      <h1 class="text-2xl font-bold tracking-tight">Profil</h1>
      <p class="text-muted-foreground text-sm">Gérer les informations du compte admin</p>
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
      <Card>
        <CardHeader>
          <CardTitle class="flex items-center gap-2"><CircleUserRound class="h-4 w-4" /> Informations</CardTitle>
          <CardDescription>Nom et adresse e-mail du compte</CardDescription>
        </CardHeader>
        <CardContent>
          <form class="space-y-4" @submit.prevent="profileMutation.mutate()">
            <div class="flex items-center gap-4 mb-4">
              <Avatar class="size-16 rounded-xl">
                <AvatarFallback class="rounded-xl bg-primary text-primary-foreground text-xl font-bold">
                  {{ initials }}
                </AvatarFallback>
              </Avatar>
              <div>
                <p class="font-semibold">{{ name || 'Admin' }}</p>
                <p class="text-sm text-muted-foreground">{{ email }}</p>
              </div>
            </div>
            <Separator />
            <div class="space-y-2">
              <Label>Nom</Label>
              <Input v-model="name" />
            </div>
            <div class="space-y-2">
              <Label>E-mail</Label>
              <Input type="email" v-model="email" />
            </div>
            <Button type="submit" :disabled="profileMutation.isPending.value">
              {{ profileMutation.isPending.value ? 'Enregistrement...' : 'Enregistrer' }}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Changer le mot de passe</CardTitle>
        </CardHeader>
        <CardContent>
          <form class="space-y-4" @submit.prevent="passwordMutation.mutate()">
            <div class="space-y-2">
              <Label>Mot de passe actuel</Label>
              <Input type="password" v-model="currentPassword" required />
            </div>
            <div class="space-y-2">
              <Label>Nouveau mot de passe</Label>
              <Input type="password" v-model="newPassword" required />
            </div>
            <div class="space-y-2">
              <Label>Confirmer</Label>
              <Input type="password" v-model="confirmPassword" required />
            </div>
            <Button type="submit" :disabled="passwordMutation.isPending.value">
              {{ passwordMutation.isPending.value ? 'Modification...' : 'Mettre à jour' }}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
