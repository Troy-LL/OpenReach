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
const filters = readFileSync(new URL("../web/src/Filters.tsx", import.meta.url), "utf8");
const shell = readFileSync(new URL("../web/src/Shell.tsx", import.meta.url), "utf8");
const keyGate = readFileSync(new URL("../web/src/KeyGate.tsx", import.meta.url), "utf8");
const pagination = readFileSync(
  new URL("../web/src/PaginationBar.tsx", import.meta.url),
  "utf8",
);

describe("phone and desktop chrome", () => {
  it("lets the search query flex the full field with ellipsis only on overflow", () => {
    expect(app).toMatch(/SearchField\.Input[^]*text-ellipsis/);
    expect(app).toMatch(/SearchField\.Group[^]*min-w-0/);
    expect(app).toMatch(/min-h-11 w-full shrink-0 sm:w-auto/);
  });

  it("keeps sample onboarding to one banner plus one add-key link", () => {
    expect(app).toMatch(/>\s*Add key\s*</);
    expect(app).not.toContain("Add a TypeSafe key");
    expect(app).not.toMatch(/Sample results only/);
    expect(app.match(/>\s*Add key\s*</g)?.length).toBe(1);
  });

  it("marks gated more-like-this with a lock chip instead of a dead button", () => {
    expect(app).toContain("KeyLockedChip");
    expect(app).toContain("More like this");
    expect(gatedHint).toContain("Needs TypeSafe key");
    expect(gatedHint).not.toMatch(/<LockIcon \/>\s*Needs TypeSafe key/);
    expect(gatedHint).toMatch(/aria-label="Needs TypeSafe key"|sr-only/);
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

  it("collapses filters below md behind a details summary with a chevron", () => {
    expect(filters).toMatch(/<details/);
    expect(filters).toContain("Filters · {shown}/{total}");
    expect(filters).toMatch(/filters-chevron|chevron/);
    expect(filters).not.toMatch(/<details[^>]*\sopen[\s>]/);
    expect(filters).toContain('matchMedia("(min-width: 768px)")');
    expect(styles).toContain("filters-disclosure");
    expect(styles).toContain("::details-content");
    expect(styles).toMatch(/min-width:\s*768px/);
  });

  it("densifies open filter controls and clears the iOS bottom chrome", () => {
    expect(filters).toMatch(/size="sm"/);
    expect(filters).toMatch(/gap-3/);
    expect(filters).toMatch(/p-3/);
    expect(filters).toContain("safe-area-inset-bottom");
  });

  it("tightens results search chrome under 640px without restacking Search full-width", () => {
    expect(app).toMatch(/search-shell p-2/);
    expect(app).toMatch(/text-lg md:text-\[clamp/);
    expect(app).toMatch(/className="mb-4"/);
    expect(app).toMatch(/flex flex-row items-stretch gap-2/);
    expect(app).toMatch(/size=\{compact \? "sm" : undefined\}/);
    expect(app).toMatch(/min-h-11 shrink-0/);
  });

  it("uses compact results shell padding that still clears safe-area", () => {
    expect(shell).toMatch(/py-4/);
    expect(shell).toContain("max(1rem,env(safe-area-inset-left))");
    expect(shell).toContain("safe-area-inset-bottom");
  });

  it("clamps mobile abstracts and seats a visible 44px select beside the figure", () => {
    expect(paperCard).toContain("line-clamp-3");
    expect(paperCard).toMatch(/text-base/);
    expect(paperCard).toMatch(/p-3/);
    expect(paperCard).toMatch(/h-7 w-7/);
    expect(paperCard).toMatch(/Show more/);
    expect(paperCard).toMatch(/type="checkbox"/);
    expect(paperCard).toContain("paper-select");
    expect(paperCard).not.toMatch(/absolute top-3 right-3/);
    expect(paperCard).not.toMatch(/accent-\[var\(--accent\)\]/);
    expect(styles).toContain(".paper-select");
    expect(styles).toMatch(/\.paper-select[\s\S]*2\.75rem/);
    expect(styles).toMatch(/\.paper-select-box[\s\S]*border/);
    expect(app).not.toMatch(/aria-label=\{`Select \$\{paper\.title\}`\}/);
  });

  it("lets phone score chips wrap or compact instead of clipping Review", () => {
    expect(paperCard).not.toMatch(/max-md:flex-nowrap/);
    expect(paperCard).not.toMatch(/max-md:overflow-hidden/);
    expect(paperCard).toMatch(/flex-wrap/);
    expect(paperCard).toMatch(/max-md:hidden/);
    expect(paperCard).toContain("Rel ");
    expect(paperCard).toContain("Method ");
    expect(paperCard).toContain("Evid ");
    expect(paperCard).toContain("Details");
    expect(paperCard).toMatch(/overflow-x-clip/);
    expect(paperCard).toMatch(/min-w-0/);
  });

  it("gives phone controls a 44px tap and keeps pending tally visible", () => {
    expect(paperCard).toMatch(/Show more[\s\S]*min-h-11|min-h-11[\s\S]*Show more/);
    expect(exportBar).toMatch(/min-h-11/);
    expect(pagination).toMatch(/min-h-11/);
    expect(app).toMatch(/More like this[\s\S]*min-h-11|min-h-11[\s\S]*More like this/);
    expect(gatedHint).toMatch(/min-h-11/);
    expect(exportBar).toContain("waiting");
    expect(exportBar).not.toMatch(/max-sm:hidden/);
  });

  it("keeps filter year fields usable on phone without iOS input zoom", () => {
    expect(filters).toContain('inputMode="numeric"');
    expect(filters).toContain("Year");
    expect(styles).toMatch(/max-width:\s*767px/);
    expect(styles).toMatch(/font-size:\s*1rem/);
    expect(styles).toMatch(/min-height:\s*2\.75rem/);
  });

  it("compacts the export toolbar to a mono tally and drops the empty-state label", () => {
    expect(exportBar).toMatch(/font-mono/);
    expect(exportBar).toMatch(/p\$\{/);
    expect(exportBar).not.toMatch(/\?\s*"Select papers to export"/);
    expect(exportBar).toContain("Select papers to export");
    expect(exportBar).toMatch(/size="sm"/);
  });

  it("leaves KeyGate Continue/Browse row-from-640 and stack-below lock in place", () => {
    expect(keyGate).toMatch(/flex flex-col gap-3 sm:flex-row/);
    expect(keyGate).toMatch(/min-h-11 w-full sm:flex-1/);
    expect(keyGate).toMatch(/variant="outline"/);
  });
});
