import { XMLParser } from "fast-xml-parser";
import { getResearchConfig } from "./config.ts";
import {
  buildProfileSignature,
  buildPublicationSignature,
  computeMethodSimilarity,
  emptyMethodSignature,
} from "./signature.ts";
import type {
  ContentCoverage,
  IngestCursor,
  InstitutionalProject,
  PublicationAuthor,
  PublicationChunk,
  PublicationRecord,
  ResearchProfile,
  ResearchSource,
} from "./types.ts";
import {
  buildHashedEmbedding,
  chunkText,
  cleanWhitespace,
  createDeterministicId,
} from "./utils.ts";

export interface SourcePublicationPayload {
  publication: PublicationRecord;
  chunks: Omit<PublicationChunk, "publicationId">[];
}

export interface SourceFetchResult {
  source: ResearchSource;
  items: SourcePublicationPayload[];
  cursor: IngestCursor | null;
}

interface SourceFetchContext {
  profiles: ResearchProfile[];
  projectsByProfile: Record<string, InstitutionalProject[]>;
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  trimValues: true,
  processEntities: true,
});

function arrayify<T>(value: T | T[] | undefined | null): T[] {
  if (Array.isArray(value)) {
    return value;
  }

  return value == null ? [] : [value];
}

function formatNcbiDate(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, "/");
}

function lookbackDate(days: number): Date {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date;
}

function buildBroadTerms(
  profiles: ResearchProfile[],
  projectsByProfile: Record<string, InstitutionalProject[]>,
): { include: string[]; exclude: string[] } {
  const include = new Set<string>();
  const exclude = new Set<string>();

  for (const profile of profiles) {
    for (const item of [
      ...profile.keywords,
      ...profile.methodInterests,
      ...profile.domainInterests,
    ]) {
      const normalized = cleanWhitespace(item);
      if (normalized) {
        include.add(normalized);
      }
    }

    for (const item of profile.excludedTerms) {
      const normalized = cleanWhitespace(item);
      if (normalized) {
        exclude.add(normalized);
      }
    }

    for (const project of projectsByProfile[profile.id] ?? []) {
      for (const item of [
        project.name,
        project.summary,
        ...project.methods,
        ...project.modalities,
        ...project.aliases,
      ]) {
        const normalized = cleanWhitespace(item);
        if (normalized.length >= 4) {
          include.add(normalized);
        }
      }
    }
  }

  return {
    include: [...include].slice(0, 24),
    exclude: [...exclude].slice(0, 12),
  };
}

function buildPubMedQuery(
  profiles: ResearchProfile[],
  projectsByProfile: Record<string, InstitutionalProject[]>,
  cursor: IngestCursor | null,
): string | null {
  const { include, exclude } = buildBroadTerms(profiles, projectsByProfile);
  if (include.length === 0) {
    return null;
  }

  const since = cursor?.lastSeenAt ? new Date(cursor.lastSeenAt) : lookbackDate(getResearchConfig().ingestLookbackDays);
  const includeQuery = include
    .map((term) => `"${term.replace(/"/g, "")}"`)
    .join(" OR ");
  const excludeQuery = exclude.length
    ? ` NOT (${exclude.map((term) => `"${term.replace(/"/g, "")}"`).join(" OR ")})`
    : "";

  return `(${includeQuery}) AND ("${formatNcbiDate(since)}"[Date - Publication] : "3000"[Date - Publication])${excludeQuery}`;
}

function extractText(node: unknown): string {
  if (typeof node === "string") {
    return cleanWhitespace(node);
  }

  if (Array.isArray(node)) {
    return cleanWhitespace(node.map((item) => extractText(item)).join(" "));
  }

  if (node && typeof node === "object") {
    const values = Object.entries(node as Record<string, unknown>)
      .filter(([key]) => key !== "Label" && key !== "NlmCategory")
      .map(([, value]) => extractText(value));
    return cleanWhitespace(values.join(" "));
  }

  return "";
}

function parsePubMedAuthors(rawAuthors: unknown): PublicationAuthor[] {
  return arrayify(rawAuthors)
    .map((author) => {
      const item = author as Record<string, unknown>;
      const given = extractText(item.ForeName ?? item.Initials ?? "");
      const family = extractText(item.LastName ?? "");
      const collective = extractText(item.CollectiveName ?? "");
      const displayName = cleanWhitespace(
        collective || [given, family].filter(Boolean).join(" "),
      );

      if (!displayName) {
        return null;
      }

      return {
        given,
        family: family || displayName,
        displayName,
      } satisfies PublicationAuthor;
    })
    .filter((author): author is PublicationAuthor => Boolean(author));
}

function parsePreprintAuthors(rawAuthors: string): PublicationAuthor[] {
  return rawAuthors
    .split(";")
    .map((item) => cleanWhitespace(item))
    .filter(Boolean)
    .map((displayName) => {
      const [family, given] = displayName.includes(",")
        ? displayName.split(",", 2).map((value) => cleanWhitespace(value))
        : [displayName.split(" ").slice(-1).join(" "), displayName.split(" ").slice(0, -1).join(" ")];
      return {
        given: cleanWhitespace(given ?? ""),
        family: cleanWhitespace(family ?? displayName),
        displayName,
      } satisfies PublicationAuthor;
    });
}

function parsePubDate(rawDate: unknown): string {
  const date = rawDate as Record<string, unknown> | undefined;
  if (!date) {
    return new Date().toISOString();
  }

  const year = Number.parseInt(extractText(date.Year), 10);
  const monthValue = extractText(date.Month);
  const day = Number.parseInt(extractText(date.Day) || "1", 10);
  const monthMap: Record<string, number> = {
    jan: 1,
    feb: 2,
    mar: 3,
    apr: 4,
    may: 5,
    jun: 6,
    jul: 7,
    aug: 8,
    sep: 9,
    oct: 10,
    nov: 11,
    dec: 12,
  };

  let month = Number.parseInt(monthValue, 10);
  if (!Number.isFinite(month)) {
    month = monthMap[monthValue.slice(0, 3).toLowerCase()] ?? 1;
  }

  if (!Number.isFinite(year)) {
    return new Date().toISOString();
  }

  return new Date(Date.UTC(year, Math.max(0, month - 1), Math.max(1, day))).toISOString();
}

function buildChunks(
  publicationId: string,
  sections: Array<{ section: string; text: string }>,
): Omit<PublicationChunk, "publicationId">[] {
  const { vectorDimensions } = getResearchConfig();
  const chunks: Omit<PublicationChunk, "publicationId">[] = [];
  let order = 0;

  for (const section of sections) {
    for (const chunk of chunkText(section.text)) {
      const chunkId = createDeterministicId(
        "chunk",
        `${publicationId}:${section.section}:${order}:${chunk.slice(0, 120)}`,
      );
      chunks.push({
        id: chunkId,
        section: section.section,
        text: chunk,
        embedding: buildHashedEmbedding(`${section.section} ${chunk}`, vectorDimensions),
        chunkOrder: order,
      });
      order += 1;
    }
  }

  return chunks;
}

function collectJatsParagraphs(node: unknown, sectionTitle = "Body"): Array<{ section: string; text: string }> {
  if (!node || typeof node !== "object") {
    return [];
  }

  const item = node as Record<string, unknown>;
  const sections: Array<{ section: string; text: string }> = [];
  const directParagraphs = arrayify(item.p)
    .map((paragraph) => extractText(paragraph))
    .filter(Boolean);

  if (directParagraphs.length > 0) {
    sections.push({
      section: sectionTitle,
      text: directParagraphs.join(" "),
    });
  }

  for (const childSection of arrayify(item.sec)) {
    const child = childSection as Record<string, unknown>;
    const childTitle = extractText(child.title) || sectionTitle;
    sections.push(...collectJatsParagraphs(child, childTitle));
  }

  return sections;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "clinical-trial-pre-screener/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed for ${url}: HTTP ${response.status}`);
  }

  return (await response.json()) as T;
}

async function fetchText(url: string, accept = "text/plain"): Promise<string> {
  const response = await fetch(url, {
    headers: {
      Accept: accept,
      "User-Agent": "clinical-trial-pre-screener/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed for ${url}: HTTP ${response.status}`);
  }

  return await response.text();
}

async function fetchPubMedFullText(pmcid: string): Promise<Array<{ section: string; text: string }>> {
  try {
    const xml = await fetchText(
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pmc&id=${encodeURIComponent(pmcid)}&retmode=xml`,
      "application/xml,text/xml",
    );
    const parsed = xmlParser.parse(xml) as Record<string, unknown>;
    const article = (parsed.article as Record<string, unknown> | undefined) ?? parsed;
    const body = article.body;
    const sections = collectJatsParagraphs(body, "Body");
    return sections.filter((section) => section.text.length > 40);
  } catch {
    return [];
  }
}

async function fetchPreprintJatsXml(
  source: "biorxiv" | "medrxiv",
  jatsXmlPath: string | undefined,
): Promise<Array<{ section: string; text: string }>> {
  if (!jatsXmlPath) {
    return [];
  }

  const url = jatsXmlPath.startsWith("http")
    ? jatsXmlPath
    : jatsXmlPath.startsWith("/")
      ? `https://www.${source}.org${jatsXmlPath}`
      : `https://www.${source}.org/${jatsXmlPath}`;

  try {
    const xml = await fetchText(url, "application/xml,text/xml");
    const parsed = xmlParser.parse(xml) as Record<string, unknown>;
    const article = (parsed.article as Record<string, unknown> | undefined) ?? parsed;
    const body = article.body;
    const sections = collectJatsParagraphs(body, "Body");
    return sections.filter((section) => section.text.length > 40);
  } catch {
    return [];
  }
}

function matchesBroadInterest(
  publication: Pick<PublicationRecord, "title" | "abstract" | "fullText" | "methodSignature">,
  profiles: ResearchProfile[],
  projectsByProfile: Record<string, InstitutionalProject[]>,
): boolean {
  const searchableText = cleanWhitespace(
    [publication.title, publication.abstract, publication.fullText ?? ""].join(" ").toLowerCase(),
  );
  const { include, exclude } = buildBroadTerms(profiles, projectsByProfile);

  if (exclude.some((term) => searchableText.includes(term.toLowerCase()))) {
    return false;
  }

  if (include.some((term) => searchableText.includes(term.toLowerCase()))) {
    return true;
  }

  return profiles.some((profile) => {
    const signature = buildProfileSignature(profile, projectsByProfile[profile.id] ?? []);
    return computeMethodSimilarity(signature, publication.methodSignature).score >= 0.2;
  });
}

async function fetchPubMedSource(
  context: SourceFetchContext,
  cursor: IngestCursor | null,
): Promise<SourceFetchResult> {
  const { ncbiApiKey, ncbiEmail, pubmedRetmax, vectorDimensions } = getResearchConfig();
  const query = buildPubMedQuery(context.profiles, context.projectsByProfile, cursor);
  if (!query) {
    return { source: "pubmed", items: [], cursor };
  }

  const params = new URLSearchParams({
    db: "pubmed",
    sort: "pub date",
    retmax: String(pubmedRetmax),
    retmode: "json",
    term: query,
    tool: "clinical-trial-pre-screener",
  });

  if (ncbiEmail) params.set("email", ncbiEmail);
  if (ncbiApiKey) params.set("api_key", ncbiApiKey);

  const search = await fetchJson<{
    esearchresult?: { idlist?: string[] };
  }>(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?${params.toString()}`);
  const ids = search.esearchresult?.idlist ?? [];
  if (ids.length === 0) {
    return { source: "pubmed", items: [], cursor };
  }

  const fetchParams = new URLSearchParams({
    db: "pubmed",
    id: ids.join(","),
    retmode: "xml",
    tool: "clinical-trial-pre-screener",
  });
  if (ncbiEmail) fetchParams.set("email", ncbiEmail);
  if (ncbiApiKey) fetchParams.set("api_key", ncbiApiKey);

  const xml = await fetchText(
    `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?${fetchParams.toString()}`,
    "application/xml,text/xml",
  );
  const parsed = xmlParser.parse(xml) as {
    PubmedArticleSet?: { PubmedArticle?: unknown[] | unknown };
  };
  const articles = arrayify(parsed.PubmedArticleSet?.PubmedArticle);
  const items: SourcePublicationPayload[] = [];

  for (const rawArticle of articles) {
    const article = rawArticle as Record<string, unknown>;
    const medline = (article.MedlineCitation as Record<string, unknown> | undefined) ?? {};
    const pubmedData = (article.PubmedData as Record<string, unknown> | undefined) ?? {};
    const articleMeta = (medline.Article as Record<string, unknown> | undefined) ?? {};
    const articleIds = arrayify(
      (pubmedData.ArticleIdList as Record<string, unknown> | undefined)?.ArticleId,
    );

    const pmid = extractText(medline.PMID);
    const title = extractText(articleMeta.ArticleTitle);
    const abstract = cleanWhitespace(
      arrayify((articleMeta.Abstract as Record<string, unknown> | undefined)?.AbstractText)
        .map((item) => extractText(item))
        .join(" "),
    );

    if (!pmid || !title || !abstract) {
      continue;
    }

    let doi: string | undefined;
    let pmcid: string | undefined;
    for (const id of articleIds) {
      const item = id as Record<string, unknown>;
      if (String(item.IdType ?? "").toLowerCase() === "doi") {
        doi = extractText(item["#text"] ?? item);
      }
      if (String(item.IdType ?? "").toLowerCase() === "pmc") {
        pmcid = extractText(item["#text"] ?? item);
      }
    }

    const publishedAt = parsePubDate(
      (articleMeta.Journal as Record<string, unknown> | undefined)?.JournalIssue &&
        ((articleMeta.Journal as Record<string, unknown>).JournalIssue as Record<string, unknown>).PubDate,
    );
    const fullTextSections = pmcid ? await fetchPubMedFullText(pmcid) : [];
    const fullText = cleanWhitespace(fullTextSections.map((section) => section.text).join(" "));
    const methodSignature = buildPublicationSignature({
      title,
      abstract,
      fullText: fullText || undefined,
    });

    const publication: PublicationRecord = {
      id: createDeterministicId("pub", doi || pmid),
      source: "pubmed",
      sourceId: pmid,
      doi,
      pmid,
      title,
      abstract,
      fullText: fullText || undefined,
      authors: parsePubMedAuthors((articleMeta.AuthorList as Record<string, unknown> | undefined)?.Author),
      venue:
        extractText((articleMeta.Journal as Record<string, unknown> | undefined)?.Title) ||
        "PubMed-indexed journal",
      publishedAt,
      updatedAt: publishedAt,
      peerReviewStatus: "peer_reviewed",
      sourceQualityTier: "peer_reviewed_indexed",
      url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
      contentCoverage: (fullText ? "full_text" : "abstract_only") satisfies ContentCoverage,
      methodSignature,
      metadata: {
        pmcid,
      },
    };

    if (!matchesBroadInterest(publication, context.profiles, context.projectsByProfile)) {
      continue;
    }

    const sections =
      fullTextSections.length > 0
        ? fullTextSections
        : [{ section: "Abstract", text: abstract }];

    items.push({
      publication,
      chunks: buildChunks(publication.id, sections).map((chunk) => ({
        ...chunk,
        embedding: chunk.embedding.length
          ? chunk.embedding
          : buildHashedEmbedding(`${chunk.section} ${chunk.text}`, vectorDimensions),
      })),
    });
  }

  const latest = items
    .map((item) => item.publication)
    .sort((left, right) => right.publishedAt.localeCompare(left.publishedAt))[0];

  return {
    source: "pubmed",
    items,
    cursor: latest
      ? {
          source: "pubmed",
          lastSeenAt: latest.publishedAt,
          lastSeenExternalId: latest.pmid ?? latest.id,
        }
      : cursor,
  };
}

function buildPreprintUrl(source: "biorxiv" | "medrxiv", doi: string, version: string): string {
  return `https://www.${source}.org/content/${doi}v${version}`;
}

async function fetchPreprintSource(
  source: "biorxiv" | "medrxiv",
  context: SourceFetchContext,
  cursor: IngestCursor | null,
): Promise<SourceFetchResult> {
  const { ingestLookbackDays, preprintPageSize, vectorDimensions } = getResearchConfig();
  const startDate = cursor?.lastSeenAt?.slice(0, 10) ?? lookbackDate(ingestLookbackDays).toISOString().slice(0, 10);
  const endDate = new Date().toISOString().slice(0, 10);
  const items: SourcePublicationPayload[] = [];
  let page = 0;
  let hasMore = true;

  while (hasMore && items.length < preprintPageSize) {
    const endpoint = `https://api.biorxiv.org/details/${source}/${startDate}/${endDate}/${page}`;
    const payload = await fetchJson<{
      collection?: Array<Record<string, unknown>>;
      messages?: Array<Record<string, unknown>>;
    }>(endpoint);
    const collection = payload.collection ?? [];
    hasMore = collection.length > 0 && collection.length >= 100;

    for (const rawItem of collection) {
      const doi = cleanWhitespace(String(rawItem.doi ?? ""));
      const title = cleanWhitespace(String(rawItem.title ?? ""));
      const abstract = cleanWhitespace(String(rawItem.abstract ?? ""));
      const version = cleanWhitespace(String(rawItem.version ?? "1"));

      if (!doi || !title || !abstract) {
        continue;
      }

      const publishedAt = new Date(String(rawItem.date ?? new Date().toISOString())).toISOString();
      const fullTextSections = await fetchPreprintJatsXml(source, rawItem.jatsxml ? String(rawItem.jatsxml) : undefined);
      const fullText = cleanWhitespace(fullTextSections.map((section) => section.text).join(" "));
      const methodSignature = buildPublicationSignature({
        title,
        abstract,
        fullText: fullText || undefined,
      });

      const publication: PublicationRecord = {
        id: createDeterministicId("pub", `${source}:${doi}`),
        source,
        sourceId: `${doi}v${version}`,
        doi,
        title,
        abstract,
        fullText: fullText || undefined,
        authors: parsePreprintAuthors(String(rawItem.authors ?? "")),
        venue: cleanWhitespace(String(rawItem.category ?? "")) || `${source} preprint`,
        publishedAt,
        updatedAt: publishedAt,
        peerReviewStatus: "preprint",
        sourceQualityTier: "preprint_not_peer_reviewed",
        url: buildPreprintUrl(source, doi, version),
        contentCoverage: (fullText ? "full_text" : "abstract_only") satisfies ContentCoverage,
        methodSignature,
        metadata: {
          version,
          category: rawItem.category ?? null,
          publishedJournalDoi: rawItem.published ?? null,
        },
      };

      if (!matchesBroadInterest(publication, context.profiles, context.projectsByProfile)) {
        continue;
      }

      const sections =
        fullTextSections.length > 0
          ? fullTextSections
          : [{ section: "Abstract", text: abstract }];

      items.push({
        publication,
        chunks: buildChunks(publication.id, sections).map((chunk) => ({
          ...chunk,
          embedding: chunk.embedding.length
            ? chunk.embedding
            : buildHashedEmbedding(`${chunk.section} ${chunk.text}`, vectorDimensions),
        })),
      });

      if (items.length >= preprintPageSize) {
        break;
      }
    }

    page += 100;
  }

  const latest = items
    .map((item) => item.publication)
    .sort((left, right) => right.publishedAt.localeCompare(left.publishedAt))[0];

  return {
    source,
    items,
    cursor: latest
      ? {
          source,
          lastSeenAt: latest.publishedAt,
          lastSeenExternalId: latest.doi ?? latest.id,
        }
      : cursor,
  };
}

export async function fetchSourcePublications(
  source: ResearchSource,
  context: SourceFetchContext,
  cursor: IngestCursor | null,
): Promise<SourceFetchResult> {
  if (source === "pubmed") {
    return await fetchPubMedSource(context, cursor);
  }

  return await fetchPreprintSource(source, context, cursor);
}

export function buildFallbackPublication(
  title: string,
  abstract: string,
): PublicationRecord {
  return {
    id: createDeterministicId("pub", `${title}:${abstract.slice(0, 64)}`),
    source: "pubmed",
    sourceId: createDeterministicId("source", title),
    title,
    abstract,
    authors: [],
    venue: "Unknown venue",
    publishedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    peerReviewStatus: "peer_reviewed",
    sourceQualityTier: "peer_reviewed_indexed",
    url: "",
    contentCoverage: "abstract_only",
    methodSignature: emptyMethodSignature(),
  };
}
