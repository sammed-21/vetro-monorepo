import { gatewayAddresses } from "@vetro-protocol/gateway";
import { previewDeposit } from "@vetro-protocol/gateway/actions";
import { parseUnits } from "viem";
import { describe, expect, inject, it } from "vitest";

import {
  createClients,
  runCli,
  runCliRaw,
  swapAmount,
  usdc,
  vusd,
} from "./helpers.ts";

describe("swap preview-mint", function () {
  const rpcUrl = inject("anvilUrl");
  const { publicClient } = createClients(rpcUrl);
  const [gateway] = gatewayAddresses;

  const previewMintOnFork = (extra: string[] = []) => [
    "swap",
    "preview-mint",
    ...extra,
    "--rpc-url",
    rpcUrl,
  ];

  it("reads the preview by symbol", async function () {
    const preview = await runCli(
      previewMintOnFork(["--from", usdc.symbol, "--amount", swapAmount]),
    );
    const expected = await previewDeposit(publicClient, {
      address: gateway,
      amountIn: parseUnits(swapAmount, usdc.decimals),
      tokenIn: usdc.address,
    });
    expect(preview).toBe(expected.toString());
  });

  it("reads the same preview by address as by symbol", async function () {
    const bySymbol = await runCli(
      previewMintOnFork(["--from", usdc.symbol, "--amount", swapAmount]),
    );
    const byAddress = await runCli(
      previewMintOnFork(["--from", usdc.address, "--amount", swapAmount]),
    );
    expect(byAddress).toBe(bySymbol);
  });

  it("rejects a pegged token", async function () {
    const { exitCode, stderr } = await runCliRaw(
      previewMintOnFork(["--from", vusd.symbol, "--amount", swapAmount]),
    );
    expect(exitCode).toBe(1);
    expect(JSON.parse(stderr).error).toBe(
      `Not a whitelisted token: "${vusd.symbol}"`,
    );
  });

  it.for([
    [["--amount", swapAmount], "required option '--from <token>'"],
    [["--from", usdc.symbol], "required option '--amount <n>'"],
  ] as const)(
    "rejects a missing option: %s",
    async function ([extra, message]) {
      const { exitCode, stderr } = await runCliRaw(
        previewMintOnFork([...extra]),
      );
      expect(exitCode).toBe(1);
      expect(stderr).toContain(message);
    },
  );

  it("rejects an amount that rounds down to zero", async function () {
    const { exitCode, stderr } = await runCliRaw(
      previewMintOnFork(["--from", usdc.symbol, "--amount", "0.0000001"]),
    );
    expect(exitCode).toBe(1);
    expect(JSON.parse(stderr).error).toBe(
      `Amount is below one unit of "${usdc.symbol}": it rounds down to 0`,
    );
  });

  it.for(["0", "abc", "-1"])(
    "rejects --amount %s as a usage error",
    async function (amount) {
      const { exitCode, stderr } = await runCliRaw(
        previewMintOnFork(["--from", usdc.symbol, "--amount", amount]),
      );
      expect(exitCode).toBe(1);
      expect(stderr).toContain("option '--amount");
    },
  );
});
