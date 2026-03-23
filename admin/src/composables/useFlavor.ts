import { ref, computed } from 'vue'

export type FlavorSlug = 'ilmoo' | 'quizapp'

export interface Flavor {
  slug: FlavorSlug
  label: string
  color: string
  initials: string
}

export const FLAVORS: Flavor[] = [
  { slug: 'ilmoo', label: 'Ilmoo', color: '#1B4332', initials: 'IL' },
  { slug: 'quizapp', label: 'QuizBattle', color: '#1A365D', initials: 'QB' },
]

const activeFlavor = ref<FlavorSlug>(
  (localStorage.getItem('admin_flavor') as FlavorSlug) ?? 'ilmoo',
)

export function useFlavor() {
  function setFlavor(slug: FlavorSlug) {
    activeFlavor.value = slug
    localStorage.setItem('admin_flavor', slug)
  }

  const currentFlavor = computed(() => FLAVORS.find(f => f.slug === activeFlavor.value)!)

  return { activeFlavor, currentFlavor, setFlavor, FLAVORS }
}
