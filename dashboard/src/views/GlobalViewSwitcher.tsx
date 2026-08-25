import type { GlobalVisualView } from "../controllers/useMapViewController";

interface GlobalViewSwitcherProps {
  readonly view: GlobalVisualView;
  readonly onChange: (view: GlobalVisualView) => void;
}

export function GlobalViewSwitcher({ view, onChange }: GlobalViewSwitcherProps) {
  return (
    <fieldset className="global-view-switcher" aria-label="Choose global visualization">
      <legend>GLOBAL VIEW</legend>
      <button type="button" aria-pressed={view === "wallets"} onClick={() => onChange("wallets")}>WALLETS</button>
      <button type="button" aria-pressed={view === "clusters"} onClick={() => onChange("clusters")}>CLUSTERS</button>
    </fieldset>
  );
}
