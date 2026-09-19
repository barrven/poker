import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmpDirs: string[] = [];

after(() => {
  for (const dir of tmpDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function tmpDataDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "poker-lint-"));
  tmpDirs.push(dir);
  return dir;
}

test("package.json has an npm run lint script backed by Biome", () => {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(root, "package.json"), "utf8"),
  ) as { scripts?: Record<string, string> };
  assert.ok(pkg.scripts?.lint, "no lint script in package.json");
  assert.match(pkg.scripts.lint, /biome lint/);
  assert.match(pkg.scripts.lint, /--error-on-warnings/);
});

test("biome.json scopes linting to server/src/tests and stays lint-only (no parallel type-checking or formatter surface)", () => {
  const config = JSON.parse(
    fs.readFileSync(path.join(root, "biome.json"), "utf8"),
  ) as {
    files?: { includes?: string[] };
    linter?: { enabled?: boolean };
    formatter?: { enabled?: boolean };
    assist?: { enabled?: boolean };
  };
  assert.equal(config.linter?.enabled, true);
  const includes = config.files?.includes ?? [];
  for (const dir of ["server/**", "src/**", "tests/**"]) {
    assert.ok(includes.includes(dir), `expected ${dir} in files.includes`);
  }
  // Lint-only: no reformatting of the existing codebase, and nothing here
  // duplicates what `npm run typecheck` (tsc, using the project's own
  // tsconfig references) already owns.
  assert.equal(config.formatter?.enabled, false);
});

test("npm run lint passes with no errors against the current codebase", () => {
  const output = execFileSync("npm", ["run", "lint"], {
    cwd: root,
    encoding: "utf8",
  });
  assert.match(output, /biome lint/);
  assert.doesNotMatch(output, /Found \d+ error/);
});

test("a deliberately bad file makes lint fail with a non-zero exit code", () => {
  const dir = tmpDataDir();
  fs.writeFileSync(
    path.join(dir, "biome.json"),
    JSON.stringify({
      linter: { enabled: true, rules: { preset: "recommended" } },
    }),
  );
  fs.writeFileSync(
    path.join(dir, "bad.ts"),
    "export function unused(): number {\n  const neverUsed = 42;\n  return 1;\n}\n",
  );

  const biomeBin = path.join(root, "node_modules", ".bin", "biome");
  assert.throws(() => {
    execFileSync(biomeBin, ["lint", "--error-on-warnings", "bad.ts"], {
      cwd: dir,
      encoding: "utf8",
    });
  }, /Command failed/);
});
