import { describe, expect, it } from "vitest";
import { resolvePaperUrl } from "../src/paper-url.js";

describe("resolvePaperUrl", () => {
  it("keeps the first reachable scholarly candidate", () => {
    expect(
      resolvePaperUrl(
        [
          "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6435980/pdf/x.pdf",
          "https://doi.org/10.1117/1.jmi.6.1.014006",
        ],
        "10.1117/1.jmi.6.1.014006",
      ),
    ).toBe("https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6435980/pdf/x.pdf");
  });

  it("demotes Medium-class blog hosts and falls back to DOI", () => {
    expect(
      resolvePaperUrl(
        [
          "https://towardsdatascience.com/residual-networks-explained",
          "https://medium.com/@lab/skip-connections",
          "https://someone.substack.com/p/unet",
        ],
        "10.1000/example",
      ),
    ).toBe("https://doi.org/10.1000/example");
  });

  it("never uses an OpenAlex work id as the outbound paper link", () => {
    expect(
      resolvePaperUrl(["https://openalex.org/W2194775991"], "10.1109/cvpr.2016.90"),
    ).toBe("https://doi.org/10.1109/cvpr.2016.90");
    expect(resolvePaperUrl(["https://openalex.org/W2194775991"])).toBeNull();
  });

  it("returns null when every candidate is unusable and there is no DOI", () => {
    expect(
      resolvePaperUrl(["https://medium.com/p/notes", "https://openalex.org/W1"]),
    ).toBeNull();
  });
});
