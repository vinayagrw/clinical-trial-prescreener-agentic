create extension if not exists vector;

create table if not exists clinical_documents (
  id text primary key,
  patient_id text not null,
  encounter_id text not null,
  service text not null,
  author text not null,
  doc_type text not null,
  authored_at timestamptz not null,
  amended_at timestamptz,
  source_system text not null,
  source_id text not null,
  raw_text text not null,
  structured_payload jsonb,
  document_hash text not null,
  embedding vector(1536)
);

create index if not exists clinical_documents_patient_idx
  on clinical_documents (patient_id, encounter_id, authored_at desc);

create table if not exists clinical_facts (
  id text primary key,
  patient_id text not null,
  encounter_id text not null,
  topic text not null,
  assertion text not null,
  polarity text not null,
  certainty text not null,
  value text,
  source_doc_id text not null references clinical_documents(id),
  quoted_evidence text not null,
  authored_at timestamptz not null,
  service text not null,
  extractor text not null
);

create table if not exists handoff_runs (
  id text primary key,
  patient_id text not null,
  encounter_id text not null,
  window_hours integer not null,
  status text not null,
  generated_at timestamptz not null default now(),
  headline text not null,
  next_action text not null,
  summary jsonb not null
);

create table if not exists handoff_audit_events (
  id text primary key,
  handoff_run_id text not null references handoff_runs(id) on delete cascade,
  stage text not null,
  summary text not null,
  detail text not null,
  created_at timestamptz not null,
  metrics jsonb
);
