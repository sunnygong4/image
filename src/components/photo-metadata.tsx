import type { PublicAsset } from "@/lib/types";
import { formatBytes, formatDate, formatNumber } from "@/lib/utils";

interface PhotoMetadataProps {
  asset: PublicAsset;
  variant?: "grid" | "stacked";
}

export function PhotoMetadata({
  asset,
  variant = "grid",
}: PhotoMetadataProps) {
  const items = [
    ["Captured", formatDate(asset.captureAt)],
    ["Camera", asset.cameraLabel],
    ["Lens", asset.lensLabel],
    ["Location", asset.locationLabel],
    [
      "File size",
      asset.exifInfo?.fileSizeInByte
        ? formatBytes(asset.exifInfo.fileSizeInByte)
        : null,
    ],
    ["ISO", asset.exifInfo?.iso ? formatNumber(asset.exifInfo.iso) : null],
    ["Exposure", asset.exifInfo?.exposureTime ?? null],
    [
      "Focal length",
      asset.exifInfo?.focalLength ? `${asset.exifInfo.focalLength} mm` : null,
    ],
    ["Aperture", asset.exifInfo?.fNumber ? `f/${asset.exifInfo.fNumber}` : null],
    [
      "Dimensions",
      asset.exifInfo?.imageWidth && asset.exifInfo?.imageHeight
        ? `${formatNumber(asset.exifInfo.imageWidth)} x ${formatNumber(asset.exifInfo.imageHeight)}`
        : null,
    ],
  ].filter((item): item is [string, string] => Boolean(item[1]));

  if (!items.length) {
    return variant === "stacked" ? (
      <p className="text-xs leading-6 text-white/62 md:text-sm md:leading-7">
        No capture metadata is available for this image.
      </p>
    ) : (
      <p className="text-sm text-dusk">No capture metadata is available for this image.</p>
    );
  }

  if (variant === "stacked") {
    return (
      <dl className="space-y-2 md:space-y-3">
        {items.map(([label, value]) => (
          <div
            key={label}
            className="rounded-[1rem] border border-white/10 bg-white/[0.03] px-3 py-2.5 md:rounded-[1.35rem] md:px-4 md:py-4"
          >
            <dt className="text-[10px] uppercase tracking-[0.28em] text-white/42 md:text-[11px] md:tracking-[0.32em]">
              {label}
            </dt>
            <dd className="mt-1.5 text-xs font-medium text-white/88 md:mt-2 md:text-sm">
              {value}
            </dd>
          </div>
        ))}
      </dl>
    );
  }

  return (
    <dl className="grid gap-4 md:grid-cols-2">
      {items.map(([label, value]) => (
        <div
          key={label}
          className="rounded-[1.5rem] border border-black/10 bg-white/60 px-4 py-4"
        >
          <dt className="mb-1 text-xs uppercase tracking-[0.28em] text-dusk">{label}</dt>
          <dd className="text-sm font-medium text-ink">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
