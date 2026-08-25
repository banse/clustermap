import { useMemo, useState } from "react";

import type { ChangelogEntry, ChangelogKind } from "../models/domain";

export interface ChangelogController {
  readonly kind: ChangelogKind | "all";
  readonly from: string;
  readonly to: string;
  readonly entries: readonly ChangelogEntry[];
  readonly setKind: (value: ChangelogKind | "all") => void;
  readonly setFrom: (value: string) => void;
  readonly setTo: (value: string) => void;
  readonly reset: () => void;
}

export function useChangelogController(
  source: readonly ChangelogEntry[],
): ChangelogController {
  const [kind, setKind] = useState<ChangelogKind | "all">("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const entries = useMemo(() => source.filter((entry) => (
    (kind === "all" || entry.kind === kind)
    && (from === "" || entry.at.slice(0, 10) >= from)
    && (to === "" || entry.at.slice(0, 10) <= to)
  )), [from, kind, source, to]);

  return {
    kind,
    from,
    to,
    entries,
    setKind,
    setFrom,
    setTo,
    reset: () => {
      setKind("all");
      setFrom("");
      setTo("");
    },
  };
}
