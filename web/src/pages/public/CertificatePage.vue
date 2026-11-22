<script setup lang="ts">
// Public certificate verification: /certificates/:number (spec 6.7). The owner also gets a PDF download.
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import * as certApi from '@/api/certificates';
import { useAuthStore } from '@/stores/auth';
import type { CertificateVerify } from '@/types';
import { date } from '@/utils/format';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const number = String(route.params.number ?? '');
// No number in the URL = the plain "Verify a certificate" form (footer link).
const blank = !number;
const cert = ref<CertificateVerify | null>(null);
const missing = ref(false);
const ownId = ref<string | null>(null);
const query = ref('');

onMounted(async () => {
  if (blank) return void (missing.value = true);
  try {
    cert.value = await certApi.verify(number);
  } catch {
    missing.value = true;
    return;
  }
  if (auth.user) {
    const mine = await certApi.mine().catch(() => []);
    ownId.value = mine.find((c) => c.number === number)?.id ?? null;
  }
});
function check() {
  const n = query.value.trim();
  if (n) void router.push(`/certificates/${encodeURIComponent(n)}`);
}
</script>

<template>
  <div class="page verify">
    <section v-if="missing" class="panel notfound">
      <div class="eyebrow">{{ blank ? 'VERIFY' : 'NOT FOUND' }}</div>
      <h1 class="nf-title">{{ blank ? 'Verify a certificate' : 'We could not find this certificate' }}</h1>
      <p v-if="blank" class="nf-text">Enter the number printed on the certificate to check that it is real.</p>
      <p v-else class="nf-text">No certificate has the number <span class="mono">{{ number }}</span>. Check the number on the certificate and try again.</p>
      <form class="nf-form" @submit.prevent="check">
        <label for="c-num" class="sr-only">Certificate number</label>
        <input id="c-num" v-model="query" type="text" placeholder="OT-2026-000123" class="nf-input" />
        <v-btn type="submit" color="primary" min-height="46">Check</v-btn>
      </form>
    </section>
    <v-skeleton-loader v-else-if="!cert" type="article" color="surface" />
    <template v-else>
      <section class="banner" :class="cert.valid ? 'ok' : 'bad'" aria-labelledby="ver-h">
        <div class="bicon"><v-icon :icon="cert.valid ? 'mdi-check-decagram-outline' : 'mdi-alert-outline'" size="26" /></div>
        <div style="flex: 1 1 300px; min-width: 0">
          <h1 id="ver-h" class="btitle">{{ cert.valid ? 'Valid certificate' : 'This certificate is no longer valid' }}</h1>
          <p class="ma-0 mt-1 text-body-2 text-2">Issued by Online Training, Hidden Mines Co., Ltd.</p>
        </div>
        <v-btn v-if="ownId" color="primary" min-height="46" prepend-icon="mdi-download" @click="certApi.downloadPdf(ownId, cert.number)">Download PDF</v-btn>
      </section>

      <dl class="facts panel">
        <div><dt>Learner</dt><dd>{{ cert.name }}</dd></div>
        <div>
          <dt>Course</dt>
          <dd><router-link :to="`/courses/${cert.courseSlug}`" class="clink">{{ cert.course }}</router-link></dd>
        </div>
        <div><dt>Date issued</dt><dd>{{ date(cert.issuedAt) }}</dd></div>
        <div><dt>Certificate number</dt><dd class="mono">{{ cert.number }}</dd></div>
      </dl>

      <div class="paper" aria-hidden="true">
        <span class="p-brand">Online Training</span>
        <span class="p-head">Certificate of Completion</span>
        <span class="p-small">This certifies that</span>
        <span class="p-name">{{ cert.name }}</span>
        <span class="p-small">has successfully completed the course</span>
        <span class="p-course">{{ cert.course }}</span>
        <span class="p-small mt-3">Certificate no. {{ cert.number }} · {{ date(cert.issuedAt) }}</span>
      </div>
    </template>
  </div>
</template>

<style scoped>
.verify {
  max-width: 960px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.banner {
  border: 1px solid var(--ot-success-border);
  border-radius: var(--ot-radius-card);
  background: var(--ot-success-bg);
  padding: 20px 24px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
  --tone: var(--ot-success);
}
.banner.bad {
  border-color: var(--ot-warning-border);
  background: var(--ot-warning-bg);
  --tone: var(--ot-warning);
}
.bicon {
  flex: none;
  width: 44px;
  height: 44px;
  border-radius: 22px;
  background: var(--ot-surface);
  color: var(--tone);
  display: flex;
  align-items: center;
  justify-content: center;
}
.btitle {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: var(--tone);
}
.facts {
  margin: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  overflow: hidden;
}
.facts > div {
  padding: 18px 22px;
  border-bottom: 1px solid var(--ot-border);
}
.facts dt {
  font-size: 12px;
  color: var(--ot-muted);
}
.facts dd {
  margin: 6px 0 0;
  font-size: 16px;
  font-weight: 600;
}
.clink {
  color: var(--ot-text);
  text-decoration: none;
}
.clink:hover {
  color: var(--ot-accent-strong);
}
.paper {
  border-radius: var(--ot-radius-card);
  border: 1px solid var(--ot-border);
  border-top: 4px solid var(--ot-accent);
  background: var(--ot-raised);
  padding: 40px 32px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  text-align: center;
  aspect-ratio: 297 / 210;
  box-shadow: var(--ot-shadow-card);
}
.p-brand {
  font-size: 12px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--ot-accent);
  font-weight: 600;
}
.p-head {
  font-size: 34px;
  font-weight: 600;
}
.p-name {
  font-size: 28px;
  font-weight: 600;
}
.p-course {
  font-size: 18px;
  font-weight: 600;
}
.p-small {
  font-size: 14px;
  color: var(--ot-muted);
}
.notfound {
  padding: 48px 32px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 16px;
}
.eyebrow {
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--ot-danger);
}
.nf-title {
  margin: 0;
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.01em;
}
.nf-text {
  margin: 0;
  font-size: 15px;
  line-height: 1.6;
  color: var(--ot-muted);
  max-width: 480px;
}
.nf-form {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: center;
  width: 100%;
  max-width: 460px;
  margin-top: 8px;
}
.nf-input {
  flex: 1 1 220px;
  height: 46px;
  padding: 0 14px;
  border-radius: var(--ot-radius-control);
  border: 1px solid var(--ot-input-border);
  background: var(--ot-surface);
  color: var(--ot-text);
  font-size: 14px;
}
.nf-input:focus {
  outline: 2px solid var(--ot-accent);
  outline-offset: -1px;
}
@media (max-width: 600px) {
  .p-head {
    font-size: 24px;
  }
  .p-name {
    font-size: 21px;
  }
  .paper {
    aspect-ratio: auto;
  }
}
</style>
