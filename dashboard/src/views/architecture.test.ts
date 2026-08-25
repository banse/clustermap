import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

function sources(directory: string): string[] {
  return readdirSync(join(root, directory))
    .filter((name) => name.endsWith(".ts") || name.endsWith(".tsx"))
    .filter((name) => !name.endsWith(".test.ts") && !name.endsWith(".test.tsx"))
    .map((name) => readFileSync(join(root, directory, name), "utf8"));
}

describe("frontend MVC boundary", () => {
  it("keeps domain models React-free", () => {
    for (const source of sources("models")) {
      expect(source).not.toMatch(/from ["']react["']/);
      expect(source).not.toContain("react/jsx-runtime");
    }
  });

  it("keeps network access in models/controllers, not views", () => {
    for (const source of sources("views")) {
      expect(source).not.toMatch(/\bfetch\s*\(/);
    }
  });
});

