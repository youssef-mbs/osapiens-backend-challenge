import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

describe("integration smoke", () => {
  it("can access project runtime resources", () => {
    const readmePath = path.join(process.cwd(), "README.md");
    expect(fs.existsSync(readmePath)).toBe(true);
  });
});
