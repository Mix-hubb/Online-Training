<script setup lang="ts">
import { onMounted, ref } from 'vue';
import AdminPageHeader from '@/components/admin/AdminPageHeader.vue';
import TaxonManager from '@/components/admin/taxonomy/TaxonManager.vue';
import * as api from '@/api/admin/taxonomy';
const cats = ref<api.TaxonRow[]>([]);
const tags = ref<api.TaxonRow[]>([]);
async function load() {
  [cats.value, tags.value] = await Promise.all([api.categories(), api.tags()]);
}
onMounted(load);
</script>
<template>
  <div class="admin-page d-flex flex-column ga-6">
    <AdminPageHeader title="Categories and tags" subtitle="Group courses for the catalog filters. Renaming updates every course that uses it." />
    <div class="tx-grid">
      <TaxonManager title="Categories" :rows="cats" :add="api.addCategory" :rename="api.renameCategory" :remove="api.removeCategory" @changed="load" />
      <TaxonManager title="Tags" :rows="tags" :add="api.addTag" :rename="api.renameTag" :remove="api.removeTag" @changed="load" />
    </div>
  </div>
</template>

<style scoped>
.tx-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
  gap: 20px;
  align-items: start;
}
</style>
