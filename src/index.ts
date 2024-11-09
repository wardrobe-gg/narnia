import { Hono } from 'hono';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import postgres from 'postgres';
import { createClient } from 'redis';
import { getFile } from './getFile';
import {client} from './getFile'

const app = new Hono();

const s3Client = new S3Client({
  endpoint: process.env.DO_SPACE_ENDPOINT,
  region: 'nyc3', // DigitalOcean Spaces region
  credentials: {
    accessKeyId: process.env.DO_SPACE_KEY!,
    secretAccessKey: process.env.DO_SPACE_SECRET!,
  },
  forcePathStyle: false, // Required for DigitalOcean Spaces
});

const redisClient = createClient({ url: process.env.REDIS_URL! });

redisClient.connect().catch(console.error);

app.get('/', (c) => {
  return c.text('Hello Hono!', 200);
});



app.get('/file/:fileid', async (c) => {
  const { fileid } = c.req.param();
  const {bypassCache} = c.req.query();

  const response = await getFile(c, fileid, false);
  return response;
});


app.get('/cape/:capeid', async (c) => {
  const { capeid } = c.req.param();
  const {bypassCache} = c.req.query();

  const sql = postgres(process.env.DATABASE_URL!);
  try {
    const fileId = (await sql`SELECT cape_file FROM uploaded_capes WHERE id = ${capeid}`)[0].cape_file;

    const response = await getFile(c, fileId, false);
    return response;
  } catch (e) {
    return c.text('Cape not found', 404);
  }
});

app.get('/cape/:capeid/render', async (c) => {
  const { capeid } = c.req.param();
  const {bypassCache} = c.req.query();

  console.log(`id: ${capeid}`);

  const sql = postgres(process.env.DATABASE_URL!);
  try {
    const capeRecord = await sql`SELECT * FROM uploaded_capes WHERE id = ${capeid}`;
    let fileId = capeRecord[0].render;

    const response = await getFile(c, fileId, false);
    return response;
  } catch (e) {
    console.log(e);
    return c.text('Cape not found', 404);
  }
});

app.get('/clear-cache', async (c) => {
  await redisClient.del('*');
  return c.text('Cache cleared', 200);
});

// Gracefully shutdown PostHog client when server terminates
process.on('SIGTERM', async () => {
  await client.shutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await client.shutdown();
  process.exit(0);
});



export default app;