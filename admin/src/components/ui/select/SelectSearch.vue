<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { Check, ChevronsUpDown, Search } from 'lucide-vue-next'
import { cn } from '@/lib/utils'

const props = defineProps<{
  modelValue: string
  options: { value: string; label: string }[]
  placeholder?: string
  class?: string
  triggerClass?: string
}>()

const emit = defineEmits<{ 'update:modelValue': [string] }>()

const search = ref('')
const open = ref(false)
const inputRef = ref<HTMLInputElement>()

const filtered = computed(() =>
  search.value.trim()
    ? props.options.filter(o => o.label.toLowerCase().includes(search.value.toLowerCase()))
    : props.options,
)

const selectedLabel = computed(() => {
  if (!props.modelValue) return ''
  return props.options.find(o => o.value === props.modelValue)?.label ?? ''
})

function toggle() {
  open.value = !open.value
  if (open.value) {
    nextTick(() => inputRef.value?.focus())
  }
}

function select(val: string) {
  emit('update:modelValue', val)
  open.value = false
  search.value = ''
}

function handleClickOutside(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (!target.closest('[data-select-search-popover]') && !target.closest('[data-select-search-trigger]')) {
    open.value = false
    search.value = ''
  }
}

watch(open, (v) => {
  if (v) {
    document.addEventListener('click', handleClickOutside, true)
  } else {
    document.removeEventListener('click', handleClickOutside, true)
    search.value = ''
  }
})
</script>

<template>
  <div :class="cn('relative', props.class)">
    <!-- Trigger button -->
    <button
      type="button"
      data-select-search-trigger
      :class="cn(
        'flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs ring-offset-background cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
        triggerClass,
      )"
      @click.stop="toggle"
    >
      <span :class="selectedLabel ? 'truncate' : 'text-muted-foreground truncate'">
        {{ selectedLabel || placeholder || 'Choisir...' }}
      </span>
      <ChevronsUpDown class="size-4 opacity-50 shrink-0 ml-2" />
    </button>

    <!-- Dropdown -->
    <div
      v-if="open"
      data-select-search-popover
      class="absolute left-0 z-50 mt-1 w-full min-w-48 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95"
    >
      <!-- Search input -->
      <div class="flex items-center border-b px-3 gap-2">
        <Search class="size-4 text-muted-foreground shrink-0" />
        <input
          ref="inputRef"
          v-model="search"
          placeholder="Rechercher..."
          class="flex h-9 w-full bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground"
          @click.stop
        />
      </div>

      <!-- Options list -->
      <div class="max-h-52 overflow-y-auto p-1">
        <div
          v-if="filtered.length === 0"
          class="py-6 text-center text-sm text-muted-foreground"
        >
          Aucun résultat
        </div>
        <div
          v-for="opt in filtered"
          :key="opt.value"
          class="relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
          @click.stop="select(opt.value)"
        >
          {{ opt.label }}
          <span v-if="modelValue === opt.value" class="absolute right-2 flex items-center justify-center">
            <Check class="size-4" />
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
