import { Pool } from "pg";
import { assertResearchDatabaseConfigured, getResearchConfig } from "./config.ts";
import type {
  ContentCoverage,
  CreateInstitutionalProjectInput,
  CreateResearchProfileInput,
  DigestEntry,
  GenerateDigestResult,
  IngestCursor,
  InstitutionalProject,
  MethodSignature,
  PaperSummary,
  PeerReviewStatus,
  PublicationChunk,
  PublicationDetail,
  PublicationRecord,
  RelevanceAssessment,
  ResearchDigestDetail,
  ResearchProfile,
  ResearchProfileDetail,
  SourceQualityTier,
  UpdateResearchProfileInput,
  WeeklyDigest,
} from "./types.ts";
import { createId, formatVectorLiteral } from "./utils.ts";

export interface StoredPublication extends PublicationRecord {
  embedding: number[];
}

let poolSingleton: Pool | null = null;
let schemaEnsured = false;

function getResearchSchemaSql(): string {
  const { vectorDimensions } = getResearchConfig();
  return `
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS research_profiles (
  id TEXT PRIMARY KEY,
  owner_type TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  lab_name TEXT NOT NULL,
  keywords JSONB NOT NULL DEFAULT '[]'::jsonb,
  excluded_terms JSONB NOT NULL DEFAULT '[]'::jsonb,
  method_interests JSONB NOT NULL DEFAULT '[]'::jsonb,
  domain_interests JSONB NOT NULL DEFAULT '[]'::jsonb,
  digest_day_of_week TEXT NOT NULL,
  digest_time_local TEXT NOT NULL,
  timezone TEXT NOT NULL,
  sources JSONB NOT NULL DEFAULT '["pubmed","biorxiv","medrxiv"]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS institutional_projects (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES research_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  summary TEXT NOT NULL,
  methods JSONB NOT NULL DEFAULT '[]'::jsonb,
  modalities JSONB NOT NULL DEFAULT '[]'::jsonb,
  seed_papers JSONB NOT NULL DEFAULT '[]'::jsonb,
  aliases JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS ingest_cursors (
  source TEXT PRIMARY KEY,
  last_seen_at TIMESTAMPTZ NOT NULL,
  last_seen_external_id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS publication_records (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  source_id TEXT NOT NULL,
  doi TEXT,
  pmid TEXT,
  title TEXT NOT NULL,
  abstract TEXT NOT NULL,
  full_text TEXT,
  authors JSONB NOT NULL DEFAULT '[]'::jsonb,
  venue TEXT NOT NULL,
  published_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  peer_review_status TEXT NOT NULL,
  source_quality_tier TEXT NOT NULL,
  url TEXT NOT NULL,
  content_coverage TEXT NOT NULL,
  method_signature JSONB NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  embedding VECTOR(${vectorDimensions}) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT publication_records_source_unique UNIQUE (source, source_id)
);

CREATE INDEX IF NOT EXISTS publication_records_doi_idx ON publication_records (doi);
CREATE INDEX IF NOT EXISTS publication_records_pmid_idx ON publication_records (pmid);
CREATE INDEX IF NOT EXISTS publication_records_published_idx ON publication_records (published_at DESC);
CREATE INDEX IF NOT EXISTS publication_records_embedding_idx
  ON publication_records USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE TABLE IF NOT EXISTS publication_chunks (
  id TEXT PRIMARY KEY,
  publication_id TEXT NOT NULL REFERENCES publication_records(id) ON DELETE CASCADE,
  section TEXT NOT NULL,
  text TEXT NOT NULL,
  embedding VECTOR(${vectorDimensions}) NOT NULL,
  chunk_order INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS publication_chunks_publication_idx ON publication_chunks (publication_id, chunk_order);
CREATE INDEX IF NOT EXISTS publication_chunks_embedding_idx
  ON publication_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE TABLE IF NOT EXISTS relevance_assessments (
  id TEXT PRIMARY KEY,
  publication_id TEXT NOT NULL REFERENCES publication_records(id) ON DELETE CASCADE,
  profile_id TEXT NOT NULL REFERENCES research_profiles(id) ON DELETE CASCADE,
  final_score DOUBLE PRECISION NOT NULL,
  method_similarity DOUBLE PRECISION NOT NULL,
  project_similarity DOUBLE PRECISION NOT NULL,
  topic_similarity DOUBLE PRECISION NOT NULL,
  source_quality_score DOUBLE PRECISION NOT NULL,
  recency_score DOUBLE PRECISION NOT NULL,
  cross_domain_method_match BOOLEAN NOT NULL DEFAULT FALSE,
  matched_project_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  reason_codes JSONB NOT NULL DEFAULT '[]'::jsonb,
  rationale TEXT NOT NULL,
  assessed_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT relevance_assessments_unique UNIQUE (publication_id, profile_id)
);

CREATE INDEX IF NOT EXISTS relevance_assessments_profile_idx
  ON relevance_assessments (profile_id, final_score DESC, assessed_at DESC);

CREATE TABLE IF NOT EXISTS weekly_digests (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES research_profiles(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL,
  summary TEXT NOT NULL,
  sections JSONB NOT NULL,
  status TEXT NOT NULL,
  CONSTRAINT weekly_digests_profile_week_unique UNIQUE (profile_id, week_start)
);

CREATE TABLE IF NOT EXISTS digest_entries (
  id TEXT PRIMARY KEY,
  digest_id TEXT NOT NULL REFERENCES weekly_digests(id) ON DELETE CASCADE,
  publication_id TEXT NOT NULL REFERENCES publication_records(id) ON DELETE CASCADE,
  final_score DOUBLE PRECISION NOT NULL,
  reason_codes JSONB NOT NULL DEFAULT '[]'::jsonb,
  matched_projects JSONB NOT NULL DEFAULT '[]'::jsonb,
  peer_review_status TEXT NOT NULL,
  content_coverage TEXT NOT NULL,
  section_key TEXT NOT NULL,
  paper_summary JSONB NOT NULL,
  rank_order INTEGER NOT NULL,
  CONSTRAINT digest_entries_digest_publication_unique UNIQUE (digest_id, publication_id)
);
`;
}

function getPool(): Pool {
  if (poolSingleton) {
    return poolSingleton;
  }

  poolSingleton = new Pool({
    connectionString: assertResearchDatabaseConfigured(),
  });
  return poolSingleton;
}

function parseVector(value: unknown): number[] {
  if (Array.isArray(value)) {
    return value.map((item) => Number(item));
  }

  if (typeof value === "string") {
    return value
      .replace(/^\[/, "")
      .replace(/\]$/, "")
      .split(",")
      .map((item) => Number.parseFloat(item.trim()))
      .filter((item) => Number.isFinite(item));
  }

  return [];
}

function mapProfileRow(row: Record<string, unknown>): ResearchProfile {
  return {
    id: String(row.id),
    ownerType: String(row.owner_type) as ResearchProfile["ownerType"],
    ownerName: String(row.owner_name),
    labName: String(row.lab_name),
    keywords: (row.keywords as string[]) ?? [],
    excludedTerms: (row.excluded_terms as string[]) ?? [],
    methodInterests: (row.method_interests as string[]) ?? [],
    domainInterests: (row.domain_interests as string[]) ?? [],
    digestDayOfWeek: String(row.digest_day_of_week),
    digestTimeLocal: String(row.digest_time_local),
    timezone: String(row.timezone),
    sources: (row.sources as ResearchProfile["sources"]) ?? ["pubmed", "biorxiv", "medrxiv"],
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}

function mapProjectRow(row: Record<string, unknown>): InstitutionalProject {
  return {
    id: String(row.id),
    profileId: String(row.profile_id),
    name: String(row.name),
    summary: String(row.summary),
    methods: (row.methods as string[]) ?? [],
    modalities: (row.modalities as string[]) ?? [],
    seedPapers: (row.seed_papers as string[]) ?? [],
    aliases: (row.aliases as string[]) ?? [],
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}

function mapPublicationRow(row: Record<string, unknown>): StoredPublication {
  return {
    id: String(row.id),
    source: String(row.source) as PublicationRecord["source"],
    sourceId: String(row.source_id),
    doi: row.doi ? String(row.doi) : undefined,
    pmid: row.pmid ? String(row.pmid) : undefined,
    title: String(row.title),
    abstract: String(row.abstract),
    fullText: row.full_text ? String(row.full_text) : undefined,
    authors: (row.authors as PublicationRecord["authors"]) ?? [],
    venue: String(row.venue),
    publishedAt: new Date(String(row.published_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
    peerReviewStatus: String(row.peer_review_status) as PeerReviewStatus,
    sourceQualityTier: String(row.source_quality_tier) as SourceQualityTier,
    url: String(row.url),
    contentCoverage: String(row.content_coverage) as ContentCoverage,
    methodSignature: (row.method_signature as MethodSignature) ?? {
      approachFamily: [],
      representation: [],
      objective: [],
      dataModality: [],
      evaluationStyle: [],
      toolingHints: [],
    },
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    embedding: parseVector(row.embedding),
  };
}

function mapChunkRow(row: Record<string, unknown>): PublicationChunk {
  return {
    id: String(row.id),
    publicationId: String(row.publication_id),
    section: String(row.section),
    text: String(row.text),
    embedding: parseVector(row.embedding),
    chunkOrder: Number(row.chunk_order),
  };
}

function mapAssessmentRow(row: Record<string, unknown>): RelevanceAssessment {
  return {
    id: String(row.id),
    publicationId: String(row.publication_id),
    profileId: String(row.profile_id),
    finalScore: Number(row.final_score),
    methodSimilarity: Number(row.method_similarity),
    projectSimilarity: Number(row.project_similarity),
    topicSimilarity: Number(row.topic_similarity),
    sourceQualityScore: Number(row.source_quality_score),
    recencyScore: Number(row.recency_score),
    crossDomainMethodMatch: Boolean(row.cross_domain_method_match),
    matchedProjectIds: (row.matched_project_ids as string[]) ?? [],
    reasonCodes: (row.reason_codes as string[]) ?? [],
    rationale: String(row.rationale),
    assessedAt: new Date(String(row.assessed_at)).toISOString(),
  };
}

function mapDigestRow(row: Record<string, unknown>): WeeklyDigest {
  return {
    id: String(row.id),
    profileId: String(row.profile_id),
    weekStart: String(row.week_start),
    generatedAt: new Date(String(row.generated_at)).toISOString(),
    summary: String(row.summary),
    sections: (row.sections as WeeklyDigest["sections"]) ?? [],
    status: String(row.status) as WeeklyDigest["status"],
  };
}

function mapDigestEntryRow(row: Record<string, unknown>): DigestEntry {
  return {
    id: String(row.id),
    digestId: String(row.digest_id),
    publicationId: String(row.publication_id),
    finalScore: Number(row.final_score),
    reasonCodes: (row.reason_codes as string[]) ?? [],
    matchedProjects: (row.matched_projects as string[]) ?? [],
    peerReviewStatus: String(row.peer_review_status) as PeerReviewStatus,
    contentCoverage: String(row.content_coverage) as ContentCoverage,
    sectionKey: String(row.section_key) as DigestEntry["sectionKey"],
    paperSummary: row.paper_summary as PaperSummary,
    rankOrder: Number(row.rank_order),
  };
}

export async function ensureResearchSchema(): Promise<void> {
  if (schemaEnsured) {
    return;
  }

  const pool = getPool();
  await pool.query(getResearchSchemaSql());
  schemaEnsured = true;
}

export async function listResearchProfiles(): Promise<ResearchProfile[]> {
  await ensureResearchSchema();
  const result = await getPool().query("SELECT * FROM research_profiles ORDER BY owner_name ASC");
  return result.rows.map(mapProfileRow);
}

export async function createResearchProfile(input: CreateResearchProfileInput): Promise<ResearchProfile> {
  await ensureResearchSchema();
  const id = createId("profile");
  const now = new Date().toISOString();
  const result = await getPool().query(
    `INSERT INTO research_profiles (
      id, owner_type, owner_name, lab_name, keywords, excluded_terms,
      method_interests, domain_interests, digest_day_of_week, digest_time_local,
      timezone, sources, created_at, updated_at
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14
    ) RETURNING *`,
    [
      id,
      input.ownerType,
      input.ownerName,
      input.labName,
      JSON.stringify(input.keywords),
      JSON.stringify(input.excludedTerms),
      JSON.stringify(input.methodInterests),
      JSON.stringify(input.domainInterests),
      input.digestDayOfWeek ?? "Monday",
      input.digestTimeLocal ?? "06:00",
      input.timezone ?? "America/Chicago",
      JSON.stringify(input.sources ?? ["pubmed", "biorxiv", "medrxiv"]),
      now,
      now,
    ],
  );
  return mapProfileRow(result.rows[0]);
}

export async function getResearchProfile(profileId: string): Promise<ResearchProfile | null> {
  await ensureResearchSchema();
  const result = await getPool().query(
    "SELECT * FROM research_profiles WHERE id = $1",
    [profileId],
  );
  return result.rows[0] ? mapProfileRow(result.rows[0]) : null;
}

export async function updateResearchProfile(
  profileId: string,
  input: UpdateResearchProfileInput,
): Promise<ResearchProfile | null> {
  await ensureResearchSchema();
  const current = await getResearchProfile(profileId);
  if (!current) {
    return null;
  }

  const next = {
    ...current,
    ...input,
    updatedAt: new Date().toISOString(),
  };

  const result = await getPool().query(
    `UPDATE research_profiles
     SET owner_type = $2,
         owner_name = $3,
         lab_name = $4,
         keywords = $5,
         excluded_terms = $6,
         method_interests = $7,
         domain_interests = $8,
         digest_day_of_week = $9,
         digest_time_local = $10,
         timezone = $11,
         sources = $12,
         updated_at = $13
     WHERE id = $1
     RETURNING *`,
    [
      profileId,
      next.ownerType,
      next.ownerName,
      next.labName,
      JSON.stringify(next.keywords),
      JSON.stringify(next.excludedTerms),
      JSON.stringify(next.methodInterests),
      JSON.stringify(next.domainInterests),
      next.digestDayOfWeek,
      next.digestTimeLocal,
      next.timezone,
      JSON.stringify(next.sources),
      next.updatedAt,
    ],
  );

  return mapProfileRow(result.rows[0]);
}

export async function listInstitutionalProjects(profileId: string): Promise<InstitutionalProject[]> {
  await ensureResearchSchema();
  const result = await getPool().query(
    "SELECT * FROM institutional_projects WHERE profile_id = $1 ORDER BY created_at ASC",
    [profileId],
  );
  return result.rows.map(mapProjectRow);
}

export async function createInstitutionalProject(
  profileId: string,
  input: CreateInstitutionalProjectInput,
): Promise<InstitutionalProject> {
  await ensureResearchSchema();
  const id = createId("project");
  const now = new Date().toISOString();
  const result = await getPool().query(
    `INSERT INTO institutional_projects (
      id, profile_id, name, summary, methods, modalities, seed_papers, aliases, created_at, updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    RETURNING *`,
    [
      id,
      profileId,
      input.name,
      input.summary,
      JSON.stringify(input.methods),
      JSON.stringify(input.modalities),
      JSON.stringify(input.seedPapers),
      JSON.stringify(input.aliases),
      now,
      now,
    ],
  );
  return mapProjectRow(result.rows[0]);
}

export async function upsertIngestCursor(cursor: IngestCursor): Promise<void> {
  await ensureResearchSchema();
  await getPool().query(
    `INSERT INTO ingest_cursors (source, last_seen_at, last_seen_external_id)
     VALUES ($1,$2,$3)
     ON CONFLICT (source)
     DO UPDATE SET last_seen_at = EXCLUDED.last_seen_at,
                   last_seen_external_id = EXCLUDED.last_seen_external_id`,
    [cursor.source, cursor.lastSeenAt, cursor.lastSeenExternalId],
  );
}

export async function getIngestCursor(source: IngestCursor["source"]): Promise<IngestCursor | null> {
  await ensureResearchSchema();
  const result = await getPool().query(
    "SELECT * FROM ingest_cursors WHERE source = $1",
    [source],
  );
  if (!result.rows[0]) return null;
  return {
    source,
    lastSeenAt: new Date(String(result.rows[0].last_seen_at)).toISOString(),
    lastSeenExternalId: String(result.rows[0].last_seen_external_id),
  };
}

export async function upsertPublication(
  publication: PublicationRecord,
  embedding: number[],
): Promise<StoredPublication> {
  await ensureResearchSchema();
  const pool = getPool();
  const existing = publication.doi
    ? await pool.query("SELECT * FROM publication_records WHERE doi = $1 LIMIT 1", [publication.doi])
    : publication.pmid
      ? await pool.query("SELECT * FROM publication_records WHERE pmid = $1 LIMIT 1", [publication.pmid])
      : await pool.query(
          "SELECT * FROM publication_records WHERE source = $1 AND source_id = $2 LIMIT 1",
          [publication.source, publication.sourceId],
        );

  const id = existing.rows[0]?.id ? String(existing.rows[0].id) : publication.id;
  const result = await pool.query(
    `INSERT INTO publication_records (
      id, source, source_id, doi, pmid, title, abstract, full_text, authors, venue,
      published_at, updated_at, peer_review_status, source_quality_tier, url,
      content_coverage, method_signature, metadata, embedding, created_at
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
      $11,$12,$13,$14,$15,$16,$17,$18,$19::vector,$20
    )
    ON CONFLICT (id)
    DO UPDATE SET
      source = EXCLUDED.source,
      source_id = EXCLUDED.source_id,
      doi = COALESCE(EXCLUDED.doi, publication_records.doi),
      pmid = COALESCE(EXCLUDED.pmid, publication_records.pmid),
      title = EXCLUDED.title,
      abstract = EXCLUDED.abstract,
      full_text = EXCLUDED.full_text,
      authors = EXCLUDED.authors,
      venue = EXCLUDED.venue,
      published_at = EXCLUDED.published_at,
      updated_at = EXCLUDED.updated_at,
      peer_review_status = EXCLUDED.peer_review_status,
      source_quality_tier = EXCLUDED.source_quality_tier,
      url = EXCLUDED.url,
      content_coverage = EXCLUDED.content_coverage,
      method_signature = EXCLUDED.method_signature,
      metadata = EXCLUDED.metadata,
      embedding = EXCLUDED.embedding
    RETURNING *`,
    [
      id,
      publication.source,
      publication.sourceId,
      publication.doi ?? null,
      publication.pmid ?? null,
      publication.title,
      publication.abstract,
      publication.fullText ?? null,
      JSON.stringify(publication.authors),
      publication.venue,
      publication.publishedAt,
      publication.updatedAt,
      publication.peerReviewStatus,
      publication.sourceQualityTier,
      publication.url,
      publication.contentCoverage,
      JSON.stringify(publication.methodSignature),
      JSON.stringify(publication.metadata ?? {}),
      formatVectorLiteral(embedding),
      publication.updatedAt,
    ],
  );

  return mapPublicationRow(result.rows[0]);
}

export async function replacePublicationChunks(
  publicationId: string,
  chunks: PublicationChunk[],
): Promise<void> {
  await ensureResearchSchema();
  const pool = getPool();
  await pool.query("DELETE FROM publication_chunks WHERE publication_id = $1", [publicationId]);

  for (const chunk of chunks) {
    await pool.query(
      `INSERT INTO publication_chunks (id, publication_id, section, text, embedding, chunk_order)
       VALUES ($1,$2,$3,$4,$5::vector,$6)`,
      [
        chunk.id,
        publicationId,
        chunk.section,
        chunk.text,
        formatVectorLiteral(chunk.embedding),
        chunk.chunkOrder,
      ],
    );
  }
}

export async function listStoredPublications(): Promise<StoredPublication[]> {
  await ensureResearchSchema();
  const result = await getPool().query(
    "SELECT * FROM publication_records ORDER BY published_at DESC",
  );
  return result.rows.map(mapPublicationRow);
}

export async function getStoredPublication(publicationId: string): Promise<StoredPublication | null> {
  await ensureResearchSchema();
  const result = await getPool().query(
    "SELECT * FROM publication_records WHERE id = $1",
    [publicationId],
  );
  return result.rows[0] ? mapPublicationRow(result.rows[0]) : null;
}

export async function listPublicationChunks(publicationId: string): Promise<PublicationChunk[]> {
  await ensureResearchSchema();
  const result = await getPool().query(
    "SELECT * FROM publication_chunks WHERE publication_id = $1 ORDER BY chunk_order ASC",
    [publicationId],
  );
  return result.rows.map(mapChunkRow);
}

export async function upsertRelevanceAssessment(
  assessment: RelevanceAssessment,
): Promise<RelevanceAssessment> {
  await ensureResearchSchema();
  const result = await getPool().query(
    `INSERT INTO relevance_assessments (
      id, publication_id, profile_id, final_score, method_similarity, project_similarity,
      topic_similarity, source_quality_score, recency_score, cross_domain_method_match,
      matched_project_ids, reason_codes, rationale, assessed_at
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14
    )
    ON CONFLICT (publication_id, profile_id)
    DO UPDATE SET
      final_score = EXCLUDED.final_score,
      method_similarity = EXCLUDED.method_similarity,
      project_similarity = EXCLUDED.project_similarity,
      topic_similarity = EXCLUDED.topic_similarity,
      source_quality_score = EXCLUDED.source_quality_score,
      recency_score = EXCLUDED.recency_score,
      cross_domain_method_match = EXCLUDED.cross_domain_method_match,
      matched_project_ids = EXCLUDED.matched_project_ids,
      reason_codes = EXCLUDED.reason_codes,
      rationale = EXCLUDED.rationale,
      assessed_at = EXCLUDED.assessed_at
    RETURNING *`,
    [
      assessment.id,
      assessment.publicationId,
      assessment.profileId,
      assessment.finalScore,
      assessment.methodSimilarity,
      assessment.projectSimilarity,
      assessment.topicSimilarity,
      assessment.sourceQualityScore,
      assessment.recencyScore,
      assessment.crossDomainMethodMatch,
      JSON.stringify(assessment.matchedProjectIds),
      JSON.stringify(assessment.reasonCodes),
      assessment.rationale,
      assessment.assessedAt,
    ],
  );
  return mapAssessmentRow(result.rows[0]);
}

export async function listAssessmentsForProfile(profileId: string): Promise<RelevanceAssessment[]> {
  await ensureResearchSchema();
  const result = await getPool().query(
    "SELECT * FROM relevance_assessments WHERE profile_id = $1 ORDER BY final_score DESC, assessed_at DESC",
    [profileId],
  );
  return result.rows.map(mapAssessmentRow);
}

export async function listAssessmentsForPublication(publicationId: string): Promise<RelevanceAssessment[]> {
  await ensureResearchSchema();
  const result = await getPool().query(
    "SELECT * FROM relevance_assessments WHERE publication_id = $1 ORDER BY final_score DESC",
    [publicationId],
  );
  return result.rows.map(mapAssessmentRow);
}

export async function saveWeeklyDigest(
  digest: WeeklyDigest,
  entries: DigestEntry[],
): Promise<WeeklyDigest> {
  await ensureResearchSchema();
  const pool = getPool();
  const result = await pool.query(
    `INSERT INTO weekly_digests (id, profile_id, week_start, generated_at, summary, sections, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (profile_id, week_start)
     DO UPDATE SET generated_at = EXCLUDED.generated_at,
                   summary = EXCLUDED.summary,
                   sections = EXCLUDED.sections,
                   status = EXCLUDED.status
     RETURNING *`,
    [
      digest.id,
      digest.profileId,
      digest.weekStart,
      digest.generatedAt,
      digest.summary,
      JSON.stringify(digest.sections),
      digest.status,
    ],
  );

  const storedDigest = mapDigestRow(result.rows[0]);
  await pool.query("DELETE FROM digest_entries WHERE digest_id = $1", [storedDigest.id]);
  for (const entry of entries) {
    await pool.query(
      `INSERT INTO digest_entries (
        id, digest_id, publication_id, final_score, reason_codes, matched_projects,
        peer_review_status, content_coverage, section_key, paper_summary, rank_order
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        entry.id,
        storedDigest.id,
        entry.publicationId,
        entry.finalScore,
        JSON.stringify(entry.reasonCodes),
        JSON.stringify(entry.matchedProjects),
        entry.peerReviewStatus,
        entry.contentCoverage,
        entry.sectionKey,
        JSON.stringify(entry.paperSummary),
        entry.rankOrder,
      ],
    );
  }

  return storedDigest;
}

export async function listDigestsForProfile(profileId: string): Promise<WeeklyDigest[]> {
  await ensureResearchSchema();
  const result = await getPool().query(
    "SELECT * FROM weekly_digests WHERE profile_id = $1 ORDER BY week_start DESC, generated_at DESC",
    [profileId],
  );
  return result.rows.map(mapDigestRow);
}

export async function getDigest(digestId: string): Promise<WeeklyDigest | null> {
  await ensureResearchSchema();
  const result = await getPool().query(
    "SELECT * FROM weekly_digests WHERE id = $1",
    [digestId],
  );
  return result.rows[0] ? mapDigestRow(result.rows[0]) : null;
}

export async function listDigestEntries(digestId: string): Promise<DigestEntry[]> {
  await ensureResearchSchema();
  const result = await getPool().query(
    "SELECT * FROM digest_entries WHERE digest_id = $1 ORDER BY rank_order ASC",
    [digestId],
  );
  return result.rows.map(mapDigestEntryRow);
}

export async function getResearchProfileDetail(profileId: string): Promise<ResearchProfileDetail | null> {
  const profile = await getResearchProfile(profileId);
  if (!profile) return null;

  const [projects, recentDigests] = await Promise.all([
    listInstitutionalProjects(profileId),
    listDigestsForProfile(profileId),
  ]);

  return {
    profile,
    projects,
    recentDigests: recentDigests.slice(0, 8),
  };
}

export async function getResearchDigestDetail(digestId: string): Promise<ResearchDigestDetail | null> {
  const digest = await getDigest(digestId);
  if (!digest) return null;

  const profile = await getResearchProfile(digest.profileId);
  if (!profile) return null;

  const [projects, entries] = await Promise.all([
    listInstitutionalProjects(profile.id),
    listDigestEntries(digestId),
  ]);

  const detailedEntries = await Promise.all(
    entries.map(async (entry) => {
      const [publication, assessments] = await Promise.all([
        getStoredPublication(entry.publicationId),
        listAssessmentsForPublication(entry.publicationId),
      ]);

      if (!publication) {
        throw new Error(`Publication ${entry.publicationId} not found for digest ${digestId}.`);
      }

      const assessment = assessments.find((item) => item.profileId === profile.id);
      if (!assessment) {
        throw new Error(`Assessment missing for publication ${entry.publicationId} and profile ${profile.id}.`);
      }

      return {
        ...entry,
        publication,
        assessment,
      };
    }),
  );

  return {
    ...digest,
    profile,
    projects,
    entries: detailedEntries,
  };
}

export async function getPublicationDetail(publicationId: string): Promise<PublicationDetail | null> {
  const publication = await getStoredPublication(publicationId);
  if (!publication) return null;

  const [chunks, assessments] = await Promise.all([
    listPublicationChunks(publicationId),
    listAssessmentsForPublication(publicationId),
  ]);

  return {
    publication,
    chunks,
    assessments,
  };
}

export async function listProfilesWithProjects(): Promise<Array<{ profile: ResearchProfile; projects: InstitutionalProject[] }>> {
  const profiles = await listResearchProfiles();
  const projects = await Promise.all(
    profiles.map(async (profile) => ({
      profile,
      projects: await listInstitutionalProjects(profile.id),
    })),
  );
  return projects;
}

export async function listDigestsAcrossProfiles(): Promise<Array<{ profile: ResearchProfile; digests: WeeklyDigest[] }>> {
  const profiles = await listResearchProfiles();
  return Promise.all(
    profiles.map(async (profile) => ({
      profile,
      digests: await listDigestsForProfile(profile.id),
    })),
  );
}
