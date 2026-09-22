import { describe, expect, it } from "vitest";

import {
  campaignLabel,
  endingSoonThresholdSeconds,
  endsSoon,
} from "./campaigns";
import { type PoolCampaign } from "./types";

const day = 24 * 60 * 60;

describe("endsSoon", function () {
  it("flags a campaign well inside the window", function () {
    expect(endsSoon(endingSoonThresholdSeconds / 2)).toBe(true);
  });

  it("flags a campaign just inside the boundary", function () {
    expect(endsSoon(endingSoonThresholdSeconds - 1)).toBe(true);
  });

  it("leaves a campaign on the boundary alone", function () {
    expect(endsSoon(endingSoonThresholdSeconds)).toBe(false);
  });

  it("leaves a campaign well outside the window alone", function () {
    expect(endsSoon(endingSoonThresholdSeconds + 30 * day)).toBe(false);
  });
});

const nowSeconds = 1_000_000;

const merklCampaign = {
  aprPercent: 5,
  dailyRewardsUsd: 100,
  endTimestamp: nowSeconds + 3 * day,
  id: "merkl-1",
  name: "VUSD pool",
  rewardTokenSymbol: "VUSD",
  source: "merkl",
  tvlUsd: 1000,
  url: "https://app.merkl.xyz",
} satisfies PoolCampaign;

const stakeDaoCampaign = {
  campaignNumber: 1891,
  endTimestamp: nowSeconds + 30 * day,
  id: "stake-dao-1",
  rewardTokenSymbol: "USDC",
  source: "stakeDao",
  totalRewardUsd: 11000,
  url: "https://app.stakedao.org/strategy?protocol=curve&vault=1-0x102A475c8d660fDe678D108DCc6D4A2227661AF2",
  usdPerVote: 0.000065,
  weeklyRewardUsd: 211,
} satisfies PoolCampaign;

describe("campaignLabel", function () {
  it("names the source, the reward token and the time left", function () {
    expect(campaignLabel({ campaign: merklCampaign, nowSeconds })).toBe(
      "Merkl · VUSD · 3d",
    );
    expect(campaignLabel({ campaign: stakeDaoCampaign, nowSeconds })).toBe(
      "StakeDAO · USDC · 30d",
    );
  });
});
