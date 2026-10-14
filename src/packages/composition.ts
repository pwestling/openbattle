import type { Manifest } from "./manifest";
import { systemMatches } from "./library";
import { MODULE_API } from "../sdk";

interface Candidate {
  hash: string;
  manifest: Manifest;
}

/** Validate the exact selected composition, then order dependencies before their consumers. */
export function planComposition<T extends Candidate>(packages: readonly T[]): T[] {
  const byId = new Map<string, T>();
  const hashes = new Set<string>();
  for (const pkg of packages) {
    if (byId.has(pkg.manifest.id) || hashes.has(pkg.hash))
      throw new Error(`Duplicate package selection: ${pkg.manifest.id}`);
    if (pkg.manifest.api !== MODULE_API)
      throw new Error(
        `${pkg.manifest.id} requires module API ${pkg.manifest.api}; this app runs ${MODULE_API}`,
      );
    byId.set(pkg.manifest.id, pkg);
    hashes.add(pkg.hash);
  }
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const ordered: T[] = [];
  const visit = (pkg: T) => {
    const id = pkg.manifest.id;
    if (visited.has(id)) return;
    if (visiting.has(id)) throw new Error(`Dependency cycle at ${id}`);
    visiting.add(id);
    for (const required of pkg.manifest.requires) {
      const dependency = byId.get(required.id);
      if (!dependency) throw new Error(`${id} requires missing package ${required.id}`);
      if (required.hash && dependency.hash !== required.hash)
        throw new Error(
          `${id} requires ${required.id} at SHA-256 ${required.hash}; selected ${dependency.hash}`,
        );
      visit(dependency);
    }
    if (pkg.manifest.kind === "extension") {
      const games = packages.filter(
        (p) =>
          p.manifest.kind === "system" &&
          p.manifest.systems.some((system) =>
            pkg.manifest.systems.some((selector) => systemMatches(selector, system)),
          ),
      );
      if (!games.length) throw new Error(`${id} has no compatible selected game`);
      for (const game of games) visit(game);
    }
    visiting.delete(id);
    visited.add(id);
    ordered.push(pkg);
  };
  for (const pkg of packages) visit(pkg);
  return ordered;
}

/** Add dependency closure for explicit picker roots. Never guess between installed versions. */
export function selectComposition<T extends Candidate>(
  library: readonly T[],
  roots: readonly T[],
  system: string,
): T[] {
  const selected = new Map<string, T>();
  for (const pkg of roots) {
    if (selected.has(pkg.manifest.id)) throw new Error(`Select only one version of ${pkg.manifest.id}`);
    selected.set(pkg.manifest.id, pkg);
  }
  const checked = new Set<string>();
  const compatible = (p: T) =>
    p.manifest.api === MODULE_API && p.manifest.systems.some((selector) => systemMatches(selector, system));
  const add = (pkg: T) => {
    if (checked.has(pkg.manifest.id)) return;
    if (!compatible(pkg))
      throw new Error(`${pkg.manifest.id} is not compatible with ${system} and module API ${MODULE_API}`);
    checked.add(pkg.manifest.id);
    for (const required of pkg.manifest.requires) {
      let dependency = selected.get(required.id);
      if (!dependency) {
        const matches = library.filter(
          (p) =>
            p.manifest.id === required.id && compatible(p) && (!required.hash || p.hash === required.hash),
        );
        if (matches.length !== 1)
          throw new Error(
            matches.length
              ? `${pkg.manifest.id} requires ${required.id}: choose an installed version explicitly`
              : `${pkg.manifest.id} requires missing package ${required.id}${required.hash ? ` at SHA-256 ${required.hash}` : ""}`,
          );
        dependency = matches[0]!;
        selected.set(required.id, dependency);
      }
      if (required.hash && dependency.hash !== required.hash)
        throw new Error(
          `${pkg.manifest.id} requires ${required.id} at SHA-256 ${required.hash}; selected ${dependency.hash}`,
        );
      add(dependency);
    }
  };
  for (const root of roots) add(root);
  return planComposition([...selected.values()]);
}
