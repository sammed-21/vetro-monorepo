import fetch from "fetch-plus-plus";
import { type Address } from "viem";

type StakeDaoPeriod = {
  rewardPerPeriod: string;
  rewardPerVote: string;
};

export type StakeDaoCampaign = {
  currentPeriod: StakeDaoPeriod;
  endTimestamp: number; // seconds
  gauge: Address;
  gaugeChainId: number;
  id: number;
  isCanceled: boolean;
  isClosed: boolean;
  key: string;
  rewardToken: { price: number; symbol: string };
  totalRewardAmount: string;
};

// The gauge a Curve campaign runs on and the StakeDao vault wrapping it — the
// votemarket API above only knows about gauges, so the vault (needed to link
// to the strategy page) comes from this separate StakeDao endpoint.
export type StakeDaoVault = {
  chainId: number;
  gaugeAddress: Address;
  vault: Address;
};

const stakeDaoProxyApiUrl = "/api/stakedao";

export const fetchCurveCampaigns = (
  gauges: string[],
): Promise<StakeDaoCampaign[]> =>
  fetch(`${stakeDaoProxyApiUrl}/campaigns`, {
    queryString: { gauges: gauges.join(",") },
  });

export const fetchCurveVaults = (): Promise<StakeDaoVault[]> =>
  fetch(`${stakeDaoProxyApiUrl}/vaults`);

export const stakeDaoStrategyUrl = ({
  chainId,
  vault,
}: {
  chainId: number;
  vault: Address;
}) =>
  `https://app.stakedao.org/strategy?protocol=curve&vault=${chainId}-${vault}`;

// Fallback for a campaign whose gauge has no StakeDao vault deployed (bribes
// can target any gauge, regardless of whether StakeDao wraps it in a vault),
// so no strategy page exists to link to.
export const votemarketGaugeUrl = ({
  chainId,
  gauge,
}: {
  chainId: number;
  gauge: Address;
}) => `https://votemarket.stakedao.org/curve/gauge/${chainId}-${gauge}`;
