<script setup lang="ts">
// Footer (mockup): brand + description, Learn, Account, Contact (LandingSection "footer"), copyright row.
import { computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import BrandMark from './BrandMark.vue';
import { useLanding } from '@/composables/useLanding';

const { landing, load } = useLanding();
onMounted(load);
const route = useRoute();
// The home page already shows the scrolling partner strip, so the footer row is left out there (mockup).
const partners = computed(() => (route.name === 'home' ? [] : landing.value?.partners ?? []));
const footer = computed(() => (landing.value?.sections.footer?.content ?? {}) as Record<string, string>);
</script>

<template>
  <v-footer class="d-block pa-0 site-footer">
    <div class="footer-inner">
      <div class="footer-cols">
        <div class="col-brand">
          <div class="d-flex align-center ga-2 brand"><BrandMark /><span>Online Training</span></div>
          <p>Practical video courses for people who work in mining. Learn at your own pace and earn a certificate.</p>
        </div>
        <div class="col-links">
          <div class="col-title">Learn</div>
          <router-link to="/">All courses</router-link>
          <router-link :to="{ path: '/', query: { price: 'free' } }">Free courses</router-link>
          <router-link to="/profile">My learning</router-link>
        </div>
        <div class="col-links">
          <div class="col-title">Account</div>
          <router-link to="/login">Log in</router-link>
          <router-link to="/profile/orders">Orders</router-link>
          <router-link to="/certificates">Verify a certificate</router-link>
        </div>
        <div class="col-contact">
          <div class="col-title">Contact</div>
          <div>{{ footer.companyName || 'Hidden Mines Co., Ltd.' }}</div>
          <div v-if="footer.address">{{ footer.address }}</div>
          <div v-if="footer.phone">Tel. {{ footer.phone }}</div>
          <div v-if="footer.email">{{ footer.email }}</div>
          <div v-if="footer.website">{{ footer.website }}</div>
        </div>
      </div>
      <div v-if="partners.length" class="footer-partners" aria-label="Our partners">
        <span class="col-title mb-0">Our partners</span>
        <component :is="p.websiteUrl ? 'a' : 'span'" v-for="p in partners" :key="p.id" :href="p.websiteUrl ?? undefined" target="_blank" rel="noopener" class="flogo" :title="p.name">
          <img v-if="p.logoUrl" :src="p.logoUrl" :alt="p.name" />
          <span v-else>{{ p.name }}</span>
        </component>
      </div>
      <div class="footer-bottom">
        <span>© 2026 Hidden Mines Co., Ltd. All rights reserved.</span>
        <nav class="legal-links" aria-label="Legal">
          <router-link to="/terms">Terms of Service</router-link>
          <router-link to="/privacy">Privacy Policy</router-link>
        </nav>
      </div>
    </div>
  </v-footer>
</template>

<style scoped>
.site-footer {
  position: relative;
  background: var(--ot-navy) !important;
  color: var(--ot-on-navy-muted);
}
/* Thin blue-to-amber line on top */
.site-footer::before {
  content: '';
  position: absolute;
  inset: 0 0 auto;
  height: 3px;
  background: linear-gradient(90deg, var(--ot-accent) 0%, var(--ot-topic-2-fg) 50%, var(--ot-hl) 100%);
}
.site-footer a:focus-visible {
  outline-color: var(--ot-hl);
}
.footer-inner {
  max-width: var(--ot-page-max);
  margin: 0 auto;
  padding: 48px var(--ot-gutter) 24px;
}
.footer-cols {
  display: flex;
  flex-wrap: wrap;
  gap: 40px 64px;
  font-size: 14px;
}
.col-brand {
  flex: 1 1 280px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.col-brand p {
  margin: 0;
  line-height: 1.6;
  max-width: 340px;
}
.brand {
  color: var(--ot-surface);
  font-family: var(--ot-font-display);
  font-weight: 700;
  font-size: 18px;
}
.col-links {
  flex: 0 1 160px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.col-contact {
  flex: 1 1 260px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  line-height: 1.5;
}
.col-title {
  color: var(--ot-surface);
  font-family: var(--ot-font-display);
  font-weight: 600;
  margin-bottom: 4px;
}
.col-links a {
  color: var(--ot-on-navy-muted);
  text-decoration: none;
  transition: color var(--ot-transition);
}
.col-links a:hover {
  color: var(--ot-surface);
  text-decoration: underline;
}
.footer-partners {
  margin-top: 36px;
  padding-top: 20px;
  border-top: 1px solid var(--ot-navy-2);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  font-size: 14px;
}
.flogo {
  width: 120px;
  height: var(--ot-control-h);
  border: 1px solid var(--ot-border);
  border-radius: var(--ot-radius-control);
  background: var(--ot-surface);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: var(--ot-faint);
  text-decoration: none;
  overflow: hidden;
}
.flogo img {
  max-width: 104px;
  max-height: 26px;
  object-fit: contain;
}
.footer-bottom {
  margin-top: 32px;
  padding-top: 20px;
  border-top: 1px solid var(--ot-navy-2);
  font-size: 13px;
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 8px 24px;
}
.legal-links {
  display: flex;
  gap: 20px;
}
.legal-links a {
  color: var(--ot-on-navy-muted);
  text-decoration: none;
}
.legal-links a:hover {
  color: var(--ot-surface);
  text-decoration: underline;
}
</style>
