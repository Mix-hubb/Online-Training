<script setup lang="ts">
// Error / blocked page panel (mockup NotFound): code label, title, text, one action.
defineProps<{ code: string; title: string; text: string; actionLabel: string; actionTo: string }>();
</script>

<template>
  <div class="page err-wrap">
    <section class="panel err">
      <div class="code">{{ code }}</div>
      <h1 class="title">{{ title }}</h1>
      <p class="text">{{ text }}</p>
      <v-btn color="primary" min-height="48" class="px-6 mt-2" :to="actionTo">{{ actionLabel }}</v-btn>
    </section>
  </div>
</template>

<style scoped>
.err-wrap {
  max-width: 720px;
}
.err {
  padding: 48px 32px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 16px;
}
.code {
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--ot-accent);
}
.title {
  margin: 0;
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.01em;
}
.text {
  margin: 0;
  font-size: 15px;
  line-height: 1.6;
  color: var(--ot-muted);
  max-width: 460px;
}
</style>
