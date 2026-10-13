/*
 * biomarkerOntology — normalizes biomarker aliases in a decomposition
 * response to canonical ontology concepts.
 *
 * LLMs routinely use different casing/spelling for the same gene or
 * mutation: `HER2`, `HER-2/neu`, `erbb2`, `c-erbB-2` all refer to
 * HGNC:3430 (ERBB2). When we pass these downstream (F2 retrieval, F3
 * evaluation) without normalization, BM25 misses hits and the criterion
 * evaluator can't match to evidence. This check scans each decomposed
 * criterion's `label`, `threshold`, and `normalizedConcepts` array and
 * rewrites any alias it recognises to the canonical form.
 *
 * The alias list is intentionally tiny — this is a demo, not a production
 * ontology service. P6 surfaces the count so we can see when the check
 * is actually firing.
 */

import type { DecompositionResponse } from "../ai/schemas";
import type { SafetyCheck } from "./safetyGuard";

interface OntologyEntry {
  canonical: string;
  aliases: RegExp[];
}

const ONTOLOGY: OntologyEntry[] = [
  {
    canonical: "HGNC:3430 (ERBB2/HER2)",
    aliases: [/\bher[- ]?2\/?neu\b/i, /\bher[- ]?2\b/i, /\berbb[- ]?2\b/i, /c-erbB-2/i],
  },
  {
    canonical: "HGNC:3236 (EGFR)",
    aliases: [/\begfr\b/i, /\berbb[- ]?1\b/i, /\bher[- ]?1\b/i],
  },
  {
    canonical: "HGNC:1097 (BRAF)",
    aliases: [/\bbraf\b/i, /\bb-raf\b/i],
  },
  {
    canonical: "HGNC:6342 (KRAS)",
    aliases: [/\bkras\b/i, /\bk-ras\b/i],
  },
  {
    canonical: "HGNC:11998 (TP53)",
    aliases: [/\btp[- ]?53\b/i, /\bp53\b/i],
  },
  {
    canonical: "HGNC:427 (ALK)",
    aliases: [/\balk\b/i],
  },
];

function findCanonical(fragment: string): string | null {
  for (const entry of ONTOLOGY) {
    if (entry.aliases.some((re) => re.test(fragment))) {
      return entry.canonical;
    }
  }
  return null;
}

export function biomarkerOntologyForDecomposition(): SafetyCheck<DecompositionResponse> {
  return (response) => {
    const additions: Array<{ id: string; concept: string }> = [];
    const criteria = response.criteria.map((criterion) => {
      const canon = findCanonical(
        `${criterion.label} ${criterion.threshold} ${criterion.source.originalText}`,
      );
      if (!canon) return criterion;
      if (criterion.normalizedConcepts.some((c) => c.includes(canon))) {
        return criterion;
      }
      additions.push({ id: criterion.id, concept: canon });
      return {
        ...criterion,
        normalizedConcepts: [...criterion.normalizedConcepts, canon],
      };
    });
    if (additions.length === 0) return null;
    const rewritten: DecompositionResponse = { ...response, criteria };
    return {
      severity: "info",
      mode: "biomarker_ontology",
      message: `Normalized biomarker aliases on ${additions.length} criteria.`,
      rewritten,
      detail: { additions },
    };
  };
}
