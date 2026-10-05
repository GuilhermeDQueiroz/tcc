export type Area = 'abertos' | 'emitidos' | 'faturados'
export type Tab = 'resumo' | 'calendario' | 'semanal' | 'mensal' | 'evolucao' | 'geografia' | 'carteira' | 'dimensoes' | 'pesquisa'
export type Row = Record<string, unknown>
export type Format = 'currency' | 'brl' | 'number' | 'integer' | 'decimal' | 'percent' | 'percentage' | 'weight' | 'tonnes' | 'kg' | 'volume' | 'm3' | 'days' | 'date' | 'month' | 'text' | string
export interface Filters { dimensions?: Record<string, string[]>; emissionRange?: [string, string]; billingRange?: [string, string]; includeGroups?: string[]; excludeGroups?: string[]; value?: { operator: string; value: number }; quantity?: { operator: string; value: number }; search?: string }
export interface MetricDetail { label: string; value: number | string | null; format?: Format; percentage?: number | null }
export interface Metric { id: string; label: string; value: number | string | null; format?: Format; subtitle?: string; comparison?: number | string | { value: number | null; label?: string; format?: Format }; comparisons?: MetricDetail[]; supplementary?: MetricDetail[]; help?: string }
export interface Series { id: string; title: string; type: string; rows: Row[]; x?: string; y?: string[] | string; stack?: boolean | string; format?: Format; dimension?: string; horizontal?: boolean; labels?: Record<string, string>; [key: string]: unknown }
export interface Column { key: string; label: string; format?: Format; sortKey?: string; dimension?: string }
export interface TreeNode extends Row { id?: string; node_id?: string; name?: string; row?: Row; children?: TreeNode[] }
export interface AnalyticTable { id: string; title: string; rows: Row[]; columns: Column[]; total?: Row; average?: Row; tree?: TreeNode[]; dimension?: string; [key: string]: unknown }
export interface DashboardPayload { area: Area; tab: Tab; dataVersion: string; source: string; referenceDate: string; metrics: Metric[]; series: Series[]; tables: AnalyticTable[]; meta: Record<string, unknown> }
export interface DimensionsPayload { dataVersion: string; dimensions: Record<string, string[]>; dates?: { emission?: [string, string]; billing?: [string, string] } }
export interface DetailsPayload { dataVersion: string; rows: Row[]; total: number; page: number; pageSize: number; columns: Column[] }
export interface Preset { id: string; name: string; area: Area; filters: Filters }
export type Goals = Record<string, Record<string, number>>
export const areas: { id: Area; label: string; description: string; icon: string }[] = [
  { id: 'abertos', label: 'Pedidos em Aberto', description: 'Carteira e previsão de faturamento', icon: '▤' },
  { id: 'emitidos', label: 'Pedidos Emitidos', description: 'Demanda e acompanhamento comercial', icon: '↗' },
  { id: 'faturados', label: 'Pedidos Faturados', description: 'Faturamento e desempenho', icon: '▥' },
]
export const tabs: Record<Area, { id: Tab; label: string }[]> = {
  abertos: [{ id: 'resumo', label: 'Resumo' }, { id: 'calendario', label: 'Calendário' }, { id: 'geografia', label: 'Geografia' }, { id: 'dimensoes', label: 'Dimensões' }, { id: 'pesquisa', label: 'Pesquisa' }],
  emitidos: [], faturados: [],
}
tabs.emitidos = tabs.faturados = [{ id: 'semanal', label: 'Semanal' }, { id: 'mensal', label: 'Mensal' }, { id: 'evolucao', label: 'Evolução' }, { id: 'geografia', label: 'Geografia' }, { id: 'carteira', label: 'Carteira de Clientes' }, { id: 'dimensoes', label: 'Dimensões' }, { id: 'pesquisa', label: 'Pesquisa' }]
export const dimensionLabels: Record<string, string> = { UF: 'Estado (UF)', REGIAO_UF: 'Região', CIDADE: 'Cidade', MICRO_REGIAO: 'Microregião', SUPERVISOR: 'Supervisor', CONSULTOR: 'Consultor', TIPO_ENTREGA: 'Tipo de entrega', CLASSIFICACAO: 'Classificação', STATUS: 'Status', GRUPO_ITEM: 'Grupo do item', LINHA: 'Linha', SUBGRUPO: 'Subgrupo', TIPO: 'Tipo', COLECAO: 'Coleção', GRUPO_CLIENTE: 'Grupo de Cliente', ORIGEM: 'Origem', ORGAO: 'Órgão', DESCRICAO_ITEM: 'Produto', COR: 'Cor', FAMILIA: 'Família', Aging_Bucket: 'Faixa de tempo', Mes_Grupo: 'Mês de emissão', Mes_Previsao: 'Mês de previsão', Status_Previsao: 'Situação da previsão', Canal: 'Canal', CLIENTE: 'Cliente', CODIGO_PEDIDO: 'Pedido', Ano_Num: 'Ano' }
