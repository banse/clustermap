export interface AnalysisDiffMetric {
  readonly value: string;
  readonly label: string;
  readonly detail: string;
  readonly tone: "improved" | "worsened" | "review" | "neutral";
}

export interface AnalysisDiffSection {
  readonly eyebrow: string;
  readonly title: string;
  readonly paragraphs: readonly string[];
  readonly facts?: readonly string[];
}

export const SYBILKIT_V2_DIFF = {
  base: "2026-08-22-shipped",
  head: "2026-08-25-sybilkit-0.2.0",
  population: "19,522",
  reportUrl: "https://claude.ai/code/artifact/80a0b440-a5a8-467a-869d-0624f8686d75",
  reproduceUrl: "https://github.com/banse/clustermap/tree/main/audit",
  primaryMetric: {
    fromValue: "7,949",
    toValue: "6,782",
    label: "INDEPENDENT WALLETS",
    detail: "no kept 0.2.0 group · not proof of a unique person",
  },
  comparisonMetrics: [
    {
      value: "−12,740",
      label: "VS ORIGINAL LIST",
      detail: "19,522 → 6,782",
    },
    {
      value: "57.6% → 76.7%",
      label: "POINTS COVERED",
      detail: "contract points held by flagged wallets",
    },
  ],
  metrics: [
    {
      value: "+2,925",
      label: "NEWLY FLAGGED",
      detail: "clean → flagged",
      tone: "worsened",
    },
    {
      value: "−2,082",
      label: "RELEASED",
      detail: "leave flagged status",
      tone: "improved",
    },
    {
      value: "324",
      label: "UNDER REVIEW",
      detail: "shown, never removed",
      tone: "review",
    },
    {
      value: "263 → 160",
      label: "KEPT GROUPS",
      detail: "fewer, more structural",
      tone: "neutral",
    },
  ] satisfies readonly AnalysisDiffMetric[],
  sections: [
    {
      eyebrow: "WALLET OUTCOMES",
      title: "Every wallet was re-evaluated",
      paragraphs: [
        "The frozen population did not change. Of 19,522 wallets, 2,925 move from clean to flagged, 1,900 move from flagged to clean, 182 move from flagged to review, and 142 move from clean to review. The other 14,373 keep their status.",
        "Flagged status grows by 843 overall, but this is not a wider net. The released wallets hold 3.3% of all contract points where the newly flagged hold 22.3%: 0.2.0 removes weak links around small deposits while adding previously missed, points-heavy operator patterns. Review is the visible periphery of a kept group, shown but never removed: 309 of the 324 are touched by fewer than two evidence families, and the other 15 carry only weak amount-and-cadence evidence while holding an aged, externally funded history of their own.",
      ],
    },
    {
      eyebrow: "LARGEST NEW SIGNALS",
      title: "Serial relays become visible",
      paragraphs: [
        "Group 011 contains 393 wallets, 391 newly flagged, in a roughly 1.10–1.14 ETH jittered peel chain. Group 017 is wholly new: 300 wallets relaying roughly 1.00–1.05 ETH through unique six-decimal deposits.",
        "Those amounts evaded rules based on repeated values. 0.2.0 combines tight funding order, deposit cadence, a shared gas fingerprint, and hour-local jitter bands instead.",
      ],
    },
    {
      eyebrow: "FALSE-POSITIVE CONTROL",
      title: "Broad coincidences stop carrying wallets",
      paragraphs: [
        "The largest cleanup is shipped group 008, where 906 of 998 wallets leave flagged status; another 173 leave shipped group 007. The shipped rules could weld ordinary activity through hour-scale amount windows, popular minimum deposits, short odd amounts, and shared exchange funders.",
        "Of the 2,082 released wallets, 749 joined during the hour 34–35 community rally and 890 deposited 0.05 ETH. 0.2.0 closes round-amount windows after 32 blocks, exempts the near-minimum band from identity-like sequence and drip rules, requires globally unusual odd amounts to carry at least six decimals, gates funder hubs by scale and freshness, and requires two incident families per flagged wallet — for 803 of them the two are the funding and the timing of one peel transfer, and 746 would fall below that gate if the peel rule booked funding alone.",
      ],
      facts: [
        "Independent-history benchmark: 84 / 308 flagged → 1 / 308",
        "Operator-free null model: about 46% linked → 0.1%",
        "ENS-named flagged: 360 → 23, plus 31 in review · IDMD holders: 35 → 1, plus 5 in review",
        "Released means unsupported by 0.2.0, not proven to be a unique person",
      ],
    },
    {
      eyebrow: "RECALL GAINED",
      title: "Funding structure can now build a group",
      paragraphs: [
        "The roughly 99 ETH peel-chain operator rises from 81 / 419 detected wallets to 397 / 419, and the five-step 9.9–10.3 ETH ladder from 0 / 176 to 176 / 176. The Bitget withdrawal loop is a different case: the shipped rules already reached 232 / 239, but only by treating the exchange hot wallet as an ordinary shared funder. Excluding exchange funders correctly drops that to 15 / 239, and 0.2.0 recovers 238 / 239 from structure instead.",
        "Complete enrichment now resolves a first funder for every contributor that has one — 37 have no incoming transfer at all — and a transaction fingerprint for all 28,353 deposits. As a result, 0.2.0 covers 76.7% of points versus 57.6% while keeping fewer groups.",
      ],
    },
    {
      eyebrow: "HOW TO READ THE DIFF",
      title: "A published version, not an identity verdict",
      paragraphs: [
        "SybilKit 0.2.0 is what this site now publishes. It ships the v2h rule set — the same script that produced this analysis, pinned by content hash — as its main utility. The original SybilKit 0.1.1 analysis stays selectable, and every URL pins its version; group numbers must always be read with that version because groups are rebuilt between runs.",
        "0.2.0 is our current best rule set, not a final verdict. Every constant in it was calibrated on this one population, both versions still contain false positives, and the rules are expected to change again — the audit and the dispute route exist so a specific wallet can be argued with.",
        "These are reproducible analytical signals. A group can justify review, but it is not proof that its wallets share an owner or identity.",
      ],
    },
  ] satisfies readonly AnalysisDiffSection[],
} as const;
