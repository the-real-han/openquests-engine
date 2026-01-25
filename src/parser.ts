import { GameState, Player, Action, PlayerClass, PLAYER_CLASSES } from '@openquests/schema';

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
        if (line.match(/^##\s+Optional Backstory/i)) {
            currentSection = 'BACKSTORY';
            continue;
        }

        // Parse Content based on section
        if (currentSection === 'NAME') {
            if (line && !line.startsWith('(') && !line.startsWith('##')) {
                result.name = line;
            }
        }

        if (currentSection === 'CLASS') {
            const match = line.match(/- \[[xX]\] (.+)/);
            if (match && !result.charClass) {
                const className = match[1].trim();
                // Validate against allowed classes
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
        result.backstory = result.backstory.trim();
    }

    return result;
}
