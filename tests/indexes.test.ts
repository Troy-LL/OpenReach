import { describe, expect, it } from "vitest";
import {
  parseCrossrefItems,
  parseDoajResults,
  parseEricDocs,
  parseInspireHits,
  parseOpenAireResults,
  parsePubmedXml,
  parsePreprintHits,
  parsePlosDocs,
} from "../src/indexes.js";

describe("parseCrossrefItems", () => {
  it("maps works with abstracts into Paper objects", () => {
    const papers = parseCrossrefItems([
      {
        DOI: "10.1000/example",
        title: ["A study of attention"],
        abstract: "<jats:p>We study attention mechanisms.</jats:p>",
        "published-print": { "date-parts": [[2020, 1]] },
        "container-title": ["Nature Methods"],
        URL: "https://doi.org/10.1000/example",
        author: [
          { given: "Ashish", family: "Vaswani" },
          { given: "Noam", family: "Shazeer" },
        ],
      },
    ]);
    expect(papers).toHaveLength(1);
    expect(papers[0]).toMatchObject({
      source: "crossref",
      doi: "10.1000/example",
      year: 2020,
      venue: "Nature Methods",
      authors: ["Ashish Vaswani", "Noam Shazeer"],
    });
    expect(papers[0].abstract).toBe("We study attention mechanisms.");
    expect(papers[0].title).toBe("A study of attention");
  });

  it("skips works without title or abstract", () => {
    expect(
      parseCrossrefItems([
        { DOI: "10.1/x", title: ["Only title"] },
        { DOI: "10.1/y", abstract: "Only abstract" },
      ]),
    ).toEqual([]);
  });
});

describe("parsePubmedXml", () => {
  it("extracts PMID articles from efetch XML", () => {
    const xml = `<?xml version="1.0"?>
<PubmedArticleSet>
  <PubmedArticle>
    <MedlineCitation>
      <PMID>12345</PMID>
      <Article>
        <ArticleTitle>Robust vision transformers</ArticleTitle>
        <Abstract><AbstractText>Vision Transformers perform well.</AbstractText></Abstract>
        <AuthorList>
          <Author ValidYN="Y"><LastName>Dosovitskiy</LastName><ForeName>Alexey</ForeName></Author>
          <Author ValidYN="Y"><LastName>Beyer</LastName><ForeName>Lucas</ForeName></Author>
        </AuthorList>
        <Journal><Title>Frontiers in AI</Title><JournalIssue><PubDate><Year>2024</Year></PubDate></JournalIssue></Journal>
        <ELocationID EIdType="doi">10.3389/frai.2024.1</ELocationID>
      </Article>
    </MedlineCitation>
  </PubmedArticle>
</PubmedArticleSet>`;
    const papers = parsePubmedXml(xml);
    expect(papers).toHaveLength(1);
    expect(papers[0]).toMatchObject({
      id: "pmid:12345",
      source: "pubmed",
      year: 2024,
      doi: "10.3389/frai.2024.1",
      authors: ["Alexey Dosovitskiy", "Lucas Beyer"],
    });
    expect(papers[0].url).toContain("pubmed.ncbi.nlm.nih.gov/12345");
  });
});

describe("parseInspireHits", () => {
  it("maps INSPIRE literature metadata", () => {
    const papers = parseInspireHits([
      {
        id: 3196435,
        metadata: {
          titles: [{ title: "Particle dual attention transformer" }],
          abstracts: [{ value: "Jet tagging is a crucial classification task." }],
          dois: [{ value: "10.1140/epjc/s10052-023-12345" }],
          publication_info: [{ journal_title: "Eur.Phys.J.C", year: 2023 }],
          earliest_date: "2023-01-15",
        },
      },
    ]);
    expect(papers).toHaveLength(1);
    expect(papers[0]).toMatchObject({
      id: "inspire:3196435",
      source: "inspire",
      year: 2023,
      venue: "Eur.Phys.J.C",
      doi: "10.1140/epjc/s10052-023-12345",
    });
  });
});

describe("parseEricDocs", () => {
  it("maps ERIC docs using description as abstract", () => {
    const papers = parseEricDocs([
      {
        id: "EJ123",
        title: "Transformers in the classroom",
        description: "A study of educational transformers.",
        publicationdateyear: 2019,
        source: "Journal of Education",
        isbn: undefined,
        issn: ["1234-5678"],
      },
    ]);
    expect(papers).toHaveLength(1);
    expect(papers[0]).toMatchObject({
      id: "eric:EJ123",
      source: "eric",
      year: 2019,
      venue: "Journal of Education",
    });
  });
});

describe("parseDoajResults", () => {
  it("maps DOAJ bibjson articles", () => {
    const papers = parseDoajResults([
      {
        bibjson: {
          title: "Open access attention survey",
          abstract: "We survey attention in open access journals.",
          year: "2021",
          journal: { title: "Frontiers in Psychology" },
          identifier: [{ id: "10.3389/fpsyg.2021.1", type: "doi" }],
          link: [
            {
              url: "https://www.frontiersin.org/articles/10.3389/fpsyg.2021.1/full",
              type: "fulltext",
            },
          ],
        },
      },
    ]);
    expect(papers).toHaveLength(1);
    expect(papers[0]).toMatchObject({
      source: "doaj",
      doi: "10.3389/fpsyg.2021.1",
      year: 2021,
      venue: "Frontiers in Psychology",
    });
  });
});

describe("parseOpenAireResults", () => {
  it("flattens OpenAIRE nested dollar fields", () => {
    const papers = parseOpenAireResults([
      {
        metadata: {
          "oaf:entity": {
            "oaf:result": {
              title: [{ $: "Attention expression mechanism" }],
              description: { $: "We propose an attention expression model." },
              dateofacceptance: { $: "2000-01-01" },
              pid: {
                "@classid": "doi",
                $: "10.1109/roman.2000.892460",
              },
              journal: { $: "IEEE RO-MAN" },
            },
          },
        },
      },
    ]);
    expect(papers).toHaveLength(1);
    expect(papers[0]).toMatchObject({
      source: "openaire",
      doi: "10.1109/roman.2000.892460",
      year: 2000,
      title: "Attention expression mechanism",
    });
  });
});

describe("parsePreprintHits", () => {
  it("labels bioRxiv and medRxiv from Europe PMC preprint hits", () => {
    const papers = parsePreprintHits([
      {
        id: "PPR1",
        title: "A bioRxiv preprint",
        abstractText: "Biology preprint abstract.",
        pubYear: "2024",
        journalTitle: "bioRxiv",
        doi: "10.1101/2024.01.01.123456",
        source: "PPR",
      },
      {
        id: "PPR2",
        title: "A medRxiv preprint",
        abstractText: "Clinical preprint abstract.",
        pubYear: "2023",
        journalTitle: "medRxiv",
        doi: "10.1101/2023.01.01.23245678",
        source: "PPR",
      },
    ]);
    expect(papers.map((p) => p.source)).toEqual(["biorxiv", "medrxiv"]);
    expect(papers[0].url).toContain("biorxiv.org");
    expect(papers[1].url).toContain("medrxiv.org");
  });
});

describe("parsePlosDocs", () => {
  it("maps PLOS Solr docs", () => {
    const papers = parsePlosDocs([
      {
        id: "10.1371/journal.pcbi.1013424",
        title: "Protein language models",
        abstract: ["PLMs use transformer architectures."],
        publication_date: "2025-09-12T00:00:00Z",
        journal: "PLOS Computational Biology",
      },
    ]);
    expect(papers).toHaveLength(1);
    expect(papers[0]).toMatchObject({
      source: "plos",
      year: 2025,
      doi: "10.1371/journal.pcbi.1013424",
    });
  });
});
