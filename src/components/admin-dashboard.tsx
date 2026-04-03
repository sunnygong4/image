"use client";

import Link from "next/link";
import { useDeferredValue, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  PERSON_VISIBILITIES,
  PORTFOLIO_GENRES,
  PORTFOLIO_ROLES,
  REVIEW_STATES,
  type AdminDashboardData,
} from "@/lib/types";
import { cn } from "@/lib/utils";

interface AdminDashboardProps {
  data: AdminDashboardData;
}

export function AdminDashboard({ data }: AdminDashboardProps) {
  const router = useRouter();
  const [albumFilter, setAlbumFilter] = useState("");
  const [peopleFilter, setPeopleFilter] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [isAlbumSyncPending, startAlbumSyncTransition] = useTransition();
  const [isPeopleSyncPending, startPeopleSyncTransition] = useTransition();
  const [isSavePending, startSaveTransition] = useTransition();
  const deferredAlbumFilter = useDeferredValue(albumFilter);
  const deferredPeopleFilter = useDeferredValue(peopleFilter);

  const filteredAlbums = data.albums.filter((album) => {
    if (!deferredAlbumFilter.trim()) {
      return true;
    }

    const needle = deferredAlbumFilter.trim().toLowerCase();
    return (
      album.title.toLowerCase().includes(needle) ||
      album.slug.toLowerCase().includes(needle) ||
      album.immichTitle.toLowerCase().includes(needle)
    );
  });

  const filteredPeople = data.people.filter((person) => {
    if (!deferredPeopleFilter.trim()) {
      return true;
    }

    const needle = deferredPeopleFilter.trim().toLowerCase();
    return (
      person.displayName.toLowerCase().includes(needle) ||
      person.slug.toLowerCase().includes(needle)
    );
  });

  const selectedAlbum =
    data.albums.find((album) => album.id === data.selectedAlbumId) ?? null;

  async function runJsonAction(
    url: string,
    body: Record<string, unknown> | null,
    successMessage: string,
    method = "PATCH",
  ) {
    setFeedback(null);

    startSaveTransition(async () => {
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setFeedback(payload?.error ?? "Request failed.");
        return;
      }

      setFeedback(successMessage);
      router.refresh();
    });
  }

  async function handleAlbumSync() {
    setFeedback(null);

    startAlbumSyncTransition(async () => {
      const response = await fetch("/api/admin/immich/sync", { method: "POST" });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setFeedback(payload?.error ?? "Album sync failed.");
        return;
      }

      setFeedback(
        `Synced ${payload?.albumCount ?? 0} albums and ${payload?.assetMembershipCount ?? 0} asset memberships.`,
      );
      router.refresh();
    });
  }

  async function handlePeopleSync() {
    setFeedback(null);

    startPeopleSyncTransition(async () => {
      const response = await fetch("/api/admin/immich/people-sync", {
        method: "POST",
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setFeedback(payload?.error ?? "People sync failed.");
        return;
      }

      setFeedback(
        `Synced people: ${payload?.createdCount ?? 0} created, ${payload?.mergedCount ?? 0} merged, ${payload?.membershipCount ?? 0} memberships refreshed.`,
      );
      router.refresh();
    });
  }

  async function handleAlbumSubmit(
    event: React.FormEvent<HTMLFormElement>,
    albumId: string,
  ) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    await runJsonAction(
      `/api/admin/albums/${albumId}`,
      {
        slug: String(formData.get("slug") ?? ""),
        visibility: String(formData.get("visibility") ?? "private"),
        featured: formData.get("featured") === "on",
        sortOrder: Number(formData.get("sortOrder") ?? 0),
        coverAssetId: emptyToNull(formData.get("coverAssetId")),
        titleOverride: emptyToNull(formData.get("titleOverride")),
        descriptionOverride: emptyToNull(formData.get("descriptionOverride")),
        shareUrl: emptyToNull(formData.get("shareUrl")),
        category: emptyToNull(formData.get("category")),
      },
      "Album settings saved.",
    );
  }

  async function handleAssetSubmit(
    event: React.FormEvent<HTMLFormElement>,
    assetId: string,
  ) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    await runJsonAction(
      `/api/admin/assets/${assetId}`,
      {
        albumId: String(formData.get("albumId") ?? ""),
        visibility: String(formData.get("visibility") ?? "inherit"),
        featured: formData.get("featured") === "on",
        allowDownload: formData.get("allowDownload") === "on",
        sortOrder: Number(formData.get("sortOrder") ?? 0),
        titleOverride: emptyToNull(formData.get("titleOverride")),
        descriptionOverride: emptyToNull(formData.get("descriptionOverride")),
        primaryGenre: emptyToNull(formData.get("primaryGenre")),
        secondaryGenre: emptyToNull(formData.get("secondaryGenre")),
        portfolioRole: String(formData.get("portfolioRole") ?? "archive"),
        reviewState: String(formData.get("reviewState") ?? "suggested"),
      },
      "Photo settings saved.",
    );
  }

  async function handlePersonSubmit(
    event: React.FormEvent<HTMLFormElement>,
    personId: string,
  ) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    await runJsonAction(
      `/api/admin/people/${personId}`,
      {
        displayName: String(formData.get("displayName") ?? ""),
        slug: String(formData.get("slug") ?? ""),
        visibility: String(formData.get("visibility") ?? "private"),
        sourcePriority: Number(formData.get("sourcePriority") ?? 0),
        confidenceScore: Number(formData.get("confidenceScore") ?? 0),
      },
      "Person settings saved.",
    );
  }

  async function handlePersonMerge(personId: string) {
    const targetPersonId = window.prompt("Merge into which target person ID?");
    const cleaned = targetPersonId?.trim();

    if (!cleaned) {
      return;
    }

    await runJsonAction(
      `/api/admin/people/${personId}/merge`,
      { targetPersonId: cleaned },
      `Merged person into ${cleaned}.`,
      "POST",
    );
  }

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-black/10 bg-white/60 px-6 py-8 shadow-soft">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-dusk">Admin</p>
            <h1 className="display-font mt-3 text-5xl text-ink">Portfolio curation</h1>
            <p className="mt-4 max-w-3xl text-sm leading-8 text-dusk md:text-base">
              Albums still control public visibility, while asset annotations now drive
              the homepage, genre pages, AI shortlists, and people discovery.
            </p>
          </div>

          <div className="surface flex flex-col gap-3 rounded-[1.75rem] border border-black/10 p-5">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-dusk">Immich status</p>
              <p className="mt-2 text-sm font-medium text-ink">{data.status.message}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleAlbumSync}
                disabled={isAlbumSyncPending || !data.status.hasImmichConfig}
                className="rounded-full bg-pine px-5 py-3 text-sm font-semibold text-white transition hover:bg-ink disabled:cursor-not-allowed disabled:bg-dusk"
              >
                {isAlbumSyncPending ? "Syncing albums..." : "Sync albums"}
              </button>
              <button
                type="button"
                onClick={handlePeopleSync}
                disabled={isPeopleSyncPending || !data.status.hasImmichConfig}
                className="rounded-full border border-black/10 px-5 py-3 text-sm font-semibold text-ink transition hover:border-pine/30 hover:text-pine disabled:cursor-not-allowed disabled:text-dusk"
              >
                {isPeopleSyncPending ? "Syncing people..." : "Sync people"}
              </button>
            </div>
          </div>
        </div>

        {feedback ? (
          <div className="mt-6 rounded-[1.25rem] border border-pine/20 bg-pine/10 px-4 py-3 text-sm text-ink">
            {feedback}
          </div>
        ) : null}
      </section>

      <section className="grid gap-8 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-4">
          <Panel>
            <label className="text-xs uppercase tracking-[0.28em] text-dusk" htmlFor="album-filter">
              Filter albums
            </label>
            <input
              id="album-filter"
              type="search"
              value={albumFilter}
              onChange={(event) => setAlbumFilter(event.target.value)}
              placeholder="Search by title or slug"
              className="input-field mt-3"
            />
          </Panel>

          <div className="space-y-4">
            {filteredAlbums.length ? (
              filteredAlbums.map((album) => (
                <form
                  key={album.id}
                  onSubmit={(event) => handleAlbumSubmit(event, album.id)}
                  className={cn(
                    "surface rounded-[1.75rem] border border-black/10 p-5 shadow-soft",
                    selectedAlbum?.id === album.id && "border-pine/40 ring-1 ring-pine/10",
                  )}
                >
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.28em] text-dusk">
                        {album.immichTitle}
                      </p>
                      <h2 className="display-font mt-2 text-3xl text-ink">{album.title}</h2>
                      <p className="mt-2 text-sm text-dusk">{album.assetCount} public photos</p>
                    </div>
                    <Link
                      href={`/admin?album=${album.id}`}
                      className="rounded-full border border-black/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-dusk transition hover:border-pine/30 hover:text-pine"
                    >
                      Inspect
                    </Link>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Slug">
                      <input name="slug" defaultValue={album.slug} className="input-field" />
                    </Field>
                    <Field label="Visibility">
                      <select name="visibility" defaultValue={album.visibility} className="input-field">
                        <option value="private">Private</option>
                        <option value="public">Public</option>
                      </select>
                    </Field>
                    <Field label="Sort order">
                      <input name="sortOrder" type="number" defaultValue={album.sortOrder} className="input-field" />
                    </Field>
                    <Field label="Cover asset ID">
                      <input name="coverAssetId" defaultValue={album.coverAssetId ?? ""} className="input-field" />
                    </Field>
                    <Field label="Title override" span="full">
                      <input
                        name="titleOverride"
                        defaultValue={album.title === album.immichTitle ? "" : album.title}
                        className="input-field"
                      />
                    </Field>
                    <Field label="Description override" span="full">
                      <textarea
                        name="descriptionOverride"
                        defaultValue={
                          album.description === album.immichDescription ? "" : (album.description ?? "")
                        }
                        rows={3}
                        className="textarea-field"
                      />
                    </Field>
                    <Field label="Immich share URL" span="full">
                      <input name="shareUrl" defaultValue={album.shareUrl ?? ""} className="input-field" />
                    </Field>
                    <Field label="Category">
                      <select name="category" defaultValue={album.category ?? ""} className="input-field">
                        <option value="">None (event)</option>
                        <option value="event">Event</option>
                        <option value="month">Month</option>
                        <option value="film-roll">Film roll</option>
                        <option value="hidden">Hidden</option>
                      </select>
                    </Field>
                  </div>

                  <label className="mt-4 inline-flex items-center gap-3 text-sm font-medium text-ink">
                    <input name="featured" type="checkbox" defaultChecked={album.featured} className="h-4 w-4 rounded border-black/20" />
                    Feature this album in story sections
                  </label>

                  <div className="mt-5 flex justify-end">
                    <button
                      type="submit"
                      disabled={isSavePending}
                      className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-pine disabled:cursor-not-allowed disabled:bg-dusk"
                    >
                      {isSavePending ? "Saving..." : "Save album"}
                    </button>
                  </div>
                </form>
              ))
            ) : (
              <Panel>No synced albums match that filter yet.</Panel>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <Panel>
            <p className="text-xs uppercase tracking-[0.28em] text-dusk">Album detail</p>
            <h2 className="display-font mt-2 text-3xl text-ink">
              {selectedAlbum ? selectedAlbum.title : "Select an album"}
            </h2>
            <p className="mt-2 text-sm text-dusk">
              {selectedAlbum
                ? `${data.selectedAlbumAssets.length} photos — click a photo to edit it.`
                : "Pick an album from the left to inspect its photo-level settings."}
            </p>
          </Panel>

          {selectedAlbum ? (
            <div className="space-y-4">
              {data.selectedAlbumAssets.length ? (
                <>
                  {/* Photo grid */}
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
                    {data.selectedAlbumAssets.map((asset) => (
                      <button
                        key={asset.id}
                        type="button"
                        onClick={() => setSelectedAssetId(asset.id === selectedAssetId ? null : asset.id)}
                        className={cn(
                          "group relative aspect-square overflow-hidden rounded-xl border-2 transition",
                          asset.id === selectedAssetId
                            ? "border-pine ring-2 ring-pine/30"
                            : "border-transparent hover:border-black/20",
                        )}
                      >
                        <img src={asset.thumbUrl} alt={asset.title} className="h-full w-full object-cover" />
                        <div className="absolute inset-0 bg-black/0 transition group-hover:bg-black/20" />
                        <div className="absolute bottom-0 left-0 right-0 translate-y-full bg-black/70 px-1.5 py-1 text-[9px] text-white transition group-hover:translate-y-0 truncate">
                          {asset.title}
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Selected photo editor */}
                  {selectedAssetId ? (() => {
                    const asset = data.selectedAlbumAssets.find(a => a.id === selectedAssetId);
                    if (!asset) return null;
                    return (
                      <form
                        key={asset.id}
                        onSubmit={(event) => handleAssetSubmit(event, asset.id)}
                        className="surface rounded-[1.75rem] border border-pine/20 p-5 shadow-soft"
                      >
                        <input type="hidden" name="albumId" value={asset.albumId} />
                        <div className="flex items-start gap-4 mb-5">
                          <div className="h-24 w-24 shrink-0 overflow-hidden rounded-[1rem] border border-black/10 bg-ink/5">
                            <img src={asset.previewUrl} alt={asset.title} className="h-full w-full object-cover" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="display-font text-xl text-ink truncate">{asset.title}</p>
                            <p className="text-sm text-dusk">{asset.originalFileName}</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => runJsonAction(
                                  `/api/admin/albums/${asset.albumId}`,
                                  { coverAssetId: asset.id },
                                  "Cover photo updated.",
                                )}
                                className="rounded-full border border-pine/30 bg-pine/10 px-3 py-1.5 text-xs font-semibold text-pine transition hover:bg-pine hover:text-white"
                              >
                                Set as album cover
                              </button>
                              <button
                                type="button"
                                onClick={() => runJsonAction(
                                  `/api/admin/assets/${asset.id}/analyze`,
                                  null,
                                  "Gemini analysis saved.",
                                  "POST",
                                )}
                                disabled={isSavePending}
                                className="rounded-full border border-amber-400/40 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-400 hover:text-white disabled:opacity-50"
                              >
                                ✦ Analyze with Gemini
                              </button>
                            </div>
                          </div>
                        </div>
                        <div className="space-y-4">
                          <div className="grid gap-4 md:grid-cols-2">
                            <Field label="Visibility">
                              <select name="visibility" defaultValue={asset.visibility} className="input-field">
                                <option value="inherit">Inherit album</option>
                                <option value="private">Private</option>
                                <option value="public">Public</option>
                              </select>
                            </Field>
                            <Field label="Sort order">
                              <input name="sortOrder" type="number" defaultValue={asset.sortOrder} className="input-field" />
                            </Field>
                            <Field label="Primary genre">
                              <select name="primaryGenre" defaultValue={asset.primaryGenre ?? ""} className="input-field">
                                <option value="">None</option>
                                {PORTFOLIO_GENRES.map((genre) => (
                                  <option key={genre} value={genre}>{genre}</option>
                                ))}
                              </select>
                            </Field>
                            <Field label="Secondary genre">
                              <select name="secondaryGenre" defaultValue={asset.secondaryGenre ?? ""} className="input-field">
                                <option value="">None</option>
                                {PORTFOLIO_GENRES.map((genre) => (
                                  <option key={genre} value={genre}>{genre}</option>
                                ))}
                              </select>
                            </Field>
                            <Field label="Portfolio role">
                              <select name="portfolioRole" defaultValue={asset.portfolioRole} className="input-field">
                                {PORTFOLIO_ROLES.map((role) => (
                                  <option key={role} value={role}>{role}</option>
                                ))}
                              </select>
                            </Field>
                            <Field label="Review state">
                              <select name="reviewState" defaultValue={asset.reviewState} className="input-field">
                                {REVIEW_STATES.map((state) => (
                                  <option key={state} value={state}>{state}</option>
                                ))}
                              </select>
                            </Field>
                            <Field label="Title override" span="full">
                              <input name="titleOverride" defaultValue={asset.titleOverride ?? ""} className="input-field" />
                            </Field>
                            <Field label="Description override" span="full">
                              <textarea name="descriptionOverride" defaultValue={asset.descriptionOverride ?? ""} rows={3} className="textarea-field" />
                            </Field>
                          </div>
                          <div className="flex flex-wrap items-center justify-between gap-4">
                            <div className="flex flex-wrap gap-4">
                              <label className="inline-flex items-center gap-2 text-sm font-medium text-ink">
                                <input name="featured" type="checkbox" defaultChecked={asset.featured} className="h-4 w-4 rounded border-black/20" />
                                Featured
                              </label>
                              <label className="inline-flex items-center gap-2 text-sm font-medium text-ink">
                                <input name="allowDownload" type="checkbox" defaultChecked={asset.allowDownload} className="h-4 w-4 rounded border-black/20" />
                                Allow download
                              </label>
                            </div>
                            <button type="submit" disabled={isSavePending} className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-pine disabled:cursor-not-allowed disabled:bg-dusk">
                              {isSavePending ? "Saving..." : "Save photo"}
                            </button>
                          </div>
                        </div>
                      </form>
                    );
                  })() : null}
                </>
              ) : (
                <Panel>This album does not have any synced image assets yet.</Panel>
              )}
            </div>
          ) : (
            <Panel>Run a sync to import albums from Immich and start annotating work.</Panel>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <Panel>
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-dusk">People graph</p>
              <h2 className="display-font mt-2 text-3xl text-ink">Canonical people</h2>
              <p className="mt-2 text-sm text-dusk">
                Lightroom imports and Immich suggestions merge here before they power public person pages.
              </p>
            </div>
            <div className="w-full md:w-72">
              <label className="text-xs uppercase tracking-[0.28em] text-dusk" htmlFor="people-filter">
                Filter people
              </label>
              <input
                id="people-filter"
                type="search"
                value={peopleFilter}
                onChange={(event) => setPeopleFilter(event.target.value)}
                placeholder="Search by name or slug"
                className="input-field mt-3"
              />
            </div>
          </div>
        </Panel>

        <div className="grid gap-4 xl:grid-cols-2">
          {filteredPeople.length ? (
            filteredPeople.map((person) => (
              <form
                key={person.id}
                onSubmit={(event) => handlePersonSubmit(event, person.id)}
                className="surface rounded-[1.75rem] border border-black/10 p-5 shadow-soft"
              >
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.28em] text-dusk">
                      {person.assetCount} linked / {person.publicAssetCount} public
                    </p>
                    <h3 className="display-font mt-2 text-3xl text-ink">{person.displayName}</h3>
                    <p className="mt-2 text-sm text-dusk">
                      ID: {person.id} · sources: {person.sourceTypes.join(", ") || "manual"}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Link
                      href={`/people/${person.slug}`}
                      className="rounded-full border border-black/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-dusk transition hover:border-pine/30 hover:text-pine"
                    >
                      Open public page
                    </Link>
                    <button
                      type="button"
                      onClick={() => handlePersonMerge(person.id)}
                      className="rounded-full border border-black/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-dusk transition hover:border-pine/30 hover:text-pine"
                    >
                      Merge
                    </button>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Display name">
                    <input name="displayName" defaultValue={person.displayName} className="input-field" />
                  </Field>
                  <Field label="Slug">
                    <input name="slug" defaultValue={person.slug} className="input-field" />
                  </Field>
                  <Field label="Visibility">
                    <select name="visibility" defaultValue={person.visibility} className="input-field">
                      {PERSON_VISIBILITIES.map((visibility) => (
                        <option key={visibility} value={visibility}>{visibility}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Source priority">
                    <input name="sourcePriority" type="number" defaultValue={person.sourcePriority} className="input-field" />
                  </Field>
                  <Field label="Confidence score">
                    <input
                      name="confidenceScore"
                      type="number"
                      step="0.01"
                      defaultValue={person.confidenceScore ?? 0}
                      className="input-field"
                    />
                  </Field>
                </div>

                <div className="mt-5 flex justify-end">
                  <button
                    type="submit"
                    disabled={isSavePending}
                    className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-pine disabled:cursor-not-allowed disabled:bg-dusk"
                  >
                    {isSavePending ? "Saving..." : "Save person"}
                  </button>
                </div>
              </form>
            ))
          ) : (
            <Panel>No people match that filter yet.</Panel>
          )}
        </div>
      </section>
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="surface rounded-[1.75rem] border border-black/10 p-5 shadow-soft text-sm text-dusk">
      {children}
    </div>
  );
}

function Field({
  children,
  label,
  span,
}: {
  children: React.ReactNode;
  label: string;
  span?: "full";
}) {
  return (
    <label className={cn("text-sm text-ink", span === "full" && "md:col-span-2")}>
      <span className="mb-2 block text-xs uppercase tracking-[0.25em] text-dusk">
        {label}
      </span>
      {children}
    </label>
  );
}

function emptyToNull(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}
