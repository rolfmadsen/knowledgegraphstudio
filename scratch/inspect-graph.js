import fs from 'fs';
import path from 'path';
import Dexie from 'dexie';

// Since the workspace VFS lives in lightning-fs in IndexedDB, let's read the IndexedDB database.
// lightning-fs database name is typically 'fs' or 'lightning-fs'. Let's find out by checking database names or writing a Dexie script.

async function run() {
  const dbs = await Dexie.getDatabaseNames();
  console.log('IndexedDB Databases found:', dbs);
  
  // Let's inspect the files in 'localforage' or IndexedDB.
  // Wait, let's search if there are local files too in case they were exported.
  // Wait, in lightning-fs, the DB name is "fs". Let's open it and dump the directories/files.
  const dbName = dbs.find(name => name.includes('fs') || name.includes('localforage'));
  if (!dbName) {
    console.log('No FS databases found in IndexedDB names.');
    return;
  }
  
  console.log(`Opening database: ${dbName}`);
  const db = new Dexie(dbName);
  await db.open();
  console.log('Tables:', db.tables.map(t => t.name));
  
  // Dump files table
  const filesTable = db.table('files');
  if (filesTable) {
    const files = await filesTable.toArray();
    console.log(`Found ${files.length} records in files table.`);
    // Log any file paths ending with xarchi.yaml
    const yamlFiles = files.filter(f => f.filepath?.includes('xarchi.yaml'));
    yamlFiles.forEach(f => {
      console.log('Filepath:', f.filepath);
      // If we have content
      const content = f.content ? new TextDecoder().decode(f.content) : 'empty';
      console.log('--- Content ---');
      console.log(content);
      console.log('---------------');
    });
  }
}

run().catch(console.error);
