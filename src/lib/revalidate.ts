import { revalidatePath } from "next/cache";

import { PORTFOLIO_GENRES } from "@/lib/types";

export function revalidatePortfolioPaths() {
  revalidatePath("/");
  revalidatePath("/albums");
  revalidatePath("/search");
  revalidatePath("/admin");
  revalidatePath("/people");
  revalidatePath("/people/[slug]", "page");
  revalidatePath("/photos/[assetId]", "page");
  revalidatePath("/albums/[slug]", "page");
  revalidatePath("/work/[genre]", "page");

  for (const genre of PORTFOLIO_GENRES) {
    revalidatePath(`/work/${genre}`);
  }
}
