import { describe, expect, it } from "vitest";
import { invertAbstract, openAlexToPaper, s2ToPaper } from "../src/retrieve.js";

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
