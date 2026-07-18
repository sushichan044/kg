export interface FileEntry {
  id: string;
  path: string;
}

export async function fetchFiles(): Promise<FileEntry[]> {
  const res = await fetch("/_/api/files");
  if (!res.ok) {
    throw new Error(`failed to list files: ${res.status}`);
  }

  return (await res.json()) as FileEntry[];
}

export async function fetchContent(id: string): Promise<string> {
  const res = await fetch(`/_/api/files/${encodeURIComponent(id)}/content`);
  if (!res.ok) {
    throw new Error(`failed to read file: ${res.status}`);
  }

  return res.text();
}
