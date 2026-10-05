import { isAxiosError } from 'axios'

export function getErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return 'Сервер не ответил вовремя. Обновите данные перед повторной попыткой.'
    }
    if (!error.response) {
      return 'Не удалось получить ответ сервера. Проверьте соединение и обновите данные.'
    }
    const message: unknown = error.response.data?.message
    if (typeof message === 'string' && message) return message
    if (Array.isArray(message) && typeof message[0] === 'string') return message[0]
  }
  return 'Не удалось выполнить запрос. Попробуйте ещё раз.'
}
