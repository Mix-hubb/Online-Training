// 2026-11-27: instructors sign up with documents, an admin approves them; instructors own their courses,
// admins review them; owner revenue share; free preview lessons; public instructor profiles.
import { beforeEach, describe, expect, it } from 'vitest';
import { anon, as, makeCourse, makeUser, prisma, resetDb, PASSWORD } from './helpers.js';
import { markOrderPaid } from '../src/lib/order-paid.js';

const pdf = Buffer.from('%PDF-1.4\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n').toString('base64');
const signup = (email: string) => ({
  name: 'New Teacher',
  email,
  password: PASSWORD,
  phone: '0812345678',
  headline: 'Network engineer',
  bio: 'Ten years in data centres.',
  expertise: ['Networking'],
  documents: [
    { title: 'Degree', isPublic: true, file: { name: 'degree.pdf', dataBase64: pdf } },
    { title: 'ID card', isPublic: false, file: { name: 'id.pdf', dataBase64: pdf } },
  ],
});

describe('instructor sign-up and approval', () => {
  beforeEach(resetDb);

  it('signs up as PENDING with documents; tools stay closed until an admin approves', async () => {
    const r = await anon().post('/auth/register-instructor').send(signup('teach@test.local'));
    expect(r.status).toBe(201);
    const u = await prisma.user.findUniqueOrThrow({ where: { email: 'teach@test.local' }, include: { instructorProfile: { include: { documents: true } } } });
    expect(u.role).toBe('INSTRUCTOR');
    expect(u.instructorProfile?.status).toBe('PENDING');
    expect(u.instructorProfile?.documents).toHaveLength(2);
    await prisma.user.update({ where: { id: u.id }, data: { emailVerifiedAt: new Date() } });

    // Own profile works; course tools do not.
    expect((await as(u.id).get('/instructor/profile')).body.status).toBe('PENDING');
    const blocked = await as(u.id).get('/instructor/dashboard');
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe('INSTRUCTOR_NOT_APPROVED');
    expect((await as(u.id).get('/auth/me')).body.user.instructorStatus).toBe('PENDING');

    // Admin sees it under PENDING, approves, sets the share.
    const admin = await makeUser('ADMIN');
    const pending = await as(admin.id).get('/admin/instructors?approval=PENDING');
    expect(pending.body.items.map((i: { id: string }) => i.id)).toContain(u.id);
    expect(pending.body.counts.PENDING).toBe(1);
    expect((await as(admin.id).post(`/admin/instructors/${u.id}/approve`)).status).toBe(200);
    expect((await as(admin.id).put(`/admin/instructors/${u.id}/share`).send({ sharePercentBp: 3000 })).status).toBe(200);
    expect((await as(u.id).get('/instructor/dashboard')).status).toBe(200);
    expect((await prisma.instructorProfile.findUniqueOrThrow({ where: { userId: u.id } })).sharePercentBp).toBe(3000);
  });

  it('a rejected applicant sees the reason and goes back to PENDING after updating', async () => {
    const admin = await makeUser('ADMIN');
    const u = await makeUser('INSTRUCTOR', { instructorStatus: 'PENDING' });
    expect((await as(admin.id).post(`/admin/instructors/${u.id}/reject`).send({ reason: 'Need a teaching certificate' })).status).toBe(200);
    const p = await as(u.id).get('/instructor/profile');
    expect(p.body.status).toBe('REJECTED');
    expect(p.body.rejectReason).toBe('Need a teaching certificate');
    const saved = await as(u.id).put('/instructor/profile').send({ phone: '0812345678', headline: 'H', bio: 'B', expertise: [] });
    expect(saved.body.status).toBe('PENDING');
    expect(saved.body.rejectReason).toBeNull();
  });

  it('rejects a sign-up without documents or with a non-document file', async () => {
    expect((await anon().post('/auth/register-instructor').send({ ...signup('a@test.local'), documents: [] })).status).toBe(400);
    const bad = { ...signup('b@test.local'), documents: [{ title: 'X', isPublic: false, file: { name: 'x.txt', dataBase64: Buffer.from('hello').toString('base64') } }] };
    expect((await anon().post('/auth/register-instructor').send(bad)).status).toBe(415);
    expect(await prisma.user.count({ where: { email: { in: ['a@test.local', 'b@test.local'] } } })).toBe(0);
  });
});

describe('instructor-made courses', () => {
  beforeEach(resetDb);

  it('the owner makes a course, sends it for review; the admin cannot edit it but approves or sends it back', async () => {
    const admin = await makeUser('ADMIN');
    const ins = await makeUser('INSTRUCTOR');
    expect((await as(admin.id).post('/admin/courses').send({ title: 'By admin' })).status).toBe(403);
    const c = (await as(ins.id).post('/instructor/courses').send({ title: 'Mine', summary: 'What you learn' })).body;
    expect(c.status).toBe('DRAFT');
    expect(c.ownerId).toBe(ins.id);

    // Owner cannot publish directly.
    expect((await as(ins.id).post(`/instructor/courses/${c.id}/status`).send({ status: 'PUBLISHED' })).status).toBe(400);
    expect((await as(admin.id).patch(`/admin/courses/${c.id}`).send({ title: 'Changed' })).status).toBe(403);

    // Hidden from the catalog while DRAFT / IN_REVIEW; the owner can preview it.
    expect((await anon().get(`/courses/${c.slug}`)).status).toBe(404);
    expect((await as(ins.id).get(`/courses/${c.slug}`)).status).toBe(200);

    // Sending for review needs a lesson.
    expect((await as(ins.id).post(`/instructor/courses/${c.id}/status`).send({ status: 'IN_REVIEW' })).status).toBe(400);
    expect((await as(ins.id).post(`/instructor/courses/${c.id}/lessons`).send({ title: 'L1' })).status).toBe(201);
    expect((await as(ins.id).post(`/instructor/courses/${c.id}/status`).send({ status: 'IN_REVIEW' })).status).toBe(200);
    const back = await as(admin.id).post(`/admin/courses/${c.id}/reject`).send({ reason: 'Add a final test' });
    expect(back.status).toBe(200);
    const again = await prisma.course.findUniqueOrThrow({ where: { id: c.id } });
    expect(again.status).toBe('DRAFT');
    expect(again.reviewNote).toBe('Add a final test');

    await as(ins.id).post(`/instructor/courses/${c.id}/status`).send({ status: 'IN_REVIEW' });
    expect((await anon().get(`/courses/${c.slug}`)).status).toBe(404);
    expect((await as(admin.id).post(`/admin/courses/${c.id}/approve`)).status).toBe(200);
    const pub = await anon().get(`/courses/${c.slug}`);
    expect(pub.status).toBe(200);
    expect(pub.body.owner).toMatchObject({ id: ins.id, public: true });
  });

  it('a co-instructor edits lessons but not details; the owner manages the team', async () => {
    const owner = await makeUser('INSTRUCTOR');
    const co = await makeUser('INSTRUCTOR');
    const stranger = await makeUser('INSTRUCTOR');
    const c = await makeCourse({ ownerId: owner.id, status: 'DRAFT' });
    expect((await as(co.id).get(`/instructor/courses/${c.id}`)).status).toBe(403);
    const team = await as(owner.id).post(`/instructor/courses/${c.id}/team`).send({ email: co.email });
    expect(team.status).toBe(201);
    expect(team.body).toHaveLength(2);
    expect((await as(co.id).post(`/instructor/courses/${c.id}/lessons`).send({ title: 'By co' })).status).toBe(201);
    expect((await as(co.id).patch(`/instructor/courses/${c.id}`).send({ title: 'Renamed' })).status).toBe(403);
    expect((await as(co.id).post(`/instructor/courses/${c.id}/team`).send({ email: stranger.email })).status).toBe(403);
    expect((await as(stranger.id).post(`/instructor/courses/${c.id}/lessons`).send({ title: 'X' })).status).toBe(403);
    expect((await as(owner.id).delete(`/instructor/courses/${c.id}/team/${owner.id}`)).status).toBe(400);
  });

  it('pays the owner their admin-set share; co-instructors get nothing from the system', async () => {
    const owner = await makeUser('INSTRUCTOR', { sharePercentBp: 3000 });
    const co = await makeUser('INSTRUCTOR', { sharePercentBp: 5000 });
    const buyer = await makeUser();
    const c = await makeCourse({ ownerId: owner.id, isFree: false, priceMinor: 10_000 });
    await prisma.courseInstructor.create({ data: { courseId: c.id, userId: co.id, sharePercentBp: 4000 } });
    const order = await prisma.order.create({ data: { userId: buyer.id, courseId: c.id, amountMinor: 10_000, currency: 'usd' } });
    await markOrderPaid(order.id);
    const rows = await prisma.revenueEntry.findMany({ where: { orderId: order.id, kind: 'INSTRUCTOR' }, include: { partner: true } });
    expect(rows).toHaveLength(1);
    expect(rows[0].partner.userId).toBe(owner.id);
    expect([rows[0].baseMinor, rows[0].percentBp, rows[0].amountMinor]).toEqual([10_000, 3000, 3000]);
  });
});

describe('free preview lessons', () => {
  beforeEach(resetDb);

  it('a signed-in user who does not own the course can play only the free lessons', async () => {
    const owner = await makeUser('INSTRUCTOR');
    const u = await makeUser();
    const c = await makeCourse({ ownerId: owner.id, isFree: false, priceMinor: 5000, lessons: 3, freePreview: [2] });
    const [l1, l2] = c.lessons;
    const learn = await as(u.id).get(`/courses/${c.slug}/learn`);
    expect(learn.status).toBe(200);
    expect(learn.body.freePreview).toBe(true);
    expect(learn.body.lessons.map((l: { unlocked: boolean }) => l.unlocked)).toEqual([false, true, false]);
    expect(learn.body.quiz.unlocked).toBe(false);
    expect((await as(u.id).get(`/lessons/${l2.id}/play`)).status).toBe(200);
    expect((await as(u.id).get(`/lessons/${l1.id}/play`)).status).toBe(403);
    const detail = await anon().get(`/courses/${c.slug}`);
    expect(detail.body.lessons.map((l: { isFreePreview: boolean }) => l.isFreePreview)).toEqual([false, true, false]);
  });

  it('nothing is free on a course that is not published', async () => {
    const owner = await makeUser('INSTRUCTOR');
    const u = await makeUser();
    const c = await makeCourse({ ownerId: owner.id, status: 'DRAFT', freePreview: [1] });
    expect((await as(u.id).get(`/lessons/${c.lessons[0].id}/play`)).status).toBe(403);
  });
});

describe('public instructor profiles', () => {
  beforeEach(resetDb);

  it('lists approved instructors only and shows public documents and published courses', async () => {
    const shown = await makeUser('INSTRUCTOR');
    await makeUser('INSTRUCTOR', { instructorStatus: 'PENDING' });
    await prisma.instructorDocument.createMany({
      data: [
        { userId: shown.id, title: 'Public cert', storageKey: 'instructor-docs/x/a.pdf', mime: 'application/pdf', sizeBytes: 10, isPublic: true },
        { userId: shown.id, title: 'Private id', storageKey: 'instructor-docs/x/b.pdf', mime: 'application/pdf', sizeBytes: 10, isPublic: false },
      ],
    });
    await makeCourse({ ownerId: shown.id });
    await makeCourse({ ownerId: shown.id, status: 'DRAFT' });

    const list = await anon().get('/instructors');
    expect(list.body.items.map((i: { id: string }) => i.id)).toEqual([shown.id]);
    expect(list.body.items[0].courseCount).toBe(1);
    const one = await anon().get(`/instructors/${shown.id}`);
    expect(one.status).toBe(200);
    expect(one.body.documents.map((d: { title: string }) => d.title)).toEqual(['Public cert']);
    expect(one.body.courses).toHaveLength(1);
    expect(one.body).not.toHaveProperty('email');
    expect(one.body).not.toHaveProperty('phone');
  });
});
