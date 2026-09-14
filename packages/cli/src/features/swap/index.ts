import { type Command } from "commander";

import { register as allowance } from "./commands/allowance.ts";
import { register as approve } from "./commands/approve.ts";
import { register as cooldown } from "./commands/cooldown.ts";
import { register as cooldownEnabled } from "./commands/cooldownEnabled.ts";
import { register as isInstantRedeem } from "./commands/isInstantRedeem.ts";
import { register as maxOut } from "./commands/maxOut.ts";
import { register as mint } from "./commands/mint.ts";
import { register as mintFee } from "./commands/mintFee.ts";
import { register as peggedToken } from "./commands/peggedToken.ts";
import { register as previewMint } from "./commands/previewMint.ts";
import { register as price } from "./commands/price.ts";
import { register as redeemFee } from "./commands/redeemFee.ts";
import { register as sendToQueue } from "./commands/sendToQueue.ts";
import { register as tokenConfig } from "./commands/tokenConfig.ts";
import { register as treasury } from "./commands/treasury.ts";
import { register as whitelistedTokens } from "./commands/whitelistedTokens.ts";

const swapCommands = [
  allowance,
  approve,
  cooldown,
  cooldownEnabled,
  isInstantRedeem,
  maxOut,
  mint,
  mintFee,
  peggedToken,
  previewMint,
  price,
  redeemFee,
  sendToQueue,
  tokenConfig,
  treasury,
  whitelistedTokens,
];

export function register(program: Command) {
  const swap = program
    .command("swap")
    .description("Swap operations (whitelisted ↔ pegged token)");

  swapCommands.forEach((registerCommand) => registerCommand(swap));
}
