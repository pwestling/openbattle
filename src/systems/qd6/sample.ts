import type { ImportedRoster } from "../wh40k/roster";
import { buildUnit, type UnitSpec, type WeaponSpec } from "./roster";

/**
 * Three invented armies for Quality d6, so the game can be tried without a
 * list. Every name and number is made up for this app.
 */

const knife: WeaponSpec = { name: "Knife", attacks: 1 };

const cinderLegion: UnitSpec[] = [
  {
    name: "Legion Captain",
    size: 1,
    quality: 3,
    defense: 4,
    points: 75,
    rules: ["Hero", "Tough(3)", "Fearless"],
    weapons: [
      { name: "Lever Pistol", range: 12, attacks: 2, rules: ["AP(1)"] },
      { name: "Sabre", attacks: 3, rules: ["AP(1)"] },
    ],
  },
  {
    name: "Line Riflemen",
    size: 10,
    quality: 4,
    defense: 4,
    points: 110,
    rules: [],
    weapons: [{ name: "Long Rifle", range: 24, attacks: 1 }, knife],
  },
  {
    name: "Breacher Squad",
    size: 5,
    quality: 4,
    defense: 4,
    points: 95,
    rules: ["Furious"],
    weapons: [
      { name: "Scattergun", range: 12, attacks: 2, rules: ["AP(1)"] },
      { name: "Hatchet", attacks: 1 },
    ],
  },
  {
    name: "Mortar Team",
    size: 2,
    quality: 4,
    defense: 5,
    points: 70,
    rules: [],
    weapons: [
      { name: "Field Mortar", range: 30, attacks: 1, rules: ["Indirect", "Blast(3)"], count: 1 },
      knife,
    ],
  },
  {
    name: "Ridge Walker",
    size: 1,
    quality: 4,
    defense: 2,
    points: 150,
    rules: ["Tough(6)", "Fearless"],
    weapons: [
      { name: "Twin Autogun", range: 24, attacks: 4, rules: ["AP(1)"] },
      { name: "Stamp", attacks: 3, rules: ["AP(1)"] },
    ],
  },
];

const thornkin: UnitSpec[] = [
  {
    name: "Brood Matron",
    size: 1,
    quality: 3,
    defense: 4,
    points: 85,
    rules: ["Hero", "Tough(3)", "Regeneration", "Fast"],
    weapons: [{ name: "Hooked Talons", attacks: 4, rules: ["AP(1)", "Rending"] }],
  },
  {
    name: "Thornlings",
    size: 10,
    quality: 4,
    defense: 6,
    points: 100,
    rules: ["Fast", "Furious"],
    weapons: [{ name: "Barbed Claws", attacks: 2 }],
  },
  {
    name: "Spine Throwers",
    size: 5,
    quality: 5,
    defense: 5,
    points: 70,
    rules: ["Stealth"],
    weapons: [
      { name: "Spine Sling", range: 18, attacks: 2, rules: ["Poison"] },
      { name: "Barbs", attacks: 1 },
    ],
  },
  {
    name: "Bramble Brute",
    size: 1,
    quality: 4,
    defense: 3,
    points: 160,
    rules: ["Tough(6)", "Impact(3)", "Fearless", "Furious"],
    weapons: [{ name: "Crushing Limbs", attacks: 5, rules: ["AP(2)", "Deadly(2)"] }],
  },
];

const glassChoir: UnitSpec[] = [
  {
    name: "Choir Seer",
    size: 1,
    quality: 3,
    defense: 4,
    points: 90,
    rules: ["Hero", "Tough(3)", "Stealth"],
    weapons: [
      { name: "Shard Wand", range: 18, attacks: 2, rules: ["AP(2)", "Reliable"] },
      { name: "Glass Edge", attacks: 2 },
    ],
  },
  {
    name: "Shard Lancers",
    size: 5,
    quality: 3,
    defense: 4,
    points: 130,
    rules: ["Relentless"],
    weapons: [{ name: "Lance Rifle", range: 30, attacks: 1, rules: ["AP(2)", "Lock-On"] }, knife],
  },
  {
    name: "Veil Skimmers",
    size: 3,
    quality: 4,
    defense: 4,
    points: 135,
    rules: ["Flying", "Fast", "Tough(3)"],
    weapons: [
      { name: "Prism Carbine", range: 18, attacks: 2, rules: ["AP(1)"] },
      { name: "Prow Blade", attacks: 2 },
    ],
  },
  {
    name: "Echo Marksman",
    size: 1,
    quality: 3,
    defense: 5,
    points: 45,
    rules: ["Scout"],
    weapons: [{ name: "Echo Rifle", range: 30, attacks: 1, rules: ["AP(1)", "Sniper"] }, knife],
  },
  {
    name: "Choir Wardens",
    size: 5,
    quality: 4,
    defense: 3,
    points: 85,
    rules: ["Fearless"],
    weapons: [{ name: "Glaive", attacks: 2, rules: ["AP(1)"] }],
  },
];

function army(name: string, color: string, specs: UnitSpec[]): ImportedRoster {
  const units = specs.map(buildUnit);
  return { name, color, points: units.reduce((n, u) => n + (u.sheet.points ?? 0), 0), units, warnings: [] };
}

/** Every sample army a player can pick. */
export const qd6Armies = (): ImportedRoster[] => [
  army("Cinder Legion", "#b5552e", cinderLegion),
  army("Thornkin Brood", "#4f7a32", thornkin),
  army("Glass Choir", "#4a7fb0", glassChoir),
];

/** A ready-made invented army: 0 = Cinder Legion, 1 = Thornkin Brood. */
export function qd6Sample(seat: 0 | 1): ImportedRoster {
  return qd6Armies()[seat]!;
}
