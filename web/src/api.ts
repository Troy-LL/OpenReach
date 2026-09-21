import type { Paper, RankedPaper, SearchResult } from "@shared/types";
import { assertLooksLikeKey, TYPESAFE_KEY_HEADER } from "@shared/key-format";
import {
  clearClientKey,
  loadClientKey,
  saveClientKey,
} from "./client-key";

export type ExportFormat = "apa" | "bibtex";

export type CiteablePaper = Pick<
  RankedPaper,
  "id" | "title" | "year" | "venue" | "doi" | "url" | "authors"
> & {
  volume?: string | null;
  issue?: string | null;
  pages?: string | null;
};

function apiHeaders(extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  const key = loadClientKey();
  if (key) headers.set(TYPESAFE_KEY_HEADER, key);
  return headers;
}

async function readJson<T>(res: Response): Promise<T> {
  const body = (await res.json()) as T & { error?: string };
  if (!res.ok) {
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  return body;
}

export async function getHealth(): Promise<{ ok: boolean; hasKey: boolean }> {
  const res = await fetch("/api/health", { headers: apiHeaders() });
  return readJson(res);
}

export async function saveApiKey(key: string): Promise<void> {
  const trimmed = assertLooksLikeKey(key);
  const res = await fetch("/api/key", {
    method: "POST",
    headers: apiHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ key: trimmed }),
  });
  await readJson(res);
  saveClientKey(trimmed);
}

export async function clearApiKey(): Promise<{ hasKey: boolean }> {
  clearClientKey();
  const res = await fetch("/api/key", { method: "DELETE", headers: apiHeaders() });
  return readJson(res);
}

export async function searchPapers(question: string): Promise<SearchResult> {
  const res = await fetch("/api/search", {
    method: "POST",
    headers: apiHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ question }),
  });
  return readJson<SearchResult>(res);
}

export async function loadDemo(): Promise<SearchResult> {
  const res = await fetch("/api/demo");
  return readJson<SearchResult>(res);
}

export async function scoreVisible(
  sessionId: string,
  ids: string[],
): Promise<{ papers: RankedPaper[]; pending: number; sessionId: string }> {
  const res = await fetch("/api/score", {
    method: "POST",
    headers: apiHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ sessionId, ids }),
  });
  return readJson(res);
}

export async function exportCitations(
  format: ExportFormat,
  papers: CiteablePaper[],
): Promise<{ format: ExportFormat; text: string }> {
  const res = await fetch("/api/export", {
    method: "POST",
    headers: apiHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ format, papers }),
  });
  return readJson(res);
}

export async function moreLikePaper(paper: Paper): Promise<SearchResult> {
  const res = await fetch("/api/more-like", {
    method: "POST",
    headers: apiHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ paper }),
  });
  return readJson<SearchResult>(res);
}

export interface Suggestion {
  id: string;
  text: string;
  hint: string | null;
  kind: "work" | "topic" | "concept";
}

export async function fetchSuggestions(query: string): Promise<Suggestion[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const res = await fetch(`/api/suggest?q=${encodeURIComponent(q)}`, {
    headers: apiHeaders(),
  });
  const body = await readJson<{ suggestions: Suggestion[] }>(res);
  return body.suggestions ?? [];
}
