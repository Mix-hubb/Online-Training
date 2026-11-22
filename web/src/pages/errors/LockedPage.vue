<script setup lang="ts">
import ErrorPanel from '@/components/common/ErrorPanel.vue';
</script>

<template>
  <ErrorPanel code="LOCKED" title="This lesson is locked" text="Finish the previous lesson first. Lessons open one after another." action-label="My learning" action-to="/profile" />
</template>
