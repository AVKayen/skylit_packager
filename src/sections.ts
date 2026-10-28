import sharp from "sharp";
import type { PackagerConfig } from "./config";
import { parseIndex } from "./index-parser";
import type { PhotoSource } from "./storage";
import type { Section } from "./types";

export type SectionBuild = {
    sections: Section[];
    images: Map<string, Buffer>;
};

export async function buildSections(config: PackagerConfig, source: PhotoSource): Promise<SectionBuild> {
    const sections = parseIndex(await Bun.file(config.indexFile).text());
    const indexedIds = new Set(sections.flatMap((section) => section.entries.map((entry) => entry.id)));
    const images = new Map<string, { width: number; height: number; lqip: string; extension: string; data: Buffer }>();

    for (const photo of await source.list()) {
        if (!indexedIds.has(photo.id)) continue;
        const image = sharp(photo.data);
        const metadata = await image.metadata();
        if (!metadata.width || !metadata.height) throw new Error(`Image has no dimensions: ${photo.id}`);
        const lqip = await image.resize(40).webp().toBuffer();
        images.set(photo.id, {
            width: metadata.width,
            height: metadata.height,
            lqip: lqip.toString("base64"),
            extension: photo.extension,
            data: photo.data,
        });
    }

    const outputSections = sections.map((section) => {
        const photos = section.entries.flatMap((entry) => {
            const image = images.get(entry.id);
            if (!image) {
                console.warn(`Image data not found for ID: ${entry.id}`);
                return [];
            }
            return [{
                id: entry.id,
                title: entry.title,
                width: image.width,
                height: image.height,
                lqip: image.lqip,
                extension: image.extension,
                column: 1 as const,
                metadata: entry.metadata,
                data: image.data,
            }];
        });
        assignColumns(photos, config.output.columnGap);
        return { title: section.title, photos: photos.map(({ data: _data, ...photo }) => photo) };
    });
    return {
        sections: outputSections,
        images: new Map([...images].map(([id, image]) => [id, image.data])),
    };
}

function assignColumns(photos: Array<{ id: string; width: number; height: number; column: 1 | 2 | 3 }>, gap: number): void {
    const heights = [0, 0, 0];
    for (const photo of photos) {
        const column = heights.indexOf(Math.min(...heights));
        photo.column = (column + 1) as 1 | 2 | 3;
        heights[column] = heights[column]! + (photo.height / photo.width) * 1200 + gap;
    }
}
