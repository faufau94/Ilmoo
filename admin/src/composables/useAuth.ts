import { ref, computed } from 'vue'
import { adminLogin, setAuthToken } from '@/lib/api'

const token = ref<string | null>(localStorage.getItem('admin_token'))

// Restore token on load
if (token.value) {
  setAuthToken(token.value)
}

export function useAuth() {
  const isAuthenticated = computed(() => !!token.value)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function login(email: string, password: string) {
    loading.value = true
    error.value = null

    try {
      const result = await adminLogin(email, password)
      const newToken = result.data.token
      token.value = newToken
      setAuthToken(newToken)
      localStorage.setItem('admin_token', newToken)
    } catch (err) {
      error.value = (err as Error).message || 'Erreur de connexion'
      throw err
    } finally {
      loading.value = false
    }
  }

  function logout() {
    token.value = null
    setAuthToken(null)
    localStorage.removeItem('admin_token')
  }

  return {
    token,
    isAuthenticated,
    loading,
    error,
    login,
    logout,
  }
}
