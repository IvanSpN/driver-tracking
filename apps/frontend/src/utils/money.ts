const formatter = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' })

// сумма хранится в копейках (amountMinor)
export function formatMoney(minor: number): string {
  return formatter.format(minor / 100)
}
