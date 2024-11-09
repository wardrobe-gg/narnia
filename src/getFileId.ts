import postgres from "postgres";
import dotenv from 'dotenv';

dotenv.config();


export async function getCapeFromUser(userIdentifier: string, returnMore: boolean = false) {
    const sql = postgres(process.env.DATABASE_URL);

    let capeFile;
    if (userIdentifier.length === 32 || userIdentifier.length === 36) {
      let record = (await 
      sql`SELECT users.cape, cape_slots.cape_id, uploaded_capes.cape_file, uploaded_capes.name, uploaded_capes.render, uploaded_capes.mcmeta, uploaded_capes.emissive_layer, uploaded_capes.specular_layer, uploaded_capes.normal_layer
      FROM users, cape_slots, uploaded_capes
      WHERE users.cape = cape_slots.id AND cape_slots.cape_id = uploaded_capes.id
      AND users.uuid = ${userIdentifier}`);
      if (record[0]?.cape_file) {
        capeFile = record[0]
      }
      else {return null};
    }
    else if (userIdentifier.startsWith('wuid;') && userIdentifier.length === 17) {
      let record = (await 
        sql`SELECT users.cape, cape_slots.cape_id, uploaded_capes.cape_file, uploaded_capes.name, uploaded_capes.render, uploaded_capes.mcmeta, uploaded_capes.emissive_layer, uploaded_capes.specular_layer, uploaded_capes.normal_layer
        FROM users, cape_slots, uploaded_capes
        WHERE users.cape = cape_slots.id AND cape_slots.cape_id = uploaded_capes.id
        AND users.id = ${userIdentifier.split('wuid;')[1]}`);
        if (record[0]?.cape_file) {
          capeFile = record[0].cape_file
        }
        else {return null};
    }
    else if (userIdentifier.length < 17) {
      let record = (await 
        sql`SELECT users.cape, cape_slots.cape_id, uploaded_capes.cape_file, uploaded_capes.name, uploaded_capes.render, uploaded_capes.mcmeta, uploaded_capes.emissive_layer, uploaded_capes.specular_layer, uploaded_capes.normal_layer
        FROM users, cape_slots, uploaded_capes
        WHERE users.cape = cape_slots.id AND cape_slots.cape_id = uploaded_capes.id
        AND users.username = ${userIdentifier}`);
        if (record[0]?.cape_file) {
          capeFile = record[0]
        }
        else {return null};
    }
    else {
      return null;
    }
  
    if (capeFile) {
      if (returnMore === true) {
        return {
          texture: capeFile.cape_file ?? false,
          name: capeFile.name ?? false,
          render: capeFile.render ?? false,
          animation: capeFile.mcmeta ?? false,
          specular: capeFile.specular_layer ?? false,
          emissive: capeFile.emissive_layer ?? false,
          normal: capeFile.normal_layer ?? false
        } as CapeFile
      }
      return capeFile.cape_file
    }
    else {
      return null;
    }
}

export type CapeFile = {
  texture: string | false,
  name: string | false,
  render: string | false,
  animation: string | false | object,
  specular: string | false,
  emissive: string | false,
  normal: string | false
}