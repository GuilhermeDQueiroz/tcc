import type { Column, Format, Row } from '../types/analytics'
// Python's float formatting rounds the exact binary value, with ties to even.
// Intl rounds decimal ties differently, changing boundary centavos from legacy.
function decimal(value: number, digits: number): string {
  const buffer = new ArrayBuffer(8), view = new DataView(buffer)
  view.setFloat64(0, Math.abs(value)); const bits = view.getBigUint64(0)
  const exponent = Number((bits >> 52n) & 2047n), fraction = bits & ((1n << 52n)-1n)
  const mantissa = exponent ? (1n << 52n) + fraction : fraction
  const power = exponent ? exponent-1023-52 : -1022-52
  let numerator = mantissa * (10n ** BigInt(digits)), denominator = 1n
  if (power >= 0) numerator <<= BigInt(power); else denominator <<= BigInt(-power)
  let rounded = numerator / denominator; const remainder = numerator % denominator
  if (remainder*2n > denominator || (remainder*2n === denominator && rounded%2n === 1n)) rounded++
  const raw = rounded.toString().padStart(digits+1,'0'), integer = digits ? raw.slice(0,-digits) : raw
  const sign = value < 0 || Object.is(value,-0) ? '-' : ''
  return sign + integer.replace(/\B(?=(\d{3})+(?!\d))/g,'.') + (digits ? ',' + raw.slice(-digits) : '')
}
export function formatValue(value: unknown, format: Format = 'number'): string {
  if (format === 'text') return value == null ? '' : String(value)
  if (format === 'date') { if (!value) return '—'; const date = String(value).slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date.split('-').reverse().join('/') : String(value) }
  if (format === 'month') { if (!value) return ''; const parts = String(value).split('-'); return parts.length === 2 ? `${['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'][Number(parts[1])-1]}/${parts[0]!.slice(-2)}` : String(value) }
  if (value == null || value === '' || (typeof value === 'number' && !Number.isFinite(value))) {
    if (['currency', 'brl', 'money', 'BRL'].includes(format)) return 'R$ 0,00'
    if (['volume', 'm3'].includes(format)) return '0,00 m³'
    if (['weight', 'tonnes', 'peso'].includes(format)) return ''
    if (['number', 'integer'].includes(format)) return '0'
    if (['positiveDecimal','serviceDecimal'].includes(format)) return '-'
    return value == null ? '—' : ''
  }
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return String(value)
  if(format==='currencyCompact'){
    const magnitude=Math.abs(numeric),scale=magnitude>=1e9?1e9:magnitude>=1e6?1e6:magnitude>=1e3?1e3:1
    return `R$ ${decimal(numeric/scale,2)}${scale===1e9?' bi':scale===1e6?' mi':scale===1e3?' mil':''}`
  }
  if (format === 'positiveDecimal') return numeric > 0 ? decimal(numeric,1).replaceAll('.','').replace(',','.') : '-'
  if (format === 'serviceDecimal') return decimal(numeric,1).replaceAll('.','').replace(',','.')
  if (format === 'progress') return `${decimal(Math.max(0,Math.min(100,numeric <= 1 ? numeric*100 : numeric)),0)}%`
  if (['currency', 'brl', 'money', 'BRL'].includes(format)) return `R$ ${decimal(numeric, 2)}`
  if (['weight', 'tonnes', 'peso'].includes(format)) return `${decimal(Math.fround(numeric / 1000), 2)} t`
  if (format === 'weight64') return `${decimal(numeric / 1000, 2)} t`
  if (format === 'kg') return `${decimal(numeric, 2)} kg`
  if (['volume', 'm3'].includes(format)) return `${decimal(numeric, 2)} m³`
  if (['percent', 'percentage', 'pct'].includes(format)) return `${decimal(numeric, 1)}%`
  if (format === 'ratio') return `${decimal(numeric * 100, 1)}%`
  if (format === 'days') return `${decimal(numeric, 1)} dias`
  if (format === 'quantity4') return decimal(numeric,4).replace(/0+$/,'').replace(/,$/,'')
  return decimal(numeric, ['decimal', 'float'].includes(format) ? 2 : 0)
}
export function inferFormat(key: string): Format {
  const field = key.toLowerCase()
  if (/data|date|^dt_|ultima_compra|primeira_compra/.test(field)) return 'date'
  if (/^(uf|name|nome|label|grupo|consultor|supervisor|cidade|status|origem|linha|colecao|classificacao|cor|tipo|orgao|segmento|mes)/.test(field)) return 'text'
  if (/percent|pct|otif|particip|ating|yoy|mom|variacao/.test(field)) return 'percent'
  if (/peso|weight/.test(field)) return 'weight'
  if (/volume|m3/.test(field)) return 'volume'
  if (/valor|value|receita|fatura|financeir|ticket|preco|meta|projecao|saldo/.test(field)) return 'currency'
  if (/servico|service|dias|days|recencia/.test(field)) return 'days'
  return 'number'
}
export function compactAxisValue(value: unknown,format: Format='number'): string {
  let numeric=Number(value)
  if(!Number.isFinite(numeric))return ''
  const currency=['currency','brl','money','BRL'].includes(format)
  let unit=''
  if(['weight','tonnes','peso','weight64'].includes(format)){numeric=format==='weight64' ? numeric/1000 : Math.fround(numeric/1000);unit='t'}
  else if(format==='kg')unit='kg'
  else if(['volume','m3'].includes(format))unit='m³'
  else if(['percent','percentage','pct'].includes(format))unit='%'
  else if(format==='ratio'){numeric*=100;unit='%'}
  else if(format==='days')unit='dias'
  const magnitude=Math.abs(numeric),scale=magnitude>=1e9?1e9:magnitude>=1e6?1e6:magnitude>=1e3?1e3:1
  const suffix=scale===1e9?'bi':scale===1e6?'mi':scale===1e3?'mil':''
  const label=decimal(numeric/scale,1).replace(/,0$/,'')
  return `${currency?'R$ ':''}${label}${suffix?' '+suffix:''}${unit?(unit==='%'?'':' ')+unit:''}`
}
export function toCsv(rows: Row[], columns: Column[]): string {
  const escape = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`
  return '\uFEFF' + [columns.map(column => escape(column.label)).join(';'), ...rows.map(row => columns.map(column => escape(row[column.key])).join(';'))].join('\r\n')
}
export const useFormatters = () => ({ formatValue, inferFormat,compactAxisValue })
