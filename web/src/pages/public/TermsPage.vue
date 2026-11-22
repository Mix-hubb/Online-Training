<script setup lang="ts">
// Terms of Service (/terms). Placeholders in [brackets]; needs legal review before launch.
import LegalDoc, { type LegalSection } from '@/components/common/LegalDoc.vue';

const sections: LegalSection[] = [
  {
    id: 'about',
    title: 'About these terms',
    paragraphs: [
      'Online Training is run by Hidden Mines Co., Ltd. ("we", "us"), [company registration number], [registered address]. By creating an account or using the site you agree to these terms. If you do not agree, please do not use the site.',
    ],
  },
  {
    id: 'account',
    title: 'Your account',
    items: [
      'You need an account to enroll in a course. Sign up with your email and a password, or with Google.',
      'Give a real name and an email address you can open. Your name is printed on your certificates.',
      'Keep your password private. You are responsible for what happens under your account.',
      'One account is for one person. Do not share it.',
      'You must be at least [minimum age] years old to create an account.',
    ],
  },
  {
    id: 'courses',
    title: 'Courses and access',
    items: [
      'Some courses are free. Paid courses are bought once; there is no subscription.',
      'After payment is confirmed, the course is added to your account and you can watch it for as long as the site runs it. [Confirm if access should have an end date.]',
      'Course content is for your own learning. You may not download, copy, record, share or resell the videos, tests or materials.',
      'We may update a course, for example to fix or add lessons. We may stop offering a course to new learners; learners who already enrolled keep access [confirm].',
    ],
  },
  {
    id: 'payments',
    title: 'Prices and payment',
    items: [
      'Prices are shown in US dollars, and in Thai baht where offered, before you pay.',
      'Card and PromptPay payments are handled by Stripe. Bank transfer payments are checked by our team after you upload the transfer slip. [Bitcoin: add details once the provider is chosen.]',
      'We do not see or store your full card number.',
      'Receipts are provided by the payment provider. Thai tax invoices are [not provided at this time / available on request].',
    ],
  },
  {
    id: 'refunds',
    title: 'Refunds',
    paragraphs: [
      'Purchases are final and the site does not issue refunds. [Company to confirm this policy and any exceptions required by law, then update this section.] If you have a problem with a purchase, contact us using the details below.',
    ],
  },
  {
    id: 'tests',
    title: 'Final tests and certificates',
    items: [
      'Some courses end with a final test. Each test has a pass mark, and may have a time limit and a set number of attempts.',
      'Written answers are graded by our staff or the course instructor.',
      'When you pass, you get a certificate with a unique number. Anyone with the number can check it on the site.',
      'Do not cheat on a test or let another person take it for you. We may cancel a certificate that was earned this way.',
    ],
  },
  {
    id: 'conduct',
    title: 'Acceptable use',
    paragraphs: ['When you use the site, including messages to our team or instructors, you agree not to:'],
    items: [
      'break the law or the rights of others;',
      'send abusive, false or harmful messages or files;',
      'try to get into accounts, data or parts of the site you are not allowed to use;',
      'disrupt the site, or use bots or scripts to scrape it.',
    ],
  },
  {
    id: 'suspension',
    title: 'Suspending accounts',
    paragraphs: [
      'We may suspend or close an account that breaks these terms. Where we can, we will tell you why. [Company to decide what happens to paid courses in this case.]',
    ],
  },
  {
    id: 'ip',
    title: 'Content ownership',
    paragraphs: [
      'The courses, videos, tests, text, logos and design on the site belong to us or to our instructors and partners. Using the site does not give you ownership of them.',
    ],
  },
  {
    id: 'liability',
    title: 'Limits of our responsibility',
    paragraphs: [
      'Courses are for training and general information. They do not replace site-specific safety rules, official certification or professional advice. Always follow the safety rules at your workplace.',
      'We work to keep the site running, but we cannot promise it will always be available or free of errors. [Liability limit to be set by legal review.]',
    ],
  },
  {
    id: 'changes',
    title: 'Changes to these terms',
    paragraphs: [
      'We may update these terms. The date at the top shows the latest version. If a change is important, we will tell you by email or on the site.',
    ],
  },
  {
    id: 'law',
    title: 'Governing law',
    paragraphs: ['These terms are governed by the laws of [Thailand]. [Court or dispute process to be confirmed.]'],
  },
  {
    id: 'contact',
    title: 'Contact us',
    paragraphs: ['Hidden Mines Co., Ltd., [address]. Email: [contact email]. Phone: [phone number].'],
  },
];
</script>

<template>
  <LegalDoc
    title="Terms of Service"
    updated="[date]"
    intro="These terms explain how you can use Online Training, what you get when you enroll in a course, and what we expect from you."
    :sections="sections"
  >
    <p class="mt-8 text-body-2">
      See also our <router-link to="/privacy" class="row-link">Privacy Policy</router-link>.
    </p>
  </LegalDoc>
</template>
