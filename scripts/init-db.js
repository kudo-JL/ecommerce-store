/**
 * Initialize / migrate the database. Safe to run multiple times.
 */
const path = require('path');
const fs = require('fs');
const db = require('../lib/db');

(async () => {
  await db.load();
  const schema = fs.readFileSync(path.join(__dirname, '..', 'lib', 'schema.sql'), 'utf8');
  db.exec(schema);
  console.log('[init-db] schema applied at', db.DB_PATH);
})();
