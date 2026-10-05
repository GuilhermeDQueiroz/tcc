<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { dimensionLabels, type AnalyticTable, type Row, type TreeNode, type Column } from '../../types/analytics'
import { formatValue, inferFormat, toCsv } from '../../composables/useFormatters'
import { saveBlob } from '../../api/client'
import AnalysisFrame from '../ui/AnalysisFrame.vue'
import AppIcon from '../ui/AppIcon.vue'
import LoadingState from '../ui/LoadingState.vue'
import {sortTableRows} from '../../domain/analytics/tableRows'
const props = withDefaults(defineProps<{ table: AnalyticTable; loading?:boolean; loadingLabel?:string; embedded?:boolean; server?: boolean; totalRows?: number; page?: number; pageSize?: number; selectedKeys?: string[]; initialSort?: string; initialDirection?: 'asc'|'desc'; selectable?:boolean; selectedRowId?:string; autoExpand?:boolean; fit?:boolean; columnWidths?:Record<string,number>; pagination?:boolean; hideTitle?:boolean }>(), { server: false, page: 1, pageSize: 20, pagination:true })
const emit = defineEmits<{ drilldown: [dimension: string, value: unknown]; page: [page: number]; pageSize: [size: number]; sort: [key: string, direction: 'asc'|'desc']; columns: [keys: string[]]; export: []; select:[row:Row] }>()
const sortKey = ref(props.initialSort || ''), sortDirection = ref<'asc'|'desc'>(props.initialDirection || 'desc'), localPage = ref(1), localSize = ref(props.pageSize), selectedColumns = ref<string[]>([]), orderedColumns = ref<Column[]>([]), availableColumns = ref<Column[]>([]), expanded = ref(new Set<string>()), columnMenu = ref(false), dragging = ref('')
watch(() => props.table, (table,previous) => {
  const reset = previous?.placeholder || (previous && previous.id !== table.id)
  const known = new Map((reset ? [] : availableColumns.value).map(column => [column.key, column])); for (const column of table.columns) known.set(column.key, column)
  availableColumns.value = [...known.values()]
  const order = !reset && orderedColumns.value.length ? orderedColumns.value.map(column => column.key) : props.selectedKeys || []; orderedColumns.value = [...table.columns].sort((a,b) => { const ai = order.indexOf(a.key), bi = order.indexOf(b.key); return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi) })
  if (!selectedColumns.value.length || reset) selectedColumns.value = props.selectedKeys?.length ? [...props.selectedKeys] : table.columns.map(column => column.key)
  if (reset) expanded.value = new Set()
  localPage.value = 1
  if(props.autoExpand) expanded.value=new Set(table.rows.filter(row=>Array.isArray(row.children)&&row.children.length).map(row=>String(row.node_id||row.id)))
}, { immediate: true })
const visibleColumns = computed(() => orderedColumns.value.filter(column => selectedColumns.value.includes(column.key)))
const tableStyle=computed(()=>props.columnWidths?{tableLayout:'fixed' as const,width:visibleColumns.value.reduce((sum,column)=>sum+(props.columnWidths?.[column.key]||130),0)+'px',minWidth:'100%'}:undefined)
function sortRows<T extends Row>(rows: T[]): T[] {
  if (!sortKey.value || props.server) return rows
  const key = availableColumns.value.find(column => column.key === sortKey.value)?.sortKey || sortKey.value
  return sortTableRows(rows,key,sortDirection.value)
}
const roots = computed(() => props.table.tree?.length ? props.table.tree : props.table.rows)
const sortedRoots = computed(() => sortRows(roots.value))
watch(()=>props.selectedRowId,id=>{if(!id||props.server)return;const index=sortedRoots.value.findIndex(row=>String(row.node_id||row.id)===id);if(index>=0)localPage.value=Math.floor(index/localSize.value)+1})
const currentPage = computed(() => props.server ? props.page : localPage.value), size = computed(() => props.server ? props.pageSize : localSize.value)
const rowCount = computed(() => props.server ? props.totalRows ?? props.table.rows.length : roots.value.length)
const pages = computed(() => Math.max(1, Math.ceil(rowCount.value / size.value)))
const visibleRows = computed(() => {
  const roots = props.server || !props.pagination ? sortedRoots.value : sortedRoots.value.slice((currentPage.value-1)*size.value, currentPage.value*size.value)
  const result: { row: Row; id: string; depth: number; hasChildren: boolean }[] = []
  function walk(nodes: Row[], depth: number, prefix: string) {
    (depth===0?nodes:sortRows(nodes)).forEach((node,index) => { const id = String(node.node_id || node.id || `${prefix}-${index}`), children = Array.isArray(node.children) ? node.children as TreeNode[] : []; const row = node.row && typeof node.row === 'object' ? { ...node, ...(node.row as Row) } : node; result.push({ row, id, depth, hasChildren: children.length > 0 }); if (expanded.value.has(id)) walk(children, depth+1, id) })
  }
  walk(roots,0,'root'); return result
})
function sortBy(key: string) { sortDirection.value = sortKey.value === key && sortDirection.value === 'desc' ? 'asc' : 'desc'; sortKey.value = key; if (props.server) emit('sort', key, sortDirection.value) }
function toggle(id: string) { const values = new Set(expanded.value); values.has(id) ? values.delete(id) : values.add(id); expanded.value = values }
function expandAll() { if (expanded.value.size) { expanded.value = new Set(); return }; const values = new Set<string>(); function walk(nodes: Row[], prefix: string) { nodes.forEach((node,index) => { const id = String(node.node_id || node.id || `${prefix}-${index}`); if (Array.isArray(node.children) && node.children.length) { values.add(id); walk(node.children as Row[],id) } }) }; walk(roots.value,'root'); expanded.value = values }
function moveColumn(target: string) { if (!dragging.value || target === dragging.value) return; const columns = [...orderedColumns.value], source = columns.findIndex(column => column.key === dragging.value), dest = columns.findIndex(column => column.key === target); if (source < 0 || dest < 0) return; columns.splice(dest,0,columns.splice(source,1)[0]!); orderedColumns.value = columns; dragging.value = ''; if (props.server) emit('columns',columns.filter(column => selectedColumns.value.includes(column.key)).map(column => column.key)) }
function selectColumn(key: string) { const values = selectedColumns.value.includes(key) ? selectedColumns.value.filter(value => value !== key) : [...selectedColumns.value,key]; if (!values.length) return; selectedColumns.value = values; if (props.server) emit('columns',values) }
function changePage(value: number) { if (props.server) emit('page',value); else localPage.value = value }
function changeSize(event: Event) { const value = Number((event.target as HTMLSelectElement).value); if (props.server) emit('pageSize',value); else { localSize.value = value; localPage.value = 1 } }
function exportRows() { if (props.server) { emit('export'); return }; saveBlob(new Blob([toCsv(sortedRoots.value,visibleColumns.value)], { type: 'text/csv;charset=utf-8' }), `${props.table.id}.csv`) }
function isNumeric(column:Column){return !!column.format&&!['text','date','month'].includes(column.format)}
function progressWidth(row: Row,column: Column) { const value=Number(row[column.key] || 0); return Math.max(0,Math.min(100,value <= 1 ? value*100 : value)) }
function cell(row: Row, column: Column, index: number) { const value = index===0 && row.col_name && column.format==='text' ? [row.name,row[String(row.col_name)],row[column.key]].find(value=>value!=null && String(value).trim()!=='') ?? 'Não informado' : row[column.key] ?? (index === 0 ? row.name : undefined); return formatValue(value, column.key==='% Part' || column.format==='progress' ? 'progress' : column.format || (typeof value === 'string' ? 'text' : inferFormat(column.key))) }
function drillKey(row: Row, column: Column) { return String(row._dimension || row.col_name || column.dimension || props.table.dimension || (dimensionLabels[column.key] ? column.key : '')) }
function drill(row: Row, column: Column) { const key = drillKey(row,column); if (key) emit('drilldown', key, row._value ?? row[key] ?? row[column.key] ?? row.name) }
function selectRow(row:Row){if(props.selectable&&!props.loading)emit('select',row)}
defineExpose({exportRows,expandAll,availableColumns,selectedColumns,selectColumn})
</script>
<template><AnalysisFrame class="analytic-table" :class="{'analysis-embedded':embedded,'fit-viewport':fit,'sized-columns':!!columnWidths,'title-hidden':hideTitle}" :data-table-id="table.id" :aria-label="table.title" :title="table.title" icon="table" :busy="loading">
<template #controls><slot name="controls"/></template>
<template #config><fieldset><legend>Colunas exibidas</legend><label v-for="column in availableColumns" :key="column.key"><input type="checkbox" :checked="selectedColumns.includes(column.key)" @change="selectColumn(column.key)">{{column.label}}</label></fieldset><div class="config-actions"><button v-if="table.tree?.length" @click="expandAll"><AppIcon name="layers"/>{{expanded.size ? 'Recolher todos' : 'Expandir todos'}}</button><button @click="exportRows"><AppIcon name="download"/>Exportar CSV</button></div></template>
<div class="table-viewport"><div class="table-scroll" :inert="loading || undefined"><table :class="{ 'has-tree': !!table.tree?.length }" :style="tableStyle"><colgroup v-if="columnWidths"><col v-for="column in visibleColumns" :key="column.key" :style="{width:(columnWidths[column.key]||130)+'px'}"></colgroup><thead><tr><th v-for="(column, cIdx) in visibleColumns" :key="column.key" :title="column.label" :class="{numeric:isNumeric(column)}" draggable="true" :aria-sort="sortKey===column.key ? sortDirection==='asc' ? 'ascending' : 'descending' : 'none'" @dragstart="dragging=column.key" @dragover.prevent @drop.prevent="moveColumn(column.key)"><button @click="sortBy(column.key)"><span v-if="cIdx === 0 && table.tree?.length" class="matrix-expand-all" :title="expanded.size ? 'Recolher todos os níveis' : 'Expandir todos os níveis'" @click.stop="expandAll">{{ expanded.size ? '⊟' : '⊞' }}</span><span aria-hidden="true" class="drag-handle">⠿</span>{{ column.label }} <span aria-hidden="true">{{ sortKey===column.key ? sortDirection==='asc' ? '↑' : '↓' : '↕' }}</span></button></th></tr></thead><tbody><tr v-for="item in visibleRows" :key="item.id" :data-row-id="item.id" :class="{ 'child-row': item.depth > 0, 'selectable-row':selectable, 'selected-row':selectedRowId===item.id }" @click="selectRow(item.row)"><td v-for="(column,index) in visibleColumns" :key="column.key" :title="cell(item.row,column,index)" :class="{ numeric:isNumeric(column) }" :style="index===0 ? {paddingLeft: `${14+item.depth*22}px`} : undefined"><div v-if="index===0" class="tree-identity"><span v-if="item.depth > 0" class="tree-branch-icon" :style="{ color: item.depth === 1 ? '#006a3a' : item.depth === 2 ? '#4e9d2d' : '#64748b' }">↳</span><button v-if="item.hasChildren" class="expand-row" :class="{ 'is-expanded': expanded.has(item.id) }" :aria-expanded="expanded.has(item.id)" :aria-label="`Expandir ${cell(item.row,column,index)}`" @click.stop="toggle(item.id)">{{ expanded.has(item.id) ? '▾' : '▸' }}</button><button v-if="drillKey(item.row,column)" class="cell-link" :title="cell(item.row,column,index)" @click.stop="drill(item.row,column)">{{ cell(item.row,column,index) }}</button><button v-else-if="selectable" class="cell-link row-select-link" :aria-pressed="selectedRowId===item.id" :aria-label="`Selecionar ${cell(item.row,column,index)}`" :title="cell(item.row,column,index)" @click.stop="selectRow(item.row)">{{cell(item.row,column,index)}}</button><span v-else :title="cell(item.row,column,index)">{{ cell(item.row,column,index) }}</span></div><span v-else-if="column.key === '% Part' || column.format === 'progress'" class="progress-cell"><span class="progress-track"><span :style="{width:`${progressWidth(item.row,column)}%`}"></span></span><span class="progress-value">{{ cell(item.row,column,index) }}</span></span><template v-else>{{ cell(item.row,column,index) }}</template></td></tr><tr v-if="!visibleRows.length && !loading"><td :colspan="visibleColumns.length" class="empty-table">Nenhum registro encontrado para este recorte.</td></tr></tbody><tfoot v-if="table.total || table.average"><tr v-for="(row,label) in { ...(table.total ? { TOTAL: table.total } : {}), ...(table.average ? { MÉDIA: table.average } : {}) }" :key="label"><td v-for="(column,index) in visibleColumns" :key="column.key" :class="{numeric:isNumeric(column)}">{{ index===0 ? row?.[column.key] || label : cell(row || {},column,index) }}</td></tr></tfoot></table></div><LoadingState :active="!!loading" overlay :label="loadingLabel || 'Carregando tabela…'"/></div>
<footer v-if="pagination" class="table-footer" :inert="loading || undefined"><label>Itens por página<select :value="size" @change="changeSize"><option v-for="value in [15,20,30,50,100]" :key="value">{{ value }}</option><option v-if="rowCount>0" :value="rowCount">Todos</option></select></label><span>{{ rowCount ? ((currentPage-1)*size+1).toLocaleString('pt-BR') : 0 }}–{{ Math.min(currentPage*size,rowCount).toLocaleString('pt-BR') }} de {{ rowCount.toLocaleString('pt-BR') }} registros</span><div><button aria-label="Página anterior" :disabled="currentPage<=1" @click="changePage(currentPage-1)">‹</button><span>{{ currentPage }} / {{ pages }}</span><button aria-label="Próxima página" :disabled="currentPage>=pages" @click="changePage(currentPage+1)">›</button></div></footer></AnalysisFrame></template>








<style scoped>
.selectable-row{cursor:pointer}.selectable-row.selected-row td{background:#e4f3db;color:#174a30}.selectable-row.selected-row td:first-child{box-shadow:inset 3px 0 #00713b}.row-select-link{font-weight:600}
</style>
