// Create the first admin on a fresh server (2026-11-25). The production database starts empty (no seed).
//   npm run create-admin -- --email you@company.com --name "Your Name"
// Prints a temporary password ONCE; the admin must change it at first login. Nothing is stored in plain text.
// An email that already has an account is turned into an admin only with --promote (it keeps its password).
import bcrypt from 'bcryptjs';
import { prisma } from '../db.js';
import { writeAudit } from '../lib/audit.js';
import { tempPassword } from '../lib/tokens.js';
import { email as emailSchema } from '../lib/validate.js';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const parsed = emailSchema.safeParse(arg('email') ?? '');
  const name = (arg('name') ?? '').trim();
  const promote = process.argv.includes('--promote');
  if (!parsed.success || !name) {
    console.error('Usage: npm run create-admin -- --email you@company.com --name "Your Name" [--promote]');
    process.exitCode = 1;
    return;
  }
  const email = parsed.data;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.role === 'ADMIN') return void console.log(`${email} is already an admin.`);
    if (!promote) {
      console.error(`${email} already has a ${existing.role === 'USER' ? 'learner' : existing.role.toLowerCase()} account. Add --promote to make it an admin (it keeps its password).`);
      process.exitCode = 1;
      return;
    }
    await prisma.user.update({ where: { id: existing.id }, data: { role: 'ADMIN' } });
    await writeAudit(null, 'admin.cli_promote', 'User', existing.id, { email });
    return void console.log(`${email} is now an admin. They log in with their own password.`);
  }
  const password = tempPassword();
  const u = await prisma.user.create({
    data: { email, name, role: 'ADMIN', passwordHash: await bcrypt.hash(password, 10), emailVerifiedAt: new Date(), mustChangePassword: true },
  });
  await writeAudit(null, 'admin.cli_create', 'User', u.id, { email });
  console.log(`Admin created: ${email}`);
  console.log(`Temporary password (shown once, change it at first login): ${password}`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
