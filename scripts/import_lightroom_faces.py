import argparse
import csv
import json
import sqlite3
from pathlib import Path


CATALOG_DEFAULT = Path(r"C:\Users\sunny\Pictures\Lightroom Catalog-v12-2\Sunny'sMainCatalog.lrcat")
OUT_DEFAULT = Path("ops/catalog-ranking")

QUERY = """
SELECT
  k.id_local AS keyword_id,
  k.name AS person_name,
  k.keywordType AS keyword_type,
  kf.face AS source_face_key,
  img.captureTime AS capture_at,
  file.baseName AS base_name,
  file.extension AS extension,
  folder.pathFromRoot AS path_from_root,
  root.absolutePath AS absolute_root,
  f.tl_x AS face_left,
  f.tl_y AS face_top,
  (f.br_x - f.tl_x) AS face_width,
  (f.br_y - f.tl_y) AS face_height
FROM AgLibraryKeywordFace kf
JOIN AgLibraryKeyword k
  ON k.id_local = kf.tag
JOIN AgLibraryFace f
  ON f.id_local = kf.face
JOIN Adobe_images img
  ON img.id_local = f.image
JOIN AgLibraryFile file
  ON file.id_local = img.rootFile
JOIN AgLibraryFolder folder
  ON folder.id_local = file.folder
JOIN AgLibraryRootFolder root
  ON root.id_local = folder.rootFolder
WHERE k.keywordType = 'person'
  AND COALESCE(kf.userReject, 0) = 0
  AND COALESCE(k.name, '') != ''
ORDER BY k.name ASC, img.captureTime ASC
"""


def parse_args():
    parser = argparse.ArgumentParser(description="Export Lightroom face assignments into a reusable manifest.")
    parser.add_argument("--catalog", type=Path, default=CATALOG_DEFAULT)
    parser.add_argument("--out-dir", type=Path, default=OUT_DEFAULT)
    return parser.parse_args()


def main():
    args = parse_args()
    args.out_dir.mkdir(parents=True, exist_ok=True)
    json_path = args.out_dir / "lightroom-faces.json"
    csv_path = args.out_dir / "lightroom-faces.csv"

    with sqlite3.connect(args.catalog) as connection:
        connection.row_factory = sqlite3.Row
        rows = [
            {
                "keyword_id": str(row["keyword_id"]),
                "person_name": row["person_name"],
                "source_face_key": str(row["source_face_key"]),
                "capture_at": row["capture_at"],
                "filename": f"{row['base_name']}.{str(row['extension']).lower()}",
                "relative_catalog_path": str(Path(row["path_from_root"]) / f"{row['base_name']}.{str(row['extension']).lower()}"),
                "absolute_catalog_path": str(Path(row["absolute_root"]) / row["path_from_root"] / f"{row['base_name']}.{str(row['extension']).lower()}"),
                "face_left": round(float(row["face_left"]), 6),
                "face_top": round(float(row["face_top"]), 6),
                "face_width": round(float(row["face_width"]), 6),
                "face_height": round(float(row["face_height"]), 6),
                "source_confidence": 1.0,
            }
            for row in connection.execute(QUERY)
        ]

    with json_path.open("w", encoding="utf-8") as handle:
        json.dump(rows, handle, indent=2)

    with csv_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0].keys()) if rows else [])
        writer.writeheader()
        writer.writerows(rows)


if __name__ == "__main__":
    main()
