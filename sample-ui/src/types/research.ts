export type ResearchSource = "pubmed" | "biorxiv" | "medrxiv";
export type OwnerType = "faculty" | "lab" | "department";
export type PeerReviewStatus = "peer_reviewed" | "preprint";
export type SourceQualityTier =
  | "peer_reviewed_indexed"
  | "preprint_not_peer_reviewed";
export type ContentCoverage = "full_text" | "abstract_only";
export type DigestStatus = "generated" | "superseded";
export type DigestSectionKey =
  | "direct_project_matches"
  | "method_matches_across_domains"
  | "top_general_relevance"
  | "watchlist_low_confidence";

export interface ResearchProfile {
  id: string;
  ownerType: OwnerType;
  ownerName: string;
  labName: string;
  keywords: string[];
  excludedTerms: string[];
  methodInterests: string[];
  domainInterests: string[];
  digestDayOfWeek: string;
  digestTimeLocal: string;
  timezone: string;
  sources: ResearchSource[];
  createdAt: string;
  updatedAt: string;
}

export interface InstitutionalProject {
  id: string;
  profileId: string;
  name: string;
  summary: string;
  methods: string[];
  modalities: string[];
  seedPapers: string[];
  aliases: string[];
  createdAt: string;
  updatedAt: string;
}

export interface MethodSignature {
  approachFamily: string[];
  representation: string[];
  objective: string[];
  dataModality: string[];
  evaluationStyle: string[];
  toolingHints: string[];
}

export interface PublicationAuthor {
  given: string;
  family: string;
  displayName: string;
}

export interface PublicationRecord {
  id: string;
  source: ResearchSource;
  sourceId: string;
  doi?: string;
  pmid?: string;
  title: string;
  abstract: string;
  fullText?: string;
  authors: PublicationAuthor[];
  venue: string;
  publishedAt: string;
  updatedAt: string;
  peerReviewStatus: PeerReviewStatus;
  sourceQualityTier: SourceQualityTier;
  url: string;
  contentCoverage: ContentCoverage;
  methodSignature: MethodSignature;
  metadata?: Record<string, unknown>;
}

export interface PublicationChunk {
  id: string;
  publicationId: string;
  section: string;
  text: string;
  embedding: number[];
  chunkOrder: number;
}

export interface RelevanceAssessment {
  id: string;
  publicationId: string;
  profileId: string;
  finalScore: number;
  methodSimilarity: number;
  projectSimilarity: number;
  topicSimilarity: number;
  sourceQualityScore: number;
  recencyScore: number;
  crossDomainMethodMatch: boolean;
  matchedProjectIds: string[];
  reasonCodes: string[];
  rationale: string;
  assessedAt: string;
}

export interface PaperSummaryCitation {
  chunkId: string;
  section: string;
  excerpt: string;
}

export interface PaperSummary {
  overview: string;
  methods: string;
  findings: string;
  limitations: string;
  whyRelevant: string;
  sourceQualityNote: string;
  citations: PaperSummaryCitation[];
}

export interface DigestSection {
  key: DigestSectionKey;
  title: string;
  description: string;
  entryIds: string[];
}

export interface WeeklyDigest {
  id: string;
  profileId: string;
  weekStart: string;
  generatedAt: string;
  summary: string;
  sections: DigestSection[];
  status: DigestStatus;
}

export interface DigestEntry {
  id: string;
  digestId: string;
  publicationId: string;
  finalScore: number;
  reasonCodes: string[];
  matchedProjects: string[];
  peerReviewStatus: PeerReviewStatus;
  contentCoverage: ContentCoverage;
  sectionKey: DigestSectionKey;
  paperSummary: PaperSummary;
  rankOrder: number;
}

export interface ResearchProfileSummary {
  profile: ResearchProfile;
  projectCount: number;
  digestCount: number;
  latestDigest: WeeklyDigest | null;
}

export interface ResearchProfilesResponse {
  items: ResearchProfileSummary[];
}

export interface ResearchProfileDetail {
  profile: ResearchProfile;
  projects: InstitutionalProject[];
  recentDigests: WeeklyDigest[];
}

export interface ResearchProfileDigestsResponse {
  profile: ResearchProfile;
  items: WeeklyDigest[];
}

export interface ResearchDigestDetail extends WeeklyDigest {
  profile: ResearchProfile;
  projects: InstitutionalProject[];
  entries: Array<
    DigestEntry & {
      publication: PublicationRecord;
      assessment: RelevanceAssessment;
    }
  >;
}

export interface PublicationDetail {
  publication: PublicationRecord;
  chunks: PublicationChunk[];
  assessments: RelevanceAssessment[];
}

export interface CreateResearchProfileInput {
  ownerType: OwnerType;
  ownerName: string;
  labName: string;
  keywords: string[];
  excludedTerms: string[];
  methodInterests: string[];
  domainInterests: string[];
  digestDayOfWeek?: string;
  digestTimeLocal?: string;
  timezone?: string;
  sources?: ResearchSource[];
}

export interface UpdateResearchProfileInput {
  ownerType?: OwnerType;
  ownerName?: string;
  labName?: string;
  keywords?: string[];
  excludedTerms?: string[];
  methodInterests?: string[];
  domainInterests?: string[];
  digestDayOfWeek?: string;
  digestTimeLocal?: string;
  timezone?: string;
  sources?: ResearchSource[];
}

export interface CreateInstitutionalProjectInput {
  name: string;
  summary: string;
  methods: string[];
  modalities: string[];
  seedPapers: string[];
  aliases: string[];
}

export interface IngestRunResult {
  startedAt: string;
  sources: Array<{
    source: ResearchSource;
    publicationCount: number;
    cursorUpdatedTo: string;
  }>;
  totalPublicationCount: number;
}

export interface RecomputeResult {
  profileId?: string;
  assessmentCount: number;
  publicationCount: number;
  crossDomainMatchCount: number;
}

export interface GenerateDigestInput {
  profileId?: string;
  weekStart?: string;
}

export interface GenerateDigestResult {
  generatedCount: number;
  digests: WeeklyDigest[];
}
