#!/usr/bin/env node

import { runTick } from "./index";
import { handleComment } from "./handle_comment";

const [, , command] = process.argv;

async function main() {
    switch (command) {
        case "tick":
            await runTick();
            break;

        case "handle-comment":
            await handleComment();
            break;

        default:
            console.error(`
Usage:
  openquests init
  openquests tick
  openquests handle-comment
`);
            process.exit(1);
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
