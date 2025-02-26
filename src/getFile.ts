import { Hono } from "hono";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import postgres from "postgres";
import { createClient } from "redis";
import { PostHog } from "posthog-node";
import { constructHTML, fileNotFound, genericError } from "./buildPage";

export const client = new PostHog(process.env.POSTHOG_API_KEY!, {
  host: "https://us.i.posthog.com",
});

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

export const getFile = async (
  wardrobe: string,
  c: any,
  fileid: string,
  bypassCache: boolean,
) => {
  try {
    // Check Redis cache first

    const cachedFile = await redisClient.get(`file:${fileid}`);

    if (cachedFile && bypassCache !== true) {
      console.log("Cache hit");
      const data = JSON.parse(cachedFile);
      const contentType = data.contentType ?? "application/octet-stream";
      const base64Content = data.content;
      const filename = data.fileName;
      const should_cache = data.cache;

      client.capture({
        distinctId: crypto.randomUUID(),
        event: "cache_hit",
        properties: {
          should_cache: should_cache,
          file_id: fileid,
        },
      });

      // Convert base64 content to a buffer
      const buffer = Buffer.from(base64Content, "base64");

      // Create response with buffer
      const response = new Response(buffer);

      // Set the correct content type for inline files
      response.headers.set("Content-Type", contentType);

      // Handle inline images and videos
      if (
        contentType?.startsWith("image/") ||
        contentType?.startsWith("video/")
      ) {
        response.headers.set(
          "Content-Disposition",
          `inline; filename="${filename}"`,
        );
      } else {
        response.headers.set(
          "Content-Disposition",
          `attachment; filename="${filename}"`,
        );
      }

      return response;
    } else {
      console.log("Cache miss");
      // If not in cache, get file metadata from database
      const sql = postgres(process.env.DATABASE_URL!);
      const file = (await sql`SELECT * FROM files WHERE id = ${fileid}`)[0];

      if (!file) {
        return fileNotFound(wardrobe, c);
      }

      const decodedFileLocation = decodeURIComponent(
        file.file_location,
      ).replace(/^\/|\/$/g, "");

      // Fetch file from S3
      const command = new GetObjectCommand({
        Bucket: process.env.DO_SPACE_BUCKET!,
        Key: decodedFileLocation,
      });

      const response = await s3Client.send(command);

      if (!response.Body) {
        return fileNotFound(wardrobe, c);
      }

      // Convert readable stream to buffer
      const streamResponse = await new Response(
        response.Body as ReadableStream,
      ).arrayBuffer();
      const buffer = Buffer.from(streamResponse);
      const base64Content = buffer.toString("base64");

      // Cache the file in Redis, include content type in cache
      const cacheData = {
        contentType: file.content_type ?? "application/octet-stream",
        content: base64Content,
        fileName: file.file_name,
        cache: file.cache,
      };

      if (bypassCache !== true && file.cache === true) {
        console.log("Caching file");
        await redisClient.set(`file:${fileid}`, JSON.stringify(cacheData), {
          EX: 3600, // Cache for 1 hour
        });

        client.capture({
          distinctId: crypto.randomUUID(),
          event: "cache_miss",
          properties: {
            file_id: fileid,
          },
        });
      } else if (file.cache === false) {
        console.log("Uncached file");
        client.capture({
          distinctId: crypto.randomUUID(),
          event: "uncached_file",
          properties: {
            file_id: fileid,
          },
        });
      }

      const reqResponse = new Response(buffer);

      // Set response headers
      reqResponse.headers.set(
        "Content-Type",
        file.content_type ?? "application/octet-stream",
      );
      reqResponse.headers.set("X-Hash", file.hash);
      reqResponse.headers.set("X-Wardrobe", wardrobe);

      if (
        file.content_type?.startsWith("image/") ||
        file.content_type?.startsWith("video/")
      ) {
        reqResponse.headers.set(
          "Content-Disposition",
          `inline; filename="${file.file_name}"`,
        );
      } else {
        reqResponse.headers.set(
          "Content-Disposition",
          `attachment; filename="${file.file_name}"`,
        );
      }

      return reqResponse;
    }
  } catch (error) {
    console.error("Error fetching file:", error);
    return genericError(wardrobe, c);
  }
};
