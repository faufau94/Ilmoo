import { ref } from 'vue'

// Global state shared between AppSidebar and Questions page
const showCreate = ref(false)
const showImport = ref(false)

export function useQuestionDialog() {
  function openCreate() { showCreate.value = true }
  function openImport() { showImport.value = true }
  function closeCreate() { showCreate.value = false }
  function closeImport() { showImport.value = false }

  return { showCreate, showImport, openCreate, openImport, closeCreate, closeImport }
}
