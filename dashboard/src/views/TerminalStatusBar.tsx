import type { TerminalMode } from "../models/terminal";

interface StatusBarProps {
  readonly mode: TerminalMode;
  readonly notice: string;
  readonly onLists: () => void;
  readonly onHistory: () => void;
  readonly onYou: () => void;
  readonly onCycle: () => void;
  readonly onFilter: () => void;
  readonly onWallet: () => void;
  readonly onRefresh: () => void;
  readonly onExport: () => void;
  readonly onHelp: () => void;
}

export function TerminalStatusBar(props: StatusBarProps) {
  const actions = [
    ["l", "lists", props.onLists],
    ["h", "history", props.onHistory],
    ["y", "you", props.onYou],
    ["c", "view", props.onCycle],
    ["f", "filter", props.onFilter],
    ["w", "wallet", props.onWallet],
    ["r", "refresh", props.onRefresh],
    ["e", "export", props.onExport],
    ["?", "keys", props.onHelp],
  ] as const;
  return (
    <footer className="terminal-statusbar">
      <div className="shortcut-bar">
        {actions.map(([key, label, action]) => <button type="button" key={key} onClick={action}><kbd>{key}</kbd>{label}</button>)}
      </div>
      <div className="runtime-state"><span>{props.notice}</span><strong>VIEW:{props.mode.toUpperCase()}</strong></div>
    </footer>
  );
}
