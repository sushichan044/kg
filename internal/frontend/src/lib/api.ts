import * as v from "valibot";

const FileEntrySchema = v.pipe(v.strictObject({ id: v.string(), path: v.string() }), v.readonly());

const FileEntriesSchema = v.pipe(v.array(FileEntrySchema), v.readonly());

export type FileEntry = v.InferOutput<typeof FileEntrySchema>;

export async function fetchFiles(): Promise<readonly FileEntry[]> {
  const res = await fetch("/_/api/files");
  if (!res.ok) {
    throw new Error(`failed to list files: ${res.status}`);
  }

  const body: unknown = await res.json();
  const entries = v.safeParse(FileEntriesSchema, body);
  if (!entries.success) {
    throw new Error("file list response did not match the expected shape");
  }

  return entries.output;
}

export async function fetchContent(id: string): Promise<string> {
  const res = await fetch(`/_/api/files/${encodeURIComponent(id)}/content`);
  if (!res.ok) {
    throw new Error(`failed to read file: ${res.status}`);
  }

  return res.text();
}
