import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';
import { hash } from 'bcryptjs';

import { PrismaClient } from '../src/generated/prisma/client.js';

function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is missing from environment variables`);
  }

  return value;
}

const databaseUrl = getRequiredEnv('DATABASE_URL');
const adminEmail = getRequiredEnv('ADMIN_EMAIL');
const adminPassword = getRequiredEnv('ADMIN_PASSWORD');

const adminFirstName = process.env.ADMIN_FIRST_NAME?.trim() || null;
const adminLastName = process.env.ADMIN_LAST_NAME?.trim() || null;

if (adminPassword.length < 12) {
  throw new Error('ADMIN_PASSWORD must contain at least 12 characters');
}

const adapter = new PrismaPg({
  connectionString: databaseUrl,
});

const prisma = new PrismaClient({
  adapter,
});

async function main(): Promise<void> {
  const normalizedEmail = adminEmail.trim().toLowerCase();

  const existingAdmin = await prisma.user.findUnique({
    where: {
      email: normalizedEmail,
    },
  });

  if (existingAdmin) {
    console.log(`Admin already exists: ${existingAdmin.email}`);
    return;
  }

  const passwordHash: string = await hash(adminPassword, 12);

  const admin = await prisma.user.create({
    data: {
      email: normalizedEmail,
      passwordHash,
      firstName: adminFirstName,
      lastName: adminLastName,
      role: 'ADMIN',
      isActive: true,
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });

  console.log('Admin created successfully:');
  console.log(admin);
}

main()
  .catch((error: unknown) => {
    console.error('Failed to seed the administrator:');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });