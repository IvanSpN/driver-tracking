<script setup lang="ts">
import { reactive, watch } from 'vue'
import BaseModal from './BaseModal.vue'
import LoadingButton from './LoadingButton.vue'
import type { Driver, DriverInput } from '../api/drivers'

const props = defineProps<{
  open: boolean
  driver?: Driver | null
  saving?: boolean
  error?: string
}>()
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
  if (props.saving) return
  emit('save', { ...form })
}
</script>

<template>
  <BaseModal
    :open="open"
    :title="driver ? 'Редактировать водителя' : 'Новый водитель'"
    :busy="saving"
    :error="error"
    @close="emit('close')"
  >
    <form class="form" @submit.prevent="submit">
      <fieldset class="form form-fields" :disabled="saving">
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
          <LoadingButton
            type="submit"
            class="btn-primary"
            :loading="saving"
            loading-text="Сохраняем…"
            >Сохранить</LoadingButton
          >
        </div>
      </fieldset>
    </form>
  </BaseModal>
</template>
