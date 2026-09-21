import { describe, expect, it } from "vitest";
import {
  formatApa,
  formatApaList,
  formatBibtex,
  formatBibtexList,
  type Citeable,
} from "../src/cite.js";

function cite(partial: Partial<Citeable> & Pick<Citeable, "id" | "title">): Citeable {
  return {
    year: 2020,
    venue: null,
    doi: null,
    url: null,
    ...partial,
  };
}

describe("formatApa", () => {
  it("uses [Author unknown] and DOI link when authors are missing", () => {
    const paper = cite({
      id: "resnet",
      title: "Deep Residual Learning for Image Recognition",
      year: 2016,
      venue: "CVPR",
      doi: "10.1109/cvpr.2016.90",
    });

    expect(formatApa(paper)).toBe(
      "[Author unknown]. (2016). Deep Residual Learning for Image Recognition. CVPR. https://doi.org/10.1109/cvpr.2016.90",
    );
  });

  it("formats named authors without inventing initials", () => {
    const paper = cite({
      id: "1",
      title: "Attention Is All You Need",
      year: 2017,
      venue: "NeurIPS",
      authors: ["Vaswani, Ashish", "Shazeer, Noam", "Parmar, Niki"],
      doi: "10.5555/3295222.3295349",
    });

    expect(formatApa(paper)).toBe(
      "Vaswani, Ashish, Shazeer, Noam, & Parmar, Niki. (2017). Attention Is All You Need. NeurIPS. https://doi.org/10.5555/3295222.3295349",
    );
  });

  it("splits display names on the last space when there is no comma", () => {
    const paper = cite({
      id: "2",
      title: "A Paper",
      year: 2019,
      venue: "ICML",
      authors: ["Kaiming He", "Xiangyu Zhang"],
    });

    expect(formatApa(paper)).toMatch(/^He, Kaiming, & Zhang, Xiangyu\./);
  });

  it("uses (n.d.) when year is missing", () => {
    const paper = cite({
      id: "3",
      title: "Untitled Draft",
      year: null,
      url: "https://example.org/draft",
      authors: ["Ada Lovelace"],
    });

    expect(formatApa(paper)).toBe(
      "Lovelace, Ada. (n.d.). Untitled Draft. https://example.org/draft",
    );
  });

  it("omits volume, issue, and pages when not provided", () => {
    const paper = cite({
      id: "4",
      title: "Brief Note",
      year: 2021,
      venue: "Nature",
      authors: ["Smith, Jane"],
      doi: "10.1038/example",
    });

    const apa = formatApa(paper);
    expect(apa).not.toMatch(/\bvolume\b/i);
    expect(apa).not.toMatch(/\bpages\b/i);
    expect(apa).toBe(
      "Smith, Jane. (2021). Brief Note. Nature. https://doi.org/10.1038/example",
    );
  });

  it("includes volume, issue, and pages only when provided", () => {
    const paper = cite({
      id: "5",
      title: "Full Metadata",
      year: 2022,
      venue: "JMLR",
      authors: ["Doe, John"],
      volume: "23",
      issue: "1",
      pages: "1-42",
      doi: "10.5555/jmlr",
    });

    expect(formatApa(paper)).toBe(
      "Doe, John. (2022). Full Metadata. JMLR, 23(1), 1-42. https://doi.org/10.5555/jmlr",
    );
  });
});

describe("formatBibtex", () => {
  it("uses @article when venue is present", () => {
    const paper = cite({
      id: "resnet",
      title: "Deep Residual Learning for Image Recognition",
      year: 2016,
      venue: "CVPR",
      doi: "10.1109/cvpr.2016.90",
    });

    const bib = formatBibtex(paper);
    expect(bib).toMatch(/^@article\{/);
    expect(bib).toContain("journal = {CVPR}");
    expect(bib).not.toContain("pages =");
  });

  it("uses @misc when venue is absent", () => {
    const paper = cite({
      id: "misc-1",
      title: "A Preprint",
      year: 2024,
      url: "https://arxiv.org/abs/2400.00001",
    });

    const bib = formatBibtex(paper);
    expect(bib).toMatch(/^@misc\{/);
    expect(bib).not.toContain("journal =");
    expect(bib).toContain("url = {https://arxiv.org/abs/2400.00001}");
  });

  it("escapes braces in titles and builds a stable cite key", () => {
    const paper = cite({
      id: "brace-id",
      title: "Learning {Invariant} Representations",
      year: 2020,
      venue: "ICLR",
      authors: ["He, Kaiming"],
    });

    const bib = formatBibtex(paper);
    expect(bib).toMatch(/^@article\{He2020Learning,/);
    expect(bib).toContain("title = {Learning \\{Invariant\\} Representations}");
  });

  it("falls back to sanitized id for cite key without authors", () => {
    const paper = cite({
      id: "oa:W123456789",
      title: "Orphan Paper",
      year: 2018,
      venue: "Workshop",
    });

    const bib = formatBibtex(paper);
    expect(bib).toMatch(/^@article\{oaW1234567892018Orphan,/);
  });
});

describe("formatApaList / formatBibtexList", () => {
  it("joins APA entries with newlines", () => {
    const papers = [
      cite({ id: "a", title: "First", year: 2020, venue: "A" }),
      cite({ id: "b", title: "Second", year: 2021, venue: "B" }),
    ];

    const list = formatApaList(papers);
    expect(list).toBe(`${formatApa(papers[0])}\n${formatApa(papers[1])}`);
  });

  it("separates BibTeX entries with a blank line", () => {
    const papers = [
      cite({ id: "a", title: "First", year: 2020, venue: "A" }),
      cite({ id: "b", title: "Second", year: 2021 }),
    ];

    const list = formatBibtexList(papers);
    expect(list).toBe(`${formatBibtex(papers[0])}\n\n${formatBibtex(papers[1])}`);
  });
});
