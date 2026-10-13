import type {
  InstitutionalProject,
  MethodSignature,
  PublicationRecord,
  ResearchProfile,
} from "./types.ts";
import { clamp, tokenize, uniqueStrings } from "./utils.ts";

const METHOD_PATTERNS = {
  approachFamily: [
    "compression",
    "radiomics",
    "genomics",
    "transformer",
    "diffusion",
    "graph neural",
    "gnn",
    "contrastive",
    "self-supervised",
    "federated",
    "multimodal",
    "bayesian",
    "causal",
    "survival",
    "segmentation",
    "retrieval",
    "representation learning",
    "autoencoder",
    "cnn",
    "llm",
  ],
  representation: [
    "embedding",
    "latent",
    "graph",
    "wavelet",
    "feature map",
    "sequence",
    "token",
    "k-mer",
    "voxel",
    "patch",
    "tabular",
  ],
  objective: [
    "classification",
    "prediction",
    "segmentation",
    "compression",
    "generation",
    "reconstruction",
    "retrieval",
    "ranking",
    "screening",
    "detection",
    "forecast",
    "survival",
  ],
  dataModality: [
    "radiology",
    "imaging",
    "mri",
    "ct",
    "pathology",
    "histology",
    "genomics",
    "genomic",
    "rna",
    "transcriptomics",
    "proteomics",
    "ehr",
    "clinical",
    "text",
    "multimodal",
  ],
  evaluationStyle: [
    "cross-validation",
    "external validation",
    "ablation",
    "benchmark",
    "prospective",
    "retrospective",
    "randomized",
    "cohort",
    "multi-center",
  ],
} as const;

function extractMatches(text: string, patterns: readonly string[]): string[] {
  const lower = text.toLowerCase();
  return uniqueStrings(
    patterns.filter((pattern) => lower.includes(pattern)),
  );
}

export function emptyMethodSignature(): MethodSignature {
  return {
    approachFamily: [],
    representation: [],
    objective: [],
    dataModality: [],
    evaluationStyle: [],
    toolingHints: [],
  };
}

export function extractMethodSignatureFromText(text: string): MethodSignature {
  const normalized = text.toLowerCase();
  const toolingHints = uniqueStrings(
    tokenize(text).filter((token) =>
      [
        "transformer",
        "diffusion",
        "compressive",
        "radiomics",
        "genomics",
        "multimodal",
        "self-supervised",
        "contrastive",
        "federated",
        "bayesian",
        "survival",
        "segmentation",
      ].some((hint) => token.includes(hint.replace(/[^a-z0-9]/g, ""))),
    ),
  );

  return {
    approachFamily: extractMatches(normalized, METHOD_PATTERNS.approachFamily),
    representation: extractMatches(normalized, METHOD_PATTERNS.representation),
    objective: extractMatches(normalized, METHOD_PATTERNS.objective),
    dataModality: extractMatches(normalized, METHOD_PATTERNS.dataModality),
    evaluationStyle: extractMatches(normalized, METHOD_PATTERNS.evaluationStyle),
    toolingHints,
  };
}

export function buildProfileSignature(
  profile: ResearchProfile,
  projects: InstitutionalProject[],
): MethodSignature {
  const combinedText = [
    profile.methodInterests.join(" "),
    profile.domainInterests.join(" "),
    profile.keywords.join(" "),
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

  return extractMethodSignatureFromText(combinedText);
}

export function buildPublicationSignature(publication: Pick<PublicationRecord, "title" | "abstract" | "fullText">): MethodSignature {
  return extractMethodSignatureFromText(
    [publication.title, publication.abstract, publication.fullText ?? ""].join(" "),
  );
}

function jaccardSimilarity(left: string[], right: string[]): number {
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

export function computeMethodSimilarity(
  left: MethodSignature,
  right: MethodSignature,
): { score: number; crossDomain: boolean } {
  const approach = jaccardSimilarity(left.approachFamily, right.approachFamily);
  const representation = jaccardSimilarity(left.representation, right.representation);
  const objective = jaccardSimilarity(left.objective, right.objective);
  const evaluation = jaccardSimilarity(left.evaluationStyle, right.evaluationStyle);
  const tooling = jaccardSimilarity(left.toolingHints, right.toolingHints);
  const modality = jaccardSimilarity(left.dataModality, right.dataModality);

  const score = clamp(
    approach * 0.35 +
      representation * 0.2 +
      objective * 0.2 +
      evaluation * 0.1 +
      tooling * 0.15,
  );

  const crossDomain =
    score >= 0.45 &&
    approach >= 0.3 &&
    objective >= 0.2 &&
    modality < 0.2;

  return { score, crossDomain };
}
