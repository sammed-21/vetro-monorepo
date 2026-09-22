import { gatewayAddresses } from "@vetro-protocol/gateway";
import { previewRedeem } from "@vetro-protocol/gateway/actions";
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

describe("swap preview-redeem", function () {
  const rpcUrl = inject("anvilUrl");
  const { publicClient } = createClients(rpcUrl);
  const [gateway] = gatewayAddresses;

  const previewRedeemOnFork = (extra: string[] = []) => [
    "swap",
    "preview-redeem",
    ...extra,
    "--rpc-url",
    rpcUrl,
  ];

  it("reads the preview by symbol", async function () {
    const preview = await runCli(
      previewRedeemOnFork(["--to", usdc.symbol, "--amount", swapAmount]),
    );
    const expected = await previewRedeem(publicClient, {
      address: gateway,
      peggedTokenIn: parseUnits(swapAmount, vusd.decimals),
      tokenOut: usdc.address,
    });
    expect(preview).toBe(expected.toString());
  });

  it("reads the same preview by address as by symbol", async function () {
    const bySymbol = await runCli(
      previewRedeemOnFork(["--to", usdc.symbol, "--amount", swapAmount]),
    );
    const byAddress = await runCli(
      previewRedeemOnFork(["--to", usdc.address, "--amount", swapAmount]),
    );
    expect(byAddress).toBe(bySymbol);
  });

  it("rejects a pegged token", async function () {
    const { exitCode, stderr } = await runCliRaw(
      previewRedeemOnFork(["--to", vusd.symbol, "--amount", swapAmount]),
    );
    expect(exitCode).toBe(1);
    expect(JSON.parse(stderr).error).toBe(
      `Not a whitelisted token: "${vusd.symbol}"`,
    );
  });

  it.for([
    [["--amount", swapAmount], "required option '--to <token>'"],
    [["--to", usdc.symbol], "required option '--amount <n>'"],
  ] as const)(
    "rejects a missing option: %s",
    async function ([extra, message]) {
      const { exitCode, stderr } = await runCliRaw(
        previewRedeemOnFork([...extra]),
      );
      expect(exitCode).toBe(1);
      expect(stderr).toContain(message);
    },
  );

  it("rejects an amount that rounds down to zero", async function () {
    const { exitCode, stderr } = await runCliRaw(
      previewRedeemOnFork([
        "--to",
        usdc.symbol,
        "--amount",
        "0.0000000000000000001",
      ]),
    );
    expect(exitCode).toBe(1);
    expect(JSON.parse(stderr).error).toBe(
      `Amount is below one unit of "${vusd.symbol}": it rounds down to 0`,
    );
  });

  it("rejects an amount that pays out zero", async function () {
    const { exitCode, stderr } = await runCliRaw(
      previewRedeemOnFork(["--to", usdc.symbol, "--amount", "0.0000001"]),
    );
    expect(exitCode).toBe(1);
    expect(JSON.parse(stderr).error).toBe(
      `Amount is too small to redeem into "${usdc.symbol}": it pays out 0`,
    );
  });

  it.for(["0", "abc", "-1"])(
    "rejects --amount %s as a usage error",
    async function (amount) {
      const { exitCode, stderr } = await runCliRaw(
        previewRedeemOnFork(["--to", usdc.symbol, "--amount", amount]),
      );
      expect(exitCode).toBe(1);
      expect(stderr).toContain("option '--amount");
    },
  );
});
