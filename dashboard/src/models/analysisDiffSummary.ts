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

export const AUDITED_V2H_DIFF = {
  base: "2026-08-22-shipped",
  head: "2026-08-25-v2h",
  population: "19,522",
  reportUrl: "https://claude.ai/code/artifact/80a0b440-a5a8-467a-869d-0624f8686d75",
  reproduceUrl: "https://github.com/banse/clustermap/tree/main/audit",
  primaryMetric: {
    fromValue: "19,522",
    toValue: "6,782",
    label: "INDEPENDENT WALLETS",
    detail: "no kept v2h group · not proof of a unique person",
  },
  comparisonMetrics: [
    {
      value: "−1,167",
      label: "VS SHIPPED 0.1.1",
      detail: "7,949 → 6,782",
    },
    {
      value: "−12,740",
      label: "VS ORIGINAL LIST",
      detail: "19,522 → 6,782",
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
      detail: "one-family periphery",
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
        "Flagged status grows by 843 overall, but this is not a wider net. The released set holds under 2% of points; v2h removes weak links around small deposits while adding previously missed, points-heavy operator patterns. Review is the visible periphery of a kept group: fewer than two evidence families touch the wallet directly.",
      ],
    },
    {
      eyebrow: "LARGEST NEW SIGNALS",
      title: "Serial relays become visible",
      paragraphs: [
        "V2H group 011 contains 393 wallets, 391 newly flagged, in a roughly 1.10–1.14 ETH jittered peel chain. V2H group 017 is wholly new: 300 wallets relaying roughly 1.00–1.05 ETH through unique six-decimal deposits.",
        "Those amounts evaded rules based on repeated values. V2H combines tight funding order, deposit cadence, a shared gas fingerprint, and hour-local jitter bands instead.",
      ],
    },
    {
      eyebrow: "FALSE-POSITIVE CONTROL",
      title: "Broad coincidences stop carrying wallets",
      paragraphs: [
        "The largest cleanup is shipped group 008, where 906 of 998 wallets leave flagged status; another 173 leave shipped group 007. The shipped rules could weld ordinary activity through hour-scale amount windows, popular minimum deposits, short odd amounts, and shared exchange funders.",
        "Of the 2,082 released wallets, 749 joined during the hour 34–35 community rally and 890 deposited 0.05 ETH. V2H closes round-amount windows after 32 blocks, exempts the near-minimum band from identity-like sequence and drip rules, requires globally unusual odd amounts to carry at least six decimals, gates funder hubs by scale and freshness, and requires two incident families per flagged wallet.",
      ],
      facts: [
        "Independent-history benchmark: 84 / 308 flagged → 1 / 308",
        "Operator-free null model: about 46% linked → 0.1%",
        "ENS-named flagged: 360 → 23 · IDMD holders: 35 → 1",
        "Released means unsupported by v2h, not proven to be a unique person",
      ],
    },
    {
      eyebrow: "RECALL GAINED",
      title: "Funding structure can now build a group",
      paragraphs: [
        "The roughly 99 ETH peel-chain operator rises from 81 / 419 detected wallets to 397 / 419. The five-step 9.9–10.3 ETH ladder rises from 0 / 176 to 176 / 176, while the Bitget withdrawal loop reaches 238 / 239.",
        "Complete enrichment now covers every contributor's first funder and all 28,353 deposits. As a result, v2h covers 76.7% of points versus 57.6% while keeping fewer groups.",
      ],
    },
    {
      eyebrow: "HOW TO READ THE DIFF",
      title: "A version change, not an identity verdict",
      paragraphs: [
        "The audited v2h candidate is now the default view. The shipped analysis remains selectable and every URL pins its version; group numbers must always be read with that version because groups are rebuilt between runs.",
        "These are reproducible analytical signals. A group can justify review, but it is not proof that its wallets share an owner or identity.",
      ],
    },
  ] satisfies readonly AnalysisDiffSection[],
} as const;
