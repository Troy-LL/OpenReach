import { describe, expect, it } from "vitest";
import { specialtyIndexesFor } from "../src/retrieve.js";
import type { Intent } from "../src/types.js";

const ALWAYS = [
  "openalex",
  "semantic_scholar",
  "crossref",
  "openaire",
  "doaj",
] as const;

describe("specialtyIndexesFor", () => {
  it("runs every specialty when field is unknown", () => {
    expect(specialtyIndexesFor(undefined).sort()).toEqual(
      [
        "arxiv",
        "biorxiv",
        "eric",
        "europe_pmc",
        "inspire",
        "medrxiv",
        "plos",
        "pubmed",
      ].sort(),
    );
  });

  it.each([
    ["cs", ["arxiv"]],
    ["physics", ["arxiv", "inspire"]],
    ["biomed", ["europe_pmc", "pubmed", "biorxiv", "medrxiv", "plos"]],
    ["social", ["eric"]],
    [
      "other",
      [
        "arxiv",
        "inspire",
        "europe_pmc",
        "pubmed",
        "biorxiv",
        "medrxiv",
        "plos",
        "eric",
      ],
    ],
  ] as const)("covers %s without holes in the matrix", (field, expected) => {
    expect(specialtyIndexesFor(field as Intent["field"]).sort()).toEqual(
      [...expected].sort(),
    );
    // Always-on indexes are separate from specialty gating.
    expect(ALWAYS.length).toBeGreaterThanOrEqual(5);
  });
});
