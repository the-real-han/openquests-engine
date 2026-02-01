import { PlayerClass } from "@openquests/schema"

export type DiceRange = {
    min?: number
    max?: number
}

export type GatheringRule = {
    dice?: DiceRange
    reward: number
    messages: string[]
}

export type GatheringRuleSet = {
    action: "GATHER"
    defaultReward: number
    rules: GatheringRule[]
}

export type WeightedOutcome = {
    type: string
    weight: number
}

export type ResolutionRule = {
    dice?: { min?: number; max?: number }
    reward?: number
    amount?: number
    xp?: number
    messages: string[]
}

export type ExploreRuleSet = {
    action: "EXPLORE"
    outcomes: WeightedOutcome[]
    resolution: Record<string, {
        rules: ResolutionRule[]
    }>
}

export type AttackClanResolutionRule = {
    diceDiff?: DiceRange

    // Rewards / penalties
    foodSteal?: number
    woodShield?: number

    // Narrative variation
    messages: string[]
}

export type AttackMonsterRule = {
    dice?: DiceRange
    xp: number
    kill?: boolean
    messages: string[]
}

export type AttackMonsterRuleSet = {
    action: "ATTACK_MONSTER"
    defaultXp: number
    rules: AttackMonsterRule[]
}

export type Title = {
    id: string,
    title: string,
    requirement: {
        field: string,
        operator: string,
        value: number
    },
    bonus: {
        food: number,
        wood: number,
        gold: number,
        xp: number,
        fortune: number
    }
}

export type Boss = {
    id: string,
    name: string,
    locationId: string,
    durationDays: number,
    requirements: {
        minPlayers: number,
        classCount: Record<PlayerClass, number>
    },
    rewards: {
        xp: number
    },
    failureReward: {
        xp: number
    },
    messages: {
        appear: string[],
        success: string[],
        fail: string[]
    }
}

export type LocationEvent = {
    id: string
    type: "WEATHER" | "INVASION" | "BLESSING" | "CURSE"
    effects: {
        explore?: number        // flat modifier
        gather?: {
            food?: number
            wood?: number
            gold?: number
        }
        fortune?: number        // dice modifier
        clanResourceLossPct?: {
            food?: number
            wood?: number
            gold?: number
        }
    }

    messages: string[]
}