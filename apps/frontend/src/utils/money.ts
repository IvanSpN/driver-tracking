const formatter = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' })
const wholeFormatter = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 0,
})

// сумма хранится в копейках (amountMinor)
export function formatMoney(minor: number): string {
  return formatter.format(minor / 100)
}

// без копеек — для сводных сумм в списке (долг, переплата)
export function formatMoneyShort(minor: number): string {
  return wholeFormatter.format(minor / 100)
}
