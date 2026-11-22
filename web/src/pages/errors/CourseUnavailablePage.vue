<script setup lang="ts">
import ErrorPanel from '@/components/common/ErrorPanel.vue';
</script>

<template>
  <ErrorPanel code="COURSE" title="This course is not available right now" text="The course may be unpublished. Your progress is kept if it comes back." action-label="Browse other courses" action-to="/" />
</template>
