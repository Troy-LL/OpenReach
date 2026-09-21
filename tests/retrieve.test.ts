import { describe, expect, it } from "vitest";
import {
  invertAbstract,
  OPENALEX_WORK_SELECT,
  openAlexToPaper,
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
