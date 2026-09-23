<script setup lang="ts">
import { reactive, watch } from 'vue'
import type { Driver, DriverInput } from '../api/drivers'

const props = defineProps<{ open: boolean; driver?: Driver | null }>()
const emit = defineEmits<{
  close: []
  save: [input: DriverInput]
}>()

const form = reactive<DriverInput>({
  lastName: '',
  firstName: '',
  middleName: '',
  phone: '',
  isOfficial: false,
  note: '',
})

watch(
  () => [props.open, props.driver] as const,
  ([open]) => {
    if (!open) return
    form.lastName = props.driver?.lastName ?? ''
    form.firstName = props.driver?.firstName ?? ''
    form.middleName = props.driver?.middleName ?? ''
    form.phone = props.driver?.phone ?? ''
    form.isOfficial = props.driver?.isOfficial ?? false
    form.note = props.driver?.note ?? ''
  },
  { immediate: true },
)

function submit() {
  emit('save', { ...form })
}
</script>

<template>
  <div v-if="open" class="overlay" @click.self="emit('close')">
    <div class="modal">
      <h2 class="title">{{ driver ? 'Редактировать водителя' : 'Новый водитель' }}</h2>

      <form class="form" @submit.prevent="submit">
        <label class="field">
          <span>Фамилия</span>
          <input v-model="form.lastName" required />
        </label>

        <label class="field">
          <span>Имя</span>
          <input v-model="form.firstName" required />
        </label>

        <label class="field">
          <span>Отчество</span>
          <input v-model="form.middleName" />
        </label>

        <label class="field">
          <span>Телефон</span>
          <input v-model="form.phone" type="tel" />
        </label>

        <label class="checkbox-field">
          <input v-model="form.isOfficial" type="checkbox" />
          <span>Официально (белая)</span>
        </label>

        <label class="field">
          <span>Заметка</span>
          <textarea v-model="form.note" rows="2"></textarea>
        </label>

        <div class="actions">
          <button type="button" class="btn-secondary" @click="emit('close')">Отмена</button>
          <button type="submit" class="btn-primary">Сохранить</button>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgb(0 0 0 / 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  z-index: 100;
}

.modal {
  width: 100%;
  max-width: 420px;
  max-height: 90vh;
  overflow-y: auto;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 24px;
}

.title {
  font-size: 16px;
  margin: 0 0 16px;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  color: var(--text-muted);
}

.field input,
.field textarea {
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 9px 10px;
  font-size: 16px;
  color: var(--text);
  background: var(--bg);
  font-family: inherit;
  resize: vertical;
}

.field input:focus,
.field textarea:focus {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}

.checkbox-field {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 4px;
}

.btn-primary,
.btn-secondary {
  border-radius: var(--radius-sm);
  padding: 8px 14px;
  font-size: 14px;
  cursor: pointer;
  border: 1px solid transparent;
}

.btn-primary {
  background: var(--accent);
  color: var(--accent-fg);
}

.btn-secondary {
  background: var(--bg);
  border-color: var(--border);
  color: var(--text);
}
</style>
