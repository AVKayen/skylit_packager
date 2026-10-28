[skylit.studio](https://skylit.studio)

# skylit-packager

Skylit-packager is a static photo bundle generator for skylit

This repo hosts the photo index for [skylit.studio](https://skylit.studio) as well es the packager code in index.ts.

The de-facto skylit.studio code is in the [skylit-earth](https://github.com/AVKayen/skylit_earth) repo

Old skylit.studio code based on Sanity CDN and using the justifiedLayout library is in the [skylit](https://github.com/AVKayen/skylit) repo

## Running the packager

Install dependencies with `bun install`, then run:

```sh
bun run index.ts
```

The default [packager.config.json](./packager.config.json) reads photos from an S3-compatible
bucket and writes the static bundle to `output/`. Configure S3 credentials using the AWS SDK
environment variables (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and, when needed,
`AWS_SESSION_TOKEN`). For Cloudflare R2, MinIO, or another S3-compatible service, set
`storage.endpoint`, `storage.region`, and `storage.forcePathStyle` as appropriate.

To use local files instead, change storage to:

```json
{
  "type": "local",
  "directory": "data/photos"
}
```

Pass a different config as the first argument, or override the index file as the second:

```sh
bun run index.ts ./my-packager.config.json
bun run index.ts ./my-packager.config.json ./index.txt
```

The implementation is split into configuration, index parsing, storage, section building,
and output modules under `src/`.