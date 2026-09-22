import { type Address } from "viem";
import { describe, expect, it } from "vitest";

import { type StakeDaoCampaign, type StakeDaoVault } from "../lib/stakeDaoApi";

import { toPoolCampaign, toVaultsByGauge } from "./fetchStakeDaoCampaigns";

const gauge = "0x28a72343bFf5e10b36E72d86b1041ED2447Dc0Cc" as Address;
const vault = "0x757360820728819953937B752f6B83AeB11090c7" as Address;

const campaign = {
  currentPeriod: { rewardPerPeriod: "500", rewardPerVote: "0.000275" },
  endTimestamp: 2_000_000,
  gauge,
  gaugeChainId: 1,
  id: 1739,
  isCanceled: false,
  isClosed: false,
  key: "42161-8c2c-14d9-1739",
  rewardToken: { price: 1, symbol: "USDC" },
  totalRewardAmount: "1000",
} satisfies StakeDaoCampaign;

describe("toPoolCampaign", function () {
  it("links to the StakeDao strategy page when the gauge has a known vault", function () {
    const vaultsByGauge = toVaultsByGauge([
      { chainId: 1, gaugeAddress: gauge, vault } satisfies StakeDaoVault,
    ]);

    expect(toPoolCampaign({ campaign, vaultsByGauge }).url).toBe(
      `https://app.stakedao.org/strategy?protocol=curve&vault=1-${vault}`,
    );
  });

  it("falls back to the votemarket gauge page when no vault is known", function () {
    const vaultsByGauge = toVaultsByGauge([]);

    expect(toPoolCampaign({ campaign, vaultsByGauge }).url).toBe(
      `https://votemarket.stakedao.org/curve/gauge/1-${gauge}`,
    );
  });
});
