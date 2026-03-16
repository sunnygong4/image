export function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function formatDate(value?: string | null) {
  if (!value) {
    return "Unknown date";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
  }).format(date);
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("en-CA").format(value);
}

export function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  const precision = size >= 100 || unitIndex === 0 ? 0 : size >= 10 ? 1 : 2;
  return `${size.toFixed(precision)} ${units[unitIndex]}`;
}

export function compactText(value?: string | null) {
  if (!value) {
    return "";
  }

  return value.trim().replace(/\s+/g, " ");
}

export function pluralize(
  count: number,
  singular: string,
  plural = `${singular}s`,
) {
  return `${formatNumber(count)} ${count === 1 ? singular : plural}`;
}
