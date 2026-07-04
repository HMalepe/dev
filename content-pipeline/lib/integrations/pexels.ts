import "server-only";

export interface PexelsPhoto {
  url: string;
  photographer: string;
  pexelsPageUrl: string;
}

/**
 * Searches Pexels for a single thematic, non-identifying image. Callers are
 * responsible for keeping queries generic (locations, objects, mood shots)
 * per the Phase 3 constraint against depicting specific real people -- see
 * docs/asset-pipeline-safety.md.
 */
export async function searchPexelsPhoto(query: string): Promise<PexelsPhoto | null> {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) throw new Error("PEXELS_API_KEY is not set.");

  const url = new URL("https://api.pexels.com/v1/search");
  url.searchParams.set("query", query);
  url.searchParams.set("orientation", "landscape");
  url.searchParams.set("per_page", "1");

  const response = await fetch(url, {
    headers: { Authorization: apiKey },
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(`Pexels search failed (${response.status}): ${errorBody}`);
  }

  const body = await response.json();
  const photo = body.photos?.[0];
  if (!photo) return null;

  return {
    url: photo.src.large as string,
    photographer: photo.photographer as string,
    pexelsPageUrl: photo.url as string,
  };
}
