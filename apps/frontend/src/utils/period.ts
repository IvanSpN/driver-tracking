const MONTH_NAMES = [
  'январь',
  'февраль',
  'март',
  'апрель',
  'май',
  'июнь',
  'июль',
  'август',
  'сентябрь',
  'октябрь',
  'ноябрь',
  'декабрь',
] as const

export function formatPeriod(period: string): string {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(period)
  if (!match) return period
  return `${match[1]}-${MONTH_NAMES[Number(match[2]) - 1]}`
}
