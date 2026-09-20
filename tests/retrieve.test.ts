import { describe, expect, it } from "vitest";
import { invertAbstract } from "../src/retrieve.js";

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
