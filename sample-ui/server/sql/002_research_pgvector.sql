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
  embedding VECTOR(64) NOT NULL,
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
  embedding VECTOR(64) NOT NULL,
  chunk_order INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS publication_chunks_publication_idx
  ON publication_chunks (publication_id, chunk_order);
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
