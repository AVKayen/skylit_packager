import type { IndexSection, PhotoMetadata } from "./types";

function parseMetadata(value: string): { title: string; metadata: PhotoMetadata } {
    const trimmed = value.trim();
    if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
        return { title: trimmed || "untitled", metadata: {} };
    }

    const parsed: unknown = JSON.parse(trimmed);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        throw new Error(`Entry metadata must be a JSON object: ${value}`);
    }
    const object = parsed as Record<string, unknown>;
    const title = typeof object.title === "string" ? object.title : "untitled";
    const metadata: PhotoMetadata = {};
    for (const [key, item] of Object.entries(object)) {
        if (key !== "title" && ["string", "number", "boolean"].includes(typeof item)) {
            metadata[key] = item as string | number | boolean;
        }
    }
    return { title, metadata };
}

export function parseIndex(contents: string): IndexSection[] {
    const sections: IndexSection[] = [];
    let current: IndexSection | undefined;

    for (const [lineNumber, rawLine] of contents.split(/\r?\n/).entries()) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#") || line.startsWith("@")) {
            continue;
        }
        if (line.startsWith(">")) {
            current = { title: line.slice(1).trim(), entries: [] };
            sections.push(current);
            continue;
        }
        if (!current) {
            throw new Error(`Photo entry appears before a section on line ${lineNumber + 1}`);
        }

        const separator = line.indexOf(" - ");
        const id = (separator < 0 ? line : line.slice(0, separator)).trim();
        if (!id) {
            throw new Error(`Missing photo ID on line ${lineNumber + 1}`);
        }
        const value = separator < 0 ? "" : line.slice(separator + 3);
        const { title, metadata } = parseMetadata(value);
        current.entries.push({ id, title, metadata });
    }
    return sections.filter((section) => section.entries.length > 0);
}
