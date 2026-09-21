import { afterEach, describe, expect, it, vi } from "vitest";
import {
  invertAbstract,
  OPENALEX_WORK_SELECT,
  openAlexToPaper,
  RELATED_SKIP_AFTER,
  retrieveCandidates,
  S2_PAPER_FIELDS,
  s2ToPaper,
} from "../src/retrieve.js";

describe("invertAbstract", () => {
  it("reconstructs text from an OpenAlex inverted index", () => {
    const inverted = {
      We: [0],
      propose: [1],
      the: [2],
      Transformer: [3],
    };
    expect(invertAbstract(inverted)).toBe("We propose the Transformer");
  });

  it("returns empty string for missing indexes", () => {
    expect(invertAbstract(null)).toBe("");
    expect(invertAbstract(undefined)).toBe("");
  });
});

describe("index author mapping", () => {
  it("keeps OpenAlex authorship display names", () => {
    const paper = openAlexToPaper(
      {
        id: "https://openalex.org/W2194775991",
        title: "Deep Residual Learning for Image Recognition",
        publication_year: 2016,
        authorships: [
          { author: { display_name: "Kaiming He" } },
          { author: { display_name: "Xiangyu Zhang" } },
        ],
      },
      "openalex",
    );
    expect(paper.authors).toEqual(["Kaiming He", "Xiangyu Zhang"]);
  });

  it("keeps Semantic Scholar author names", () => {
    const paper = s2ToPaper({
      paperId: "abc",
      title: "Attention Is All You Need",
      authors: [{ name: "Ashish Vaswani" }, { name: "Noam Shazeer" }],
    });
    expect(paper.authors).toEqual(["Ashish Vaswani", "Noam Shazeer"]);
  });
});

describe("OpenAlex outbound URL", () => {
  it("asks OpenAlex for OA location fields", () => {
    expect(OPENALEX_WORK_SELECT).toContain("best_oa_location");
    expect(OPENALEX_WORK_SELECT).toContain("open_access");
  });

  it("prefers best_oa PDF over a paywall primary landing", () => {
    const paper = openAlexToPaper(
      {
        id: "https://openalex.org/W123",
        title: "Residual networks",
        doi: "https://doi.org/10.1117/1.jmi.6.1.014006",
        primary_location: {
          landing_page_url: "https://doi.org/10.1117/1.jmi.6.1.014006",
        },
        best_oa_location: {
          pdf_url: "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6435980/pdf/nihms-1012345.pdf",
          landing_page_url: "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6435980/",
        },
        open_access: {
          oa_url: "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6435980/",
        },
      },
      "openalex",
    );
    expect(paper.url).toBe(
      "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6435980/pdf/nihms-1012345.pdf",
    );
    expect(paper.url).not.toContain("openalex.org/W");
  });

  it("uses open_access.oa_url when best_oa has no PDF", () => {
    const paper = openAlexToPaper(
      {
        id: "https://openalex.org/W456",
        title: "MDPI survey",
        doi: "10.3390/app12188972",
        primary_location: {
          landing_page_url: "https://doi.org/10.3390/app12188972",
        },
        best_oa_location: {
          landing_page_url: "https://www.mdpi.com/2076-3417/12/18/8972",
        },
        open_access: {
          oa_url: "https://www.mdpi.com/2076-3417/12/18/8972/pdf",
        },
      },
      "openalex",
    );
    expect(paper.url).toBe("https://www.mdpi.com/2076-3417/12/18/8972/pdf");
  });

  it("falls back to primary landing, then doi.org, never work.id", () => {
    const landing = openAlexToPaper(
      {
        id: "https://openalex.org/W789",
        title: "Primary only",
        primary_location: {
          landing_page_url: "https://arxiv.org/abs/1512.03385",
        },
      },
      "openalex",
    );
    expect(landing.url).toBe("https://arxiv.org/abs/1512.03385");

    const doiOnly = openAlexToPaper(
      {
        id: "https://openalex.org/W790",
        title: "DOI only",
        doi: "10.1109/cvpr.2016.90",
      },
      "openalex",
    );
    expect(doiOnly.url).toBe("https://doi.org/10.1109/cvpr.2016.90");

    const bare = openAlexToPaper(
      {
        id: "https://openalex.org/W791",
        title: "No landing",
      },
      "openalex",
    );
    expect(bare.url).toBeNull();
  });
});

describe("Semantic Scholar outbound URL", () => {
  it("requests openAccessPdf", () => {
    expect(S2_PAPER_FIELDS.split(",")).toContain("openAccessPdf");
  });

  it("prefers openAccessPdf over the S2 paper page", () => {
    const paper = s2ToPaper({
      paperId: "abc",
      title: "Attention Is All You Need",
      url: "https://www.semanticscholar.org/paper/abc",
      externalIds: { DOI: "10.5555/3295222.3295349" },
      openAccessPdf: { url: "https://arxiv.org/pdf/1706.03762" },
    });
    expect(paper.url).toBe("https://arxiv.org/pdf/1706.03762");
  });

  it("skips semanticscholar.org and falls through to doi.org", () => {
    const paper = s2ToPaper({
      paperId: "abc",
      title: "Attention Is All You Need",
      url: "https://www.semanticscholar.org/paper/abc",
      externalIds: { DOI: "10.5555/3295222.3295349" },
    });
    expect(paper.url).toBe("https://doi.org/10.5555/3295222.3295349");
  });
});

function emptyPayload(url: string): { body: string; type: string } {
  if (url.includes("arxiv.org")) {
    return { body: "<feed></feed>", type: "application/atom+xml" };
  }
  if (url.includes("efetch.fcgi")) {
    return { body: "<PubmedArticleSet></PubmedArticleSet>", type: "application/xml" };
  }
  if (url.includes("esearch.fcgi")) {
    return {
      body: JSON.stringify({ esearchresult: { idlist: [] } }),
      type: "application/json",
    };
  }
  if (url.includes("semanticscholar")) {
    return { body: JSON.stringify({ data: [] }), type: "application/json" };
  }
  if (url.includes("crossref")) {
    return {
      body: JSON.stringify({ message: { items: [] } }),
      type: "application/json",
    };
  }
  if (url.includes("inspirehep")) {
    return { body: JSON.stringify({ hits: { hits: [] } }), type: "application/json" };
  }
  if (url.includes("ies.ed.gov")) {
    return {
      body: JSON.stringify({ response: { docs: [] } }),
      type: "application/json",
    };
  }
  if (url.includes("doaj.org")) {
    return { body: JSON.stringify({ results: [] }), type: "application/json" };
  }
  if (url.includes("openaire.eu")) {
    return {
      body: JSON.stringify({ response: { results: { result: [] } } }),
      type: "application/json",
    };
  }
  if (url.includes("plos.org")) {
    return {
      body: JSON.stringify({ response: { docs: [] } }),
      type: "application/json",
    };
  }
  if (url.includes("europepmc") || url.includes("ebi.ac.uk")) {
    return {
      body: JSON.stringify({ resultList: { result: [] } }),
      type: "application/json",
    };
  }
  return { body: JSON.stringify({ results: [] }), type: "application/json" };
}

describe("retrieveCandidates fan-out", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("skips biomed indexes for a cs field and skips related after enough unique hits", async () => {
    expect(RELATED_SKIP_AFTER).toBe(80);
    const urls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        urls.push(url);
        if (url.includes("api.openalex.org/works") && url.includes("search=")) {
          const results = Array.from({ length: 90 }, (_, i) => ({
            id: `https://openalex.org/W${i}`,
            title: `Paper ${i}`,
            related_works: ["https://openalex.org/W999"],
          }));
          return new Response(JSON.stringify({ results }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        const { body, type } = emptyPayload(url);
        return new Response(body, {
          status: 200,
          headers: { "Content-Type": type },
        });
      }),
    );

    const papers = await retrieveCandidates("transformer attention", {
      field: "cs",
      keywordLimit: 90,
      relatedLimit: 20,
    });
    expect(papers.length).toBeGreaterThanOrEqual(80);
    expect(urls.some((url) => /pubmed|ncbi|europepmc|ebi\.ac\.uk|eric|inspirehep|plos/i.test(url))).toBe(
      false,
    );
    expect(urls.some((url) => url.includes("arxiv.org"))).toBe(true);
    expect(urls.some((url) => url.includes("filter=ids.openalex"))).toBe(false);
  });

  it("keeps papers from healthy indexes when one upstream fetch throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("semanticscholar")) {
          throw new Error("S2 down");
        }
        if (url.includes("api.openalex.org/works") && url.includes("search=")) {
          return new Response(
            JSON.stringify({
              results: [
                {
                  id: "https://openalex.org/W1",
                  title: "Kept paper",
                  related_works: [],
                },
              ],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        const { body, type } = emptyPayload(url);
        return new Response(body, {
          status: 200,
          headers: { "Content-Type": type },
        });
      }),
    );

    const papers = await retrieveCandidates("transformer attention", {
      field: "cs",
      relatedSkipAfter: 1,
    });
    expect(papers.some((paper) => paper.title === "Kept paper")).toBe(true);
  });
});

