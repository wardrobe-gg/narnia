import postgres from "postgres";
import { createClient } from "redis";

const redisClient = createClient({ url: process.env.REDIS_URL! });
redisClient.connect().catch(console.error);

export async function getCapeFromUser(
  userIdentifier: string,
  returnMore: boolean = false,
) {
  const sql = postgres(process.env.DATABASE_URL);

  // First, check Redis cache for user data (ID, UUID, username)
  const cachedUser = await redisClient.get(`user:${userIdentifier}`);
  let userUuid: string;

  if (cachedUser) {
    // Parse the cached user data
    userUuid = JSON.parse(cachedUser).uuid;
  } else {
    // If not cached, query the database
    const userRecord = await sql`
            SELECT uuid 
            FROM users 
            WHERE username = ${userIdentifier} 
               OR uuid = ${userIdentifier.replaceAll("-", "")} 
               OR id = ${userIdentifier.replace("wuid;", "")}`;

    if (!userRecord[0]) return null; // If no user found
    userUuid = userRecord[0].uuid;

    // Cache the user data (username -> uuid mapping) in Redis for future lookups
    await redisClient.set(
      `user:${userIdentifier}`,
      JSON.stringify({ uuid: userUuid }),
      { EX: 86400 }, // Cache for 24 hours
    );
  }

  // Check Redis cache for cape data
  const cachedCape = await redisClient.get(`cape:${userUuid}`);
  if (cachedCape) {
    // Parse the cached data if exists
    const capeData = JSON.parse(cachedCape);
    return returnMore ? capeData : capeData.texture;
  }

  let capeFile;

  // If userUuid is available, proceed with cape data retrieval
  if (userUuid) {
    const record = await sql`
            SELECT 
                users.cape, cape_slots.cape_id, uploaded_capes.*, users.uuid, files.hash AS cape_file_hash
            FROM 
                users
            JOIN cape_slots ON users.cape = cape_slots.id
            JOIN uploaded_capes ON cape_slots.cape_id = uploaded_capes.id
            LEFT JOIN files ON uploaded_capes.cape_file = files.id
            WHERE 
                users.uuid = ${userUuid}`;

    if (record[0]?.cape_file) capeFile = record[0];
  } else {
    return null;
  }

  if (!capeFile) return null;

  const capeData = {
    id: capeFile.id,
    texture: capeFile.cape_file ?? false,
    name: capeFile.name ?? false,
    render: capeFile.render ?? false,
    capeHash: capeFile.cape_file_hash ?? false,
    animation: capeFile.mcmeta ?? false,
    specular: capeFile.specular_layer ?? false,
    emissive: capeFile.emissive_layer ?? false,
    normal: capeFile.normal_layer ?? false,
  } as CapeFile;

  // Cache the result in Redis for the cape
  await redisClient.set(`cape:${capeFile.uuid}`, JSON.stringify(capeData), {
    EX: 3600,
  }); // Cache for 1 hour

  return returnMore ? capeData : capeData.texture;
}

export type CapeFile = {
  id: number;
  texture: string | false;
  name: string | false;
  render: string | false;
  capeHash: string | undefined;
  animation: string | false | object;
  specular: string | false;
  emissive: string | false;
  normal: string | false;
};
