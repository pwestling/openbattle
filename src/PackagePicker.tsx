import { type StoredPackage, systemMatches, useLibrary } from "./packages/library";
import { MODULE_API } from "./sdk";

export function PackageConsent({ pkg }: { pkg: StoredPackage }) {
  const { manifest } = pkg;
  return (
    <div className="package-consent">
      <strong>
        {manifest.name} {manifest.version}
      </strong>{" "}
      · {manifest.kind} · API {manifest.api}
      <p>
        <code>{manifest.id}</code>
        {manifest.author ? ` · by ${manifest.author}` : ""}
      </p>
      <p>
        SHA-256 <code>{pkg.hash}</code> · {pkg.bytes} bytes
      </p>
      <p>Adds: {manifest.adds || "No additions described by the author."}</p>
      <p>
        Dependencies:{" "}
        {manifest.requires.length
          ? manifest.requires
              .map(
                (r) => `${r.id}${r.hash ? ` at SHA-256 ${r.hash}` : " (version must be selected or unique)"}`,
              )
              .join("; ")
          : "none"}
      </p>
      <p>
        Replacements:{" "}
        {manifest.overrides?.length
          ? manifest.overrides
              .map((r) => `${r.system}: ${r.kind} ${r.on ? `${r.on}/` : ""}${r.id} from ${r.from}`)
              .join("; ")
          : "none"}
      </p>
      <label>
        <input
          type="checkbox"
          checked={pkg.trusted}
          onChange={(e) => useLibrary.getState().trust(pkg.hash, e.target.checked)}
        />
        {pkg.own ? "Trust these locally uploaded bytes" : "I consent to running these exact package bytes"}
      </label>
    </div>
  );
}

export function PackagePicker({
  library,
  pkg,
  system,
  extensionHashes,
  planned,
  error,
  onGame,
  onSystem,
  onExtension,
}: {
  library: Record<string, StoredPackage>;
  pkg: StoredPackage | undefined;
  system: string;
  extensionHashes: string[];
  planned: StoredPackage[];
  error: string;
  onGame: (hash: string) => void;
  onSystem: (system: string) => void;
  onExtension: (pkg: StoredPackage, enabled: boolean) => void;
}) {
  const installed = Object.values(library);
  const games = installed.filter((p) => p.manifest.kind === "system");
  const extensions = installed.filter(
    (p) =>
      p.manifest.kind === "extension" &&
      p.manifest.api === MODULE_API &&
      p.manifest.systems.some((selector) => systemMatches(selector, system)),
  );
  const dependencyGames = new Map<string, StoredPackage>();
  const pending = [pkg, ...extensionHashes.map((hash) => library[hash])].filter(
    (p): p is StoredPackage => !!p,
  );
  const explored = new Set<string>();
  while (pending.length) {
    const consumer = pending.pop()!;
    if (explored.has(consumer.hash)) continue;
    explored.add(consumer.hash);
    for (const required of consumer.manifest.requires) {
      for (const dependency of installed) {
        if (
          dependency.manifest.id !== required.id ||
          dependency.manifest.api !== MODULE_API ||
          !dependency.manifest.systems.some((selector) => systemMatches(selector, system))
        )
          continue;
        if (dependency.manifest.kind === "system" && dependency.manifest.id !== pkg?.manifest.id)
          dependencyGames.set(dependency.hash, dependency);
        pending.push(dependency);
      }
    }
  }
  const selectable = [...extensions, ...dependencyGames.values()];
  const incompatibleRoots = extensionHashes
    .map((hash) => library[hash])
    .filter((p): p is StoredPackage => !!p && !selectable.some((candidate) => candidate.hash === p.hash));
  const consentPackages = planned.length
    ? planned
    : [pkg, ...extensionHashes.map((hash) => library[hash])].filter((p): p is StoredPackage => !!p);
  return (
    <div className="package-picker">
      <div className="row">
        <label>
          Game package{" "}
          <select value={pkg?.hash ?? ""} onChange={(e) => onGame(e.target.value)}>
            {!games.length && <option value="">(no game package loaded)</option>}
            {games.map((p) => (
              <option key={p.hash} value={p.hash}>
                {p.manifest.name} {p.manifest.version} · {p.hash.slice(0, 12)} · API {p.manifest.api}
              </option>
            ))}
          </select>
        </label>
        {pkg && (
          <label>
            Game system{" "}
            <select value={system} onChange={(e) => onSystem(e.target.value)}>
              {pkg.manifest.systems.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <h2>Compatible extensions · module API {MODULE_API}</h2>
      <p className="muted">
        Choose explicit roots. Dependencies are included automatically; if several versions are installed,
        choose the required version here. Only one version per package ID is selected.
      </p>
      {!extensions.length && <p className="muted">No compatible extensions installed.</p>}
      {selectable.map((p) => {
        const explicit = extensionHashes.includes(p.hash);
        const included = planned.some((entry) => entry.hash === p.hash);
        const required = included && !explicit;
        return (
          <label className="package-option" key={p.hash}>
            <input
              type="checkbox"
              checked={explicit || included}
              disabled={required}
              onChange={(e) => onExtension(p, e.target.checked)}
            />
            {p.manifest.name} {p.manifest.version} ·{" "}
            {p.manifest.kind === "system" ? "dependency game version · " : ""}
            <code>{p.manifest.id}</code> · <code>{p.hash.slice(0, 12)}</code>
            {required ? " · required dependency" : explicit ? " · explicit root" : ""}
          </label>
        );
      })}
      {incompatibleRoots.map((p) => (
        <div className="package-option" key={p.hash}>
          <span className="bad">
            {p.manifest.name} {p.manifest.version} is an explicit root, but is not a compatible extension or
            dependency for this game/API.
          </span>
          <button onClick={() => onExtension(p, false)}>Remove root</button>
        </div>
      ))}
      {error && (
        <p className="bad" role="alert">
          {error}
        </p>
      )}
      {!!planned.length && (
        <>
          <h2>Exact execution and recorded package order</h2>
          <ol className="package-order">
            {planned.map((p) => (
              <li key={p.hash}>
                {p.manifest.name} {p.manifest.version} · {p.manifest.kind} ·{" "}
                {p.hash === pkg?.hash || extensionHashes.includes(p.hash)
                  ? "explicit root"
                  : "required dependency"}
                <br />
                <code>{p.hash}</code>
              </li>
            ))}
          </ol>
        </>
      )}
      {!!consentPackages.length && (
        <details open>
          <summary>Package identities, dependencies, replacements and per-hash consent</summary>
          <p className="advisory-warning">
            Packages run code. Review each exact hash before trusting it. A new version requires new consent.
          </p>
          {consentPackages.map((p) => (
            <PackageConsent key={p.hash} pkg={p} />
          ))}
        </details>
      )}
    </div>
  );
}
