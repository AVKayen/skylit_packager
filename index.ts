const sharp = require("sharp");
const readdir = require("node:fs/promises").readdir;
const mkdir = require("node:fs/promises").mkdir;
const copyFile = require("node:fs/promises").copyFile;

import {
    S3Client,
    S3ServiceException,
    // This command supersedes the ListObjectsCommand and is the recommended way to list objects.
    paginateListObjectsV2,
    ListObjectsV2Command,
} from "@aws-sdk/client-s3";


type Section = {
    title: string;
    photos: Array<Photo>;
};

type IndexEntry = {
    id: string;
    title: string;
};

type IndexSection = {
    title: string;
    entries: Array<IndexEntry>;
};

type Photo = {
    id: string;
    title: string;
    width: number;
    height: number;
    lqip?: string;
    extension: string;
    column: 1 | 2 | 3;
};

async function main() {
    const indexFile = process.argv[2] || "index.txt";
    // Read and parse the section index in index.txt
    let indexSections: Array<IndexSection> = [];
    let indexArguments: Map<string, string> = new Map();
    const index = Bun.file(`${indexFile || "index.txt"}`).text();
    await index.then(async (data) => {
        const lines = data.split("\n");
        if (lines.length === 0) {
            console.log("No lines found in index.txt");
            return;
        }
        let currentSection: IndexSection = { title: "", entries: [] };
        for (const line of lines) {
            let entry = line.trim();
            if (entry === "") {
                continue;
            }
            if (entry.startsWith("#")) {
                continue;
            }
            if (entry.startsWith(">")) {
                if (currentSection.entries.length > 0) {
                    indexSections.push(currentSection);
                }
                currentSection = { title: entry.substring(1).trim(), entries: [] };
                continue;
            }
            if (entry.startsWith("@")) {
                const [key, value] = entry.substring(1).split("=").map((part) => part.trim());
                if (!key || !value) {
                    console.log(`Invalid argument format: ${line}`);
                    continue;
                }
                indexArguments.set(key, value);
                continue;
            }
            const [id, title] = entry.split("-").map((part) => part.trim());
            if (!id || !title) {
                console.log(`Invalid line format: ${line}`);
                continue;
            }
            currentSection.entries.push({ id, title });
        }
        if (currentSection.entries.length > 0) {
            indexSections.push(currentSection);
        }
    });
    console.log(`Read ${indexArguments.size} arguments and ${indexSections.length} sections from index.txt`);

    if (!indexArguments.has("imageUrl") || !indexArguments.has("targetDirectory")) {
        console.log("Missing required arguments: imageUrl or targetDirectory");
        return;
    }

    const imageUrl = indexArguments.get("imageUrl")!;
    const targetPath = indexArguments.get("targetDirectory")!;

    try {
        await mkdir(`${targetPath}/photos`, { recursive: true });
    } catch (error) {
        console.log(`Error creating output directory: ${error}`);
    }

    const s3Client = new S3Client({});
    const command = new ListObjectsV2Command({
        Bucket: "skylit-photos"
    });
    let photoListS3 = await s3Client.send(command);
    console.log(`Found ${photoListS3.Contents?.length || 0} photos in S3 bucket`);

    let images: Map<string, { width: number; height: number; lqip: string, extension: string }> = new Map();
    for (const photo of photoListS3.Contents || []) {
        let name = photo.Key;
        if (!name) {
            console.log(`Photo key is undefined, skipping`);
            continue;
        }
        const imageBuffer = await fetch(`${imageUrl}/${name}`).then((res) => res.arrayBuffer()).then((buffer) => Buffer.from(buffer));

        const [id, extension] = name.split(".");
        if (!id || !extension) {
            console.log(`Invalid photo name format: ${name}, skipping`);
            continue;
        }
        try {
            const image = sharp(imageBuffer);
            const metadata = await image.metadata();
            const lqip = await image.resize(40).webp().toBuffer();
            images.set(id, { width: metadata.width!, height: metadata.height!, lqip: lqip.toString("base64"), extension });
        } catch (error) {
            console.log(`Error processing photo ${name}: ${error}`);
            continue;
        }


        if (indexSections.some((section) => section.entries.some((entry) => entry.id === name.split(".")[0]))) {
            try {
                await sharp(imageBuffer)
                    .resize({ width: 1200 })
                    .jpeg({ quality: 80 })
                    .toFile(`${targetPath}/photos/${id}.jpg`);
            } catch (error) {
                console.log(`Error processing image ${id}: ${error}`);
            }
        } else {
            console.log(`Photo ${name} not found in index, skipping`);
        }
        console.log(`Photo: ${photo.Key}`);
    }


    // Join the section index with the image metadata to create a complete section index
    let sections: Array<Section> = [];
    for (const indexSection of indexSections) {
        let section: Section = { title: indexSection.title, photos: [] };
        for (const entry of indexSection.entries) {
            const imageData = images.get(entry.id);
            if (!imageData) {
                console.log(`Image data not found for ID: ${entry.id}`);
                continue;
            }
            section.photos.push({
                id: entry.id,
                title: entry.title,
                width: imageData.width,
                height: imageData.height,
                lqip: imageData.lqip,
                extension: imageData.extension,
                column: 1, // Default column, will be updated later
            });
        }
        sections.push(section);
    }

    // Create output directory and copy static files
    
    try {
        await copyFile("index.html", `${targetPath}/index.html`);
    } catch (error) {
        console.log(`Error copying index.html: ${error}`);
    }

    // Distribute photos among the masonry columns based on their aspect ratios
    for (const section of sections) {
        let columns: Array<{ photos: string[]; height: number }> = [
            { photos: [], height: 0 },
            { photos: [], height: 0 },
            { photos: [], height: 0 },
        ];
        for (const photo of section.photos) {
            const aspectRatio = photo.height / photo.width;
            const scaledHeight = Math.round(aspectRatio * 1200);
            const column = columns.reduce((prev, curr) => (curr.height < prev.height ? curr : prev), columns[0]!);
            column.photos.push(photo.id);
            column.height += scaledHeight + 50;
        }
        for (const column of columns) {
            for (const photoId of column.photos) {
                const photo = section.photos.find((p) => p.id === photoId);
                if (photo) {
                    photo.column = columns.indexOf(column) + 1 as (1 | 2 | 3);
                }
            }
        }
    }

    // Write the section index to a JSON file in the output directory
    try {
        await Bun.write(`${targetPath}/sections.json`, JSON.stringify(sections, null, 2));
        console.log(`Section index written to ${targetPath}/sections.json`);
    } catch (error) {
        console.log(`Error writing section index: ${error}`);
    }
}

main().catch((error) => {
    console.error(`Error in main function: ${error}`);
}).finally(() => {
    console.log("Processing complete");
});
