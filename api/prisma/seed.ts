// Demo seed data for LOCAL development only. Run: npm run prisma:seed (or `npx prisma migrate reset`).
// Demo logins (all use SEED_PASSWORD, default "Demo-pass-2026"):
//   admin@example.com (ADMIN), learner@example.com (USER), new.learner@example.com (USER, nothing enrolled),
//   instructor@example.com (INSTRUCTOR), partner@example.com (PARTNER). Full list: docs/TEST_ACCOUNTS.md
// Company details, bank details and partner names are [bracketed] placeholders, never real data.
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const PASSWORD = process.env.SEED_PASSWORD ?? 'Demo-pass-2026';
const API_URL = process.env.API_URL ?? 'http://localhost:4000';
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR ?? 'uploads');

// Flat placeholder image: solid background, thin accent bar, plain sans-serif title.
function svgBody(title: string, bg: string, fg: string, w: number, hgt: number) {
  // Logos (short images) get large centred text; covers and banners get a caption on the left, centred vertically
  // (cards crop covers top and bottom, so a caption near the edge would be cut off).
  const logo = hgt <= 200;
  const fs = logo ? Math.round(hgt * 0.48) : Math.round(hgt / 11);
  const text = logo
    ? `<text x="${w / 2}" y="${Math.round(hgt / 2 + fs / 3)}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="${fs}" fill="${fg}">${title}</text>`
    : `<text x="64" y="${Math.round(hgt / 2 + fs / 3)}" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="${fs}" fill="${fg}">${title}</text>`;
  // Banners and covers have no title (the page shows the text next to the image), so the placeholder is a plain stripe pattern.
  if (!title) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${hgt}" viewBox="0 0 ${w} ${hgt}">
<defs><pattern id="s" width="40" height="40" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="20" height="40" fill="${fg}" fill-opacity="0.08"/></pattern></defs>
<rect width="100%" height="100%" fill="${bg}"/><rect width="100%" height="100%" fill="url(#s)"/></svg>`;
  }
  const bar = logo ? '' : `
<rect x="0" y="${hgt - 12}" width="100%" height="12" fill="${fg}" fill-opacity="0.25"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${hgt}" viewBox="0 0 ${w} ${hgt}">
<rect width="100%" height="100%" fill="${bg}"/>${bar}
${text}</svg>`;
}

// Hand-drawn mockup illustrations kept in prisma/seed-art (used for the home banners).
function art(name: string) {
  const dir = path.join(UPLOAD_DIR, 'public', 'seed');
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(path.join(import.meta.dirname, 'seed-art', `${name}.svg`), path.join(dir, `${name}.svg`));
  return `${API_URL}/files/public/seed/${name}.svg`;
}

function svg(name: string, title: string, bg: string, fg: string, w = 1280, hgt = 720) {
  const dir = path.join(UPLOAD_DIR, 'public', 'seed');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${name}.svg`), svgBody(title, bg, fg, w, hgt));
  return `${API_URL}/files/public/seed/${name}.svg`;
}

async function user(email: string, name: string, role: 'USER' | 'INSTRUCTOR' | 'PARTNER' | 'ADMIN') {
  return prisma.user.upsert({
    where: { email },
    create: { email, name, role, passwordHash: await bcrypt.hash(PASSWORD, 10), emailVerifiedAt: new Date() },
    update: {},
  });
}

// Mockup course about ASIC miner hardware (2026-11-26). Added on its own, so running the seed again on a
// database that already has the demo data adds this course once. Images are original drawings in prisma/seed-art.
async function seedAsicCourse() {
  const slug = 'asic-miner-hardware';
  if (await prisma.course.findUnique({ where: { slug } })) return;
  const hardware = await prisma.category.upsert({ where: { slug: 'hardware' }, create: { name: 'Hardware', slug: 'hardware' }, update: {} });
  const anatomy = art('asic-anatomy');
  const domains = art('asic-hashboard');
  const lesson = (order: number, title: string, description: string, attachmentUrls: string[] = []) => ({
    order,
    title,
    description,
    attachmentUrls,
    bunnyVideoId: `dev-seed-${order}`,
    videoStatus: 'READY' as const,
    durationSec: 240,
    sourceHeight: 1080,
  });
  const mcq = (order: number, text: string, options: [string, boolean][]) => ({
    order,
    type: 'MCQ' as const,
    text,
    points: 1,
    options: { create: options.map(([t, isCorrect]) => ({ text: t, isCorrect })) },
  });

  await prisma.course.create({
    data: {
      slug,
      title: 'ASIC Miner Hardware Basics',
      summary: 'What is inside a Bitcoin ASIC miner, part by part, and how the main brands differ.',
      description:
        'Antminer (Bitmain), Whatsminer (MicroBT) and Avalon (Canaan) miners share one layout: hashboards full of ASIC chips, ' +
        'a power supply, a control board and a cooling system. This course walks through each part, the chips and board models ' +
        'of each brand, and what that means when you diagnose or repair a board.',
      outcomes: [
        'Name the four main parts of an ASIC miner and what each one does',
        'Explain voltage domains and the chip data chain on a hashboard',
        'Recognise the key parts on a hashboard and a control board',
        'Tell Bitmain, MicroBT and Canaan boards apart',
      ],
      thumbnailUrl: art('asic-cover'),
      level: 'BEGINNER',
      status: 'PUBLISHED',
      publishedAt: new Date(),
      isFree: true,
      categoryId: hardware.id,
      lessons: {
        create: [
          lesson(
            1,
            'How an ASIC miner is built',
            'The four main parts. Hashboards carry the ASIC chips that compute SHA-256 and make most of the heat. ' +
              'The control board runs the firmware, sends work to the chips, reads temperature and chip status, and talks to the mining pool over the network. ' +
              'The PSU turns AC mains into DC for the hashboards and the control board. Fans and heatsinks pull the heat out of the case.',
            [anatomy],
          ),
          lesson(
            2,
            'Chips and models by brand',
            'Bitmain uses its BM-series chips (BM1387, BM1397, BM1398, BM1368, BM1370) in models such as the Antminer S9, S19, S19 Pro, S21 and T21. ' +
              'An S19 board has 76 chips in 38 domains; an S19 Pro board has 114 chips. ' +
              'MicroBT builds its own chips for the Whatsminer M20, M30, M31, M50, M53, M60 and M63. ' +
              'Canaan uses A-series chips (such as the A3210) in the Avalon 1047 to 1466; an Avalon 1246 has 3 hashboards and about 90 TH/s in total.',
          ),
          lesson(
            3,
            'Hashboard parts and voltage domains',
            'Chips sit in long rows and pass work along a daisy chain. They are grouped into voltage domains stacked in series, ' +
              'so each domain gets a small slice of the board voltage. Main parts: ASIC chips, power MOSFET on the input (a short makes the board draw too much current), ' +
              'boost circuit and LDO regulators for the small support rails, EEPROM with calibration data (voltage trim and frequency table), ' +
              'PIC or supervisor chip, crystal oscillator, temperature sensors, many decoupling capacitors next to the chips, copper bus bars, and heatsinks.',
            [domains],
          ),
          lesson(
            4,
            'Control board parts',
            'An FPGA (for example an Artix-7) drives the UART chain to the hashboard chips at hardware speed. ' +
              'A CPU or SoC (for example a Zynq 7010 with two ARM Cortex-A9 cores) runs the firmware and manages the system. ' +
              'An Ethernet PHY and RJ45 port bring in work from the pool. UART, SPI and I2C links reach the hashboards, sensors and EEPROMs, ' +
              'and a small regulator section turns the PSU output into the voltages the control board needs.',
          ),
          lesson(
            5,
            'Key differences for repair',
            'Bitmain boards use BM-series chips, have clear domain layouts and the largest repair community and documentation. ' +
              'Whatsminer boards use MicroBT chips and their own domain counts, power layout and connectors, so they need their own test fixtures and methods. ' +
              'Avalon boards use Canaan A-series chips, with boards and firmware clearly different from both.',
          ),
        ],
      },
      quiz: {
        create: {
          passPercent: 60,
          timeLimitMin: 15,
          maxAttempts: 3,
          questions: {
            create: [
              mcq(1, 'Which part computes SHA-256?', [
                ['The ASIC chips on the hashboards', true],
                ['The PSU', false],
                ['The Ethernet PHY', false],
              ]),
              mcq(2, 'Why are chips on a hashboard grouped into voltage domains in series?', [
                ['So each chip can connect to the pool on its own', false],
                ['So each domain takes a small slice of the board voltage', true],
                ['To make the board lighter', false],
              ]),
              mcq(3, 'What does the hashboard EEPROM store?', [
                ['The pool address and password', false],
                ['Video for the control panel', false],
                ['Calibration data such as voltage trim and frequency tables', true],
              ]),
              mcq(4, 'On the control board, what drives the UART chain to the chips at hardware speed?', [
                ['The fan controller', false],
                ['The FPGA', true],
                ['The RJ45 port', false],
              ]),
              mcq(5, 'Which chips are used in Antminer models?', [
                ['Canaan A-series chips', false],
                ['MicroBT chips', false],
                ['Bitmain BM-series chips', true],
              ]),
            ],
          },
        },
      },
    },
  });
  const last = await prisma.banner.findFirst({ orderBy: { order: 'desc' } });
  await prisma.banner.create({
    data: { imageUrl: art('asic-banner'), altText: 'ASIC Miner Hardware Basics', linkUrl: `/courses/${slug}`, order: (last?.order ?? 0) + 1 },
  });
}

async function main() {
  // Extra test account with no enrolments (for trying enrol / buy flows). Upsert, so it is safe to run again.
  await user('new.learner@example.com', 'New Learner', 'USER');
  // Re-running on an existing database adds the ASIC mockup course (it skips itself once present).
  if (await prisma.course.findFirst({ where: { slug: 'mine-safety-basics' } })) {
    await seedAsicCourse();
    console.log('Seed data already present. Use `npx prisma migrate reset` to start over.');
    return;
  }

  const admin = await user('admin@example.com', 'Admin', 'ADMIN');
  const learner = await user('learner@example.com', 'Somchai Learner', 'USER');
  const instructor = await user('instructor@example.com', 'Dr. Napat Instructor', 'INSTRUCTOR');
  const partnerUser = await user('partner@example.com', '[Partner company]', 'PARTNER');

  const [safety, geology, ops] = await Promise.all(
    [
      ['Safety', 'safety'],
      ['Geology', 'geology'],
      ['Operations', 'operations'],
    ].map(([name, slug]) => prisma.category.create({ data: { name, slug } })),
  );
  const tags = await Promise.all(
    ['ppe', 'ventilation', 'surveying', 'blasting', 'first-aid'].map((slug) => prisma.tag.create({ data: { name: slug.replace('-', ' '), slug } })),
  );

  const lessons = (titles: string[], seconds: number) =>
    titles.map((title, i) => ({
      order: i + 1,
      title,
      description: `Lesson ${i + 1}: ${title}.`,
      bunnyVideoId: `dev-seed-${i + 1}`,
      videoStatus: 'READY' as const,
      durationSec: seconds,
      sourceHeight: 1080,
    }));

  const free = await prisma.course.create({
    data: {
      slug: 'mine-safety-basics',
      title: 'Mine Safety Basics',
      summary: 'The rules every person on a mine site must know before day one.',
      description: 'Personal protective equipment, site rules, hazard spotting and what to do in an emergency.',
      outcomes: ['Choose the right PPE for each area', 'Spot the most common hazards', 'Know the emergency steps'],
      // No cover image: the site draws one from the course topic (CourseCover.vue).
      thumbnailUrl: null,
      level: 'BEGINNER',
      status: 'PUBLISHED',
      publishedAt: new Date(),
      isFree: true,
      categoryId: safety.id,
      tags: { create: [{ tagId: tags[0].id }, { tagId: tags[4].id }] },
      lessons: { create: lessons(['Why safety comes first', 'Personal protective equipment', 'Emergency procedures'], 120) },
      quiz: {
        create: {
          passPercent: 70,
          timeLimitMin: 15,
          maxAttempts: 3,
          questions: {
            create: [
              {
                order: 1,
                type: 'MCQ',
                text: 'When must a hard hat be worn?',
                points: 1,
                options: { create: [{ text: 'Only underground', isCorrect: false }, { text: 'In every marked area of the site', isCorrect: true }, { text: 'Only when it rains', isCorrect: false }] },
              },
              {
                order: 2,
                type: 'MCQ',
                text: 'What is the first step when you hear the evacuation alarm?',
                points: 1,
                options: { create: [{ text: 'Finish the current task', isCorrect: false }, { text: 'Stop work and go to the muster point', isCorrect: true }, { text: 'Call your family', isCorrect: false }] },
              },
              {
                order: 3,
                type: 'MCQ',
                text: 'Damaged PPE should be…',
                points: 1,
                options: { create: [{ text: 'Reported and replaced', isCorrect: true }, { text: 'Fixed with tape', isCorrect: false }, { text: 'Used until the shift ends', isCorrect: false }] },
              },
            ],
          },
        },
      },
    },
  });

  const paid = await prisma.course.create({
    data: {
      slug: 'underground-surveying',
      title: 'Underground Surveying',
      summary: 'Measure, map and check underground workings with confidence.',
      description: 'Survey control, instruments, traverses and how to check your work. Ends with a written test graded by the instructor.',
      outcomes: ['Set up survey control underground', 'Run and close a traverse', 'Write a clear survey report'],
      // No cover image: the site draws one from the course topic (CourseCover.vue).
      thumbnailUrl: null,
      level: 'INTERMEDIATE',
      status: 'PUBLISHED',
      publishedAt: new Date(),
      isFree: false,
      priceMinor: 4900,
      priceThbMinor: 159000,
      categoryId: geology.id,
      tags: { create: [{ tagId: tags[2].id }] },
      lessons: { create: lessons(['Survey control', 'Instruments', 'Running a traverse', 'Checking your work'], 180) },
      quiz: {
        create: {
          passPercent: 60,
          timeLimitMin: 30,
          maxAttempts: 2,
          questions: {
            create: [
              {
                order: 1,
                type: 'MCQ',
                text: 'A closed traverse lets you…',
                points: 2,
                options: { create: [{ text: 'Check the misclosure', isCorrect: true }, { text: 'Skip the backsight', isCorrect: false }] },
              },
              { order: 2, type: 'ESSAY', text: 'Explain how you would set up survey control in a new drive.', points: 3 },
            ],
          },
        },
      },
      // Instructor gets 30% of this course's sales, taken before the co-investor share.
      instructors: { create: { userId: instructor.id, assignedBy: admin.id, sharePercentBp: 3000 } },
    },
  });

  await prisma.course.create({
    data: {
      slug: 'ventilation-planning',
      title: 'Ventilation Planning',
      summary: 'Draft course: airflow basics for planners.',
      description: 'Draft.',
      outcomes: [],
      level: 'ADVANCED',
      status: 'DRAFT',
      isFree: true,
      categoryId: ops.id,
      lessons: { create: lessons(['Airflow basics'], 120) },
    },
  });

  await prisma.partner.create({
    data: {
      name: '[Partner company]',
      contact: '[contact person, phone]',
      websiteUrl: 'https://example.com',
      logoUrl: svg('logo-partner', '[Partner]', '#FFFFFF', '#1F6FB8', 480, 160),
      showLogo: true,
      logoOrder: 1,
      userId: partnerUser.id,
      sharePercentBp: 2500, // 25% of each sale after instructor shares
    },
  });
  // The instructor's earnings account. Instructors are paid per course (CourseInstructor.sharePercentBp), never a total share.
  await prisma.partner.create({ data: { name: instructor.name, userId: instructor.id } });
  // Admin pin: listed first in the learner catalog.
  await prisma.course.update({ where: { id: paid.id }, data: { pinOrder: 1 } });

  await prisma.enrollment.create({ data: { userId: learner.id, courseId: free.id } });

  await prisma.banner.createMany({
    data: [
      { imageUrl: art('banner-1'), altText: 'Learn safe mining', linkUrl: '/courses/mine-safety-basics', order: 1 },
      { imageUrl: art('banner-2'), altText: 'Underground Surveying', linkUrl: '/courses/underground-surveying', order: 2 },
    ],
  });

  await prisma.landingSection.createMany({
    data: [
      { key: 'hero', order: 1, content: { title: 'Online Training', subtitle: 'Courses for people who work in mining.' } },
      { key: 'continue', order: 2, content: { title: 'Continue learning' } },
      { key: 'catalog', order: 3, content: { title: 'All courses' } },
      { key: 'partners', order: 4, content: { title: 'Our partners' } },
      {
        key: 'footer',
        order: 5,
        content: {
          companyName: '[Company legal name]',
          address: '[Company address]',
          email: '[contact email]',
          phone: '[phone]',
          copyright: '[© year Company]',
        },
      },
    ],
  });

  await prisma.certificateTemplate.upsert({
    where: { id: 1 },
    create: { id: 1, heading: 'Certificate of Completion', issuerName: '[Issuer name]', signerName: '[Signer name]', signerTitle: '[Signer title]', primaryColor: '#5B9BD0' },
    update: {},
  });

  await seedAsicCourse();

  console.log('Seed done. Demo logins are listed at the top of prisma/seed.ts.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
