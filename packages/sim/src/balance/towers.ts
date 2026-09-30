import { defineTowers, type Branch, type TowerDef } from "./define";

/** Adding a tower is adding an entry here. Types, stats, bot, shop and map derive from it (ADR 008). */
export const TOWERS = defineTowers({
  archer: {
    cost: 60,
    label: "Pincha",
    line: "tira rápido y barato",
    color: 0x6cc46c,
    attack: { type: "pierce", damage: 8, range: 2500, cooldown: 8 },
    branches: {
      a: { label: "Al gordo", line: "de lejos y siempre al de más vida", attack: { range: 4000 }, targeting: "mostHp" },
      b: { label: "A lo loco", line: "el doble de tiros, de cerca", attack: { cooldown: 4, range: 1500 } },
    },
  },
  mage: {
    cost: 70,
    label: "Maldice",
    line: "pega fuerte y de lejos",
    color: 0x5ab0ff,
    attack: { type: "magic", damage: 14, range: 3000, cooldown: 12 },
    branches: {
      a: { label: "Mal de ojo", line: "más daño por golpe", attack: { damage: 24 } },
      b: { label: "Contagio", line: "el golpe se pasa a un vecino", chain: 1 },
    },
  },
  hammer: {
    cost: 90,
    label: "Mazazo",
    line: "un golpe pesado cada tanto",
    color: 0xc9a27a,
    attack: { type: "blunt", damage: 36, range: 2000, cooldown: 24 },
    branches: {
      a: { label: "Piña", line: "más pesado, más lento", attack: { damage: 80, cooldown: 36 } },
      b: { label: "Sacudón", line: "pega a todos los pegados al objetivo", attack: { splash: 600 } },
    },
  },
  cannon: {
    cost: 105,
    label: "Reviente",
    line: "explota en área",
    color: 0xf0954a,
    attack: { type: "explosive", damage: 40, range: 3000, cooldown: 30, splash: 700 },
    branches: {
      a: { label: "Bombazo", line: "más daño, misma área", attack: { damage: 60 } },
      b: { label: "Cañita voladora", line: "vuela lejos, no tira a lo que tiene encima", attack: { range: 5000 }, minRange: 2000 },
    },
  },
  frost: {
    cost: 70,
    label: "Heladera",
    line: "frena al que pasa",
    color: 0x9fd8ff,
    control: { effect: "slow", range: 2500, cooldown: 10, pct: 40, duration: 40 },
    branches: {
      a: { label: "Freezer", line: "frena más y dura más", control: { pct: 55, duration: 60 } },
      b: { label: "Ola polar", line: "frena a todos en un área, menos", control: { pct: 25, splash: 1000 } },
    },
  },
  thunder: {
    cost: 110,
    label: "Cachetazo",
    line: "aturde a todos alrededor",
    color: 0xfff07a,
    control: { effect: "stun", range: 2500, cooldown: 120, duration: 20, splash: 1000 },
    branches: {
      a: { label: "Nocaut", line: "aturde más tiempo", control: { duration: 35 } },
      b: { label: "Chirlo", line: "seguido y a uno solo", control: { cooldown: 40, splash: 0 } },
    },
  },
  radar: {
    cost: 80,
    label: "Chusma",
    line: "ve lo que nadie ve",
    color: 0xd0d0d0,
    reveal: { range: 6000 },
    branches: {
      a: { label: "Portera", line: "ve más lejos", reveal: { range: 9000 } },
      b: { label: "Escrache", line: "lo que ve recibe más daño de todos", markPct: 10 },
    },
  },
  wall: { cost: 50, label: "Tranquera", line: "corta el camino hasta que la tiran", color: 0x8a8070, wall: { hp: 300, cooldown: 400 } },
  aura: {
    cost: 80,
    label: "Hinchada",
    line: "los vecinos pegan más",
    color: 0xb07cf0,
    aura: { stat: "damage", radius: 2, bonusPct: 25 },
    branches: {
      a: { label: "Barra brava", line: "radio 1, bono alto", aura: { radius: 1, bonusPct: 60 } },
      b: { label: "Popular", line: "un radio más, menos bono", aura: { radius: 3, bonusPct: 20 } },
    },
  },
  haste: {
    cost: 80,
    label: "Mate",
    line: "los vecinos disparan más seguido",
    color: 0x7ad0c8,
    aura: { stat: "rate", radius: 2, bonusPct: 25 },
    branches: {
      a: { label: "Café", line: "más cadencia", aura: { bonusPct: 40 } },
      b: { label: "Catalejo", line: "los vecinos llegan más lejos en vez de tirar más seguido", aura: { stat: "range", bonusPct: 30 } },
    },
  },
  greed: {
    cost: 100,
    label: "Propina",
    line: "lo que matan los vecinos te paga a vos",
    color: 0xe0c060,
    aura: { stat: "gold", radius: 2, bonusPct: 50 },
    branches: {
      a: { label: "Coima", line: "más porcentaje para vos", aura: { bonusPct: 80 } },
      b: { label: "Vaquita", line: "el extra se reparte entre todos, menos", aura: { bonusPct: 25 }, auraShared: true },
    },
  },
  mine: {
    cost: 100,
    label: "Alcancía",
    line: "oro por oleada, para vos",
    color: 0xf4c542,
    income: { perWave: 15 },
    branches: {
      a: { label: "Plazo fijo", line: "más oro por oleada", income: { perWave: 30 } },
      b: { label: "Caja de ahorro", line: "en vez de oro, sube tu tope de interés", income: { perWave: 20 }, incomeMode: "interestCap" },
    },
  },
});

export type TowerKind = keyof typeof TOWERS;

/** The definition that applies to this tower: its branch's once it chose one at level 3. */
export function towerDef(tower: { kind: TowerKind; branch: Branch | null }): TowerDef {
  const base = TOWERS[tower.kind];
  return tower.branch !== null && base.branches ? base.branches[tower.branch].def : base;
}

/** Declaration order: the bot's "cheapest" tie-break and the shop follow it. */
export const TOWER_KINDS = Object.keys(TOWERS) as TowerKind[];

export type { TowerDef, Branch } from "./define";

/** Percent of everything invested (build plus upgrades) a player gets back when selling. */
export const SELL_REFUND_PCT = 75;

export const UPGRADE = {
  maxLevel: 3,
  /** Each level adds this percent of the base damage. */
  damagePctPerLevel: 50,
  /** Each aura level adds this many percent points to its bonus. */
  auraBonusPctPerLevel: 10,
  /** Each control level adds this percent of the base effect (slow percent or stun duration). */
  controlPctPerLevel: 25,
  /** Each mine level adds this percent of the base income. */
  incomePctPerLevel: 50,
  /** Each upgrade costs this percent of the tower's base cost. */
  costPctPerLevel: 100,
} as const;
