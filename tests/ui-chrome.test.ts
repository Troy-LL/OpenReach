import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const app = readFileSync(new URL("../web/src/App.tsx", import.meta.url), "utf8");
const gatedHint = readFileSync(
  new URL("../web/src/GatedHint.tsx", import.meta.url),
  "utf8",
);
const paperCard = readFileSync(
  new URL("../web/src/PaperCard.tsx", import.meta.url),
  "utf8",
);
const exportBar = readFileSync(
  new URL("../web/src/ExportBar.tsx", import.meta.url),
  "utf8",
);
const styles = readFileSync(
  new URL("../web/src/styles.css", import.meta.url),
  "utf8",
);
const indexHtml = readFileSync(new URL("../web/index.html", import.meta.url), "utf8");

describe("phone and desktop chrome", () => {
  it("lets the search query flex the full field with ellipsis only on overflow", () => {
    expect(app).toMatch(/SearchField\.Input[^]*text-ellipsis/);
    expect(app).toMatch(/SearchField\.Group[^]*min-w-0/);
    expect(app).toMatch(/min-h-11 w-full shrink-0 sm:w-auto/);
  });

  it("keeps sample onboarding to one banner plus one add-key link", () => {
    expect(app).toContain("Add a TypeSafe key");
    expect(app).not.toMatch(/Sample results only/);
    expect(app.match(/Add a TypeSafe key/g)?.length).toBe(1);
  });

  it("marks gated more-like-this with a lock chip instead of a dead button", () => {
    expect(app).toContain("KeyLockedChip");
    expect(app).toContain("More like this");
    expect(gatedHint).toContain("Needs TypeSafe key");
  });

  it("sets paper titles in Source Serif", () => {
    expect(paperCard).toMatch(/font-serif/);
  });

  it("keeps export selection-gated, not TypeSafe-key-gated", () => {
    expect(exportBar).toContain("Select papers to export");
    expect(exportBar).not.toContain("Needs TypeSafe key");
  });

  it("clips horizontal overflow and honors iOS safe-area", () => {
    expect(styles).toContain("overflow-x: clip");
    expect(indexHtml).toContain("viewport-fit=cover");
  });
});
