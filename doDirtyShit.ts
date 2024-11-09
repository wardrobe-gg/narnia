import PocketBase from 'pocketbase';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import crypto from 'crypto';
import dotenv from 'dotenv';
import postgres from 'postgres';

dotenv.config();

// Initialize PocketBase
const pocketbase = new PocketBase('https://db.wardrobe.gg');

const sql = postgres(process.env.DATABASE_URL!);

pocketbase.collection('uploaded_capes').getFullList({
  filter: `cape_file != "" && tags~'4avkinm8p2qorvg'`,
})
.then(catalogCapes => {
  return Promise.all(catalogCapes.map(cape => {
    let fileName = cape.cape_file;
    return sql`UPDATE files SET cache = TRUE WHERE file_name = ${fileName}`;
  }));
})
.catch(error => {
  console.error('Error:', error);
});

console.log('Done');