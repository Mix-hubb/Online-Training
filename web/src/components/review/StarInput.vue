<script setup lang="ts">
// Star picker built on native radio inputs: arrow keys and screen readers work out of the box.
// Each star is a 44 x 44 target.
import { computed, ref, useId } from 'vue';

const model = defineModel<number>({ default: 0 });
defineProps<{ legend?: string }>();
const hover = ref(0);
const name = `stars-${useId()}`;
const shown = computed(() => hover.value || model.value);
const words = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'];
</script>

<template>
  <fieldset class="star-input">
    <legend class="text-body-2 font-weight-medium mb-1">{{ legend ?? 'Your rating' }}</legend>
    <div class="d-flex align-center flex-wrap ga-2">
      <div class="row" @mouseleave="hover = 0">
        <label v-for="i in 5" :key="i" class="star" :class="{ on: i <= shown }" @mouseenter="hover = i">
          <input v-model="model" class="sr-only" type="radio" :name="name" :value="i" />
          <v-icon :icon="i <= shown ? 'mdi-star' : 'mdi-star-outline'" size="30" aria-hidden="true" />
          <span class="sr-only">{{ i }} {{ i === 1 ? 'star' : 'stars' }}, {{ words[i] }}</span>
        </label>
      </div>
      <span class="text-body-2 text-muted" aria-hidden="true">{{ shown ? words[shown] : 'Choose 1 to 5 stars' }}</span>
    </div>
  </fieldset>
</template>

<style scoped>
.star-input {
  border: 0;
  margin: 0;
  padding: 0;
  min-width: 0;
}
.row {
  display: inline-flex;
}
.star {
  width: 44px;
  height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--ot-radius-control);
  color: var(--ot-faint);
  cursor: pointer;
  transition: color var(--ot-transition), transform var(--ot-transition);
}
.star.on {
  color: var(--ot-star);
}
.star:hover {
  transform: scale(1.08);
}
.star:has(input:focus-visible) {
  outline: 2px solid var(--ot-accent);
  outline-offset: 1px;
}
@media (prefers-reduced-motion: reduce) {
  .star:hover {
    transform: none;
  }
}
</style>
