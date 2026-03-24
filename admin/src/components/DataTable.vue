<script setup lang="ts" generic="TData extends Record<string, unknown>">
import { ref, computed } from 'vue'
import {
  useVueTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  FlexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
} from '@tanstack/vue-table'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { ArrowUpDown, ArrowUp, ArrowDown, Search, ChevronLeft, ChevronRight } from 'lucide-vue-next'

const props = withDefaults(defineProps<{
  data: TData[]
  columns: ColumnDef<TData, unknown>[]
  loading?: boolean
  searchPlaceholder?: string
  pageSize?: number
  // Server-side pagination (optional) — when provided, disables client-side pagination
  serverPage?: number
  serverPageCount?: number
}>(), {
  loading: false,
  searchPlaceholder: 'Rechercher...',
  pageSize: 20,
  serverPage: undefined,
  serverPageCount: undefined,
})

const emit = defineEmits<{
  'update:serverPage': [page: number]
  'row-click': [row: TData, event: MouseEvent]
}>()

const isServerPaginated = computed(() => props.serverPage !== undefined)

const sorting = ref<SortingState>([])
const columnFilters = ref<ColumnFiltersState>([])
const globalFilter = ref('')
const clientPageIndex = ref(0)

const table = useVueTable({
  get data() { return props.data },
  get columns() { return props.columns },
  getCoreRowModel: getCoreRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
  getPaginationRowModel: getPaginationRowModel(),
  getSortedRowModel: getSortedRowModel(),
  // For server pagination, tell TanStack Table the total page count externally
  get pageCount() {
    return isServerPaginated.value ? (props.serverPageCount ?? 1) : -1
  },
  manualPagination: isServerPaginated.value,
  state: {
    get sorting() { return sorting.value },
    get columnFilters() { return columnFilters.value },
    get globalFilter() { return globalFilter.value },
    get pagination() {
      return {
        pageIndex: isServerPaginated.value ? (props.serverPage ?? 0) : clientPageIndex.value,
        pageSize: props.pageSize,
      }
    },
  },
  onSortingChange: (updater) => {
    sorting.value = typeof updater === 'function' ? updater(sorting.value) : updater
  },
  onColumnFiltersChange: (updater) => {
    columnFilters.value = typeof updater === 'function' ? updater(columnFilters.value) : updater
  },
  onGlobalFilterChange: (val) => { globalFilter.value = val },
  onPaginationChange: (updater) => {
    const current = {
      pageIndex: isServerPaginated.value ? (props.serverPage ?? 0) : clientPageIndex.value,
      pageSize: props.pageSize,
    }
    const next = typeof updater === 'function' ? updater(current) : updater
    if (isServerPaginated.value) {
      emit('update:serverPage', next.pageIndex)
    } else {
      clientPageIndex.value = next.pageIndex
    }
  },
})

const currentPage = computed(() =>
  isServerPaginated.value ? (props.serverPage ?? 0) : clientPageIndex.value,
)
const totalPages = computed(() =>
  isServerPaginated.value ? (props.serverPageCount ?? 1) : table.getPageCount(),
)
const resultCount = computed(() =>
  isServerPaginated.value
    ? props.data.length
    : table.getFilteredRowModel().rows.length,
)
</script>

<template>
  <div class="space-y-4">
    <!-- Search bar + filters on same line -->
    <div class="flex flex-wrap items-center gap-3">
      <div class="relative w-64">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          v-model="globalFilter"
          :placeholder="searchPlaceholder"
          class="pl-9"
        />
      </div>
      <slot name="filters" />
    </div>

    <!-- Table -->
    <Card>
      <CardContent class="p-0">
        <Table>
          <TableHeader>
            <TableRow v-for="headerGroup in table.getHeaderGroups()" :key="headerGroup.id">
              <TableHead
                v-for="header in headerGroup.headers"
                :key="header.id"
                :class="header.column.getCanSort() ? 'cursor-pointer select-none' : ''"
                @click="header.column.getCanSort() && header.column.toggleSorting()"
              >
                <div class="flex items-center gap-1">
                  <FlexRender
                    v-if="!header.isPlaceholder"
                    :render="header.column.columnDef.header"
                    :props="header.getContext()"
                  />
                  <template v-if="header.column.getCanSort()">
                    <ArrowUp v-if="header.column.getIsSorted() === 'asc'" class="h-3.5 w-3.5 text-muted-foreground" />
                    <ArrowDown v-else-if="header.column.getIsSorted() === 'desc'" class="h-3.5 w-3.5 text-muted-foreground" />
                    <ArrowUpDown v-else class="h-3.5 w-3.5 text-muted-foreground/50" />
                  </template>
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-if="loading">
              <TableCell :colspan="columns.length" class="text-center py-10 text-muted-foreground">
                Chargement...
              </TableCell>
            </TableRow>
            <TableRow v-else-if="table.getRowModel().rows.length === 0">
              <TableCell :colspan="columns.length" class="text-center py-10 text-muted-foreground">
                Aucun résultat
              </TableCell>
            </TableRow>
            <TableRow
              v-else
              v-for="row in table.getRowModel().rows"
              :key="row.id"
              class="cursor-pointer"
              @click="(e: MouseEvent) => emit('row-click', row.original, e)"
            >
              <TableCell v-for="cell in row.getVisibleCells()" :key="cell.id">
                <FlexRender :render="cell.column.columnDef.cell" :props="cell.getContext()" />
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>

    <!-- Pagination -->
    <div class="flex items-center justify-between text-sm text-muted-foreground">
      <span>{{ resultCount }} résultat(s)</span>
      <div v-if="totalPages > 1" class="flex items-center gap-2">
        <span>Page {{ currentPage + 1 }} / {{ totalPages }}</span>
        <Button
          variant="outline" size="icon"
          :disabled="currentPage === 0"
          @click="isServerPaginated ? emit('update:serverPage', currentPage - 1) : table.previousPage()"
        >
          <ChevronLeft class="h-4 w-4" />
        </Button>
        <Button
          variant="outline" size="icon"
          :disabled="currentPage >= totalPages - 1"
          @click="isServerPaginated ? emit('update:serverPage', currentPage + 1) : table.nextPage()"
        >
          <ChevronRight class="h-4 w-4" />
        </Button>
      </div>
    </div>
  </div>
</template>
