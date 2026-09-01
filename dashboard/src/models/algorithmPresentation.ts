import type { EvidenceFamily, Overview } from "./domain";
import { formatCount } from "./presentation";

type KnownAnalysis = "shipped" | "v2";

interface RuleCatalogEntry {
  readonly id: string;
  readonly label: string;
  readonly families: readonly EvidenceFamily[];
  readonly activeIn: readonly KnownAnalysis[];
  readonly pairedFamilies: boolean;
  readonly threshold: Readonly<Record<KnownAnalysis, string | null>>;
}

export interface AlgorithmRuleDefinition {
  readonly id: string;
  readonly label: string;
  readonly families: readonly EvidenceFamily[];
  readonly pairedFamilies: boolean;
  readonly threshold: string;
  readonly meaning: string;
}

export interface AlgorithmSection {
  readonly id:
    | "frozen-input"
    | "points"
    | "rule-atlas"
    | "graph-construction"
    | "wallet-gate"
    | "confidence-tiers"
    | "version-differences"
    | "limits-reproducibility";
  readonly number: string;
  readonly title: string;
  readonly summary: string;
  readonly facts: readonly string[];
}

export interface AlgorithmPresentation {
  readonly versionId: string;
  readonly versionLabel: string;
  readonly detectorApplied: boolean;
  readonly ruleState: string;
  readonly rules: readonly AlgorithmRuleDefinition[];
  readonly sections: readonly AlgorithmSection[];
  readonly provenance: {
    readonly detector: string;
    readonly detectorVersion: string;
    readonly ruleSet: string;
    readonly analysisCommit: string;
    readonly detectorRevision: string | null;
    readonly rulesFile: string | null;
    readonly rulesSha256: string | null;
    readonly contentHash: string;
    readonly reproduceCommand: string;
  };
  readonly links: {
    readonly auditUrl: string;
    readonly contestUrl: string;
  };
}

const BOTH: readonly KnownAnalysis[] = ["shipped", "v2"];
const V2: readonly KnownAnalysis[] = ["v2"];

const RULE_CATALOG: readonly RuleCatalogEntry[] = [
  {
    id: "identical-odd-amount",
    label: "Identical odd amount",
    families: ["amount"],
    activeIn: BOTH,
    pairedFamilies: false,
    threshold: {
      shipped: "Exact odd amount among single-deposit wallets; global reach.",
      v2: "Exact ≥6-decimal amount above the 1.25× minimum band; global reach.",
    },
  },
  {
    id: "identical-amount-wave",
    label: "Identical amount wave",
    families: ["amount"],
    activeIn: BOTH,
    pairedFamilies: false,
    threshold: {
      shipped: "Exact round/common amount among single-deposit wallets in a contiguous-hour wave.",
      v2: "Exact non-jitter amount above the 1.25× minimum band, split at gaps over 32 blocks.",
    },
  },
  {
    id: "equal-split",
    label: "Equal split",
    families: ["amount"],
    activeIn: BOTH,
    pairedFamilies: false,
    threshold: {
      shipped: "An identical-amount group of at least five wallets whose total is at least 50 ETH.",
      v2: "An identical-amount group of at least five wallets whose total is at least 50 ETH.",
    },
  },
  {
    id: "near-same-block",
    label: "Near-same-block amounts",
    families: ["amount"],
    activeIn: BOTH,
    pairedFamilies: false,
    threshold: {
      shipped: "Adjacent non-equal amounts within ±10% in the same block.",
      v2: "Adjacent jitter-class amounts within ±10% in the same block, above the minimum band.",
    },
  },
  {
    id: "consecutive-joins",
    label: "Consecutive joins",
    families: ["sequence"],
    activeIn: BOTH,
    pairedFamilies: false,
    threshold: {
      shipped: "At least five consecutive join indices, each ≤2 blocks apart, with near amounts.",
      v2: "At least five consecutive join indices, each ≤2 blocks apart, with near amounts; a run is skipped only when every amount is inside the 1.25× minimum band.",
    },
  },
  {
    id: "repeated-block-burst",
    label: "Repeated block burst",
    families: ["cadence"],
    activeIn: BOTH,
    pairedFamilies: false,
    threshold: {
      shipped: "At least five exact-amount deposits in one block, repeated in at least two blocks.",
      v2: "At least five exact-amount deposits in one block, repeated in at least two blocks.",
    },
  },
  {
    id: "metronomic-drip",
    label: "Metronomic drip",
    families: ["cadence"],
    activeIn: BOTH,
    pairedFamilies: false,
    threshold: {
      shipped: "At least eight exact-amount deposits with 1–8 block gaps whose gap range is ≤4.",
      v2: "At least eight exact-amount deposits above the minimum band with 1–8 block gaps whose gap range is ≤4.",
    },
  },
  {
    id: "jitter-engine",
    label: "Jitter engine",
    families: ["amount", "cadence"],
    activeIn: V2,
    pairedFamilies: true,
    threshold: {
      shipped: null,
      v2: "At least 20 jitter-class wallet rows inside a 2% amount band and one contract hour; amounts need not be unique.",
    },
  },
  {
    id: "sub-cent-residual",
    label: "Sub-cent residual",
    families: ["amount"],
    activeIn: V2,
    pairedFamilies: false,
    threshold: {
      shipped: null,
      v2: "The same non-trivial ≥6-digit residual below 0.01 ETH across at least three wallets.",
    },
  },
  {
    id: "deposit-ladder",
    label: "Deposit ladder",
    families: ["amount"],
    activeIn: V2,
    pairedFamilies: false,
    threshold: {
      shipped: null,
      v2: "The same ≥3-step deposit tuple across at least five wallets whose adjacent first-deposit gaps are ≤300 blocks.",
    },
  },
  {
    id: "fresh-funder-hub",
    label: "Fresh funder hub",
    families: ["funding", "cadence"],
    activeIn: V2,
    pairedFamilies: true,
    threshold: {
      shipped: null,
      v2: "One non-infrastructure funder with fan-out below 50 funds at least three nonce-0 wallets whose adjacent deposit gaps are ≤600 blocks.",
    },
  },
  {
    id: "exchange-fan-out",
    label: "Exchange fan-out",
    families: ["funding", "gas"],
    activeIn: V2,
    pairedFamilies: true,
    threshold: {
      shipped: null,
      v2: "At least ten nonce-0 withdrawals share one uncommon priority fee; ≥50% of the hub group and ≤25% population share.",
    },
  },
  {
    id: "tight-peel-chain",
    label: "Tight peel chain",
    families: ["funding", "cadence"],
    activeIn: V2,
    pairedFamilies: true,
    threshold: {
      shipped: null,
      v2: "The first funder is a contributor, the funded wallet nonce is ≤20, deposits are ≤30 blocks apart, and amounts are within ±25%.",
    },
  },
  {
    id: "peel-chain",
    label: "Peel chain",
    families: ["funding"],
    activeIn: BOTH,
    pairedFamilies: false,
    threshold: {
      shipped: "A wallet's first funder is already a member of the same behavioural component.",
      v2: "A wallet's first funder is already a member of the same component; corroboration only.",
    },
  },
  {
    id: "shared-first-funder",
    label: "Shared first funder",
    families: ["funding"],
    activeIn: BOTH,
    pairedFamilies: false,
    threshold: {
      shipped: "At least two members of one component share a non-infrastructure first funder.",
      v2: "At least two members of one component share a non-infrastructure first funder; known exchange hubs require fresh wallets.",
    },
  },
  {
    id: "fee-fingerprint",
    label: "Fee fingerprint",
    families: ["gas"],
    activeIn: BOTH,
    pairedFamilies: false,
    threshold: {
      shipped: "At least 90% group coverage and five distinct transactions with two of three fee/limit axes collapsed.",
      v2: "At least 90% group coverage and five distinct transactions with two of three fee/limit axes collapsed.",
    },
  },
  {
    id: "gas-limit-priority-fee",
    label: "Gas limit + priority fee",
    families: ["gas"],
    activeIn: BOTH,
    pairedFamilies: false,
    threshold: {
      shipped: "At least 90% group coverage and five distinct transactions with one gas limit and at most two priority fees.",
      v2: "At least 90% group coverage and five distinct transactions with one gas limit and at most two priority fees.",
    },
  },
];

function analysisKind(overview: Overview): KnownAnalysis | "raw" | "unknown" {
  if (overview.version.list_scope === "raw") return "raw";
  if (overview.version.detector_version === "0.1.1") return "shipped";
  if (overview.version.detector_version === "0.2.0") return "v2";
  return "unknown";
}

function ruleMeaning(families: readonly EvidenceFamily[]): string {
  const funding = families.includes("funding");
  const behavioral = families.some((family) => family !== "funding");
  if (funding && behavioral) return "Measured transfer + behavioural pattern from one conceptual rule.";
  if (funding) return "Measured funding transfer.";
  return "Behavioural pattern; no transfer is asserted.";
}

function activeRules(kind: KnownAnalysis | "raw" | "unknown"): AlgorithmRuleDefinition[] {
  if (kind === "raw" || kind === "unknown") return [];
  return RULE_CATALOG
    .filter((rule) => rule.activeIn.includes(kind))
    .map((rule) => ({
      id: rule.id,
      label: rule.label,
      families: rule.families,
      pairedFamilies: rule.pairedFamilies,
      threshold: rule.threshold[kind]!,
      meaning: ruleMeaning(rule.families),
    }));
}

function graphFacts(overview: Overview, kind: ReturnType<typeof analysisKind>): readonly string[] {
  if (kind === "raw") return ["No detector edges or components exist in the raw contract-list view."];
  if (kind === "unknown") return ["This detector version has no published graph-construction explanation in this interface."];
  const facts = kind === "shipped" ? [
    `Component-building rule edges from amount, split, sequence, and cadence are unioned first; a kept group requires ${overview.analysis.min_size}+ wallets and ${overview.analysis.min_families}+ evidence families.`,
    "Gas and funding evidence are attached inside the resulting components afterward; they corroborate but cannot merge groups or pull in another wallet.",
    "Families describe kinds of evidence, not independent witnesses.",
  ] : [
    `Component-building rule edges, including the v2 structural funding builders, are unioned first; a kept core requires ${overview.analysis.min_size}+ wallets and ${overview.analysis.min_families}+ evidence families.`,
    "Library gas and ordinary shared-funder/peel evidence are attached inside components afterward; they corroborate but cannot merge groups or pull in another wallet.",
    "Families describe kinds of evidence, not independent witnesses.",
  ];
  if (kind === "v2") facts.push("In the published v2 run the group-level two-family gate is inert; the local member gate plus 5+ core wallets is binding.");
  return facts;
}

function walletGateFacts(kind: ReturnType<typeof analysisKind>): readonly string[] {
  if (kind === "raw") return ["Every frozen wallet remains a source-list record; no wallet gate runs."];
  if (kind === "shipped") {
    return [
      "Every member of the whole kept component inherits the component result; there is no separate local member gate.",
      "The shipped analysis has no under-review periphery: wallets are clean or flagged.",
    ];
  }
  if (kind === "v2") {
    return [
      "The local two-family core requires at least two incident evidence families on each flagged wallet.",
      "A core is kept only when at least 5 wallets pass that local gate.",
      "A wallet with nonce ≥ 50, an external first funder, and only amount/cadence evidence moves to the aged-weak review periphery.",
      "Group evidence and evidence touching one member remain separate claims.",
    ];
  }
  return ["This detector version has no published wallet-gate explanation in this interface."];
}

function confidenceFacts(kind: ReturnType<typeof analysisKind>): readonly string[] {
  if (kind === "raw") return ["No detector confidence or evidence tier is computed for the raw list."];
  return [
    "Base confidence is 1 − ∏(1 − strongest family strength), using only the strongest reason in each family.",
    "Wallet freshness multiplies base confidence by a 0.85–1.00 factor (0.85 + 0.15 × nonce-0 share); it never raises confidence.",
    "REVIEW is the default display tier. ELEVATED requires ≥80% plus funding or at least three families.",
    "CRITICAL requires ≥95%, funding, and at least three families. These are presentation tiers, not ownership verdicts.",
  ];
}

function formatCoverage(value: number, total: number): string {
  return `${formatCount(value)} / ${formatCount(total)}`;
}

export function buildAlgorithmPresentation(overview: Overview): AlgorithmPresentation {
  const kind = analysisKind(overview);
  const detectorApplied = kind !== "raw";
  const rules = activeRules(kind);
  const rawState = "NO DETECTOR APPLIED";
  const ruleState = kind === "raw"
    ? rawState
    : kind === "unknown"
      ? "RULE CATALOG NOT PUBLISHED FOR THIS VERSION"
      : `${formatCount(rules.length)} RULES REPRESENTED BY PUBLISHED EDGES`;
  const dispute = overview.analysis.dispute;
  const factsBySection: AlgorithmPresentation["sections"] = [
    {
      id: "frozen-input",
      number: "01",
      title: "FROZEN INPUT",
      summary: "The analysis starts from the settled WhitelistCurator.sol population, not a live wallet feed.",
      facts: [
        `${formatCount(overview.totals.deposits)} deposits from ${formatCount(overview.totals.population)} wallets, frozen at Ethereum block ${formatCount(overview.provenance.snapshot_block)}.`,
        "WhitelistCurator refunded ETH in the deposit transaction; final credited weight and the participation record remained.",
        `Enrichment coverage: ${formatCoverage(overview.totals.funding_rows, overview.totals.population)} first-funder rows and ${formatCoverage(overview.totals.tx_fingerprints, overview.totals.deposits)} transaction fingerprints.`,
      ],
    },
    {
      id: "points",
      number: "02",
      title: "POINTS",
      summary: "The contract's integer square-root curve sets visual prominence; it does not prove one wallet equals one person.",
      facts: [
        `points = isqrt(weight_wei) × ${formatCount(overview.analysis.points_per_eth)} ÷ 1,000,000,000, floored once after multiplication.`,
        `POINTS_PER_ETH is read from the selected dataset (${formatCount(overview.analysis.points_per_eth)} here), never inferred from display text.`,
        "CLUSTERMAP uses points for map prominence and points share only, not as uniqueness evidence.",
      ],
    },
    {
      id: "rule-atlas",
      number: "03",
      title: "RULE ATLAS",
      summary: kind === "raw"
        ? rawState
        : "Concrete detectors publish amount, sequence, cadence, gas, and funding evidence edges.",
      facts: [
        ruleState,
        "Funding is the only family representing measured transfers; amount, sequence, cadence, and gas are behavioural matches.",
        "A paired-family rule emits two edge families from one conceptual observation; those families are not independent witnesses.",
      ],
    },
    {
      id: "graph-construction",
      number: "04",
      title: "GRAPH CONSTRUCTION",
      summary: "Component-building edges form groups; corroborating edges can explain a group without merging it.",
      facts: graphFacts(overview, kind),
    },
    {
      id: "wallet-gate",
      number: "05",
      title: "WALLET GATE",
      summary: "A group's evidence and the evidence touching one wallet answer different questions.",
      facts: walletGateFacts(kind),
    },
    {
      id: "confidence-tiers",
      number: "06",
      title: "CONFIDENCE & PRESENTATION TIERS",
      summary: "Confidence combines families upward, then presentation thresholds describe review priority.",
      facts: confidenceFacts(kind),
    },
    {
      id: "version-differences",
      number: "07",
      title: "VERSION DIFFERENCES",
      summary: "Raw, shipped 0.1.1, and published 0.2.0 are immutable, distinct assertions over the same population.",
      facts: [
        "RAW · 19,522 wallets · no detector · no groups.",
        "0.1.1 SHIPPED · 263 groups · 11,573 flagged · no review tier.",
        "0.2.0 PUBLISHED · 160 groups · 12,416 flagged · 324 under review.",
        `SELECTED · ${overview.version.id} · ${formatCount(overview.version.cluster_count)} groups · ${formatCount(overview.version.status_counts.flagged)} flagged · ${formatCount(overview.version.status_counts.review)} under review.`,
      ],
    },
    {
      id: "limits-reproducibility",
      number: "08",
      title: "LIMITS & REPRODUCIBILITY",
      summary: "Reproducibility proves which analysis ran, not that its interpretation of a person is correct.",
      facts: [
        "Published incident edges expose the strongest kept edge per source/target/family; discarded raw candidates are not claimed as visible.",
        "Paired families can come from one builder, and every rule was calibrated on this one population.",
        "An evidence group is a review question, not proof of common identity, control, intent, or ownership.",
        `CONTENT HASH · ${overview.version.content_hash}`,
        `REPRODUCE · ${overview.version.reproduce_command}`,
      ],
    },
  ];

  return {
    versionId: overview.version.id,
    versionLabel: overview.version.label,
    detectorApplied,
    ruleState,
    rules,
    sections: factsBySection,
    provenance: {
      detector: overview.version.detector,
      detectorVersion: overview.version.detector_version,
      ruleSet: overview.version.rule_set,
      analysisCommit: overview.version.commit,
      detectorRevision: kind === "raw" ? null : overview.version.detector_commit ?? null,
      rulesFile: kind === "raw" ? null : overview.version.rules_file ?? null,
      rulesSha256: kind === "raw" ? null : overview.version.rules_sha256 ?? null,
      contentHash: overview.version.content_hash,
      reproduceCommand: overview.version.reproduce_command,
    },
    links: {
      auditUrl: dispute?.audit_url ?? "https://github.com/banse/clustermap/tree/main/audit",
      contestUrl: dispute?.contest_url ?? "https://github.com/banse/clustermap/issues/new?labels=dispute",
    },
  };
}
