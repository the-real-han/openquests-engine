import { GameState, Action, TickResult, Player, Clan } from '@openquests/schema';
import { generateWorldLog } from './world_log';
import EXPLORE_RULES from "./rules/exploring.rules.json";
import GATHERING_RULES from "./rules/gathering.rules.json";
import ATTACK_CLAN_RULES from "./rules/attackClan.rules.json";
import { AttackClanResolutionRule, ExploreRuleSet, GatheringRuleSet, ResolutionRule } from './rules/types';
import ATTACK_MONSTER_RULES from "./rules/attackMonster.rules.json";
import { AttackMonsterRuleSet, AttackMonsterRule } from "./rules/types";

function resolveAttackMonster(dice: number): AttackMonsterRule {
    const ruleset = ATTACK_MONSTER_RULES as AttackMonsterRuleSet;
    return ruleset.rules.find(r => matchDice(dice, r.dice))!;
}

function resolveGathering(dice: number) {
    return (GATHERING_RULES as GatheringRuleSet).rules.find(r =>
        matchDice(dice, r.dice)
    )!;
}

function pickWeighted<T extends { weight: number }>(
    items: T[],
    roll: number
): T {
    const total = items.reduce((s, i) => s + i.weight, 0);
    let r = roll % total;

    for (const item of items) {
        if (r < item.weight) return item;
        r -= item.weight;
    }
    return items[0];
}

function resolveExploring(dice: number, rules: ResolutionRule[]) {
    return rules.find(r => matchDice(dice, r.dice))!;
}

function resolveCombatRule(
    diff: number,
    rules: AttackClanResolutionRule[]
) {
    return rules.find(r => matchDice(diff, r.diceDiff))!;
}

function resolveAttackClan(
    attacker: Player,
    defender: Player,
    rollDice: DiceFn
) {
    let attackRoll = rollDice();
    let defendRoll = rollDice();

    if (hasAdvantage(attacker.character.class, defender.character.class)) {
        attackRoll += ATTACK_CLAN_RULES.advantage.bonus;
    } else if (hasAdvantage(defender.character.class, attacker.character.class)) {
        defendRoll += ATTACK_CLAN_RULES.advantage.bonus;
    }

    const diff = attackRoll - defendRoll;

    if (diff > 0) {
        return {
            type: "win",
            rule: resolveCombatRule(diff, ATTACK_CLAN_RULES.combat.win.rules),
            diff
        };
    }

    return {
        type: "lose",
        rule: resolveCombatRule(diff, ATTACK_CLAN_RULES.combat.lose.rules),
        diff
    };
}

function multiplyXp(baseXp: number, player: Player) {
    return Math.floor(baseXp * Math.pow(1.1, player.character.level))
}

function lvUp(player: Player) {
    const currentLv = player.character.level;
    // lv1 - 9xp, lv2 - 16xp, lv3 - 25xp, lv4 - 36xp...
    const requiredXp = (currentLv + 2) * (currentLv + 2);
    if (player.character.xp >= requiredXp) {
        player.character.level++;
        player.character.xp -= requiredXp;
        player.message += ` [LEVEL UP: ${player.character.level}]`;
    }
}

function multiplyResources(baseAmount: number, player: Player) {
    return Math.floor(baseAmount * Math.pow(1.05, player.character.level))
}

type DiceFn = () => number;

function rollRandomDice(): number {
    return Math.floor(Math.random() * 20) + 1;
}

function waitMessage(): string {
    return "You take a moment to observe. When you act again, the world will answer."
}


type ClanResource = "food" | "wood" | "gold";

const trapLossTypes: ClanResource[] = ["food", "food", "wood", "gold"];

const CLASS_ADVANTAGE: Record<string, string[]> = {
    Warrior: ["Lancer"],
    Lancer: ["Archer"],
    Archer: ["Monk"],
    Monk: ["Warrior"],
    Adventurer: []
};

function hasAdvantage(attacker: string, defender: string): boolean {
    return CLASS_ADVANTAGE[attacker]?.includes(defender) ?? false;
}

function matchDice(dice: number, range?: { min?: number; max?: number }) {
    if (!range) return true
    if (range.min !== undefined && dice < range.min) return false
    if (range.max !== undefined && dice > range.max) return false
    return true
}


/**
 * Pure function to process a single tick of the game world.
 * Must be deterministic and side-effect free.
 */ //
export function processTick(initialState: GameState, actions: Action[], rollDice: DiceFn = rollRandomDice): TickResult {
    // Deep copy state to ensure immutability during processing
    const nextState = JSON.parse(JSON.stringify(initialState)) as GameState;

    // 1. Advance Day
    nextState.day += 1;
    const uniqueActions = [...new Map(actions.map(item => [item.playerId, item])).values()];

    // 2. Process Actions
    const gatheringActions: Action[] = uniqueActions.filter(action => action.type === 'GATHER');
    const explorationActions: Action[] = uniqueActions.filter(action => action.type === 'EXPLORE');
    const attackClanActions: Action[] = uniqueActions.filter(action => action.type === 'ATTACK' && action.target !== 'monsters_base');
    const attackMonstersActions: Action[] = uniqueActions.filter(action => action.type === 'ATTACK' && action.target === 'monsters_base');
    const waitActions: Action[] = uniqueActions.filter(action => action.type === 'WAIT');

    for (const action of gatheringActions) {
        const player = nextState.players[action.playerId];

        if (!player) {
            console.warn(`Action received for unknown player ${action.playerId}`);
            continue;
        }

        const clan = nextState.clans[player.character.clanId];
        const diceRolled = rollDice();
        const { reward, messages } = resolveGathering(diceRolled);
        const finalReward = multiplyResources(reward, player);

        switch (action.target) {
            case "food":
                player.meta.gatherFoodCount++;
                player.meta.food += finalReward;
                clan.defeatedBy ? null : clan.food += finalReward;
                break;
            case "wood":
                player.meta.gatherWoodCount++;
                player.meta.wood += finalReward;
                clan.defeatedBy ? null : clan.wood += finalReward;
                break;
            case "gold":
                player.meta.gatherGoldCount++;
                player.meta.gold += finalReward;
                clan.defeatedBy ? null : clan.gold += finalReward;
                break;
        }
        player.message += `[+${finalReward} ${action.target}] ${messages[rollDice() % messages.length]}`;
    }

    for (const action of explorationActions) {
        const player = nextState.players[action.playerId];

        if (!player) {
            console.warn(`Action received for unknown player ${action.playerId}`);
            continue;
        }

        const clan = nextState.clans[player.character.clanId];
        const diceRolled = rollDice();
        const outcomeRoll = rollDice();
        const outcome = pickWeighted((EXPLORE_RULES as ExploreRuleSet).outcomes, outcomeRoll).type;
        const ruleset = (EXPLORE_RULES as ExploreRuleSet).resolution[outcome];

        if (outcome === "trap") {
            const resource = trapLossTypes[rollDice() % trapLossTypes.length];
            const rule = resolveExploring(diceRolled, ruleset.rules);

            if (rule.xp) {
                const xp = multiplyXp(rule.xp, player);
                player.character.xp += xp;
                player.message += `[+${xp} xp] ${rule.messages[rollDice() % rule.messages.length]}`;
                lvUp(player);
            } else {
                const finalAmount = multiplyResources(rule.amount!, player);
                clan[resource] = Math.max(0, clan[resource] - finalAmount);
                player.message += `[-${finalAmount} ${resource}] ${rule.messages[rollDice() % rule.messages.length].replace("{resource}", resource)}`;
            }
        } else {
            const rule = resolveExploring(diceRolled, ruleset.rules);
            let reward = rule.reward!;

            if (outcome === "xp") {
                const xp = multiplyXp(reward, player);
                player.character.xp += xp;
                player.message += `[+${xp} xp] ${rule.messages[rollDice() % rule.messages.length]}`;
                lvUp(player);
            } else if (!clan.defeatedBy) {
                reward = multiplyResources(reward, player);
                player.meta[outcome as ClanResource] += reward;
                clan[outcome as ClanResource] += reward;
            }
            player.message += `[+${reward} ${outcome}] ${rule.messages[rollDice() % rule.messages.length].replace("{resource}", outcome)}`;
        }
        player.meta.exploreCount++;
    }


    for (const action of attackClanActions) {
        const attacker = nextState.players[action.playerId];
        if (!attacker) continue;

        const attackerClan = nextState.clans[attacker.character.clanId];
        const targetLocation = nextState.locations[action.target!];
        if (!targetLocation) {
            attacker.message += "Your target could not be found.";
            continue;
        }

        const defenderClan = nextState.clans[targetLocation.clanId];
        if (!defenderClan || defenderClan.food <= 0) {
            attacker.message += "The clan you sought has already fallen.";
            continue;
        }

        if (defenderClan.id === attackerClan.id) {
            attacker.message += "Brothen, point your weapon at your enemy. You cannot attack your own clan.";
            continue;
        }

        // Cost
        const goldCost = ATTACK_CLAN_RULES.cost.gold;
        if (attackerClan.gold < goldCost) {
            attacker.message += "Your clan lacks the gold to wage war.";
            continue;
        }
        attackerClan.gold -= goldCost;

        const defenders = Object.values(nextState.players).filter(
            p => p.character.clanId === defenderClan.id
        );
        if (!defenders.length) {
            attacker.message += "You found no defenders — only ruins.";
            continue;
        }

        const defender = defenders[rollDice() % defenders.length];

        const result = resolveAttackClan(
            attacker,
            defender,
            rollDice
        );

        const msg =
            result.rule.messages[rollDice() % result.rule.messages.length].replace("${clanName}", defenderClan.name);

        if (result.type === "win") {
            attacker.meta.attackCount++;
            attacker.meta.attackWinStreak++;
            attacker.meta.attackLoseStreak = 0;
            attacker.meta.playerWins++;
            defender.meta.attackedCount++;
            defender.meta.playerLosses++;

            let food = multiplyResources(result.rule.foodSteal!, attacker);
            if (defenderClan.wood > 0) {
                const woodUsed = Math.min(defenderClan.wood, multiplyResources(result.rule.woodShield!, attacker));
                defenderClan.wood -= woodUsed;
                food -= woodUsed;
            }

            defenderClan.food = Math.max(0, defenderClan.food - food);
            if (!attackerClan.defeatedBy) {
                attackerClan.food += food;
            }

            attacker.message += `[+${food} food] ${msg}`;

            if (defenderClan.food === 0) {
                defenderClan.defeatedBy = attackerClan.id;
                const finalMsg = ATTACK_CLAN_RULES.destruction.foodZero.messages[rollDice() % ATTACK_CLAN_RULES.destruction.foodZero.messages.length].replace("${clanName}", defenderClan.name)
                attacker.message += "\n" + finalMsg;
                defenders.forEach(d => {
                    d.message = finalMsg + "\n" + d.message;
                });
            }
        } else {
            attacker.meta.attackCount++;
            attacker.meta.attackWinStreak = 0;
            attacker.meta.attackLoseStreak++;
            attacker.meta.playerLosses++;
            defender.meta.attackedCount++;
            defender.meta.playerWins++;
            attacker.message += msg;
        }
    }

    for (const action of attackMonstersActions) {
        const player = nextState.players[action.playerId];
        if (!player) continue;

        const dice = rollDice();
        const rule = resolveAttackMonster(dice);

        player.meta.monsterEncountered++;

        if (rule.kill) {
            player.meta.monsterKilled++;
        }

        let xp = rule.xp;
        xp = multiplyXp(xp, player);
        player.character.xp += xp;

        const msg =
            rule.messages[rollDice() % rule.messages.length];

        player.message += `[+${xp} xp] ${msg}`;

        lvUp(player);
    }


    for (const action of waitActions) {
        const player = nextState.players[action.playerId];

        if (!player) {
            console.warn(`Action received for unknown player ${action.playerId}`);
            continue;
        }

        player.message += waitMessage()
    }

    // TODO
    // Titles
    // 

    // 3. Update World & Generate Logs
    const worldLog = generateWorldLog(nextState);
    nextState.worldLog = worldLog;

    if (!nextState.locationLogs) nextState.locationLogs = {};

    for (const location of Object.values(nextState.locations)) {
        const population = Object.values(nextState.players).filter((p: Player) =>
            p.character.clanId === location.clanId
        ).length;

        let summary = '';
        if (population === 0) summary = "The area is quiet and undisturbed.";
        else if (population === 1) summary = "A lone adventurer lingers here.";
        else if (population < 5) summary = "A small group of adventurers gather here.";
        else summary = "The location buzzes with activity.";

        // Append static flavor
        summary += ` ${location.description}`;

        nextState.locationLogs[location.id] = {
            day: nextState.day,
            summary: summary,
            population: population,
            notes: []
        };
    }

    // 4. Generate Narrative
    const narrativeSummary = `Day ${nextState.day} has ended. Travelers moved between the known locations.`;

    return {
        newState: nextState,
        narrativeSummary
    };
}
