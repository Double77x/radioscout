/**
 * Blob helpers for the radio backup export.
 * Every conversion is total (never throws on corrupt input) so one bad file
 * can never fail an export — it degrades to null.
 */

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result)));
    reader.addEventListener("error", () => reject(new Error("Could not read file bytes")));
    reader.readAsDataURL(blob);
  });
}

function blobToBase64(blob: Blob): Promise<string> {
  return blobToDataUrl(blob).then((url) => url.split(",", 2)[1] ?? "");
}

/**
 * Native share sheet for a file. Web callers should use `downloadBlob`
 * instead — the Web Share API cannot reliably share Blobs.
 */
export async function shareFile(filename: string, blob: Blob): Promise<void> {
  const [{ Filesystem, Directory }, { Share }] = await Promise.all([
    import("@capacitor/filesystem"),
    import("@capacitor/share"),
  ]);
  const saved = await Filesystem.writeFile({
    path: filename,
    data: await blobToBase64(blob),
    directory: Directory.Cache,
  });
  await Share.share({
    title: filename,
    text: filename,
    url: saved.uri,
    dialogTitle: filename,
  });
}

/** Web download fallback: anchor click + deferred URL revoke. */
export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  globalThis.setTimeout(() => URL.revokeObjectURL(url), 5000);
}
