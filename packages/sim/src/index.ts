export { BALANCE_VERSION, FP, TEAM_OWNER, TICKS_PER_SECOND } from "./constants";
export type * from "./types";
export { createInitialState, type InitialStateOptions, type PlayerSetup } from "./state";
export { step, cloneState } from "./step";
export {
  applyCommand,
  findPlayer,
  sellRefund,
  upgradeCost,
  investedIn,
  towerDamage,
  towerIncome,
  auraBonusOf,
  controlPctOf,
  controlDurationOf,
  mayManage,
  underAttack,
  validateBuild,
  validateCommand,
  type RejectReason,
} from "./commands";
export { hashState } from "./hash";
export { canSubmitRecord } from "./records";
export { dumpState } from "./dump";
export { createBot, type Bot, type BotMode } from "./bot/index";
export { getMap, isInside, isPathCell, isBuildable, pathCells, distanceToPath, pathIndex } from "./grid";
export { pathLength, positionAt, cellCenterFP } from "./path";
export { MAPS, MAP_IDS, DEFAULT_MAP, isMapId, type MapId, type MapDef, type Point } from "./balance/maps";
export { TOWERS, TOWER_KINDS, SELL_REFUND_PCT, UPGRADE, towerDef, type TowerDef, type Branch } from "./balance/towers";
export {
  hasAttack,
  hasAura,
  hasControl,
  hasIncome,
  hasReveal,
  hasWall,
  AURA_STATS,
  CONTROL_EFFECTS,
  type TowerSpec,
  type AttackSpec,
  type AuraSpec,
  type AuraStat,
  type ControlSpec,
  type ControlEffect,
  type IncomeSpec,
  type RevealSpec,
  type WallSpec,
  type BranchSpec,
  type BranchDef,
  type Targeting,
  TARGETINGS,
  ABILITY_TARGETS,
  type AbilitySpec,
  type AbilityDef,
  type AbilityLevel,
  type AbilityTarget,
} from "./balance/define";
export { ABILITIES, ABILITY_KINDS, abilityLevel } from "./balance/abilities";
export { ENEMIES, ENEMY_KINDS, type EnemyDef, type EnemySpec } from "./balance/enemies";
export { AFFIXES, BOSS_AFFIXES, type BossAffix } from "./balance/affixes";
export { bossAffix, initialShield } from "./affixes";
export { isRevealed } from "./systems/targeting";
export {
  ATTACK_TYPES,
  ARMORS,
  DAMAGE_TABLE,
  ATTACK_LABELS,
  ARMOR_LABELS,
  damageMultiplier,
  type AttackType,
  type Armor,
} from "./balance/damage";
export { WAVES, type WaveDef, type SpawnGroup } from "./balance/waves";
export { GAME } from "./balance/game";
export { PLAYER_COLORS } from "./balance/players";
export { isPlayerColor, pickColor } from "./colors";
export { currentTarget, damageAgainst, effectiveCooldown, effectiveRange } from "./systems/towers";
export { currentSpeed } from "./systems/move";
export { upcomingWaves, multiplierAgainstWaves, bestAttackTower, wavesNeedReveal } from "./preview";
export { ECONOMY } from "./balance/economy";
export { attenuatedBounty, scaledEnemyHp, startingGold, interestOn, callWaveBonus, callQuorum } from "./economy";
