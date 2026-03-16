import { syncPeopleFromImmich } from "@/lib/people-sync";
import { revalidatePortfolioPaths } from "@/lib/revalidate";

export const runtime = "nodejs";

export async function POST() {
  try {
    const result = await syncPeopleFromImmich();
    revalidatePortfolioPaths();
    return Response.json(result);
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Immich people sync failed unexpectedly.",
      },
      { status: 500 },
    );
  }
}
