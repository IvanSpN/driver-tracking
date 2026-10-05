<template>
  <span class="loading-spinner" aria-hidden="true" />
</template>

<style scoped>
.loading-spinner {
  display: inline-block;
  width: 1em;
  height: 1em;
  flex-shrink: 0;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: spin 0.75s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .loading-spinner {
    animation: none;
  }
}
</style>
