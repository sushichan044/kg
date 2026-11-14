export function downloadZip(bytes: Uint8Array<ArrayBuffer>, filename: string): void {
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/zip" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename.replace(/\.[^.]+$/, "")}.zip`;
  link.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 60_000);
}
