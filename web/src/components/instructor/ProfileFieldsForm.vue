<script setup lang="ts">
// Instructor profile fields (sign-up and "My profile"): phone, headline, about, areas of expertise.
// The phone number is seen by admins only; the rest shows on the public instructor profile once approved.
import { ref } from 'vue';
import type { ProfileFields } from '@/api/instructors';

const f = defineModel<ProfileFields>({ required: true });
const tag = ref('');
const rules = {
  required: (v: string) => !!v?.trim() || 'Required',
  phone: (v: string) => /^[+\d][\d\s-]{5,29}$/.test(v?.trim() ?? '') || 'Enter a phone number',
};
function addTag() {
  const t = tag.value.trim();
  if (t && !f.value.expertise.includes(t) && f.value.expertise.length < 10) f.value.expertise = [...f.value.expertise, t.slice(0, 60)];
  tag.value = '';
}
</script>

<template>
  <div class="d-flex flex-column ga-1">
    <v-text-field v-model="f.phone" label="Phone (admins only)" type="tel" autocomplete="tel" :rules="[rules.phone]" />
    <v-text-field v-model="f.headline" label="Headline" placeholder="e.g. Network engineer, 10 years in data centres" maxlength="120" counter :rules="[rules.required]" />
    <v-textarea v-model="f.bio" label="About you" hint="Your teaching and work experience. Shown on your public profile." rows="4" auto-grow maxlength="3000" counter :rules="[rules.required]" />
    <div class="d-flex flex-column ga-2">
      <v-text-field
        v-model="tag"
        label="Areas of expertise (optional)"
        hint="Type one and press Enter. Up to 10."
        persistent-hint
        :disabled="f.expertise.length >= 10"
        @keydown.enter.prevent="addTag"
        @blur="addTag"
      />
      <div v-if="f.expertise.length" class="d-flex flex-wrap ga-2">
        <v-chip v-for="t in f.expertise" :key="t" closable size="small" @click:close="f.expertise = f.expertise.filter((x) => x !== t)">{{ t }}</v-chip>
      </div>
    </div>
  </div>
</template>
