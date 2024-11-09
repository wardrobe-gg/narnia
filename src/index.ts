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
import crypto from 'crypto';


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
  const wardrobe = crypto.randomBytes(12).toString('hex');
  return c.html(constructHTML({
    title: 'Welcome to Narnia',
    texth1: 'Narnia',
    texth2: 'Welcome to',
    textP: 'Aslan Awaits'
  }))
});


const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.get('/pageStuff/pageBg.jpg', async (c) => {
  const wardrobe = crypto.randomBytes(12).toString('hex');
  const filePath = path.join(__dirname, 'pageStuff', 'pageBg.jpg');
  return new Response(Bun.file(filePath));
});

app.get('/pageStuff/mcFont.ttf', async (c) => {
  const wardrobe = crypto.randomBytes(12).toString('hex');
  const filePath = path.join(__dirname, 'pageStuff', 'Ranyth5x_BIG.ttf');
  return new Response(Bun.file(filePath));
});

app.get('/pageStuff/ssFont.ttf', async (c) => {
  const wardrobe = crypto.randomBytes(12).toString('hex');
  const filePath = path.join(__dirname, 'pageStuff', 'BasicallyASansSerif-Regular.ttf');
  return new Response(Bun.file(filePath));
});


app.get('/file/:fileid', async (c) => {
  const wardrobe = crypto.randomBytes(12).toString('hex');
  const { fileid } = c.req.param();
  const {bypassCache} = c.req.query();

  const response = await getFile(wardrobe, c, fileid, false);
  return response;
});

app.get('/:rawUser', async(c) => {
  const wardrobe = crypto.randomBytes(12).toString('hex');
  const {rawUser} = c.req.param();
  let user = decodeURIComponent(rawUser).split('.json')[0];
  const sql = postgres(process.env.DATABASE_URL);
  try {
    let capeFile: CapeFile = await getCapeFromUser(user, true);

    let capeRecord = {};
  
    if (capeFile !== null) {
  
      // Get the animation information so that we can inline it.
      let animationJson: any = false;
      if (capeFile.animation !== false) {
        const animationResponse = await fetch(`${buildUrl(capeFile.animation)}`);
        if (animationResponse.ok) {
          animationJson = await animationResponse.json();
        } else {
          console.error("Failed to fetch animation data.");
        }
      }
  
      // Some legacy capes don't have file hashes. Calculate them if this is the case.
      if (!capeFile.capeHash) {
        console.log('Found a cape without a hash. Hashing it now.')
        
        const capeImage = await fetch(`${buildUrl(capeFile.texture)}`);
        
        if (capeImage.ok) {
          const capeBuffer = Buffer.from(await capeImage.arrayBuffer());
          const hash = crypto.createHash('sha256').update(capeBuffer as unknown as crypto.BinaryLike).digest('hex');
  
          capeFile.capeHash = hash;
          await sql`UPDATE uploaded_capes SET cape_file_hash = ${hash} WHERE id = ${capeFile.id}`
  
          client.capture({
            distinctId: crypto.randomUUID(),
            event: 'legacy_cape_hashed',
            properties: {
              cape_id: capeFile.id
            }
          })
        } else {
          console.error('Failed to fetch cape image.');
        }
      }
  
  
      let cape = {
        id: capeFile.id,
        texture: buildUrl(capeFile.texture),
        name: capeFile.name ?? false,
        render: buildUrl(capeFile.render),
        capeHash: capeFile.capeHash,
        animation: animationJson.animation ?? false,
        emissive: buildUrl(capeFile.emissive),
        specular: buildUrl(capeFile.specular),
        normal: buildUrl(capeFile.normal)
      } as CapeFile
      capeRecord = {cape, ...capeRecord}
    }
    else {
      return c.html(constructHTML({
        texth1: 'Sorry!',
        texth2: 'User not found',
        textP: wardrobe,
        title: 'User not found'
      }), 404)
    }
  
    capeRecord = {...capeRecord, cosmetics: []};
  
    return c.json(capeRecord);
  }

  catch (e) {
    console.error(wardrobe, e);
    return c.html(constructHTML({
      texth1: 'Sorry!',
      texth2: 'An error occured',
      textP: wardrobe,
      title: 'An error occurred'
    }), 500)
  }
  
  
})


const buildUrl = (fileId: string | false | object) => {
  if (typeof fileId === 'string') {
    return `https://narnia.wardrobe.gg/file/` + fileId
  }
  else {
    return false
  }
};


app.get('/cape/byid/:capeid', async (c) => {
  const wardrobe = crypto.randomBytes(12).toString('hex');
  const { capeid } = c.req.param();
  const {bypassCache} = c.req.query();

  const sql = postgres(process.env.DATABASE_URL!);
  try {
    const fileId = (await sql`SELECT cape_file FROM uploaded_capes WHERE id = ${capeid}`)[0].cape_file;

    const response = await getFile(wardrobe, c, fileId, false);
    return response;
  } catch (e) {
    return c.html(constructHTML({
      texth1: 'Sorry!',
      texth2: 'Cape not found',
      textP: wardrobe,
      title: 'Cape not found'
    }), 404)
  }
});

app.get('/cape/byid/:capeid/render', async (c) => {
  const wardrobe = crypto.randomBytes(12).toString('hex');
  const { capeid } = c.req.param();
  const {bypassCache} = c.req.query();

  const sql = postgres(process.env.DATABASE_URL!);
  try {
    const capeRecord = await sql`SELECT * FROM uploaded_capes WHERE id = ${capeid}`;
    let fileId = capeRecord[0].render;

    const response = await getFile(wardrobe, c, fileId, false);
    return response;
  } catch (e) {
    console.log(e);
    return c.html(constructHTML({
      texth1: 'Sorry!',
      texth2: 'Cape not found',
      textP: wardrobe,
      title: 'Cape not found'
    }), 404)
  }
});

app.get('/cape/byuser/:rawUsername', async (c) => {
  const wardrobe = crypto.randomBytes(12).toString('hex');
  const { rawUsername } = c.req.param();
  const username = decodeURIComponent(rawUsername);
  const {bypassCache} = c.req.query();

  const sql = postgres(process.env.DATABASE_URL!);

  const fileId = await getCapeFromUser(username);

  if (fileId) {
    const response = await getFile(wardrobe, c, fileId, false);
    return response;
  }
  else {
    return c.html(constructHTML({
      texth1: 'Sorry!',
      texth2: 'User not found',
      textP: wardrobe,
      title: 'User not found'
    }), 404)
  }
});

app.get('/cape/byuser/:rawUsername/render', async (c) => {
  const wardrobe = crypto.randomBytes(12).toString('hex');
  const { rawUsername } = c.req.param();
  const username = decodeURIComponent(rawUsername);
  const {bypassCache} = c.req.query();

  const sql = postgres(process.env.DATABASE_URL!);

  const file = await getCapeFromUser(username, true);

  if (file) {
    const response = await getFile(wardrobe, c, file.render, false);
    return response;
  }
  else {
    return c.html(constructHTML({
      texth1: 'Sorry!',
      texth2: 'User not found',
      textP: wardrobe,
      title: 'User not found'
    }), 404)
  }
});




app.get('/utils/clear-cache', async (c) => {
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