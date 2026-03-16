import type { PortfolioGenre } from "@/lib/types";

export const SIGNATURE_GENRES: PortfolioGenre[] = ["landscape", "wildlife"];
export const SPECIALTY_GENRES: PortfolioGenre[] = [
  "street",
  "event",
  "product",
  "sports",
];

export const GENRE_CONTENT: Record<
  PortfolioGenre,
  {
    description: string;
    kicker: string;
    title: string;
  }
> = {
  landscape: {
    kicker: "Signature Work",
    title: "Landscape",
    description:
      "Large-scale scenes, light, weather, and quiet moments that anchor the public portfolio.",
  },
  street: {
    kicker: "Focus Gallery",
    title: "Street",
    description:
      "Observed city moments, layered gestures, and fleeting human detail shaped by timing and atmosphere.",
  },
  wildlife: {
    kicker: "Signature Work",
    title: "Wildlife",
    description:
      "Animal portraits and wild encounters selected to sit beside the landscape work as the core portfolio.",
  },
  event: {
    kicker: "Focus Gallery",
    title: "Events",
    description:
      "Human moments, atmosphere, and coverage work shaped for clients, stories, and editorial delivery.",
  },
  product: {
    kicker: "Specialty",
    title: "Product Photography",
    description:
      "Controlled light, detail, and commercial polish for objects, campaigns, and brand stories.",
  },
  sports: {
    kicker: "Specialty",
    title: "Sports Photography",
    description:
      "Fast, decisive frames built around action, emotion, and the pace of competition.",
  },
  film: {
    kicker: "Archive",
    title: "Film",
    description:
      "Film scans and analog work that sit slightly apart from the main digital portfolio.",
  },
  other: {
    kicker: "Archive",
    title: "Other Work",
    description:
      "A flexible catch-all for experiments, one-off studies, and work that does not fit a main lane yet.",
  },
};

export function isPortfolioGenre(value: string): value is PortfolioGenre {
  return value in GENRE_CONTENT;
}
