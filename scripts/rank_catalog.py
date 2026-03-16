import argparse
import csv
import json
import math
import subprocess
from collections import defaultdict
from pathlib import Path


SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".tif", ".tiff"}
ROOT_DEFAULT = Path(r"C:\Users\sunny\Pictures\LRC Saved")
OUT_DEFAULT = Path("ops/catalog-ranking")
NODE_HELPER = Path(__file__).with_name("image_metrics.mjs")

GENRE_KEYWORDS = {
    "landscape": ("landscape", "mountain", "lake", "sunset", "forest", "hike", "park"),
    "street": ("street", "urban", "city", "daily", "night", "downtown", "portrait"),
    "wildlife": ("wildlife", "bird", "animal", "zoo", "safari", "deer", "fox", "bear"),
    "event": ("wedding", "grad", "event", "party", "ceremony", "conference", "birthday"),
    "product": ("product", "studio", "catalog", "watch", "shoe", "bottle", "merch"),
    "sports": ("soccer", "football", "sports", "match", "stadium", "basketball", "hockey"),
    "film": ("film", "polaroid", "analog", "35mm"),
}


def parse_args():
    parser = argparse.ArgumentParser(description="Rank catalog images into a reusable manifest.")
    parser.add_argument("--root", type=Path, default=ROOT_DEFAULT)
    parser.add_argument("--out-dir", type=Path, default=OUT_DEFAULT)
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--batch-size", type=int, default=48)
    return parser.parse_args()


def iter_files(root: Path):
    count = 0
    for path in root.rglob("*"):
        if path.is_file() and path.suffix.lower() in SUPPORTED_EXTENSIONS:
            yield path
            count += 1


def chunked(items, size):
    for index in range(0, len(items), size):
        yield items[index : index + size]


def call_metric_helper(paths):
    result = subprocess.run(
        ["node", str(NODE_HELPER)],
        input=json.dumps([str(path) for path in paths]),
        text=True,
        capture_output=True,
        check=True,
    )
    return json.loads(result.stdout)


def infer_genre(path: Path):
    haystack = " ".join(path.parts).lower()
    scores = {}

    for genre, keywords in GENRE_KEYWORDS.items():
        score = sum(1 for keyword in keywords if keyword in haystack)
        if score:
            scores[genre] = score

    if not scores:
        return "other", None, 0.3

    ranked = sorted(scores.items(), key=lambda item: item[1], reverse=True)
    primary = ranked[0][0]
    secondary = ranked[1][0] if len(ranked) > 1 else None
    confidence = min(1.0, 0.45 + ranked[0][1] * 0.12)
    return primary, secondary, confidence


def clamp(value, min_value=0.0, max_value=1.0):
    return max(min_value, min(max_value, value))


def compute_resolution_score(width, height):
    megapixels = (width * height) / 1_000_000 if width and height else 0
    return clamp(megapixels / 24)


def compute_technical_score(metric):
    exposure_balance = 1.0 - abs(metric["luminanceMean"] - 0.5) * 1.6
    return clamp(
        0.45 * compute_resolution_score(metric["width"], metric["height"])
        + 0.35 * metric["sharpness"]
        + 0.20 * clamp(exposure_balance)
    )


def compute_aesthetic_score(metric, primary_genre):
    contrast = metric["contrast"]
    luminance = metric["luminanceMean"]
    brightness_balance = clamp(1.0 - abs(luminance - 0.45) * 1.4)
    genre_bonus = 0.08 if primary_genre in {"landscape", "wildlife"} else 0.0

    return clamp(
        0.42 * metric["sharpness"]
        + 0.33 * contrast
        + 0.25 * brightness_balance
        + genre_bonus
    )


def compute_uniqueness_scores(rows):
    clusters = defaultdict(list)
    for row in rows:
        clusters[row["duplicate_cluster_id"]].append(row)

    for items in clusters.values():
        score = clamp(1.0 / math.sqrt(len(items)))
        for item in items:
            item["uniqueness_score"] = score


def compute_ai_score(row):
    primary_genre = row["primary_genre_guess"]
    genre_boost = 0.0
    if primary_genre in {"landscape", "wildlife"}:
        genre_boost = 0.12
    elif primary_genre in {"event", "product", "sports"}:
        genre_boost = 0.08

    return clamp(
        0.40 * row["aesthetic_score"]
        + 0.25 * row["technical_score"]
        + 0.20 * row["uniqueness_score"]
        + 0.15 * clamp(row["genre_confidence"] + genre_boost)
    )


def assign_roles(rows):
    by_genre = defaultdict(list)
    for row in rows:
        by_genre[row["primary_genre_guess"]].append(row)

    for items in by_genre.values():
        items.sort(key=lambda row: row["ai_score"], reverse=True)

    signature_cut = {
        path["relative_path"]
        for genre in ("landscape", "wildlife")
        for path in by_genre.get(genre, [])[:100]
    }
    specialty_cut = {
        path["relative_path"]
        for genre in ("event", "product", "sports")
        for path in by_genre.get(genre, [])[:60]
    }

    for row in rows:
        if row["relative_path"] in signature_cut:
            row["portfolio_role_guess"] = "signature"
            row["signature_flag"] = True
            row["shortlist_flag"] = True
        elif row["relative_path"] in specialty_cut:
            row["portfolio_role_guess"] = "specialty"
            row["signature_flag"] = False
            row["shortlist_flag"] = True
        else:
            row["portfolio_role_guess"] = "archive"
            row["signature_flag"] = False
            row["shortlist_flag"] = False


def write_outputs(rows, out_dir: Path):
    out_dir.mkdir(parents=True, exist_ok=True)
    json_path = out_dir / "manifest.json"
    csv_path = out_dir / "manifest.csv"

    with json_path.open("w", encoding="utf-8") as handle:
        json.dump(rows, handle, indent=2)

    with csv_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0].keys()) if rows else [])
        writer.writeheader()
        writer.writerows(rows)


def main():
    args = parse_args()
    files = list(iter_files(args.root))
    if args.limit > 0:
        files = files[: args.limit]

    rows = []

    for batch in chunked(files, args.batch_size):
        metrics = call_metric_helper(batch)
        for path, metric in zip(batch, metrics):
            if metric.get("error"):
                continue

            primary, secondary, confidence = infer_genre(path)
            rows.append(
                {
                    "relative_path": str(path.relative_to(args.root)),
                    "filename": path.name,
                    "folder_hint": path.parent.name,
                    "capture_at": None,
                    "primary_genre_guess": primary,
                    "secondary_genre_guess": secondary,
                    "genre_confidence": round(confidence, 4),
                    "duplicate_cluster_id": f"{metric['dHash']}:{metric['aHash'][:8]}",
                    "aesthetic_score": round(compute_aesthetic_score(metric, primary), 4),
                    "technical_score": round(compute_technical_score(metric), 4),
                    "uniqueness_score": 0.0,
                    "ai_score": 0.0,
                    "portfolio_role_guess": "archive",
                    "shortlist_flag": False,
                    "signature_flag": False,
                }
            )

    compute_uniqueness_scores(rows)
    for row in rows:
        row["uniqueness_score"] = round(row["uniqueness_score"], 4)
        row["ai_score"] = round(compute_ai_score(row), 4)

    assign_roles(rows)
    rows.sort(key=lambda row: row["ai_score"], reverse=True)
    write_outputs(rows, args.out_dir)


if __name__ == "__main__":
    main()
