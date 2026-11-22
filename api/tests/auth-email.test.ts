// Email auth end to end: sign up -> verify -> log in, forgot -> reset, rate limits, mail failures.
import { beforeEach, describe, expect, it } from 'vitest';
import { mailTest, sentMails } from '../src/mail.js';
import { anon, prisma, resetDb } from './helpers.js';

const PW = 'First-pass-123';
const NEW_PW = 'Second-pass-456';

function lastMailTo(to: string) {
  return [...sentMails].reverse().find((m) => m.to === to);
}
function tokenFrom(to: string, path: string) {
  const m = lastMailTo(to);
  const match = m?.text.match(new RegExp(`${path}\\?token=([A-Za-z0-9_-]+)`));
  if (!match) throw new Error(`no ${path} link mailed to ${to}`);
  return match[1];
}
const mailsTo = (to: string) => sentMails.filter((m) => m.to === to).length;

async function signUp(email: string) {
  return anon().post('/auth/register').send({ name: 'New Person', email, password: PW });
}

describe('email auth', () => {
  beforeEach(async () => {
    await resetDb();
    sentMails.length = 0;
    mailTest.failNext = 0;
  });

  it('sign up -> verify email -> log in', async () => {
    const email = 'new@person.test';
    const r = await signUp('  New@Person.TEST ');
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ email, mailSent: true });

    const mail = lastMailTo(email)!;
    expect(mail.subject).toMatch(/verify/i);
    expect(mail.html).toContain('/verify-email?token=');

    const before = await anon().post('/auth/login').send({ email, password: PW });
    expect(before.status).toBe(403);
    expect(before.body.error.code).toBe('EMAIL_NOT_VERIFIED');

    const v = await anon().post('/auth/verify-email').send({ token: tokenFrom(email, '/verify-email') });
    expect(v.status).toBe(200);
    expect(v.body.user.emailVerified).toBe(true);
    expect(String(v.headers['set-cookie'])).toContain('HttpOnly');

    const login = await anon().post('/auth/login').send({ email, password: PW });
    expect(login.status).toBe(200);
    expect(login.body.user.email).toBe(email);
    expect((await anon().post('/auth/login').send({ email, password: 'Wrong-pass-000' })).status).toBe(401);
  });

  it('verify links: single use, expire, and a resend replaces the old one', async () => {
    const email = 'twice@person.test';
    await signUp(email);
    const first = tokenFrom(email, '/verify-email');
    await anon().post('/auth/resend-verification').send({ email });
    const second = tokenFrom(email, '/verify-email');
    expect(second).not.toBe(first);
    expect((await anon().post('/auth/verify-email').send({ token: first })).status).toBe(400);
    expect((await anon().post('/auth/verify-email').send({ token: second })).status).toBe(200);
    expect((await anon().post('/auth/verify-email').send({ token: second })).status).toBe(400);

    const other = 'late@person.test';
    await signUp(other);
    await prisma.authToken.updateMany({ where: { user: { email: other } }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await anon().post('/auth/verify-email').send({ token: tokenFrom(other, '/verify-email') })).status).toBe(400);
  });

  it('a taken email cannot sign up again', async () => {
    await signUp('taken@person.test');
    expect((await signUp('taken@person.test')).status).toBe(409);
  });

  it('forgot password -> reset -> log in with the new password', async () => {
    const email = 'forgot@person.test';
    await signUp(email);
    await anon().post('/auth/verify-email').send({ token: tokenFrom(email, '/verify-email') });

    // Unknown address: same answer, no mail (no account enumeration).
    const unknown = await anon().post('/auth/forgot-password').send({ email: 'nobody@person.test' });
    expect(unknown.status).toBe(200);
    expect(mailsTo('nobody@person.test')).toBe(0);

    expect((await anon().post('/auth/forgot-password').send({ email })).status).toBe(200);
    const mail = lastMailTo(email)!;
    expect(mail.subject).toMatch(/reset/i);
    const token = tokenFrom(email, '/reset-password');

    expect((await anon().post('/auth/reset-password').send({ token, password: 'short' })).status).toBe(400);
    expect((await anon().post('/auth/reset-password').send({ token, password: NEW_PW })).status).toBe(200);
    expect(lastMailTo(email)!.subject).toMatch(/password was changed/i);
    expect((await anon().post('/auth/reset-password').send({ token, password: 'Third-pass-789' })).status).toBe(400);

    expect((await anon().post('/auth/login').send({ email, password: PW })).status).toBe(401);
    expect((await anon().post('/auth/login').send({ email, password: NEW_PW })).status).toBe(200);
  });

  it('reset links expire after use of another link and after 1 hour', async () => {
    const email = 'links@person.test';
    await signUp(email);
    await anon().post('/auth/forgot-password').send({ email });
    const a = tokenFrom(email, '/reset-password');
    await anon().post('/auth/forgot-password').send({ email });
    const b = tokenFrom(email, '/reset-password');
    expect((await anon().post('/auth/reset-password').send({ token: b, password: NEW_PW })).status).toBe(200);
    expect((await anon().post('/auth/reset-password').send({ token: a, password: NEW_PW })).status).toBe(400);

    sentMails.length = 0;
    const other = 'old@person.test';
    await signUp(other);
    await anon().post('/auth/forgot-password').send({ email: other });
    await prisma.authToken.updateMany({ where: { user: { email: other }, type: 'RESET' }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await anon().post('/auth/reset-password').send({ token: tokenFrom(other, '/reset-password'), password: NEW_PW })).status).toBe(400);
  });

  it('banned users get no reset mail and cannot log in', async () => {
    const email = 'banned@person.test';
    await signUp(email);
    await anon().post('/auth/verify-email').send({ token: tokenFrom(email, '/verify-email') });
    await prisma.user.update({ where: { email }, data: { status: 'BANNED' } });
    sentMails.length = 0;
    expect((await anon().post('/auth/forgot-password').send({ email })).status).toBe(200);
    expect(mailsTo(email)).toBe(0);
    expect((await anon().post('/auth/login').send({ email, password: PW })).body.error.code).toBe('BANNED');
  });

  it('login is blocked after 10 wrong passwords for one email', async () => {
    const email = 'guess@person.test';
    await signUp(email);
    await anon().post('/auth/verify-email').send({ token: tokenFrom(email, '/verify-email') });
    for (let i = 0; i < 10; i++) expect((await anon().post('/auth/login').send({ email, password: `Wrong-${i}-xx` })).status).toBe(401);
    const blocked = await anon().post('/auth/login').send({ email, password: PW });
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('TOO_MANY_REQUESTS');
  });

  it('at most 3 mails per address in 15 minutes, same answer either way', async () => {
    const email = 'spam@person.test';
    await signUp(email); // 1 (verify)
    for (let i = 0; i < 4; i++) expect((await anon().post('/auth/forgot-password').send({ email })).status).toBe(200);
    expect(mailsTo(email)).toBe(3);
  });

  it('a mail provider error never breaks sign-up or leaks through forgot-password', async () => {
    mailTest.failNext = 1;
    const r = await signUp('fail@person.test');
    expect(r.status).toBe(201);
    expect(r.body.mailSent).toBe(false);
    // The learner can ask again and gets a working link.
    expect((await anon().post('/auth/resend-verification').send({ email: 'fail@person.test' })).status).toBe(200);
    expect((await anon().post('/auth/verify-email').send({ token: tokenFrom('fail@person.test', '/verify-email') })).status).toBe(200);

    mailTest.failNext = 1;
    expect((await anon().post('/auth/forgot-password').send({ email: 'fail@person.test' })).status).toBe(200);
  });
});
