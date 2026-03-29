import JSZip from 'jszip';

// ─── Types ───────────────────────────────────────────────────────

export interface FileWithPath extends File {
  _relativePath?: string;
}

export interface ZipResult {
  file: File;
  totalFiles: number;
  addedFiles: number;
  skippedFiles: string[];
}

export class FolderNotReadableError extends Error {
  constructor(detail?: string) {
    super(detail || 'Cannot read folder contents');
    this.name = 'FolderNotReadableError';
  }
}

// ─── Read directory via FileSystemEntry ──────────────────────────

function readEntriesPromise(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => reader.readEntries(resolve, reject));
}

async function readAllEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  const all: FileSystemEntry[] = [];
  let batch = await readEntriesPromise(reader);
  while (batch.length > 0) {
    all.push(...batch);
    batch = await readEntriesPromise(reader);
  }
  return all;
}

async function traverseEntry(entry: FileSystemEntry, basePath: string): Promise<FileWithPath[]> {
  if (entry.isFile) {
    try {
      const file = await new Promise<File>((res, rej) => (entry as FileSystemFileEntry).file(res, rej));
      const f = file as FileWithPath;
      f._relativePath = basePath + entry.name;
      return [f];
    } catch (err) {
      console.warn(`[zipUtils] entry.file() failed "${basePath}${entry.name}":`, err);
      return [];
    }
  }
  if (entry.isDirectory) {
    try {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      const children = await readAllEntries(reader);
      const files: FileWithPath[] = [];
      for (const child of children) {
        files.push(...await traverseEntry(child, basePath + entry.name + '/'));
      }
      return files;
    } catch (err) {
      console.warn(`[zipUtils] readDir failed "${basePath}${entry.name}":`, err);
      return [];
    }
  }
  return [];
}

// ─── Public: read from already-captured entries ──────────────────

/**
 * Read files from FileSystemEntry[].
 * Entries must be captured SYNCHRONOUSLY in the drop handler via
 * `dt.items[i].webkitGetAsEntry()` (direct index access, no intermediate variable).
 */
export async function readFromEntries(entries: FileSystemEntry[]): Promise<FileWithPath[]> {
  const allFiles: FileWithPath[] = [];
  for (const entry of entries) {
    allFiles.push(...await traverseEntry(entry, ''));
  }
  return allFiles;
}

// ─── Read directory via File System Access API (more reliable) ──

async function traverseDirectoryHandle(
  dirHandle: FileSystemDirectoryHandle,
  basePath: string,
): Promise<FileWithPath[]> {
  const files: FileWithPath[] = [];
  // @ts-ignore - entries() is available in Chrome/Edge
  for await (const [name, handle] of dirHandle.entries()) {
    if (handle.kind === 'file') {
      try {
        const file = await (handle as FileSystemFileHandle).getFile();
        const f = file as FileWithPath;
        f._relativePath = basePath + name;
        files.push(f);
      } catch (err) {
        console.warn(`[zipUtils] handle.getFile() failed "${basePath}${name}":`, err);
      }
    } else if (handle.kind === 'directory') {
      files.push(...await traverseDirectoryHandle(handle as FileSystemDirectoryHandle, basePath + name + '/'));
    }
  }
  return files;
}

/**
 * Read files from FileSystemHandle[] (File System Access API).
 * Handles must be captured from DataTransferItem.getAsFileSystemHandle()
 * during the drop event. More reliable than webkitGetAsEntry on Windows.
 */
export async function readFromHandles(handles: FileSystemHandle[]): Promise<FileWithPath[]> {
  const allFiles: FileWithPath[] = [];
  for (const handle of handles) {
    if (handle.kind === 'directory') {
      const dirFiles = await traverseDirectoryHandle(handle as FileSystemDirectoryHandle, handle.name + '/');
      allFiles.push(...dirFiles);
    } else if (handle.kind === 'file') {
      try {
        const file = await (handle as FileSystemFileHandle).getFile();
        const f = file as FileWithPath;
        f._relativePath = handle.name;
        allFiles.push(f);
      } catch (err) {
        console.warn(`[zipUtils] handle.getFile() failed "${handle.name}":`, err);
      }
    }
  }
  return allFiles;
}

// ─── Helpers ─────────────────────────────────────────────────────

function isZipFile(file: File): boolean {
  return (
    file.name.toLowerCase().endsWith('.zip') ||
    file.type === 'application/zip' ||
    file.type === 'application/x-zip-compressed'
  );
}

function stripRootFolder(path: string): string {
  const parts = path.split('/');
  return parts.length > 1 ? parts.slice(1).join('/') : path;
}

function getRootFolderName(file: FileWithPath): string {
  const rel = file._relativePath || file.webkitRelativePath || '';
  return rel.split('/')[0] || 'white';
}

// ─── Zip files ───────────────────────────────────────────────────

async function zipFiles(files: FileWithPath[], zipFileName: string): Promise<ZipResult> {
  const zip = new JSZip();
  const skippedFiles: string[] = [];
  let addedFiles = 0;

  for (const file of files) {
    const rel = file._relativePath || file.webkitRelativePath || file.name;
    const pathInZip = stripRootFolder(rel);
    if (!pathInZip) continue;

    try {
      zip.file(pathInZip, await file.arrayBuffer());
      addedFiles++;
    } catch (err) {
      skippedFiles.push(pathInZip);
      console.warn(`[zipUtils] Skipped: ${pathInZip}`, err);
    }
  }

  if (addedFiles === 0) {
    throw new FolderNotReadableError('All files were unreadable');
  }

  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  return {
    file: new File([blob], zipFileName, { type: 'application/zip' }),
    totalFiles: files.length,
    addedFiles,
    skippedFiles,
  };
}

// ─── Public API ──────────────────────────────────────────────────

/**
 * Any input → single zip File.
 * Single .zip → pass through. Everything else → zip it.
 */
export async function normalizeToZip(files: File[] | FileList): Promise<ZipResult> {
  const arr = Array.from(files) as FileWithPath[];

  if (arr.length === 0) {
    throw new FolderNotReadableError('No files');
  }

  // Single zip → pass through
  if (arr.length === 1 && isZipFile(arr[0])) {
    return { file: arr[0], totalFiles: 1, addedFiles: 1, skippedFiles: [] };
  }

  const folderName = getRootFolderName(arr[0]);
  return zipFiles(arr, `${folderName}.zip`);
}

/** @deprecated Use normalizeToZip */
export const zipFilesWithStructure = zipFiles;

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
