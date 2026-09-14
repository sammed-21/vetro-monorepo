import { previewDeposit } from "@vetro-protocol/gateway/actions";
import { type Command } from "commander";
import { parseUnits } from "viem";

import { parseAmount } from "../../../lib/args.ts";
import { type GlobalOptions, createVetroClient } from "../../../lib/client.ts";
import { printResult } from "../../../lib/output.ts";
import { resolveWhitelistedToken } from "../../../lib/tokens.ts";

export function register(swap: Command) {
  swap
    .command("preview-mint")
    .description(
      "Print the pegged token that would be minted for a whitelisted token deposit, in the pegged token's decimals",
    )
    .requiredOption(
      "--from <token>",
      "Whitelisted token to deposit, by symbol or address",
    )
    .requiredOption("--amount <n>", "Amount in human units", parseAmount)
    .action(async function (
      options: { amount: string; from: string },
      command: Command,
    ) {
      const { client } = await createVetroClient(
        command.optsWithGlobals<GlobalOptions>(),
      );
      const tokenIn = await resolveWhitelistedToken({
        client,
        value: options.from,
      });

      const amountIn = parseUnits(options.amount, tokenIn.decimals);
      if (amountIn === 0n) {
        throw new Error(
          `Amount is below one unit of "${options.from}": it rounds down to 0`,
        );
      }

      const peggedTokenOut = await previewDeposit(client, {
        address: tokenIn.gatewayAddress,
        amountIn,
        tokenIn: tokenIn.address,
      });
      printResult(peggedTokenOut);
    });
}
