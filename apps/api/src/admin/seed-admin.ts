import 'dotenv/config';
import { Client } from 'pg';
import { randomBytes, scryptSync } from 'crypto';
import { v4 as uuidv4 } from 'uuid';

const SYSTEM_ENTITY_CR = 'SYSTEM-000001';

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derivedKey}`;
}

async function main() {
  const args = process.argv.slice(2);
  let email = 'admin@env-project.sa';
  let password = 'AdminPass1';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--email' && args[i + 1]) email = args[i + 1];
    if (args[i] === '--password' && args[i + 1]) password = args[i + 1];
  }

  const client = new Client({
    host: process.env.POSTGRES_HOST ?? '127.0.0.1',
    port: Number(process.env.POSTGRES_PORT ?? 5432),
    user: process.env.POSTGRES_USER ?? 'postgres',
    password: process.env.POSTGRES_PASSWORD ?? 'postgres',
    database: process.env.POSTGRES_DB ?? 'env_project',
  });

  await client.connect();

  try {
    // Ensure system entity exists
    const existingEntity = await client.query(
      'SELECT id FROM entities WHERE cr_number = $1',
      [SYSTEM_ENTITY_CR],
    );

    let entityId: string;

    if (existingEntity.rows[0]) {
      entityId = existingEntity.rows[0].id;
      console.log(`System entity exists: ${entityId}`);
    } else {
      entityId = uuidv4();
      await client.query(
        `INSERT INTO entities (id, name_ar, name_en, cr_number, sector, city)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [entityId, 'إدارة المنصة', 'Platform Administration', SYSTEM_ENTITY_CR, 'government', 'Riyadh'],
      );
      console.log(`System entity created: ${entityId}`);
    }

    // Check if user exists
    const existingUser = await client.query(
      'SELECT id FROM users WHERE email = $1',
      [email],
    );

    if (existingUser.rows[0]) {
      // Update to superadmin
      await client.query(
        'UPDATE users SET role = $1, password_hash = $2, entity_id = $3 WHERE email = $4',
        ['superadmin', hashPassword(password), entityId, email],
      );
      console.log(`Updated existing user to superadmin: ${email}`);
    } else {
      const userId = uuidv4();
      await client.query(
        `INSERT INTO users (id, entity_id, first_name, last_name, full_name, email, password_hash, role)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [userId, entityId, 'Platform', 'Admin', 'Platform Admin', email, hashPassword(password), 'superadmin'],
      );
      console.log(`Superadmin created: ${email}`);
    }

    console.log(`\nCredentials:`);
    console.log(`  Email: ${email}`);
    console.log(`  Password: ${password}`);
    console.log(`  Role: superadmin`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Failed to seed admin:', err);
  process.exit(1);
});
