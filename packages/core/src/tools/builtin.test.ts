import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "bun:test";
import { deleteFileTool, PathGuardError, setDefaultFileGuardOptions, writeFileTool } from "./builtin";

describe("file builtin tools", () => {
  let tempDir = "";

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
      tempDir = "";
    }
    setDefaultFileGuardOptions({});
  });

  test("write_file creates nested files", async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "tinyclaw-write-"));
    setDefaultFileGuardOptions({ allowedDirs: [tempDir] });
    const targetPath = path.join(tempDir, "nested", "hello.txt");

    const result = await writeFileTool.run(
      { path: targetPath, content: "hello world" },
      {},
    );

    expect(result.path).toBe(targetPath);
    expect(result.bytesWritten).toBe(11);
    expect(await readFile(targetPath, "utf8")).toBe("hello world");
  });

  test("write_file resolves relative paths from cwd", async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "tinyclaw-write-"));
    setDefaultFileGuardOptions({ allowedDirs: [tempDir], cwd: tempDir });
    const result = await writeFileTool.run(
      { path: "notes.txt", content: "relative" },
      {},
    );

    expect(result.path).toBe(path.join(tempDir, "notes.txt"));
    expect(await readFile(result.path, "utf8")).toBe("relative");
  });

  test("delete_file removes a file", async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "tinyclaw-delete-"));
    setDefaultFileGuardOptions({ allowedDirs: [tempDir] });
    const targetPath = path.join(tempDir, "remove-me.txt");
    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(targetPath, "temp", "utf8");

    const result = await deleteFileTool.run({ path: targetPath }, {});

    expect(result).toEqual({ path: targetPath, deleted: true });
    await expect(readFile(targetPath, "utf8")).rejects.toThrow();
  });

  // -----------------------------------------------------------------------
  // Security tests
  // -----------------------------------------------------------------------

  test("rejects path traversal via ../ escape", async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "tinyclaw-sec-"));
    setDefaultFileGuardOptions({ allowedDirs: [tempDir] });
    const escapePath = path.join(tempDir, "../../../etc/tinyclaw-exploit-test");

    await expect(
      writeFileTool.run({ path: escapePath, content: "ESCAPE" }, {}),
    ).rejects.toThrow(PathGuardError);
  });

  test("rejects absolute path outside allowed dirs", async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "tinyclaw-sec-"));
    setDefaultFileGuardOptions({ allowedDirs: [tempDir] });

    await expect(
      writeFileTool.run({ path: "/etc/tinyclaw-should-fail", content: "NOPE" }, {}),
    ).rejects.toThrow(PathGuardError);
  });

  test("rejects home directory expansion outside allowed dirs", async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "tinyclaw-sec-"));
    setDefaultFileGuardOptions({ allowedDirs: [tempDir] });

    await expect(
      writeFileTool.run({ path: "~/.ssh/tinyclaw-test", content: "SSH_KEY" }, {}),
    ).rejects.toThrow(PathGuardError);
  });

  test("cwd injection falls back to safe cwd", async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "tinyclaw-sec-"));
    setDefaultFileGuardOptions({ allowedDirs: [tempDir], cwd: tempDir });

    const result = await writeFileTool.run(
      { path: "safe.txt", content: "OK", cwd: "/etc" },
      {},
    );

    expect(result.path).toStartWith(tempDir);
  });

  test("rejects null byte in path", async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "tinyclaw-sec-"));
    setDefaultFileGuardOptions({ allowedDirs: [tempDir] });

    await expect(
      writeFileTool.run(
        { path: path.join(tempDir, "safe.txt\0.sh"), content: "X" },
        {},
      ),
    ).rejects.toThrow(PathGuardError);
  });

  test("rejects content exceeding max file size", async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "tinyclaw-sec-"));
    setDefaultFileGuardOptions({ allowedDirs: [tempDir], maxFileBytes: 100 });

    await expect(
      writeFileTool.run(
        { path: path.join(tempDir, "big.txt"), content: "A".repeat(200) },
        {},
      ),
    ).rejects.toThrow(PathGuardError);
  });

  test("delete_file rejects path outside allowed dirs", async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "tinyclaw-sec-"));
    setDefaultFileGuardOptions({ allowedDirs: [tempDir] });

    await expect(
      deleteFileTool.run({ path: "/etc/should-not-delete" }, {}),
    ).rejects.toThrow(PathGuardError);
  });

  test("allows nested subdirectory writes", async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "tinyclaw-sec-"));
    setDefaultFileGuardOptions({ allowedDirs: [tempDir] });

    const nestedPath = path.join(tempDir, "deep", "nested", "file.txt");
    const result = await writeFileTool.run({ path: nestedPath, content: "deep" }, {});

    expect(result.path).toBe(nestedPath);
    expect(await readFile(nestedPath, "utf8")).toBe("deep");
  });

  test("rejects special filesystem paths", async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "tinyclaw-sec-"));
    setDefaultFileGuardOptions({ allowedDirs: [tempDir, "/dev"] });

    await expect(
      writeFileTool.run({ path: "/dev/null", content: "test" }, {}),
    ).rejects.toThrow(PathGuardError);
  });

  test("multiple allowed directories", async () => {
    const dirA = await mkdtemp(path.join(os.tmpdir(), "tinyclaw-sec-a-"));
    const dirB = await mkdtemp(path.join(os.tmpdir(), "tinyclaw-sec-b-"));
    setDefaultFileGuardOptions({ allowedDirs: [dirA, dirB] });

    const pathA = path.join(dirA, "a.txt");
    const pathB = path.join(dirB, "b.txt");

    const resultA = await writeFileTool.run({ path: pathA, content: "A" }, {});
    const resultB = await writeFileTool.run({ path: pathB, content: "B" }, {});

    expect(resultA.path).toBe(pathA);
    expect(resultB.path).toBe(pathB);

    await rm(dirA, { recursive: true, force: true });
    await rm(dirB, { recursive: true, force: true });
  });
});
