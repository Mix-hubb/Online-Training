<script setup lang="ts">
import { onMounted, ref } from 'vue';
import AdminPageHeader from '@/components/admin/AdminPageHeader.vue';
import * as api from '@/api/admin/settings';
import { errorMessage } from '@/api/client';
const b = ref({ bankName: '', accountName: '', accountNumber: '', note: '' });
const placeholder = ref(false);
const busy = ref(false);
const ok = ref(false);
const err = ref('');
onMounted(async () => {
  const d = await api.bankDetails();
  placeholder.value = d.placeholder;
  b.value = d.placeholder ? { bankName: '', accountName: '', accountNumber: '', note: '' } : { bankName: d.bankName, accountName: d.accountName, accountNumber: d.accountNumber, note: d.note ?? '' };
});
async function save() {
  err.value = '';
  if (!b.value.bankName.trim() || !b.value.accountName.trim() || !b.value.accountNumber.trim()) return void (err.value = 'Fill in bank, account name and number.');
  busy.value = true;
  try {
    const d = await api.saveBankDetails({ ...b.value, note: b.value.note || undefined });
    placeholder.value = d.placeholder;
    ok.value = true;
  } catch (e) {
    err.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <div class="admin-page d-flex flex-column ga-6">
    <AdminPageHeader title="Settings" subtitle="Bank details shown to learners who pay by bank transfer." />
    <section class="panel pa-6 d-flex flex-column ga-1" style="max-width: 680px" aria-labelledby="bank-h">
      <h2 id="bank-h" class="h2">Bank transfer details</h2>
      <p class="text-body-2 text-muted mb-4">Shown to learners who choose bank transfer (THB).</p>
      <v-alert v-if="placeholder" type="warning" variant="tonal" density="compact" class="mb-4">Not set yet. Learners see a warning not to transfer until you add real details.</v-alert>
      <v-alert v-if="err" type="error" variant="tonal" density="compact" class="mb-4">{{ err }}</v-alert>
      <v-text-field v-model="b.bankName" label="Bank" class="mb-2" />
      <v-text-field v-model="b.accountName" label="Account name" class="mb-2" />
      <v-text-field v-model="b.accountNumber" label="Account number" class="mb-2" />
      <v-textarea v-model="b.note" label="Instructions for learners (optional)" rows="2" auto-grow variant="outlined" />
      <div class="d-flex flex-wrap align-center justify-space-between ga-3">
        <span class="text-caption text-muted">{{ placeholder ? 'Real details are not set yet. Learners see placeholders until you save.' : 'Learners see these details on the bank transfer page.' }}</span>
        <v-btn color="primary" :loading="busy" @click="save">Save</v-btn>
      </div>
    </section>
    <section class="panel pa-6" style="max-width: 680px">
      <h2 class="h2 mb-1">Payment and video services</h2>
      <p class="text-body-2 text-muted mb-0">Stripe, Bunny Stream/Storage, Resend and Google sign-in are set with environment variables on the server, not here. Bitcoin is not connected yet.</p>
    </section>
    <v-snackbar v-model="ok" :timeout="2500">Saved</v-snackbar>
  </div>
</template>

<style scoped>
.h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}
</style>
