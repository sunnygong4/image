# Immich Portfolio

A custom public portfolio for `image.sunnygong.com`, backed by Immich for metadata, search, AI, and private share links.

## What is in this repo

- A `Next.js 15` public site with album, photo, search, and admin pages.
- A small local SQLite portfolio database for public/private curation.
- Server-side Immich API integration so the browser never receives the Immich API key.
- Docker Compose and Caddy files for `image.sunnygong.com` and `immich.sunnygong.com`.
- Syncthing and library-rescan operational docs.
- An AI curation pipeline for Gemini-assisted tagging, scoring, and optional export.

## Local development

1. Copy `.env.example` to `.env`.
2. Set `IMMICH_URL` and `IMMICH_API_KEY`.
3. Install dependencies with `npm install`.
4. Run `npm run dev`.
5. Open `http://localhost:3000/admin` and trigger the first Immich sync.

## Production shape

- `image.sunnygong.com` points to the portfolio app.
- `immich.sunnygong.com` points to the Immich web/API service.
- Immich mounts your synced filesystem archive at `/external-library`.
- The portfolio stores visibility overrides in `./data/portfolio.sqlite`.

## Immich setup

1. Bring up the stack with `docker compose up -d`.
2. Complete the first-run setup in Immich.
3. Create a read-only API key for the portfolio app and place it in `.env` as `IMMICH_API_KEY`.
4. In Immich, create an external library that points to `/external-library`.
5. Use the admin page in this app to sync albums and mark them public.

## Syncthing workflow

- Laptop folder: configure your photo archive as `Send Only`.
- Server folder: configure `/srv/photos/library` as `Receive Only`.
- Enable Syncthing file versioning on the server for recovery.
- Point `IMMICH_EXTERNAL_LIBRARY_PATH` at the same server folder.

Detailed Syncthing notes live in [ops/syncthing/README.md](/C:/Users/sunny/Documents/Projects/image/ops/syncthing/README.md).

## AI curation

The Gemini-assisted photo sorting pipeline is documented in [docs/ai-photo-pipeline.md](/C:/Users/sunny/Documents/Projects/image/docs/ai-photo-pipeline.md).

## Library rescans

Immich should rescan external libraries every 15 minutes in v1. Example script and systemd timer files are included in:

- [scripts/immich-rescan.sh](/C:/Users/sunny/Documents/Projects/image/scripts/immich-rescan.sh)
- [ops/systemd/immich-library-scan.service](/C:/Users/sunny/Documents/Projects/image/ops/systemd/immich-library-scan.service)
- [ops/systemd/immich-library-scan.timer](/C:/Users/sunny/Documents/Projects/image/ops/systemd/immich-library-scan.timer)

## Caddy admin password

Generate a bcrypt hash for `ADMIN_BCRYPT_HASH` with:

```bash
docker run --rm caddy:2.8-alpine caddy hash-password --plaintext 'choose-a-strong-password'
```
