import postgres from "postgres";
import { createClient } from "redis";

const redisClient = createClient({ url: process.env.REDIS_URL! });
redisClient.connect().catch(console.error);

export async function getCapeFromUser(userIdentifier: string, returnMore: boolean = false) {
    // Check Redis cache first
    const cachedCape = await redisClient.get(`cape:${userIdentifier}`);
    if (cachedCape) {
        // Parse the cached data if exists
        const capeData = JSON.parse(cachedCape);
        return returnMore ? capeData : capeData.texture;
    }

    const sql = postgres(process.env.DATABASE_URL);
    let capeFile;
    let userUUID;

    if (userIdentifier.length === 32 || userIdentifier.length === 36) {
        const record = await sql`
            SELECT 
                users.cape, cape_slots.cape_id, uploaded_capes.*, users.uuid
            FROM 
                users
            JOIN cape_slots ON users.cape = cape_slots.id
            JOIN uploaded_capes ON cape_slots.cape_id = uploaded_capes.id
            WHERE 
                users.uuid = ${userIdentifier}`;

        if (record[0]?.cape_file) capeFile = record[0];
    } 
    else if (userIdentifier.startsWith('wuid;') && userIdentifier.length === 17) {
        const userId = userIdentifier.split('wuid;')[1];
        const record = await sql`
            SELECT 
                users.cape, cape_slots.cape_id, uploaded_capes.*, users.uuid
            FROM 
                users
            JOIN cape_slots ON users.cape = cape_slots.id
            JOIN uploaded_capes ON cape_slots.cape_id = uploaded_capes.id
            WHERE 
                users.id = ${userId}`;
        

        if (record[0]?.cape_file) capeFile = record[0];
    } 
    else if (userIdentifier.length < 17) {
        const record = await sql`
            SELECT 
                users.cape, cape_slots.cape_id, uploaded_capes.*, users.uuid
            FROM 
                users
            JOIN cape_slots ON users.cape = cape_slots.id
            JOIN uploaded_capes ON cape_slots.cape_id = uploaded_capes.id
            WHERE 
                users.username = ${userIdentifier}`;

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
        normal: capeFile.normal_layer ?? false
    } as CapeFile;

    // Cache the result in Redis
    await redisClient.set(`cape:${capeFile.uuid}`, JSON.stringify(capeData), { EX: 3600 }); // Cache for 1 hour

    return returnMore ? capeData : capeData.texture;
}

export type CapeFile = {
    id: number,
    texture: string | false,
    name: string | false,
    render: string | false,
    capeHash: string | undefined,
    animation: string | false | object,
    specular: string | false,
    emissive: string | false,
    normal: string | false
};