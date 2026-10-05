import { computed, ref } from 'vue'
import { getErrorMessage } from '../utils/errors'

export function useAsyncAction() {
  const activeAction = ref<string | null>(null)
  const error = ref('')
  const pending = computed(() => activeAction.value !== null)

  async function run(key: string, task: () => Promise<unknown>) {
    // Guard synchronously: disabled buttons update on Vue's next render.
    if (pending.value) return
    activeAction.value = key
    error.value = ''
    try {
      await task()
    } catch (cause) {
      error.value = getErrorMessage(cause)
    } finally {
      activeAction.value = null
    }
  }

  return { activeAction, pending, error, run }
}
