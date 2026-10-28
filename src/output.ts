import { copyFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import type { PackagerConfig } from "./config";
import type { SectionBuild } from "./sections";

export async function writeOutput(config: PackagerConfig, build: SectionBuild): Promise<void> {
    const photosDirectory = join(config.output.directory, "photos");
    await mkdir(photosDirectory, { recursive: true });
    for (const staticFile of config.staticFiles) {
        await copyFile(staticFile, join(config.output.directory, staticFile));
    }
    for (const [id, data] of build.images) {
        await writePhoto(config, { id, data });
    }
    await Bun.write(join(config.output.directory, "sections.json"), JSON.stringify(build.sections, null, 2));
}

export async function writePhoto(
    config: PackagerConfig,
    photo: { id: string; data: Buffer },
): Promise<void> {
    await sharp(photo.data)
        .resize({ width: config.output.imageWidth })
        .jpeg({ quality: config.output.imageQuality })
        .toFile(join(config.output.directory, "photos", `${photo.id}.jpg`));
}
