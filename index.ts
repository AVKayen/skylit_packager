import { loadConfig } from "./src/config";
import { buildSections } from "./src/sections";
import { createPhotoSource } from "./src/storage";
import { writeOutput } from "./src/output";

async function main(): Promise<void> {
    const config = await loadConfig(process.argv.slice(2));
    const source = createPhotoSource(config);
    const build = await buildSections(config, source);
    await writeOutput(config, build);
    console.log(`Wrote ${build.sections.length} sections to ${config.output.directory}`);
}

main().catch((error: unknown) => {
    console.error("Packaging failed:", error);
    process.exitCode = 1;
});
