import { GameState, Player, Action, PlayerClass, PLAYER_CLASSES, PLAYER_NAME_MAX_LENGTH, PLAYER_BACKSTORY_MAX_LENGTH, PLAYER_NAME_MIN_LENGTH } from '@openquests/schema';

interface ParsedCharacter {
    name?: string;
    charClass?: PlayerClass;
    backstory?: string;
}

export function parseIssueBody(body: string): ParsedCharacter {
    const result: ParsedCharacter = {};

    // Clean body
    const lines = body.replace(/\r\n/g, '\n').split('\n');

    let currentSection = '';

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Detect Sections
        if (line.match(/^##\s+Character Name/i)) {
            currentSection = 'NAME';
            continue;
        }
        if (line.match(/^##\s+Class/i)) {
            currentSection = 'CLASS';
            continue;
        }
        if (line.match(/^##\s+Backstory/i)) {
            currentSection = 'BACKSTORY';
            continue;
        }

        // Parse Content based on section
        if (currentSection === 'NAME') {
            if (line && !line.startsWith('(') && !line.startsWith('##')) {
                result.name = line.trim().slice(0, PLAYER_NAME_MAX_LENGTH);
            }
        }

        if (currentSection === 'CLASS') {
            if (line && !line.startsWith('(') && !line.startsWith('##') && !result.charClass) {
                const className = line.trim();
                const validClass = PLAYER_CLASSES.find(c => c === className);
                if (validClass) {
                    result.charClass = validClass;
                }
            }
        }

        if (currentSection === 'BACKSTORY') {
            if (line && !line.startsWith('(') && !line.startsWith('##')) {
                result.backstory = (result.backstory || '') + line + '\n';
            }
        }
    }

    if (result.backstory) {
        result.backstory = result.backstory.trim().slice(0, PLAYER_BACKSTORY_MAX_LENGTH);
    }

    return result;
}
