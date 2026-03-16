# AI Photo Curation Pipeline

This pipeline keeps Immich as the website source of truth while adding AI-generated metadata, ratings, and summaries into the portfolio database.

## What it does

1. `npm run rank:catalog`
   - builds local technical and duplicate metrics into `ops/catalog-ranking/manifest.json`
2. `npm run ai:annotate -- --input ops/catalog-ranking/manifest.json --output ops/ai-ranking/gemini-manifest.json`
   - sends resized JPEGs to Gemini
   - adds tags, summary, semantic score, and genre/role suggestions
3. `npm run rank:import -- ops/ai-ranking/gemini-manifest.json ops/ai-ranking/unmatched-report.csv`
   - matches manifest rows back to Immich assets and stores the AI data in `asset_annotations`
4. `npm run ai:export`
   - optionally copies approved/public photos to `AI_EXPORT_ROOT`

## Required env vars

Add these to `.env` or `.env.local`:

```env
GEMINI_API_KEY=your-key-here
GEMINI_MODEL=gemini-2.5-flash-lite
AI_SOURCE_ROOT=C:\Users\sunny\Pictures\LRC Saved
AI_EXPORT_ROOT=C:\Users\sunny\Pictures\Portfolio Export
AI_BATCH_STATE_DIR=ops\ai-ranking\state
```

## Notes

- The website still reads from Immich plus admin metadata, not from the export folder.
- AI-generated descriptions stay suggestions until you accept or override them in admin.
- The export step only copies approved/public selections; it does not change the website.
- `ai:export -- --prune` removes files that are no longer in the current approved/public export set.
