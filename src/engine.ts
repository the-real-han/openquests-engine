import { GameState, Action, TickResult, Player, LocationModifier, LocationState, PlayerClass, Title } from '@openquests/schema';
import { buildLocationNarrationInput, buildWorldNarrationInput, generateLocationSummary, generateWorldSummary } from './story';
import EXPLORE_RULES from "./rules/exploring.rules.json";
import GATHERING_RULES from "./rules/gathering.rules.json";
import ATTACK_CLAN_RULES from "./rules/attackClan.rules.json";
import { AttackClanResolutionRule, ExploreRuleSet, GatheringRuleSet, LocationEvent, ResolutionRule } from './rules/types';
import ATTACK_MONSTER_RULES from "./rules/attackMonster.rules.json";
import TITLES from "./rules/title.rules.json";
import BOSS_RULES from "./rules/boss.rules.json";
import { AttackMonsterRuleSet, AttackMonsterRule } from "./rules/types";
import LOCATION_EVENTS from "./rules/locationEvent.rules.json";

function pushMessage(p: Player, msg: string) {
    p.message += (p.message ? "\n" : "") + msg;
}

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
    attackerDice: number,
    defenderDice: number
) {
    let attackRoll = attackerDice;
    let defendRoll = defenderDice;

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

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const lvBonusCap = 2
const lvBonusMultiplier = 1.05

function multiplyXp(baseXp: number, player: Player) {
    return Math.floor(baseXp * Math.min(Math.pow(lvBonusMultiplier, player.character.level), lvBonusCap))
}

function lvUp(player: Player) {
    const currentLv = player.character.level;
    // lv1 - 9xp, lv2 - 16xp, lv3 - 25xp, lv4 - 36xp...
    const requiredXp = (currentLv + 2) * (currentLv + 2);
    if (player.character.xp >= requiredXp) {
        player.character.level++;
        player.character.xp -= requiredXp;
        pushMessage(player, `[LEVEL UP: ${player.character.level}]`);
    }
}

function multiplyResources(baseAmount: number, player: Player) {
    return Math.floor(baseAmount * Math.min(Math.pow(lvBonusMultiplier, player.character.level), lvBonusCap))
}

type DiceFn = () => number;

function rollRandomDice(): number {
    return Math.floor(Math.random() * 20) + 1;
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

function getFieldValue(obj: any, path: string) {
    return path.split('.').reduce((o, k) => o?.[k], obj);
}

function compare(a: number, op: string, b: number) {
    switch (op) {
        case '>=': return a >= b;
        case '>': return a > b;
        case '==': return a === b;
        case '<=': return a <= b;
        case '<': return a < b;
        default: return false;
    }
}

function checkAndGrantTitles(player: Player, titles: Title[]) {
    for (const t of titles) {
        if (player.character.titles.find(title => title.id === t.id)) continue;

        const current = getFieldValue(player, t.requirement.field);

        if (compare(current, t.requirement.operator, t.requirement.value)) {
            player.character.titles.push(t);
            pushMessage(player, `[TITLE UNLOCKED: ${t.title}]`);
        }
    }
}

function getTitleBonus(player: Player, bonusType: 'food' | 'wood' | 'gold' | 'xp' | 'fortune') {
    const titleBonusTotal = player.character.titles.reduce((sum, title) => {
        const t = (TITLES as Title[]).find(t => t.id === title.id);
        return sum + (t?.bonus?.[bonusType] || 0);
    }, 0);
    return Math.min(3, titleBonusTotal);
}

function maybeSpawnBoss(previousState: GameState, state: GameState, rollDice: DiceFn) {
    if (previousState.activeBoss || state.activeBoss) return

    // 20% chance of spawning boss
    if (rollDice() > 16) {
        const boss = BOSS_RULES[rollDice() % BOSS_RULES.length] // or weighted pick later

        const monstersLocation = Object.values(state.locations).find(l => l.clanId === 'monsters')

        state.activeBoss = {
            bossId: boss.id,
            locationId: monstersLocation?.id ?? '',
            appearedOn: state.day,
            expiresOn: state.day + boss.durationDays,
            participants: []
        }

        state.activeEvents.push({
            id: `boss_appeared_${boss.id}_${state.day}`,
            type: "BOSS_APPEARED",
            day: state.day,
            location: monstersLocation?.name ?? '',
            data: { bossName: boss.name, message: boss.messages.appear[state.day % boss.messages.appear.length] }
        })
    }
}

function resolveBossIfNeeded(state: GameState) {
    const active = state.activeBoss
    if (!active) return

    const bossRule = BOSS_RULES.find(b => b.id === active.bossId)!
    const players = active.participants.map(id => state.players[id])

    const hasEnoughPlayers =
        players.length >= bossRule.requirements.minPlayers

    const hasRequiredClasses = Object.entries(
        bossRule.requirements.classCount || {}
    ).every(([cls, count]) =>
        players.filter(p => p.character.class === cls).length >= count
    )

    const success = hasEnoughPlayers && hasRequiredClasses

    if (success) {
        const msg =
            bossRule.messages.success[
            state.day % bossRule.messages.success.length
            ]

        for (const p of players) {
            const xp = multiplyXp(bossRule.rewards.xp, p) + getTitleBonus(p, "xp")
            p.character.xp += xp
            p.meta.bossKilled++;
            p.meta.monsterEncountered++;
            pushMessage(p, `[+${xp} xp] Defeated ${bossRule.name}.`)
            lvUp(p)
        }

        state.activeEvents.push({
            id: `boss_defeated_${bossRule.id}_${state.day}`,
            type: "BOSS_DEFEATED",
            day: state.day,
            location: state.locations[active.locationId].name,
            data: { bossName: bossRule.name, message: msg }
        })

        state.activeBoss = null
        return
    }

    // Not defeated yet
    const msg =
        bossRule.messages.fail[
        state.day % bossRule.messages.fail.length
        ]

    for (const p of players) {
        const xp = multiplyXp(bossRule.failureReward.xp, p) + getTitleBonus(p, "xp")
        p.character.xp += xp
        p.meta.monsterEncountered++;
        pushMessage(p, `[+${xp} xp] ${bossRule.name} is no ordinary creature, try attacking with more allies.`)
        lvUp(p)
    }

    active.participants = []

    if (state.day >= active.expiresOn) {
        state.activeEvents.push({
            id: `boss_failed_${bossRule.id}_${state.day}`,
            type: "BOSS_DISAPPEARED",
            day: state.day,
            location: state.locations[active.locationId].name,
            data: { bossName: bossRule.name, message: msg }
        })
        state.activeBoss = null
    }
}

function maybeSpawnLocationModifiers(
    state: GameState,
    locationId: string,
    rollDice: DiceFn
) {
    const modifiers: LocationModifier[] = []

    // 30% chance per day
    if (rollDice() < 6) {

        const location = state.locations[locationId]
        const locationEvent = LOCATION_EVENTS[Math.abs(rollDice()) % LOCATION_EVENTS.length] as LocationEvent
        if (!(location.clanId === "monsters" && locationEvent.type !== "WEATHER")) {
            modifiers.push({
                locationId: location.id,
                startedOn: state.day,
                ...locationEvent
            })
        }
    }

    state.activeModifiers = modifiers
    for (const modifier of modifiers) {
        state.activeEvents.push({
            id: `locmod_${modifier.id}_${state.day}`,
            type: modifier.type,
            day: state.day,
            location: state.locations[modifier.locationId].name,
            data: {
                message: modifier.messages[rollDice() % modifier.messages.length]
            }
        })
    }
}

function getActiveLocationModifier(
    state: GameState,
    location?: LocationState
): LocationModifier | null {
    if (!location || !state.activeModifiers) return null
    return state.activeModifiers.find(m => m.locationId === location.id) ?? null
}

function waitMessage(): string {
    return "You take a moment to observe. When you act again, the world will answer."
}

/**
 * Pure function to process a single tick of the game world.
 * Must be deterministic and side-effect free.
 */ //
export async function processTick(initialState: GameState, actions: Action[], rollDice: DiceFn = rollRandomDice): Promise<TickResult> {

    // Deep copy state to ensure immutability during processing
    const nextState = JSON.parse(JSON.stringify(initialState)) as GameState;

    const rollWithFortune = function (
        rollDice: () => number,
        player: Player,
        ignoreLocation = false,
        min = 1,
        max = 20
    ) {
        const base = rollDice();
        const fortune = getTitleBonus(player, 'fortune');
        const location = Object.values(nextState.locations).find(l => l.clanId === player.character.clanId);
        const locationModifier = getActiveLocationModifier(nextState, location);
        const fortuneMod = ignoreLocation ? 0 : (locationModifier?.effects.fortune ?? 0)
        return Math.max(min, Math.min(max, base + fortune + fortuneMod));
    }

    console.log("Processing previous day")

    const uniqueActions = [...new Map(actions.map(item => [item.playerId, item])).values()];


    // 2. Process Actions
    const gatheringActions: Action[] = uniqueActions.filter(action => action.type === 'GATHER');
    const explorationActions: Action[] = uniqueActions.filter(action => action.type === 'EXPLORE');
    const attackClanActions: Action[] = uniqueActions.filter(action => action.type === 'ATTACK' && action.target !== 'wildrift');
    const attackMonstersActions: Action[] = uniqueActions.filter(action => action.type === 'ATTACK' && action.target === 'wildrift');
    const waitActions: Action[] = uniqueActions.filter(action => action.type === 'WAIT');

    console.log("Process gathering actions")
    for (const action of gatheringActions) {
        const player = nextState.players[action.playerId];

        if (!player) {
            console.warn(`Action received for unknown player ${action.playerId}`);
            continue;
        }

        const clan = nextState.clans[player.character.clanId];
        const location = Object.values(nextState.locations).find(l => l.clanId === clan.id);
        const locationModifier = getActiveLocationModifier(nextState, location);
        const diceRolled = rollWithFortune(rollDice, player);
        const { reward, messages } = resolveGathering(diceRolled);
        const finalReward = multiplyResources(reward, player) + getTitleBonus(player, action.target as ClanResource) + (locationModifier?.effects?.gather?.[action.target as ClanResource] ?? 0);

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
        pushMessage(player, `[+${finalReward} ${action.target}] ${messages[rollDice() % messages.length]}`);
    }

    console.log("Process exploration actions")
    for (const action of explorationActions) {
        const player = nextState.players[action.playerId];

        if (!player) {
            console.warn(`Action received for unknown player ${action.playerId}`);
            continue;
        }

        const clan = nextState.clans[player.character.clanId];
        const targetLocation = Object.values(nextState.locations).find(l => l.id === action.target);
        const targetModifier = getActiveLocationModifier(nextState, targetLocation);
        const diceRolled = rollWithFortune(rollDice, player, true) + (targetModifier?.effects.explore ?? 0);
        const outcomeRoll = rollDice();
        const outcome = pickWeighted((EXPLORE_RULES as ExploreRuleSet).outcomes, outcomeRoll).type;
        const ruleset = (EXPLORE_RULES as ExploreRuleSet).resolution[outcome];

        if (outcome === "trap") {
            const resource = trapLossTypes[rollDice() % trapLossTypes.length];
            const rule = resolveExploring(diceRolled, ruleset.rules);

            if (rule.xp) {
                const xp = multiplyXp(rule.xp, player) + getTitleBonus(player, 'xp');
                player.character.xp += xp;
                pushMessage(player, `[+${xp} xp] ${rule.messages[rollDice() % rule.messages.length]}`);
                lvUp(player);
            } else {
                const finalAmount = multiplyResources(rule.amount!, player);
                clan[resource] = Math.max(0, clan[resource] - finalAmount);
                pushMessage(player, `[-${finalAmount} ${resource}] ${rule.messages[rollDice() % rule.messages.length].replace("{resource}", resource)}`);
            }
        } else {
            const rule = resolveExploring(diceRolled, ruleset.rules);
            let reward = rule.reward!;

            if (outcome === "xp") {
                const xp = multiplyXp(reward, player) + getTitleBonus(player, 'xp');
                player.character.xp += xp;
                pushMessage(player, `[+${xp} xp] ${rule.messages[rollDice() % rule.messages.length]}`);
                lvUp(player);
            } else if (!clan.defeatedBy) {
                reward = multiplyResources(reward, player) + getTitleBonus(player, outcome as ClanResource);
                player.meta[outcome as ClanResource] += reward;
                clan[outcome as ClanResource] += reward;
                pushMessage(player, `[+${reward} ${outcome}] ${rule.messages[rollDice() % rule.messages.length].replace("{resource}", outcome)}`);
            } else {
                pushMessage(player, "Your clan has fallen. The spoils of exploration cannot be brought home.");
            }
        }
        player.meta.exploreCount++;
    }


    console.log("Process attack actions")
    for (const action of attackClanActions) {
        const attacker = nextState.players[action.playerId];
        if (!attacker) continue;

        const attackerClan = nextState.clans[attacker.character.clanId];
        const targetLocation = nextState.locations[action.target!];
        if (!targetLocation) {
            pushMessage(attacker, "Your target could not be found.");
            continue;
        }

        const defenderClan = nextState.clans[targetLocation.clanId];
        if (!defenderClan || defenderClan.defeatedBy || defenderClan.food <= 0) {
            pushMessage(attacker, "The clan you sought has already fallen.");
            continue;
        }

        if (defenderClan.id === attackerClan.id) {
            pushMessage(attacker, "Brother, point your weapon at your enemy. You cannot attack your own clan.");
            continue;
        }

        // Cost
        const goldCost = ATTACK_CLAN_RULES.cost.gold;
        if (attackerClan.gold < goldCost) {
            pushMessage(attacker, "Your clan lacks the gold to wage war.");
            continue;
        }
        attackerClan.gold -= goldCost;

        const defenders = Object.values(nextState.players).filter(
            p => p.character.clanId === defenderClan.id
        );

        // random defender or sandbag if no defenders
        const defender = defenders.length ? defenders[rollDice() % defenders.length] : {
            playerId: -1,
            github: {
                username: "Sandbag",
                issueNumber: -1,
                userId: -1,
            },
            character: {
                clanId: defenderClan.id,
                class: "Adventurer" as PlayerClass,
                level: 1,
                xp: 0,
                name: "Sandbag",
                titles: [],
                backstory: ""
            },
            message: "You feel ready for adventure!",
            history: [],
            meta: {
                joinedDay: 1,
                lastActionDay: 1,
                gatherFoodCount: 0,
                gatherWoodCount: 0,
                gatherGoldCount: 0,
                food: 0,
                wood: 0,
                gold: 0,
                exploreCount: 0,
                attackCount: 0,
                playerWins: 0,
                playerLosses: 0,
                monsterKilled: 0,
                bossKilled: 0,
                monsterEncountered: 0,
                attackWinStreak: 0,
                attackLoseStreak: 0,
                attackedCount: 0,
            }
        }

        const result = resolveAttackClan(
            attacker,
            defender,
            rollWithFortune(rollDice, attacker),
            rollWithFortune(rollDice, defender)
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

            pushMessage(attacker, `[+${food} food] ${msg}`);

            if (defenderClan.food === 0) {
                defenderClan.wood = 0;
                defenderClan.gold = 0;
                defenderClan.defeatedBy = attackerClan.id;
                const finalMsg = ATTACK_CLAN_RULES.destruction.foodZero.messages[rollDice() % ATTACK_CLAN_RULES.destruction.foodZero.messages.length].replace("${clanName}", defenderClan.name)
                pushMessage(attacker, finalMsg);
                defenders.forEach(d => {
                    pushMessage(d, finalMsg);
                });
            }
        } else {
            attacker.meta.attackCount++;
            attacker.meta.attackWinStreak = 0;
            attacker.meta.attackLoseStreak++;
            attacker.meta.playerLosses++;
            defender.meta.attackedCount++;
            defender.meta.playerWins++;
            pushMessage(attacker, msg);
        }
    }

    console.log("Process attack monsters actions")
    for (const action of attackMonstersActions) {
        const player = nextState.players[action.playerId];
        if (!player) continue;

        const boss = nextState.activeBoss
        if (boss) {
            if (!boss.participants.includes(player.playerId)) {
                boss.participants.push(player.playerId)
            }

            pushMessage(player, "You join the hunt against a legendary foe, " + BOSS_RULES.find(b => b.id === boss.bossId)?.name)
            continue
        }

        const location = Object.values(nextState.locations).find(l => l.id === "wildrift");
        const locationModifier = getActiveLocationModifier(nextState, location);
        const monsterFortunePenalty = locationModifier?.effects.fortune ?? 0;

        const dice = rollWithFortune(rollDice, player) - monsterFortunePenalty;
        const rule = resolveAttackMonster(dice);

        player.meta.monsterEncountered++;



        if (rule.kill) {
            player.meta.monsterKilled++;
        }

        let xp = rule.xp;
        xp = multiplyXp(xp, player) + getTitleBonus(player, 'xp');
        player.character.xp += xp;

        const msg =
            rule.messages[rollDice() % rule.messages.length];

        pushMessage(player, `[+${xp} xp] ${msg}`);

        lvUp(player);
    }


    console.log("Process wait actions")
    for (const action of waitActions) {
        const player = nextState.players[action.playerId];

        if (!player) {
            console.warn(`Action received for unknown player ${action.playerId}`);
            continue;
        }

        pushMessage(player, waitMessage());
    }

    // resolve world event
    console.log("Process world event")
    for (const mod of nextState.activeModifiers ?? []) {
        const clan = nextState.clans[nextState.locations[mod.locationId].clanId]
        if (!clan || clan.defeatedBy || !mod.effects.clanResourceLossPct) continue

        for (const res of ["food", "wood", "gold"] as const) {
            const pct = mod.effects.clanResourceLossPct[res]
            if (!pct) continue

            const loss = Math.floor(clan[res] * pct)
            clan[res] = Math.max(0, clan[res] - loss)
        }
    }

    console.log("Process boss fight")
    // BOSS FIGHT
    resolveBossIfNeeded(nextState);


    console.log("Apply titles")
    // Apply Titles (after all actions this tick)
    for (const player of Object.values(nextState.players)) {
        checkAndGrantTitles(player, TITLES as Title[]);
    }

    const counts = {} as Record<string, number>;
    let maxCount = 0;
    let mostFrequentExploration = "";

    explorationActions.forEach(action => {
        if (!action.target) return;
        counts[action.target] = (counts[action.target] || 0) + 1;
        if (counts[action.target] > maxCount) {
            maxCount = counts[action.target];
            mostFrequentExploration = action.target;
        }
    });

    if (mostFrequentExploration === "wildrift") {
        console.log("looking for new BOSS")
        maybeSpawnBoss(initialState, nextState, rollDice);
    } else {
        console.log("looking for new world events")
        maybeSpawnLocationModifiers(nextState, mostFrequentExploration, rollDice);
    }

    // process clan daily bonus
    console.log("Give clan daily bonus")
    for (const clan of Object.values(nextState.clans)) {
        if (clan.bonus.wood === undefined && clan.bonus.food === undefined && clan.bonus.gold === undefined) {
            // black clan, random bonus
            const res = ["food", "wood", "gold"][rollDice() % 3]
            clan[res as ClanResource] += 15
            continue
        }
        for (const res of ["food", "wood", "gold"] as const) {
            const bonus = clan.bonus[res]
            if (bonus === undefined) continue
            clan[res] += bonus
        }
    }

    console.log("Update player history")
    for (const player of Object.values(nextState.players)) {
        const action = actions.find(a => a.playerId === player.playerId.toString()) ?? null;
        if (!player.history) player.history = [];
        player.history.push({
            day: nextState.day,
            action: action ? {
                type: action.type,
                target: action.target ?? ""
            } : undefined,
            summary: player.message
        })
        if (player.history.length > 5) {
            player.history.shift();
        }
    }

    console.log("Update world history")
    const worldHistoryEntry = buildWorldNarrationInput(nextState);
    const worldNarration = await generateWorldSummary(worldHistoryEntry);
    worldHistoryEntry.summary = worldNarration;
    if (!nextState.history) nextState.history = [];
    nextState.history.push(worldHistoryEntry);

    console.log("Update location history")
    for (const location of Object.values(nextState.locations)) {
        await sleep(20000);  // Commented out for tests - uncomment for production rate limiting
        const locationHistoryEntry = buildLocationNarrationInput(initialState, nextState, location);
        const locationNarration = await generateLocationSummary(locationHistoryEntry);
        locationHistoryEntry.summary = locationNarration;
        if (!location.history) location.history = [];
        location.history.push(locationHistoryEntry);
    }


    // 4. Generate Narrative
    const narrativeSummary = `Day ${nextState.day} has ended.`;
    nextState.day += 1;

    return {
        newState: nextState,
        narrativeSummary
    };
}
