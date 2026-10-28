import { resolve } from "node:path";

export type StorageConfig =
    | {
          type: "local";
          directory: string;
      }
    | {
          type: "s3";
          bucket: string;
          region?: string;
          endpoint?: string;
          prefix?: string;
          forcePathStyle?: boolean;
      };

export type PackagerConfig = {
    indexFile: string;
    storage: StorageConfig;
    output: {
        directory: string;
        imageWidth: number;
        imageQuality: number;
        columns: 3;
        columnGap: number;
    };
    staticFiles: string[];
};

const defaultConfig: PackagerConfig = {
    indexFile: "index.txt",
    storage: {
        type: "s3",
        bucket: "skylit-photos",
        region: "us-east-1",
        endpoint: "https://s3.amazonaws.com",
        prefix: "",
    },
    output: {
        directory: "output",
        imageWidth: 1200,
        imageQuality: 80,
        columns: 3,
        columnGap: 50,
    },
    staticFiles: ["index.html", "favicon.ico"],
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function validateConfig(config: PackagerConfig): PackagerConfig {
    if (!config.indexFile || !config.output.directory) {
        throw new Error("Config must define indexFile and output.directory");
    }
    if (config.storage.type === "s3" && !config.storage.bucket) {
        throw new Error("S3 storage requires a bucket");
    }
    if (config.output.imageWidth <= 0 || config.output.imageQuality <= 0 || config.output.imageQuality > 100) {
        throw new Error("output.imageWidth must be positive and imageQuality must be between 1 and 100");
    }
    return config;
}

export async function loadConfig(args: string[]): Promise<PackagerConfig> {
    const configPath = args[0] ?? "packager.config.json";
    const indexOverride = args[1];
    const file = Bun.file(configPath);
    if (!(await file.exists())) {
        throw new Error(`Config file not found: ${configPath}`);
    }

    const raw: unknown = await file.json();
    if (!isRecord(raw)) {
        throw new Error(`Config file must contain a JSON object: ${configPath}`);
    }

    const config = {
        ...defaultConfig,
        ...raw,
        output: { ...defaultConfig.output, ...(isRecord(raw.output) ? raw.output : {}) },
        storage: { ...defaultConfig.storage, ...(isRecord(raw.storage) ? raw.storage : {}) },
        staticFiles: Array.isArray(raw.staticFiles) ? raw.staticFiles : defaultConfig.staticFiles,
        indexFile: indexOverride ?? raw.indexFile ?? defaultConfig.indexFile,
    } as PackagerConfig;

    config.indexFile = resolve(config.indexFile);
    config.output.directory = resolve(config.output.directory);
    if (config.storage.type === "local") {
        config.storage.directory = resolve(config.storage.directory);
    }
    return validateConfig(config);
}
