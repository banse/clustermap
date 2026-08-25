import { useState } from "react";

interface AddressLinkProps {
  readonly address: string;
  readonly name?: string | null;
  readonly compact?: boolean;
}

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function AddressLink({ address, name, compact = false }: AddressLinkProps) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1_200);
  };

  return (
    <span className="address-identity">
      <span className="address-identity__mark" aria-hidden="true" />
      <a
        href={`https://etherscan.io/address/${address}`}
        target="_blank"
        rel="noreferrer"
        title={`Open ${address} on Etherscan`}
      >
        {name || (compact ? shortAddress(address) : address)}
      </a>
      <button type="button" onClick={copy} aria-label={`Copy address ${address}`}>
        {copied ? "Copied" : "Copy"}
      </button>
    </span>
  );
}

