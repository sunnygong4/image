# Syncthing plan

## Roles

- Laptop archive folder: `Send Only`
- Server archive folder (`/srv/photos/library`): `Receive Only`
- Immich external library mount: `/external-library`

## Recommended server settings

- Enable file versioning on the server-side Syncthing folder.
- Keep the server folder on local storage, not a network share.
- Do not let Immich manage or move files inside the synced archive.

## Recommended folder discipline

- Organize by stable year/event folders before you start curation.
- Avoid large folder moves after albums are curated, because external-library assets can lose their attached metadata when paths change.
- If you want RAW or video files stored but not surfaced publicly, keep them in the same sync tree and control visibility at the portfolio layer.

