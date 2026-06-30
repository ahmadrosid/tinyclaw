import { constants } from "node:fs";
import {
  access,
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import {
  basename,
  dirname,
  isAbsolute,
  join,
  normalize,
  relative,
  resolve,
  sep,
} from "node:path";
import { inflateRawSync } from "node:zlib";
import {
  TINYCLAW_API_VERSION,
  type DataExportManifest,
  type DataExportSkippedItem,
  type DataImportPreviewResponse,
  type RestoreDataImportResponse,
} from "./contract";
import { getUserConfigDir } from "./user-config";

export const TINYCLAW_EXPORT_MANIFEST = "tinyclaw-export.json";
export const TINYCLAW_EXPORT_FORMAT_VERSION = 1;

export interface CreateDataExportOptions {
  rootDir?: string;
  now?: Date;
  databasePath?: string | null;
}

export interface CreateDataExportResult {
  filename: string;
  data: Buffer;
  manifest: DataExportManifest;
}

export interface PreviewDataImportOptions {
  rootDir?: string;
}

export interface RestoreDataImportOptions {
  rootDir?: string;
  confirm: boolean;
}

interface ZipEntryInput {
  name: string;
  data: Buffer;
}

interface ZipEntry {
  name: string;
  data: Buffer;
  compressedSize: number;
  uncompressedSize: number;
}

interface InventoryItem {
  relativePath: string;
  absolutePath: string;
  size: number;
}

const ZIP_LOCAL_FILE_HEADER = 0x04034b50;
const ZIP_CENTRAL_DIRECTORY_HEADER = 0x02014b50;
const ZIP_END_OF_CENTRAL_DIRECTORY = 0x06054b50;
const ZIP_STORE = 0;
const ZIP_DEFLATE = 8;
const RESTORE_PREFIX = ".tinyclaw-restore-";
const BACKUP_PREFIX = ".tinyclaw-backup-";

const crcTable = buildCrcTable();

export async function createTinyClawDataExport(
  options: CreateDataExportOptions = {},
): Promise<CreateDataExportResult> {
  const rootDir = resolve(options.rootDir ?? getUserConfigDir());
  const createdAt = (options.now ?? new Date()).toISOString();
  const { files, skipped } = await inventoryConfigRoot(rootDir);
  const topLevelPaths = Array.from(
    new Set(files.map((file) => file.relativePath.split("/")[0]).filter(Boolean)),
  ).sort();
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);

  if (options.databasePath) {
    const databasePath = resolve(options.databasePath);
    const relativeDatabasePath = relative(rootDir, databasePath);
    if (relativeDatabasePath.startsWith("..") || isAbsolute(relativeDatabasePath)) {
      skipped.push({ path: databasePath, reason: "Database path is outside the Tinyclaw root." });
    }
  }

  const manifest: DataExportManifest = {
    kind: "tinyclaw-export",
    version: TINYCLAW_EXPORT_FORMAT_VERSION,
    apiVersion: TINYCLAW_API_VERSION,
    createdAt,
    sourceRootName: basename(rootDir) || ".tinyclaw",
    topLevelPaths,
    fileCount: files.length,
    totalBytes,
    skipped,
  };

  const entries: ZipEntryInput[] = [
    {
      name: TINYCLAW_EXPORT_MANIFEST,
      data: Buffer.from(JSON.stringify(manifest, null, 2), "utf8"),
    },
  ];

  for (const file of files) {
    entries.push({
      name: file.relativePath,
      data: await readFile(file.absolutePath),
    });
  }

  return {
    filename: `tinyclaw-export-${createdAt.replace(/[:.]/g, "-")}.zip`,
    data: writeZip(entries),
    manifest,
  };
}

export async function previewTinyClawDataImport(
  archive: Buffer | Uint8Array | ArrayBuffer,
  options: PreviewDataImportOptions = {},
): Promise<DataImportPreviewResponse> {
  const rootDir = resolve(options.rootDir ?? getUserConfigDir());
  const entries = readZip(toBuffer(archive));
  const manifest = readManifest(entries);
  const restorableEntries = entries.filter((entry) => entry.name !== TINYCLAW_EXPORT_MANIFEST);

  return {
    manifest,
    archiveFileCount: restorableEntries.length,
    archiveTotalBytes: restorableEntries.reduce((sum, entry) => sum + entry.uncompressedSize, 0),
    topLevelPaths: Array.from(
      new Set(restorableEntries.map((entry) => entry.name.split("/")[0]).filter(Boolean)),
    ).sort(),
    willReplaceRoot: await pathExists(rootDir),
  };
}

export async function restoreTinyClawDataImport(
  archive: Buffer | Uint8Array | ArrayBuffer,
  options: RestoreDataImportOptions,
): Promise<RestoreDataImportResponse> {
  if (!options.confirm) {
    throw new Error("Restore confirmation is required.");
  }

  const rootDir = resolve(options.rootDir ?? getUserConfigDir());
  const rootParent = dirname(rootDir);
  const entries = readZip(toBuffer(archive));
  const manifest = readManifest(entries);
  const stagingParent = await mkdtemp(join(rootParent, RESTORE_PREFIX));
  const stagedRoot = join(stagingParent, "root");
  const backupRoot = join(rootParent, `${BACKUP_PREFIX}${Date.now()}`);

  let movedCurrentToBackup = false;

  try {
    await mkdir(stagedRoot, { recursive: true, mode: 0o700 });
    let restoredFileCount = 0;

    for (const entry of entries) {
      if (entry.name === TINYCLAW_EXPORT_MANIFEST) {
        continue;
      }

      await writeRestoredEntry(stagedRoot, entry);
      restoredFileCount += 1;
    }

    await mkdir(rootParent, { recursive: true, mode: 0o700 });
    if (await pathExists(rootDir)) {
      await rename(rootDir, backupRoot);
      movedCurrentToBackup = true;
    }

    await rename(stagedRoot, rootDir);

    if (movedCurrentToBackup) {
      await rm(backupRoot, { recursive: true, force: true });
    }

    return {
      manifest,
      restoredRoot: rootDir,
      restoredFileCount,
    };
  } catch (error) {
    if (movedCurrentToBackup && !(await pathExists(rootDir))) {
      await rename(backupRoot, rootDir);
    }

    throw error;
  } finally {
    await rm(stagingParent, { recursive: true, force: true });
  }
}

async function inventoryConfigRoot(rootDir: string): Promise<{
  files: InventoryItem[];
  skipped: DataExportSkippedItem[];
}> {
  const files: InventoryItem[] = [];
  const skipped: DataExportSkippedItem[] = [];

  if (!(await pathExists(rootDir))) {
    return { files, skipped };
  }

  await walk(rootDir);
  files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  return { files, skipped };

  async function walk(currentDir: string): Promise<void> {
    const entries = await readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const absolutePath = join(currentDir, entry.name);
      const relativePath = toZipPath(relative(rootDir, absolutePath));

      if (shouldSkipRelativePath(relativePath)) {
        skipped.push({ path: relativePath, reason: "Internal data-portability temporary path." });
        continue;
      }

      if (entry.isDirectory()) {
        await walk(absolutePath);
        continue;
      }

      if (!entry.isFile()) {
        skipped.push({ path: relativePath, reason: "Only regular files are exported." });
        continue;
      }

      const stat = await lstat(absolutePath);
      files.push({ relativePath, absolutePath, size: stat.size });
    }
  }
}

async function writeRestoredEntry(rootDir: string, entry: ZipEntry): Promise<void> {
  validateArchivePath(entry.name);
  const targetPath = resolve(rootDir, entry.name);
  const relativeTarget = relative(rootDir, targetPath);
  if (relativeTarget.startsWith("..") || isAbsolute(relativeTarget)) {
    throw new Error(`Archive entry escapes restore root: ${entry.name}`);
  }

  await mkdir(dirname(targetPath), { recursive: true, mode: 0o700 });
  await writeFile(targetPath, entry.data, { mode: 0o600 });
}

function writeZip(entries: ZipEntryInput[]): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    validateArchivePath(entry.name);
    const name = Buffer.from(entry.name, "utf8");
    const crc = crc32(entry.data);
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(ZIP_LOCAL_FILE_HEADER, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(ZIP_STORE, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(entry.data.length, 18);
    localHeader.writeUInt32LE(entry.data.length, 22);
    localHeader.writeUInt16LE(name.length, 26);
    localHeader.writeUInt16LE(0, 28);
    localParts.push(localHeader, name, entry.data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(ZIP_CENTRAL_DIRECTORY_HEADER, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(ZIP_STORE, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(entry.data.length, 20);
    centralHeader.writeUInt32LE(entry.data.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    centralParts.push(centralHeader, name);

    offset += localHeader.length + name.length + entry.data.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const centralDirectoryOffset = offset;
  const end = Buffer.alloc(22);
  end.writeUInt32LE(ZIP_END_OF_CENTRAL_DIRECTORY, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(centralDirectoryOffset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirectory, end]);
}

function readZip(buffer: Buffer): ZipEntry[] {
  const endOffset = findEndOfCentralDirectory(buffer);
  const entryCount = buffer.readUInt16LE(endOffset + 10);
  const centralDirectoryOffset = buffer.readUInt32LE(endOffset + 16);
  const entries: ZipEntry[] = [];
  let offset = centralDirectoryOffset;

  for (let i = 0; i < entryCount; i += 1) {
    if (buffer.readUInt32LE(offset) !== ZIP_CENTRAL_DIRECTORY_HEADER) {
      throw new Error("Invalid ZIP central directory.");
    }

    const flags = buffer.readUInt16LE(offset + 8);
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString("utf8", offset + 46, offset + 46 + nameLength);

    if (flags & 0x0008) {
      throw new Error("ZIP data descriptors are not supported.");
    }

    validateArchivePath(name);

    const localNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
    const dataOffset = localHeaderOffset + 30 + localNameLength + localExtraLength;
    const compressedData = buffer.subarray(dataOffset, dataOffset + compressedSize);
    let data: Buffer;

    if (method === ZIP_STORE) {
      data = Buffer.from(compressedData);
    } else if (method === ZIP_DEFLATE) {
      data = inflateRawSync(compressedData);
    } else {
      throw new Error(`Unsupported ZIP compression method: ${method}`);
    }

    if (data.length !== uncompressedSize) {
      throw new Error(`ZIP entry size mismatch: ${name}`);
    }

    entries.push({
      name,
      data,
      compressedSize,
      uncompressedSize,
    });

    offset += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}

function readManifest(entries: ZipEntry[]): DataExportManifest {
  const manifestEntry = entries.find((entry) => entry.name === TINYCLAW_EXPORT_MANIFEST);
  if (!manifestEntry) {
    throw new Error("Archive is missing Tinyclaw export manifest.");
  }

  let manifest: DataExportManifest;
  try {
    manifest = JSON.parse(manifestEntry.data.toString("utf8")) as DataExportManifest;
  } catch {
    throw new Error("Tinyclaw export manifest is not valid JSON.");
  }

  if (manifest.kind !== "tinyclaw-export") {
    throw new Error("Archive is not a Tinyclaw export.");
  }

  if (manifest.version !== TINYCLAW_EXPORT_FORMAT_VERSION) {
    throw new Error(`Unsupported Tinyclaw export version: ${manifest.version}`);
  }

  return manifest;
}

function validateArchivePath(path: string): void {
  if (!path || path.includes("\0")) {
    throw new Error("Archive entry path is empty or invalid.");
  }

  if (path !== toZipPath(path)) {
    throw new Error(`Archive entry must use POSIX separators: ${path}`);
  }

  if (isAbsolute(path) || /^[a-zA-Z]:/.test(path)) {
    throw new Error(`Archive entry must be relative: ${path}`);
  }

  const normalized = normalize(path).split(sep).join("/");
  if (normalized === ".." || normalized.startsWith("../") || normalized.includes("/../")) {
    throw new Error(`Archive entry escapes restore root: ${path}`);
  }
}

function findEndOfCentralDirectory(buffer: Buffer): number {
  const minOffset = Math.max(0, buffer.length - 65557);
  for (let offset = buffer.length - 22; offset >= minOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === ZIP_END_OF_CENTRAL_DIRECTORY) {
      return offset;
    }
  }

  throw new Error("Invalid ZIP archive.");
}

function buildCrcTable(): number[] {
  const table: number[] = [];
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
}

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function toZipPath(path: string): string {
  return path.split(sep).join("/");
}

function shouldSkipRelativePath(path: string): boolean {
  const first = path.split("/")[0];
  return (
    first === TINYCLAW_EXPORT_MANIFEST ||
    first.startsWith(RESTORE_PREFIX) ||
    first.startsWith(BACKUP_PREFIX)
  );
}

function toBuffer(value: Buffer | Uint8Array | ArrayBuffer): Buffer {
  if (Buffer.isBuffer(value)) {
    return value;
  }

  if (value instanceof ArrayBuffer) {
    return Buffer.from(value);
  }

  return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}
