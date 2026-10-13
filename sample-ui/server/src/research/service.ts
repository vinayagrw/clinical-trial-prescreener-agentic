import { getResearchConfig } from "./config.ts";
import {
  createInstitutionalProject,
  createResearchProfile,
  getIngestCursor,
  getPublicationDetail,
  getResearchDigestDetail,
  getResearchProfileDetail,
  getStoredPublication,
  listAssessmentsForProfile,
  listDigestsAcrossProfiles,
  listDigestsForProfile,
  listInstitutionalProjects,
  listProfilesWithProjects,
  listResearchProfiles,
  listStoredPublications,
  replacePublicationChunks,
  saveWeeklyDigest,
  upsertIngestCursor,
  upsertPublication,
  upsertRelevanceAssessment,
  updateResearchProfile,
  type StoredPublication,
} from "./db.ts";
import {
  buildProfileSignature,
  computeMethodSimilarity,
  extractMethodSignatureFromText,
} from "./signature.ts";
import { fetchSourcePublications } from "./sources.ts";
import type {
  CreateInstitutionalProjectInput,
  CreateResearchProfileInput,
  DigestEntry,
  DigestSection,
  DigestSectionKey,
  GenerateDigestInput,
  GenerateDigestResult,
  IngestRunResult,
  InstitutionalProject,
  PaperSummary,
  PaperSummaryCitation,
  PublicationChunk,
  PublicationDetail,
  PublicationRecord,
  RecomputeResult,
  RelevanceAssessment,
  ResearchDigestDetail,
  ResearchProfile,
  ResearchProfileDetail,
  ResearchSource,
  UpdateResearchProfileInput,
  WeeklyDigest,
} from "./types.ts";
import {
  buildHashedEmbedding,
  clamp,
  cosineSimilarity,
  createDeterministicId,
  createId,
  daysSince,
  startOfWeekIso,
  tokenize,
  truncateText,
} from "./utils.ts";

const SECTION_METADATA: Record<
  DigestSectionKey,
  { title: string; description: string }
> = {
  direct_project_matches: {
    title: "Direct project matches",
    description: "Highest-confidence papers tied directly to active institutional projects.",
  },
  method_matches_across_domains: {
    title: "Method matches across domains",
    description: "Methodologically aligned papers surfaced even when the application domain differs.",
  },
  top_general_relevance: {
    title: "Top generally relevant papers",
    description: "Strong overall matches by topic, method, or recency for the current profile.",
  },
  watchlist_low_confidence: {
    title: "Watchlist / low-confidence",
    description: "Borderline or early-signal items worth a quick human skim.",
  },
};

function buildProfileText(
  profile: ResearchProfile,
  projects: InstitutionalProject[],
): string {
  return [
    profile.ownerName,
    profile.labName,
    profile.keywords.join(" "),
    profile.methodInterests.join(" "),
    profile.domainInterests.join(" "),
    ...projects.map((project) =>
      [
        project.name,
        project.summary,
        project.methods.join(" "),
        project.modalities.join(" "),
        project.aliases.join(" "),
      ].join(" "),
    ),
  ].join(" ");
}

function jaccard(left: string[], right: string[]): number {
  if (left.length === 0 || right.length === 0) {
    return 0;
  }

  const leftSet = new Set(left);
  const rightSet = new Set(right);
  let intersection = 0;
  for (const item of leftSet) {
    if (rightSet.has(item)) {
      intersection += 1;
    }
  }

  const union = new Set([...leftSet, ...rightSet]).size;
  return union === 0 ? 0 : intersection / union;
}

function buildPublicationText(publication: Pick<PublicationRecord, "title" | "abstract" | "fullText">): string {
  return [publication.title, publication.abstract, publication.fullText ?? ""].join(" ");
}

function computeTopicSimilarity(
  publication: PublicationRecord,
  profile: ResearchProfile,
  projects: InstitutionalProject[],
): number {
  const { vectorDimensions } = getResearchConfig();
  const profileText = buildProfileText(profile, projects);
  const publicationText = buildPublicationText(publication);

  const keywordTokens = tokenize(
    [profile.keywords.join(" "), profile.domainInterests.join(" "), projects.map((item) => item.summary).join(" ")]
      .join(" ")
      .toLowerCase(),
  );
  const publicationTokens = tokenize(publicationText);

  const lexical = jaccard(keywordTokens, publicationTokens);
  const profileVector = buildHashedEmbedding(profileText, vectorDimensions, profile.methodInterests);
  const publicationVector = buildHashedEmbedding(publicationText, vectorDimensions);
  const embeddingScore = cosineSimilarity(profileVector, publicationVector);

  return clamp(lexical * 0.55 + embeddingScore * 0.45);
}

function computeProjectSimilarity(
  publication: PublicationRecord,
  projects: InstitutionalProject[],
): { score: number; matchedProjectIds: string[] } {
  if (projects.length === 0) {
    return { score: 0, matchedProjectIds: [] };
  }

  const publicationTokens = tokenize(buildPublicationText(publication));
  const publicationSignature = publication.methodSignature;
  const matches = projects
    .map((project) => {
      const projectText = [
        project.name,
        project.summary,
        project.methods.join(" "),
        project.modalities.join(" "),
        project.aliases.join(" "),
      ].join(" ");
      const projectTokens = tokenize(projectText);
      const lexical = jaccard(projectTokens, publicationTokens);
      const projectSignature = extractMethodSignatureFromText(projectText);
      const method = computeMethodSimilarity(projectSignature, publicationSignature).score;
      const score = clamp(lexical * 0.5 + method * 0.5);
      return { projectId: project.id, score };
    })
    .sort((left, right) => right.score - left.score);

  return {
    score: matches[0]?.score ?? 0,
    matchedProjectIds: matches.filter((item) => item.score >= 0.3).slice(0, 3).map((item) => item.projectId),
  };
}

function scoreSourceQuality(publication: PublicationRecord): number {
  if (publication.sourceQualityTier === "peer_reviewed_indexed") {
    return 1;
  }

  const hasLinkedPublication = Boolean(publication.metadata?.publishedJournalDoi);
  return hasLinkedPublication ? 0.65 : 0.52;
}

function scoreRecency(publication: PublicationRecord): number {
  const ageDays = daysSince(publication.publishedAt);
  return clamp(1 - ageDays / 90, 0.12, 1);
}

function buildAssessmentRationale(
  publication: PublicationRecord,
  profile: ResearchProfile,
  projects: InstitutionalProject[],
  score: {
    methodSimilarity: number;
    projectSimilarity: number;
    topicSimilarity: number;
    sourceQualityScore: number;
    recencyScore: number;
    crossDomainMethodMatch: boolean;
    matchedProjectIds: string[];
  },
): { reasonCodes: string[]; rationale: string } {
  const reasonCodes: string[] = [];
  if (score.methodSimilarity >= 0.5) reasonCodes.push("method_overlap_high");
  if (score.projectSimilarity >= 0.35) reasonCodes.push("project_alignment");
  if (score.topicSimilarity >= 0.35) reasonCodes.push("topic_overlap");
  if (score.crossDomainMethodMatch) reasonCodes.push("cross_domain_method_match");
  if (publication.peerReviewStatus === "peer_reviewed") reasonCodes.push("peer_reviewed");
  if (publication.contentCoverage === "full_text") reasonCodes.push("full_text_analyzed");
  if (score.recencyScore >= 0.8) reasonCodes.push("recent_publication");
  if (reasonCodes.length === 0) reasonCodes.push("watchlist_candidate");

  const matchedProjectNames = projects
    .filter((project) => score.matchedProjectIds.includes(project.id))
    .map((project) => project.name);
  const rationaleParts = [
    `${publication.title} scored ${(score.methodSimilarity * 45 + score.projectSimilarity * 20 + score.topicSimilarity * 15 + score.sourceQualityScore * 10 + score.recencyScore * 10).toFixed(1)} / 100 weighted points for ${profile.ownerName}.`,
    score.methodSimilarity > 0
      ? `Method similarity is ${(score.methodSimilarity * 100).toFixed(0)}%, driven by ${publication.methodSignature.approachFamily.slice(0, 3).join(", ") || "shared modeling patterns"}.`
      : "Method similarity remained low because the paper does not share enough extracted methodological structure with the profile.",
    matchedProjectNames.length > 0
      ? `The strongest direct project links are ${matchedProjectNames.join(", ")}.`
      : "No project-specific match cleared the direct-link threshold.",
    score.crossDomainMethodMatch
      ? "This was also flagged as a cross-domain method match, meaning the technique aligns even though the application domain differs."
      : null,
    publication.peerReviewStatus === "preprint"
      ? "Source quality is discounted because the item is still a preprint."
      : "Source quality received full credit because the item is peer reviewed and indexed.",
  ]
    .filter(Boolean)
    .join(" ");

  return { reasonCodes, rationale: rationaleParts };
}

function classifyDigestSection(
  assessment: RelevanceAssessment,
): DigestSectionKey {
  if (assessment.matchedProjectIds.length > 0 && assessment.finalScore >= 0.58) {
    return "direct_project_matches";
  }

  if (assessment.crossDomainMethodMatch && assessment.methodSimilarity >= 0.45) {
    return "method_matches_across_domains";
  }

  if (assessment.finalScore >= 0.48) {
    return "top_general_relevance";
  }

  return "watchlist_low_confidence";
}

function findCitationChunks(chunks: PublicationChunk[]): PaperSummaryCitation[] {
  return chunks.slice(0, 3).map((chunk) => ({
    chunkId: chunk.id,
    section: chunk.section,
    excerpt: truncateText(chunk.text, 220),
  }));
}

function buildFallbackPaperSummary(
  publication: PublicationRecord,
  detail: PublicationDetail,
  assessment: RelevanceAssessment,
  profile: ResearchProfile,
  projects: InstitutionalProject[],
): PaperSummary {
  const citations = findCitationChunks(detail.chunks);
  const matchedProjectNames = projects
    .filter((project) => assessment.matchedProjectIds.includes(project.id))
    .map((project) => project.name);
  const abstractCitation = citations[0]?.excerpt ?? truncateText(publication.abstract, 220);
  const methodTerms =
    publication.methodSignature.approachFamily.concat(publication.methodSignature.representation).slice(0, 4);
  const methodLabel = methodTerms.length > 0 ? methodTerms.join(", ") : "methods described in the abstract";

  return {
    overview: truncateText(abstractCitation, 240),
    methods:
      publication.contentCoverage === "full_text"
        ? `Methods emphasized ${methodLabel}. Supporting text was available from the full article sections reviewed in this digest.`
        : `Method detail is limited because only the abstract was available, but the abstract points to ${methodLabel}.`,
    findings:
      citations[1]?.excerpt ??
      truncateText(
        publication.abstract,
        220,
      ),
    limitations:
      publication.contentCoverage === "full_text"
        ? "The paper was summarized from stored source sections, but the digest still requires human review before acting on the findings."
        : "Only abstract-level evidence was available, so detailed methods, subgroup analyses, and limitations may be missing.",
    whyRelevant:
      matchedProjectNames.length > 0
        ? `Relevant because it aligns with ${profile.ownerName}'s active work on ${matchedProjectNames.join(", ")} and carries a ${Math.round(assessment.methodSimilarity * 100)}% method-similarity signal.`
        : assessment.crossDomainMethodMatch
          ? `Relevant because it shares methodological structure with ${profile.ownerName}'s interests despite being in a different application domain.`
          : `Relevant because its topic and method signals overlap with ${profile.ownerName}'s configured profile.`,
    sourceQualityNote:
      publication.peerReviewStatus === "preprint"
        ? "Preprint source. Treat the digest as an early signal and verify findings before citing or operationalizing."
        : "Peer-reviewed and PubMed-indexed source.",
    citations,
  };
}

async function maybeGenerateGeminiPaperSummary(
  publication: PublicationRecord,
  detail: PublicationDetail,
  assessment: RelevanceAssessment,
  profile: ResearchProfile,
  projects: InstitutionalProject[],
): Promise<PaperSummary | null> {
  const { geminiApiKey, geminiModel } = getResearchConfig();
  if (!geminiApiKey) {
    return null;
  }

  const citations = findCitationChunks(detail.chunks);
  if (citations.length === 0) {
    return null;
  }

  const matchedProjectNames = projects
    .filter((project) => assessment.matchedProjectIds.includes(project.id))
    .map((project) => project.name);

  const prompt = [
    "You are preparing a research digest entry.",
    "Use only the cited excerpts below. Do not invent details.",
    "Return strict JSON with keys overview, methods, findings, limitations, whyRelevant, sourceQualityNote.",
    `Profile owner: ${profile.ownerName}`,
    `Lab: ${profile.labName}`,
    `Matched projects: ${matchedProjectNames.join(", ") || "none"}`,
    `Paper title: ${publication.title}`,
    `Peer review status: ${publication.peerReviewStatus}`,
    `Coverage: ${publication.contentCoverage}`,
    "Cited excerpts:",
    ...citations.map((citation) => `[${citation.chunkId}] ${citation.section}: ${citation.excerpt}`),
  ].join("\n");

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiModel)}:generateContent?key=${encodeURIComponent(geminiApiKey)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json",
          },
          contents: [
            {
              role: "user",
              parts: [{ text: prompt }],
            },
          ],
        }),
      },
    );

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>;
        };
      }>;
    };
    const rawText = payload.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      return null;
    }

    const parsed = JSON.parse(rawText) as Omit<PaperSummary, "citations">;
    if (
      typeof parsed.overview === "string" &&
      typeof parsed.methods === "string" &&
      typeof parsed.findings === "string" &&
      typeof parsed.limitations === "string" &&
      typeof parsed.whyRelevant === "string" &&
      typeof parsed.sourceQualityNote === "string"
    ) {
      return {
        ...parsed,
        citations,
      };
    }
  } catch {
    return null;
  }

  return null;
}

async function buildPaperSummary(
  publication: PublicationRecord,
  detail: PublicationDetail,
  assessment: RelevanceAssessment,
  profile: ResearchProfile,
  projects: InstitutionalProject[],
): Promise<PaperSummary> {
  return (
    (await maybeGenerateGeminiPaperSummary(publication, detail, assessment, profile, projects)) ??
    buildFallbackPaperSummary(publication, detail, assessment, profile, projects)
  );
}

function buildDigestSummary(
  profile: ResearchProfile,
  entries: Array<{ assessment: RelevanceAssessment; publication: PublicationRecord }>,
): string {
  if (entries.length === 0) {
    return `No new papers cleared the digest threshold for ${profile.ownerName} this week.`;
  }

  const directMatches = entries.filter((entry) => entry.assessment.matchedProjectIds.length > 0).length;
  const crossDomain = entries.filter((entry) => entry.assessment.crossDomainMethodMatch).length;
  const preprints = entries.filter((entry) => entry.publication.peerReviewStatus === "preprint").length;
  return `${entries.length} papers were included for ${profile.ownerName}; ${directMatches} mapped directly to active projects, ${crossDomain} were flagged as cross-domain method matches, and ${preprints} remain preprints requiring extra caution.`;
}

async function hydratePublicationMap(): Promise<Map<string, StoredPublication>> {
  const publications = await listStoredPublications();
  return new Map(publications.map((publication) => [publication.id, publication]));
}

export async function listResearchProfilesWithSummary(): Promise<
  Array<{
    profile: ResearchProfile;
    projectCount: number;
    digestCount: number;
    latestDigest: WeeklyDigest | null;
  }>
> {
  const rows = await Promise.all(
    (await listProfilesWithProjects()).map(async ({ profile, projects }) => {
      const digests = await listDigestsForProfile(profile.id);
      return {
        profile,
        projectCount: projects.length,
        digestCount: digests.length,
        latestDigest: digests[0] ?? null,
      };
    }),
  );

  return rows.sort((left, right) => left.profile.ownerName.localeCompare(right.profile.ownerName));
}

export async function createResearchProfileRecord(
  input: CreateResearchProfileInput,
): Promise<ResearchProfile> {
  return await createResearchProfile(input);
}

export async function updateResearchProfileRecord(
  profileId: string,
  input: UpdateResearchProfileInput,
): Promise<ResearchProfile | null> {
  return await updateResearchProfile(profileId, input);
}

export async function createInstitutionalProjectRecord(
  profileId: string,
  input: CreateInstitutionalProjectInput,
): Promise<InstitutionalProject> {
  return await createInstitutionalProject(profileId, input);
}

export async function getResearchProfileRecord(
  profileId: string,
): Promise<ResearchProfileDetail | null> {
  return await getResearchProfileDetail(profileId);
}

export async function getResearchDigestRecord(
  digestId: string,
): Promise<ResearchDigestDetail | null> {
  return await getResearchDigestDetail(digestId);
}

export async function runResearchIngest(profileId?: string): Promise<IngestRunResult> {
  const profiles = profileId
    ? (await listResearchProfiles()).filter((profile) => profile.id === profileId)
    : await listResearchProfiles();

  const startedAt = new Date().toISOString();
  if (profiles.length === 0) {
    return {
      startedAt,
      sources: [],
      totalPublicationCount: 0,
    };
  }

  const projectsByProfile = Object.fromEntries(
    await Promise.all(
      profiles.map(async (profile) => [profile.id, await listInstitutionalProjects(profile.id)] as const),
    ),
  );
  const activeSources = [...new Set(profiles.flatMap((profile) => profile.sources))];
  const sourceResults: IngestRunResult["sources"] = [];
  let totalPublicationCount = 0;

  for (const source of activeSources) {
    const cursor = await getIngestCursor(source);
    const result = await fetchSourcePublications(
      source,
      { profiles, projectsByProfile },
      cursor,
    );

    for (const item of result.items) {
      const embedding = buildHashedEmbedding(
        buildPublicationText(item.publication),
        getResearchConfig().vectorDimensions,
        item.publication.methodSignature.approachFamily,
      );
      const stored = await upsertPublication(item.publication, embedding);
      await replacePublicationChunks(
        stored.id,
        item.chunks.map((chunk) => ({
          ...chunk,
          publicationId: stored.id,
        })),
      );
    }

    if (result.cursor) {
      await upsertIngestCursor(result.cursor);
    }

    totalPublicationCount += result.items.length;
    sourceResults.push({
      source,
      publicationCount: result.items.length,
      cursorUpdatedTo: result.cursor?.lastSeenAt ?? cursor?.lastSeenAt ?? startedAt,
    });
  }

  return {
    startedAt,
    sources: sourceResults,
    totalPublicationCount,
  };
}

export async function recomputeResearchRelevance(profileId?: string): Promise<RecomputeResult> {
  const profiles = profileId
    ? (await listResearchProfiles()).filter((profile) => profile.id === profileId)
    : await listResearchProfiles();
  const publications = await listStoredPublications();

  let assessmentCount = 0;
  let crossDomainMatchCount = 0;

  for (const profile of profiles) {
    const projects = await listInstitutionalProjects(profile.id);
    const profileSignature = buildProfileSignature(profile, projects);
    const profileEmbedding = buildHashedEmbedding(
      buildProfileText(profile, projects),
      getResearchConfig().vectorDimensions,
      profile.methodInterests,
    );

    for (const publication of publications) {
      if (!profile.sources.includes(publication.source)) {
        continue;
      }

      const method = computeMethodSimilarity(profileSignature, publication.methodSignature);
      const project = computeProjectSimilarity(publication, projects);
      const topic = computeTopicSimilarity(publication, profile, projects);
      const sourceQualityScore = scoreSourceQuality(publication);
      const recencyScore = scoreRecency(publication);
      const publicationEmbedding = publication.embedding.length
        ? publication.embedding
        : buildHashedEmbedding(buildPublicationText(publication), getResearchConfig().vectorDimensions);
      const embeddingBonus = Math.max(0, cosineSimilarity(profileEmbedding, publicationEmbedding)) * 0.05;
      const finalScore = clamp(
        method.score * 0.45 +
          project.score * 0.2 +
          topic * 0.15 +
          sourceQualityScore * 0.1 +
          recencyScore * 0.1 +
          embeddingBonus,
      );

      const scoreBreakdown = {
        methodSimilarity: method.score,
        projectSimilarity: project.score,
        topicSimilarity: topic,
        sourceQualityScore,
        recencyScore,
        crossDomainMethodMatch: method.crossDomain,
        matchedProjectIds: project.matchedProjectIds,
      };
      const rationale = buildAssessmentRationale(publication, profile, projects, scoreBreakdown);

      await upsertRelevanceAssessment({
        id: createDeterministicId("assessment", `${publication.id}:${profile.id}`),
        publicationId: publication.id,
        profileId: profile.id,
        finalScore,
        methodSimilarity: method.score,
        projectSimilarity: project.score,
        topicSimilarity: topic,
        sourceQualityScore,
        recencyScore,
        crossDomainMethodMatch: method.crossDomain,
        matchedProjectIds: project.matchedProjectIds,
        reasonCodes: rationale.reasonCodes,
        rationale: rationale.rationale,
        assessedAt: new Date().toISOString(),
      });

      assessmentCount += 1;
      if (method.crossDomain) {
        crossDomainMatchCount += 1;
      }
    }
  }

  return {
    profileId,
    assessmentCount,
    publicationCount: publications.length,
    crossDomainMatchCount,
  };
}

export async function generateResearchDigests(
  input: GenerateDigestInput = {},
): Promise<GenerateDigestResult> {
  const targetProfiles = input.profileId
    ? (await listResearchProfiles()).filter((profile) => profile.id === input.profileId)
    : await listResearchProfiles();
  const weekStart = input.weekStart ?? startOfWeekIso();
  const publicationMap = await hydratePublicationMap();
  const digests: WeeklyDigest[] = [];

  for (const profile of targetProfiles) {
    const [projects, assessments] = await Promise.all([
      listInstitutionalProjects(profile.id),
      listAssessmentsForProfile(profile.id),
    ]);

    const candidateAssessments = assessments
      .filter((assessment) => assessment.finalScore >= 0.2)
      .slice(0, 24);

    const builtEntries: Array<DigestEntry & { publication: PublicationRecord; assessment: RelevanceAssessment }> = [];
    let rankOrder = 0;

    for (const assessment of candidateAssessments) {
      const publication = publicationMap.get(assessment.publicationId);
      if (!publication) {
        continue;
      }

      const detail = await getPublicationDetail(publication.id);
      if (!detail) {
        continue;
      }

      const paperSummary = await buildPaperSummary(publication, detail, assessment, profile, projects);
      const sectionKey = classifyDigestSection(assessment);

      builtEntries.push({
        id: createId("digest-entry"),
        digestId: "",
        publicationId: publication.id,
        finalScore: assessment.finalScore,
        reasonCodes: assessment.reasonCodes,
        matchedProjects: assessment.matchedProjectIds,
        peerReviewStatus: publication.peerReviewStatus,
        contentCoverage: publication.contentCoverage,
        sectionKey,
        paperSummary,
        rankOrder,
        publication,
        assessment,
      });
      rankOrder += 1;
    }

    const sectionEntryIds = new Map<DigestSectionKey, string[]>(
      Object.keys(SECTION_METADATA).map((key) => [key as DigestSectionKey, []]),
    );

    for (const entry of builtEntries) {
      sectionEntryIds.get(entry.sectionKey)?.push(entry.id);
    }

    const sections: DigestSection[] = (Object.keys(SECTION_METADATA) as DigestSectionKey[])
      .map((key) => ({
        key,
        title: SECTION_METADATA[key].title,
        description: SECTION_METADATA[key].description,
        entryIds: sectionEntryIds.get(key) ?? [],
      }))
      .filter((section) => section.entryIds.length > 0);

    const digest: WeeklyDigest = {
      id: createId("digest"),
      profileId: profile.id,
      weekStart,
      generatedAt: new Date().toISOString(),
      summary: buildDigestSummary(profile, builtEntries),
      sections,
      status: "generated",
    };

    const storedDigest = await saveWeeklyDigest(
      digest,
      builtEntries.map((entry) => ({
        ...entry,
        digestId: digest.id,
      })),
    );
    digests.push(storedDigest);
  }

  return {
    generatedCount: digests.length,
    digests,
  };
}

function weekdayLabelInTimezone(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    timeZone: timezone,
  }).format(date);
}

function timeLabelInTimezone(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  }).format(date);
}

function isDigestDueNow(
  profile: ResearchProfile,
  existingDigests: WeeklyDigest[],
  now = new Date(),
): boolean {
  const dueWeek = startOfWeekIso(now);
  if (existingDigests.some((digest) => digest.weekStart === dueWeek)) {
    return false;
  }

  const weekday = weekdayLabelInTimezone(now, profile.timezone);
  if (weekday.toLowerCase() !== profile.digestDayOfWeek.toLowerCase()) {
    return false;
  }

  return timeLabelInTimezone(now, profile.timezone) >= profile.digestTimeLocal;
}

export async function generateDueResearchDigests(now = new Date()): Promise<GenerateDigestResult> {
  const profileRows = await listDigestsAcrossProfiles();
  const dueProfiles = profileRows
    .filter(({ profile, digests }) => isDigestDueNow(profile, digests, now))
    .map(({ profile }) => profile);

  if (dueProfiles.length === 0) {
    return { generatedCount: 0, digests: [] };
  }

  const results = await Promise.all(
    dueProfiles.map((profile) =>
      generateResearchDigests({
        profileId: profile.id,
        weekStart: startOfWeekIso(now),
      }),
    ),
  );

  return {
    generatedCount: results.reduce((sum, item) => sum + item.generatedCount, 0),
    digests: results.flatMap((item) => item.digests),
  };
}
