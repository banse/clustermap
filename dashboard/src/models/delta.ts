import type { DeltaClass, DeltaPayload } from "./domain";

export const DELTA_CLASSES: readonly DeltaClass[] = [
  "improved",
  "worsened",
  "under_review",
  "unchanged",
];

export function countDeltaClasses(
  values: readonly DeltaClass[],
): Readonly<Record<DeltaClass, number>> {
  const counts: Record<DeltaClass, number> = {
    improved: 0,
    worsened: 0,
    under_review: 0,
    unchanged: 0,
  };
  for (const value of values) counts[value] += 1;
  return counts;
}

export function validateDelta(payload: DeltaPayload): DeltaPayload {
  const counts = countDeltaClasses(payload.wallet_classes);
  for (const value of DELTA_CLASSES) {
    if (counts[value] !== payload.counts[value]) {
      throw new Error(`Delta count mismatch for ${value}`);
    }
  }
  return payload;
}
