import 'dotenv/config';
import { DatabaseService } from './database.service';

// Standalone migration entrypoint — run as a one-shot deploy step:
//   npm run migrate         (dev, ts-node)
//   npm run migrate:prod    (built: node dist/database/migrate.js)
// Applies schema + seeds draft content under an advisory lock, then exits.
async function main() {
  const db = new DatabaseService();
  await db.migrate();
  console.log('Migrations applied successfully.');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
