import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useAuth } from '@/composables/useAuth'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/pages/Login.vue'),
    meta: { public: true },
  },
  {
    path: '/',
    redirect: '/dashboard',
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: () => import('@/pages/Dashboard.vue'),
  },
  {
    path: '/applications',
    name: 'applications',
    component: () => import('@/pages/Applications.vue'),
  },
  {
    path: '/questions',
    name: 'questions',
    component: () => import('@/pages/Questions.vue'),
  },
  {
    path: '/categories',
    name: 'categories',
    component: () => import('@/pages/Categories.vue'),
  },
  {
    path: '/users',
    name: 'users',
    component: () => import('@/pages/Users.vue'),
  },
  {
    path: '/matches',
    name: 'matches',
    component: () => import('@/pages/Matches.vue'),
  },
  {
    path: '/reports',
    name: 'reports',
    component: () => import('@/pages/Reports.vue'),
  },
  {
    path: '/tournaments',
    name: 'tournaments',
    component: () => import('@/pages/Tournaments.vue'),
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('@/pages/Settings.vue'),
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

// Navigation guard
router.beforeEach((to) => {
  const { isAuthenticated } = useAuth()

  if (to.meta.public) return true
  if (!isAuthenticated.value) return { name: 'login' }
  return true
})

export default router
