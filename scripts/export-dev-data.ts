import { getDb } from '../server/db';
import { chats, messages } from '../shared/schema';
import { writeFileSync } from 'fs';

async function exportData() {
  console.log('Exporting development database data...\n');

  const db = getDb();

  // Get all chats
  const allChats = await db.select().from(chats);
  console.log(`Found ${allChats.length} chats`);

  // Get all messages
  const allMessages = await db.select().from(messages);
  console.log(`Found ${allMessages.length} messages`);

  // Generate SQL
  let sql = '-- Development Database Export\n';
  sql += '-- Generated: ' + new Date().toISOString() + '\n\n';

  // Chats INSERT (with conflict handling)
  sql += '-- CHATS\n';
  for (const chat of allChats) {
    const title = chat.title?.replace(/'/g, "''") || 'Untitled';
    sql += `INSERT INTO chats (id, title, created_at, updated_at) VALUES ('${chat.id}', '${title}', '${chat.createdAt?.toISOString()}', '${chat.updatedAt?.toISOString()}') ON CONFLICT (id) DO NOTHING;\n`;
  }

  sql += '\n-- MESSAGES\n';
  for (const msg of allMessages) {
    const content = msg.content?.replace(/'/g, "''").replace(/\\/g, '\\\\') || '';
    const metadata = msg.metadata ? JSON.stringify(msg.metadata).replace(/'/g, "''") : 'null';
    sql += `INSERT INTO messages (id, chat_id, role, content, created_at, metadata) VALUES ('${msg.id}', '${msg.chatId}', '${msg.role}', '${content}', '${msg.createdAt?.toISOString()}', ${metadata === 'null' ? 'NULL' : `'${metadata}'`}) ON CONFLICT (id) DO NOTHING;\n`;
  }

  // Write to file
  writeFileSync('dev-data-export.sql', sql);
  console.log('\nExported to dev-data-export.sql');
  console.log('You can copy this SQL and run it in your production database SQL editor.');

  process.exit(0);
}

exportData().catch(console.error);
