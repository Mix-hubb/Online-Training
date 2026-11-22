<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import AdminPageHeader from '@/components/admin/AdminPageHeader.vue';
import * as api from '@/api/admin/audit';
import type { Paged } from '@/types';
import { dateTime } from '@/utils/format';
const q = ref({ entity: '', from: '', to: '', page: 1 });
const data = ref<Paged<api.AuditRow> | null>(null);
const open = ref<string | null>(null);
const entities = ['', 'Course', 'Lesson', 'Quiz', 'Question', 'User', 'Partner', 'Order', 'Payout', 'Banner', 'LandingSection', 'Category', 'Tag', 'CertificateTemplate'];
async function load() {
  data.value = await api.list(q.value);
}
onMounted(load);
watch(q, load, { deep: true });
</script>
<template>
  <div class="admin-page d-flex flex-column ga-6">
    <AdminPageHeader title="Audit log" subtitle="Every admin change, newest first." />
    <div class="filters">
      <div class="grow1">
        <label for="a-t" class="sr-only">Type</label>
        <select id="a-t" v-model="q.entity" class="ot-select">
          <option v-for="v in entities" :key="v" :value="v">{{ v || 'All types' }}</option>
        </select>
      </div>
      <div class="grow1"><label for="a-f" class="sr-only">From</label><input id="a-f" v-model="q.from" type="date" class="ot-input" aria-label="From date" /></div>
      <div class="grow1"><label for="a-to" class="sr-only">To</label><input id="a-to" v-model="q.to" type="date" class="ot-input" aria-label="To date" /></div>
    </div>
    <v-skeleton-loader v-if="!data" type="table" color="surface" />
    <div v-else class="table-scroll">
      <table class="data-table" style="min-width: 760px">
        <caption class="sr-only">Audit log</caption>
        <thead>
          <tr><th scope="col">When</th><th scope="col">Who</th><th scope="col">Action</th><th scope="col">Item</th><th scope="col" class="text-right">Details</th></tr>
        </thead>
        <tbody>
          <template v-for="r in data.items" :key="r.id">
            <tr>
              <td class="text-no-wrap text-muted">{{ dateTime(r.at) }}</td>
              <td class="font-weight-medium">{{ r.actor?.name ?? 'System' }}</td>
              <td><span class="tag mono">{{ r.action }}</span></td>
              <td class="text-2">{{ r.entity }} <span class="text-muted mono text-caption">{{ r.entityId?.slice(-8) }}</span></td>
              <td class="text-right">
                <button v-if="r.diff" type="button" class="row-link" :aria-expanded="open === r.id" @click="open = open === r.id ? null : r.id">{{ open === r.id ? 'Hide' : 'Show' }}</button>
              </td>
            </tr>
            <tr v-if="open === r.id">
              <td colspan="5" style="background: var(--ot-raised)"><pre class="mono text-caption ma-0" style="white-space: pre-wrap">{{ JSON.stringify(r.diff, null, 2) }}</pre></td>
            </tr>
          </template>
          <tr v-if="!data.items.length"><td colspan="5" class="text-center text-muted">No entries.</td></tr>
        </tbody>
      </table>
    </div>
    <v-pagination v-if="data && data.pages > 1" v-model="q.page" :length="data.pages" density="comfortable" />
  </div>
</template>
