import { type Address } from "viem";

import { campaignKey } from "../lib/campaigns";
import {
  fetchCurveCampaigns,
  fetchCurveVaults,
  stakeDaoStrategyUrl,
  type StakeDaoCampaign,
  type StakeDaoVault,
  votemarketGaugeUrl,
} from "../lib/stakeDaoApi";
import { type PoolCampaign, type StakeDaoPoolCampaign } from "../lib/types";

const week = 7 * 24 * 60 * 60;

const voteDeadline = (campaign: StakeDaoCampaign) =>
  campaign.endTimestamp - week;

const isRunning = ({
  campaign,
  nowSeconds,
}: {
  campaign: StakeDaoCampaign;
  nowSeconds: number;
}) =>
  !campaign.isCanceled &&
  !campaign.isClosed &&
  voteDeadline(campaign) > nowSeconds;

const vaultKey = ({ chainId, gauge }: { chainId: number; gauge: Address }) =>
  `${chainId}-${gauge.toLowerCase()}`;

const toVaultsByGauge = (vaults: StakeDaoVault[]) =>
  new Map(
    vaults.map((vault) => [
      vaultKey({ chainId: vault.chainId, gauge: vault.gaugeAddress }),
      vault.vault,
    ]),
  );

// A bribe can target any gauge, whether or not StakeDao has deployed a vault
// wrapping it, so a missing vault falls back to the gauge's votemarket page
// rather than dropping the campaign.
const toPoolCampaign = function ({
  campaign,
  vaultsByGauge,
}: {
  campaign: StakeDaoCampaign;
  vaultsByGauge: Map<string, Address>;
}): StakeDaoPoolCampaign {
  const vault = vaultsByGauge.get(
    vaultKey({ chainId: campaign.gaugeChainId, gauge: campaign.gauge }),
  );
  const { price, symbol } = campaign.rewardToken;

  return {
    campaignNumber: campaign.id,
    endTimestamp: voteDeadline(campaign),
    id: campaign.key,
    rewardTokenSymbol: symbol,
    source: "stakeDao",
    totalRewardUsd: Number(campaign.totalRewardAmount) * price,
    url: vault
      ? stakeDaoStrategyUrl({ chainId: campaign.gaugeChainId, vault })
      : votemarketGaugeUrl({
          chainId: campaign.gaugeChainId,
          gauge: campaign.gauge,
        }),
    usdPerVote: Number(campaign.currentPeriod.rewardPerVote) * price,
    weeklyRewardUsd: Number(campaign.currentPeriod.rewardPerPeriod) * price,
  };
};

export const fetchStakeDaoCampaigns = async function (
  identifiers: string[],
): Promise<Record<string, PoolCampaign[]>> {
  const [allCampaigns, vaults] = await Promise.all([
    fetchCurveCampaigns(identifiers),
    fetchCurveVaults(),
  ]);
  const vaultsByGauge = toVaultsByGauge(vaults);
  const nowSeconds = Date.now() / 1000;

  const campaigns: Record<string, PoolCampaign[]> = {};
  for (const campaign of allCampaigns.filter((candidate) =>
    isRunning({ campaign: candidate, nowSeconds }),
  )) {
    const key = campaignKey({
      address: campaign.gauge,
      chainId: campaign.gaugeChainId,
    });
    campaigns[key] = [
      ...(campaigns[key] ?? []),
      toPoolCampaign({ campaign, vaultsByGauge }),
    ];
  }
  return campaigns;
};
