import { Hono } from "hono";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import postgres from "postgres";
import { createClient } from "redis";
import { getFile } from "./getFile";
import { client } from "./getFile";
import { getCapeFromUser } from "./getFileId";
import { CapeFile } from "./getFileId";
import path from "path";
import { fileURLToPath } from "url";
import {
  capeNotFound,
  constructHTML,
  genericError,
  userNotFound,
} from "./buildPage";
import crypto from "crypto";

const app = new Hono();

const s3Client = new S3Client({
  endpoint: process.env.DO_SPACE_ENDPOINT,
  region: "nyc3", // DigitalOcean Spaces region
  credentials: {
    accessKeyId: process.env.DO_SPACE_KEY!,
    secretAccessKey: process.env.DO_SPACE_SECRET!,
  },
  forcePathStyle: false, // Required for DigitalOcean Spaces
});

const redisClient = createClient({ url: process.env.REDIS_URL! });

redisClient.connect().catch(console.error);

app.get("/", (c) => {
  const wardrobe = crypto.randomBytes(12).toString("hex");
  return c.html(
    constructHTML({
      title: "Welcome to Narnia",
      texth1: "Narnia",
      texth2: "Welcome to",
      textP: "Aslan Awaits",
    }),
  );
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.get("/pageStuff/pageBg.jpg", async (c) => {
  const wardrobe = crypto.randomBytes(12).toString("hex");
  const filePath = path.join(__dirname, "pageStuff", "pageBg.jpg");
  return new Response(Bun.file(filePath));
});

app.get("/pageStuff/mcFont.ttf", async (c) => {
  const wardrobe = crypto.randomBytes(12).toString("hex");
  const filePath = path.join(__dirname, "pageStuff", "Ranyth_uppercase.ttf");
  return new Response(Bun.file(filePath));
});

app.get("/pageStuff/ssFont.ttf", async (c) => {
  const wardrobe = crypto.randomBytes(12).toString("hex");
  const filePath = path.join(
    __dirname,
    "pageStuff",
    "BasicallyASansSerif-Regular.ttf",
  );
  return new Response(Bun.file(filePath));
});

app.get("/file/:fileid", async (c) => {
  const wardrobe = crypto.randomBytes(12).toString("hex");
  const { fileid } = c.req.param();
  const { bypassCache } = c.req.query();

  const response = await getFile(wardrobe, c, fileid, false);
  return response;
});

app.get("/:rawUser", async (c) => {
  const wardrobe = crypto.randomBytes(12).toString("hex");
  const { rawUser } = c.req.param();
  let user = decodeURIComponent(rawUser).split(".json")[0];
  const sql = postgres(process.env.DATABASE_URL);
  try {
    let capeFile: CapeFile = await getCapeFromUser(user, true);

    let capeRecord = {};

    if (capeFile !== null) {
      // Get the animation information so that we can inline it.
      let animationJson: any = false;
      if (capeFile.animation !== false) {
        const animationResponse = await fetch(
          `${buildUrl(capeFile.animation)}`,
        );
        if (animationResponse.ok) {
          animationJson = await animationResponse.json();
        } else {
          console.error("Failed to fetch animation data.");
        }
      }

      // Some legacy capes don't have file hashes. Calculate them if this is the case.
      if (!capeFile.capeHash) {
        console.log("Found a cape without a hash. Hashing it now.");

        const capeImage = await fetch(`${buildUrl(capeFile.texture)}`);

        if (capeImage.ok) {
          const capeBuffer = Buffer.from(await capeImage.arrayBuffer());
          const hash = crypto
            .createHash("sha256")
            .update(capeBuffer as unknown as crypto.BinaryLike)
            .digest("hex");

          capeFile.capeHash = hash;
          await sql`UPDATE files SET hash = ${hash} WHERE id = ${capeFile.texture}`;

          client.capture({
            distinctId: crypto.randomUUID(),
            event: "legacy_cape_hashed",
            properties: {
              cape_id: capeFile.id,
            },
          });
        } else {
          console.error("Failed to fetch cape image.");
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
        normal: buildUrl(capeFile.normal),
      } as CapeFile;
      capeRecord = { cape, ...capeRecord };
    } else {
      return userNotFound(wardrobe, c);
    }

    capeRecord = { ...capeRecord, cosmetics: [] };

    return c.json(capeRecord);
  } catch (e) {
    console.error(wardrobe, e);
    return genericError(wardrobe, c);
  }
});

const buildUrl = (fileId: string | false | object) => {
  if (typeof fileId === "string") {
    return `https://narnia.wardrobe.gg/file/` + fileId;
  } else {
    return false;
  }
};

app.get("/cape/byid/:capeid", async (c) => {
  const wardrobe = crypto.randomBytes(12).toString("hex");
  const { capeid } = c.req.param();
  const { bypassCache } = c.req.query();

  const sql = postgres(process.env.DATABASE_URL!);
  try {
    const fileId = (
      await sql`SELECT cape_file FROM uploaded_capes WHERE id = ${capeid}`
    )[0].cape_file;

    const response = await getFile(wardrobe, c, fileId, false);
    return response;
  } catch (e) {
    return capeNotFound(wardrobe, c);
  }
});

app.get("/cape/byid/:capeid/render", async (c) => {
  const wardrobe = crypto.randomBytes(12).toString("hex");
  const { capeid } = c.req.param();
  const { bypassCache } = c.req.query();

  const sql = postgres(process.env.DATABASE_URL!);
  try {
    const capeRecord =
      await sql`SELECT * FROM uploaded_capes WHERE id = ${capeid}`;
    let fileId = capeRecord[0].render;

    const response = await getFile(wardrobe, c, fileId, false);
    return response;
  } catch (e) {
    console.log(e);
    return capeNotFound(wardrobe, c);
  }
});

app.get("/cape/byuser/:rawUsername", async (c) => {
  const wardrobe = crypto.randomBytes(12).toString("hex");
  const { rawUsername } = c.req.param();
  const username = decodeURIComponent(rawUsername);
  const { bypassCache } = c.req.query();

  const sql = postgres(process.env.DATABASE_URL!);

  const fileId = await getCapeFromUser(username.replaceAll("-", ""));

  if (fileId) {
    const response = await getFile(wardrobe, c, fileId, false);
    return response;
  } else {
    return userNotFound(wardrobe, c);
  }
});

app.get("/cape/byuser/:rawUsername/render", async (c) => {
  const wardrobe = crypto.randomBytes(12).toString("hex");
  const { rawUsername } = c.req.param();
  const username = decodeURIComponent(rawUsername);
  const { bypassCache } = c.req.query();

  const sql = postgres(process.env.DATABASE_URL!);

  const file = await getCapeFromUser(username.replaceAll("-", ""), true);

  if (file) {
    const response = await getFile(wardrobe, c, file.render, false);
    return response;
  } else {
    return userNotFound(wardrobe, c);
  }
});

app.get("/utils/cache/clear", async (c) => {
  try {
    const keys = await redisClient.keys("*"); // Get all keys
    if (keys.length > 0) {
      await redisClient.del(...keys); // Delete all keys
    }
    return c.text("Cache cleared", 200);
  } catch (err) {
    console.error("Error clearing cache:", err);
    return c.text("Failed to clear cache", 500);
  }
});

app.get("/utils/cache/clear-user/:userIdentifier", async (c) => {
  const { userIdentifier } = c.req.param();
  const sql = postgres(process.env.DATABASE_URL);
  try {
    const userIdentifiers = await sql` SELECT id, username, uuid 
            FROM users 
            WHERE username = ${userIdentifier} 
               OR uuid = ${userIdentifier.replaceAll("-", "")} 
               OR id = ${userIdentifier.replace("wuid;", "")}`;
    const { id, uuid, username } = userIdentifiers[0];

    console.log(id, uuid, username);

    await redisClient.del(`user:wuid;${id}`);
    await redisClient.del(`user:${username}`);
    await redisClient.del(`user:${uuid}`);
    await redisClient.del(`cape:${uuid}`);
    return c.text("Cache cleared", 200);
  } catch (err) {
    console.error("Error clearing cache:", err);
    return c.text("Failed to clear cache", 500);
  }
});

// Gracefully shutdown PostHog client when server terminates
process.on("SIGTERM", async () => {
  await client.shutdown();
  process.exit(0);
});

process.on("SIGINT", async () => {
  await client.shutdown();
  process.exit(0);
});

export default app;
