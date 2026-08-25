import { useState, type FormEvent } from "react";

import { PRESETS, SHORTCUTS } from "../models/terminal";

export function WalletDialog({ loading, onClose, onSubmit }: { readonly loading: boolean; readonly onClose: () => void; readonly onSubmit: (address: string) => Promise<void> }) {
  const [address, setAddress] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void onSubmit(address);
  };
  return (
    <div className="terminal-overlay" role="presentation">
      <form className="terminal-dialog" onSubmit={submit} aria-labelledby="wallet-dialog-title">
        <div className="panel-title"><span id="wallet-dialog-title">CHOOSE WALLET</span><button type="button" onClick={onClose}>[ESC] CLOSE</button></div>
        <label>
          <span>ORIGINAL LIST ADDRESS</span>
          <input autoFocus required pattern="0x[0-9a-fA-F]{40}" value={address} onChange={(event) => setAddress(event.target.value)} placeholder="0x0000000000000000000000000000000000000000" />
        </label>
        <p>PASTE AN EXACT ADDRESS OR SELECT A LIST ROW WITH [J/K] + [ENTER].</p>
        <button className="terminal-primary" type="submit" disabled={loading}>{loading ? "READING…" : "[ENTER] INSPECT"}</button>
      </form>
    </div>
  );
}

export function HelpDialog({ onClose }: { readonly onClose: () => void }) {
  return (
    <div className="terminal-overlay" role="presentation">
      <section className="terminal-dialog help-dialog" aria-labelledby="help-dialog-title">
        <div className="panel-title"><span id="help-dialog-title">KEYBOARD REFERENCE</span><button type="button" autoFocus onClick={onClose}>[ESC] CLOSE</button></div>
        <div className="shortcut-reference">
          {SHORTCUTS.map((shortcut) => <div key={shortcut.key}><kbd>{shortcut.key}</kbd><strong>{shortcut.label.toUpperCase()}</strong><span>{shortcut.action}</span></div>)}
          <div><kbd>j/k</kbd><strong>MOVE</strong><span>Move the list cursor</span></div>
          <div><kbd>↵</kbd><strong>OPEN</strong><span>Inspect selected wallet</span></div>
          <div><kbd>pg</kbd><strong>PAGE</strong><span>Previous or next list page</span></div>
          <div><kbd>esc</kbd><strong>BACK</strong><span>Close overlay or return to lists</span></div>
        </div>
        <div className="dialog-presets">
          {PRESETS.map((preset) => <p key={preset.key}><kbd>{preset.key}</kbd><strong>{preset.label}</strong><span>{preset.detail}</span></p>)}
        </div>
      </section>
    </div>
  );
}
