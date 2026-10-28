import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { GetObjectCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import type { PackagerConfig } from "./config";

export type SourcePhoto = { id: string; extension: string; data: Buffer };

export interface PhotoSource {
    list(): Promise<SourcePhoto[]>;
}

function photoName(key: string): { id: string; extension: string } | undefined {
    const name = key.split("/").at(-1) ?? "";
    const dot = name.lastIndexOf(".");
    if (dot <= 0 || dot === name.length - 1) return undefined;
    return { id: name.slice(0, dot), extension: name.slice(dot + 1) };
}

class LocalPhotoSource implements PhotoSource {
    constructor(private readonly directory: string) {}

    async list(): Promise<SourcePhoto[]> {
        const entries = await readdir(this.directory, { withFileTypes: true });
        const photos: SourcePhoto[] = [];
        for (const entry of entries) {
            if (!entry.isFile()) continue;
            const name = photoName(entry.name);
            if (name) photos.push({ ...name, data: await readFile(join(this.directory, entry.name)) });
        }
        return photos;
    }
}

class S3PhotoSource implements PhotoSource {
    private readonly client: S3Client;

    constructor(private readonly config: Extract<PackagerConfig["storage"], { type: "s3" }>) {
        this.client = new S3Client({
            region: config.region ?? "us-east-1",
            endpoint: config.endpoint,
            forcePathStyle: config.forcePathStyle,
        });
    }

    async list(): Promise<SourcePhoto[]> {
        const photos: SourcePhoto[] = [];
        let continuationToken: string | undefined;
        do {
            const result = await this.client.send(new ListObjectsV2Command({
                Bucket: this.config.bucket,
                Prefix: this.config.prefix,
                ContinuationToken: continuationToken,
            }));
            for (const object of result.Contents ?? []) {
                if (!object.Key) continue;
                const name = photoName(object.Key);
                if (!name) continue;
                const response = await this.client.send(new GetObjectCommand({
                    Bucket: this.config.bucket,
                    Key: object.Key,
                }));
                if (!response.Body) throw new Error(`S3 returned no body for ${object.Key}`);
                photos.push({ ...name, data: Buffer.from(await response.Body.transformToByteArray()) });
            }
            continuationToken = result.IsTruncated ? result.NextContinuationToken : undefined;
        } while (continuationToken);
        return photos;
    }
}

export function createPhotoSource(config: PackagerConfig): PhotoSource {
    return config.storage.type === "local"
        ? new LocalPhotoSource(config.storage.directory)
        : new S3PhotoSource(config.storage);
}
