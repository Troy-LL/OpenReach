import { describe, expect, it } from "vitest";
import { dedupePapers } from "../src/dedupe.js";
import {
  arxivSearchQuery,
  normalizeArxivId,
  parseArxivAtom,
  parseEuropePmcResults,
} from "../src/sources.js";
import type { Paper } from "../src/types.js";

const ARXIV_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <id>http://arxiv.org/abs/1512.03385v1</id>
    <updated>2015-12-10T00:00:00Z</updated>
    <published>2015-12-10T00:00:00Z</published>
    <title>Deep Residual Learning for Image Recognition</title>
    <summary>  We present a residual learning framework.  </summary>
    <author><name>Kaiming He</name></author>
  </entry>
</feed>`;

describe("parseArxivAtom", () => {
  it("extracts title, abstract, year, and abs url", () => {
    const papers = parseArxivAtom(ARXIV_SAMPLE);
    expect(papers).toHaveLength(1);
    expect(papers[0].title).toBe(
      "Deep Residual Learning for Image Recognition",
    );
    expect(papers[0].abstract).toContain("residual learning");
    expect(papers[0].year).toBe(2015);
    expect(papers[0].url).toBe("https://arxiv.org/abs/1512.03385");
    expect(papers[0].doi).toBe("10.48550/arXiv.1512.03385");
    expect(papers[0].source).toBe("arxiv");
    expect(papers[0].authors).toEqual(["Kaiming He"]);
  });
});

describe("normalizeArxivId / arxivSearchQuery", () => {
  it("strips version suffixes", () => {
    expect(normalizeArxivId("http://arxiv.org/abs/1512.03385v2")).toBe(
      "1512.03385",
    );
  });

  it("joins tokens with AND for the arXiv API", () => {
    expect(arxivSearchQuery("residual networks")).toBe(
      "all:residual+AND+all:networks",
    );
  });
});

describe("parseEuropePmcResults", () => {
  it("maps core search hits into Paper objects", () => {
    const papers = parseEuropePmcResults([
      {
        id: "123",
        title: "A clinical trial of X",
        abstractText: "We ran a randomized trial.",
        pubYear: "2021",
        journalTitle: "Lancet",
        doi: "10.1000/example",
        pmid: "999",
        source: "MED",
      },
    ]);
    expect(papers).toHaveLength(1);
    expect(papers[0].source).toBe("europe_pmc");
    expect(papers[0].year).toBe(2021);
    expect(papers[0].doi).toBe("10.1000/example");
    expect(papers[0].url).toContain("europepmc.org");
  });
});

describe("dedupe across arXiv DOI forms", () => {
  it("merges openalex and arxiv records for the same preprint", () => {
    const a: Paper = {
      id: "oa:1",
      title: "Deep Residual Learning for Image Recognition",
      abstract: "We present residual networks.",
      year: 2015,
      venue: null,
      doi: "10.48550/arXiv.1512.03385",
      url: "https://doi.org/10.48550/arXiv.1512.03385",
      source: "openalex",
    };
    const b: Paper = {
      id: "arxiv:1512.03385",
      title: "Deep Residual Learning for Image Recognition",
      abstract: "We present a residual learning framework.",
      year: 2015,
      venue: "arXiv",
      doi: "10.48550/arXiv.1512.03385",
      url: "https://arxiv.org/abs/1512.03385",
      source: "arxiv",
    };
    expect(dedupePapers([a, b])).toHaveLength(1);
  });
});
