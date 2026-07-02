import { zip } from "fflate";
import type { VernClient } from "@/lib/client";

// Fetch every template's CSV export and bundle them into a single .zip so the
// user gets one download instead of one file per template.
export async function downloadAllAsZip(
  client: VernClient,
  migrationId: string,
  slugs: string[],
  zipName: string,
): Promise<void> {
  const entries = await Promise.all(
    slugs.map(async (slug) => {
      const res = await fetch(client.exportUrl(migrationId, slug));
      if (!res.ok) throw new Error(`Export failed for ${slug} (${res.status})`);
      const buf = new Uint8Array(await res.arrayBuffer());
      return [`${slug}.csv`, buf] as const;
    }),
  );

  const files: Record<string, Uint8Array> = {};
  for (const [name, buf] of entries) files[name] = buf;

  const blob: Blob = await new Promise((resolve, reject) => {
    zip(files, (err, data) => {
      if (err) reject(err);
      else resolve(new Blob([data as BlobPart], { type: "application/zip" }));
    });
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = zipName.endsWith(".zip") ? zipName : `${zipName}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
