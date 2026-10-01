import { defineDoctrines } from "./define";

/** When and how doctrines are offered (design: Doctrinas por jugador). */
export const DOCTRINE = {
  /** Offered at the close of every wave that is a multiple of this. */
  everyWaves: 5,
  offerSize: 3,
  /** Gold for the one reroll each offer allows. */
  rerollCost: 40,
} as const;

/** Adding a doctrine is adding an entry here. Each one touches only the player who picks it. */
export const DOCTRINES = defineDoctrines({
  wideAuras: { label: "Barrio", line: "tus auras llegan una celda más lejos", fits: "aura", auraRadius: 1 },
  tougherWalls: { label: "Candado", line: "tus tranqueras nuevas aguantan la mitad más", fits: "wall", wallHpPct: 50 },
  savings: { label: "Colchón", line: "más interés y más tope, solo para vos", fits: "income", interestPct: 2, interestCapGold: 5 },
  firstCheap: { label: "Rebaja", line: "la primera torre de cada oleada te sale más barata", firstTowerDiscountPct: 20 },
  quickAbilities: { label: "Manija", line: "tus habilidades se recargan más rápido", abilityCooldownPct: 15 },
  heavyBlast: {
    label: "Dinamita",
    line: "tu explosivo le pega más a los pesados",
    fits: "explosive",
    armorBonus: { attack: "explosive", armor: "heavy", pct: 10 },
  },
});

export type DoctrineKind = keyof typeof DOCTRINES;

export const DOCTRINE_KINDS = Object.keys(DOCTRINES) as DoctrineKind[];
