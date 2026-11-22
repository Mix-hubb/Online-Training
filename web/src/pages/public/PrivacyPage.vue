<script setup lang="ts">
// Privacy Policy (/privacy). Lists only what the system really stores and the services it really uses.
// Placeholders in [brackets]; needs legal review (Thai PDPA) before launch.
import LegalDoc, { type LegalSection } from '@/components/common/LegalDoc.vue';

const sections: LegalSection[] = [
  {
    id: 'who',
    title: 'Who we are',
    paragraphs: [
      'Online Training is run by Hidden Mines Co., Ltd., [registered address]. We are responsible for the personal data described here. Contact for privacy questions: [privacy contact email]. [Data Protection Officer, if appointed: name and contact.]',
    ],
  },
  {
    id: 'collect',
    title: 'What we collect',
    items: [
      'Account: your name, email address, and your password (stored only as a secure hash, never in plain text). If you sign in with Google, we get your name, email and Google account ID from Google.',
      'Learning: the courses you enroll in, which lessons you watched and how far, your final test answers and scores, and your certificates.',
      'Orders: what you bought, the price, the payment method, the payment status and the receipt link. For bank transfers, the slip image you upload.',
      'Messages: what you write to our support team or a course instructor, and images you attach.',
      'Technical data: your IP address and basic request details, used to keep the site secure (for example, to limit repeated login attempts).',
    ],
  },
  {
    id: 'not-collect',
    title: 'What we do not collect',
    items: [
      'We do not see or store your full card number. Card details go straight to Stripe.',
      'We do not use advertising or tracking cookies.',
      'We do not sell your personal data.',
    ],
  },
  {
    id: 'use',
    title: 'How we use it',
    items: [
      'to create and run your account, and let you log in;',
      'to give you access to the courses you enrolled in and save your progress;',
      'to grade tests and issue certificates;',
      'to take payments and keep order records;',
      'to answer your messages;',
      'to send account emails, such as email verification, password reset and password change notices;',
      'to keep the site secure and stop abuse.',
    ],
  },
  {
    id: 'basis',
    title: 'Legal basis',
    paragraphs: [
      'We use your data to provide the service you signed up for (contract), to meet legal and accounting duties, and for our legitimate interest in keeping the site secure. [Legal review: confirm the bases under the Thai Personal Data Protection Act B.E. 2562 (PDPA).]',
    ],
  },
  {
    id: 'cookies',
    title: 'Cookies',
    paragraphs: [
      'We use one cookie that keeps you logged in. It is required for the site to work and cannot be read by page scripts. Stripe may set its own cookies on its checkout page, and Google may when you use Google sign-in.',
    ],
  },
  {
    id: 'share',
    title: 'Who can see your data',
    items: [
      'Our staff (admins) can see account, learning, order and message data to run the site.',
      'Instructors can see the learners, progress and test answers of the courses they teach, and messages sent to them about those courses.',
      'Partners who receive a revenue share see sales totals only, never buyer names or email addresses.',
      'Anyone with a certificate number can see the name, course and date on that certificate.',
    ],
  },
  {
    id: 'processors',
    title: 'Services we use',
    paragraphs: ['These companies process data for us, only to provide their service:'],
    items: [
      'Stripe: card and PromptPay payments.',
      'Resend: sending account emails.',
      'Google: Google sign-in (only if you choose it).',
      '[Video provider, e.g. Bunny]: video streaming.',
      '[File storage provider]: storing images such as course covers, slips and message attachments.',
      '[Hosting providers, e.g. Railway and Vercel]: running the site and database.',
      'Some of these companies store data outside Thailand. [Legal review: cross-border transfer wording.]',
    ],
  },
  {
    id: 'keep',
    title: 'How long we keep it',
    paragraphs: [
      'We keep your account data while your account is open. Order records are kept for [number] years for accounting. Certificates stay valid and checkable [confirm period]. [Company to set retention periods for messages, slips and security logs.]',
    ],
  },
  {
    id: 'rights',
    title: 'Your rights',
    paragraphs: ['Under the PDPA you can ask us to:'],
    items: [
      'see and get a copy of your personal data;',
      'correct data that is wrong;',
      'delete your data, or stop or limit how we use it, where the law allows;',
      'move your data to another service where the law allows;',
      'withdraw consent you gave earlier.',
    ],
  },
  {
    id: 'rights-how',
    title: 'How to use your rights',
    paragraphs: [
      'Email [privacy contact email]. We will reply within [30] days. You can also complain to the Personal Data Protection Committee (PDPC) of Thailand.',
    ],
  },
  {
    id: 'security',
    title: 'Security',
    paragraphs: [
      'We use encrypted connections (HTTPS), hash passwords, limit repeated login attempts, and give staff only the access they need. No system is perfectly secure, so please use a strong password that you do not use anywhere else.',
    ],
  },
  {
    id: 'children',
    title: 'Children',
    paragraphs: ['The site is meant for adults working in or training for the mining industry. [Minimum age to be confirmed.]'],
  },
  {
    id: 'changes',
    title: 'Changes to this policy',
    paragraphs: ['We may update this policy. The date at the top shows the latest version. If a change is important, we will tell you by email or on the site.'],
  },
];
</script>

<template>
  <LegalDoc
    title="Privacy Policy"
    updated="[date]"
    intro="This policy explains what personal data Online Training collects, why, who can see it, and what you can ask us to do with it."
    :sections="sections"
  >
    <p class="mt-8 text-body-2">
      See also our <router-link to="/terms" class="row-link">Terms of Service</router-link>.
    </p>
  </LegalDoc>
</template>
