<script setup lang="ts">
import ErrorPanel from '@/components/common/ErrorPanel.vue';
import { homeFor, useAuthStore } from '@/stores/auth';
const auth = useAuthStore();
</script>

<template>
  <ErrorPanel code="403" title="You do not have access to this page" text="Log in with an account that has permission. If you think this is a mistake, contact us." action-label="Go back home" :action-to="homeFor(auth.user?.role)" />
</template>
