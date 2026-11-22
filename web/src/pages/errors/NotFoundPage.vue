<script setup lang="ts">
import ErrorPanel from '@/components/common/ErrorPanel.vue';
</script>

<template>
  <ErrorPanel code="404" title="We could not find that page" text="The link may be wrong or the page has moved. Go back to the course catalog and look from there." action-label="Back to courses" action-to="/" />
</template>
