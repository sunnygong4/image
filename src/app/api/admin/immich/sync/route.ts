import { revalidatePath } from "next/cache";

import { syncPortfolioFromImmich } from "@/lib/portfolio";
import { revalidatePortfolioPaths } from "@/lib/revalidate";

export const runtime = "nodejs";

export async function POST() {
  try {
    const result = await syncPortfolioFromImmich();
    revalidatePortfolio();
    return Response.json(result);
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Immich sync failed unexpectedly.",
      },
      { status: 500 },
    );
  }
}

function revalidatePortfolio() {
  revalidatePortfolioPaths();
  revalidatePath("/");
}
