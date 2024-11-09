import { Hono } from 'hono';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import postgres from 'postgres';
import { createClient } from 'redis';
import { getFile } from './getFile';
import {client} from './getFile'
import { getCapeFromUser } from './getFileId';
import { CapeFile } from './getFileId';
import path from 'path';
import { fileURLToPath } from 'url';
import { constructHTML } from './buildPage';


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
  return c.html(constructHTML('Welcome to Narnia', 'Aslan Awaits'))
});


const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.get('/pageStuff/pageTop.png', async (c) => {
  const filePath = path.join(__dirname, 'pageStuff', 'pageTop.png');
  return new Response(Bun.file(filePath));
});

app.get('/pageStuff/pageTidbit.png', async (c) => {
  const filePath = path.join(__dirname, 'pageStuff', 'pageTidbit.png');
  return new Response(Bun.file(filePath));
});

app.get('/pageStuff/mcFont.ttf', async (c) => {
  const filePath = path.join(__dirname, 'pageStuff', 'Ranyth5x_BIG.ttf');
  return new Response(Bun.file(filePath));
});

app.get('/pageStuff/ssFont.ttf', async (c) => {
  const filePath = path.join(__dirname, 'pageStuff', 'BasicallyASansSerif-Regular.ttf');
  return new Response(Bun.file(filePath));
});


app.get('/file/:fileid', async (c) => {
  const { fileid } = c.req.param();
  const {bypassCache} = c.req.query();

  const response = await getFile(c, fileid, false);
  return response;
});

app.get('/:rawUser', async(c) => {
  const {rawUser} = c.req.param();
  let user = decodeURIComponent(rawUser).split('.json')[0];

  let capeFile: CapeFile = await getCapeFromUser(user, true);

  let capeRecord = {};

  if (capeFile !== null) {
    console.log(capeFile);
    let animationJson: any = false;
    if (capeFile.animation !== false) {
      const animationResponse = await fetch(`${buildUrl(capeFile.animation)}`);
      if (animationResponse.ok) {
        animationJson = await animationResponse.json();
        console.log(animationJson);
      } else {
        console.error("Failed to fetch animation data.");
      }
    }
    let cape = {
      texture: buildUrl(capeFile.texture),
      name: capeFile.name ?? false,
      render: buildUrl(capeFile.render),
      animation: animationJson.animation ?? false,
      emissive: buildUrl(capeFile.emissive),
      specular: buildUrl(capeFile.specular),
      normal: buildUrl(capeFile.normal)
    } as CapeFile
    capeRecord = {...capeRecord, cape}
  }

  return c.json(capeRecord);
  
})


const buildUrl = (fileId: string | false | object) => {
  if (typeof fileId === 'string') {
    return `https://narnia.wardrobe.gg/file/` + fileId
  }
  else {
    return false
  }
};


app.get('/cape/byId/:capeid', async (c) => {
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

app.get('/cape/byId/:capeid/render', async (c) => {
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

app.get('/cape/byUser/:rawUsername', async (c) => {
  const { rawUsername } = c.req.param();
  const username = decodeURIComponent(rawUsername);
  const {bypassCache} = c.req.query();

  const sql = postgres(process.env.DATABASE_URL!);

  const fileId = await getCapeFromUser(username);

  if (fileId) {
    const response = await getFile(c, fileId, false);
    return response;
  }
  else {
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