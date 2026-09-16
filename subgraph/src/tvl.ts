import { BigInt, dataSource, ethereum } from "@graphprotocol/graph-ts";

import { TvlHistory, TvlTokenHistory } from "../generated/schema";
import {
  Gateway,
  // The code generated is the same for both gateways
} from "../generated/vusdGateway/Gateway";
import { PeggedToken } from "../generated/vusdGateway/PeggedToken";
import { Treasury } from "../generated/vusdGateway/Treasury";

const daySeconds = BigInt.fromI32(86400);

export function handleBlock(block: ethereum.Block): void {
  const gatewayAddress = dataSource.address();

  const dayTimestamp = block.timestamp.div(daySeconds).times(daySeconds);
  // Stored under the previous day, matching VaultHistory, so both series line
  // up when charted together.
  const previousDayTimestamp = dayTimestamp.minus(daySeconds);
  const id = `${gatewayAddress.toHexString()}-${previousDayTimestamp.toString()}`;
  if (TvlHistory.load(id) != null) {
    return;
  }

  const gateway = Gateway.bind(gatewayAddress);

  const amoSupplyResult = gateway.try_amoSupply();
  const peggedTokenResult = gateway.try_PEGGED_TOKEN();
  const treasuryResult = gateway.try_treasury();
  if (
    amoSupplyResult.reverted ||
    peggedTokenResult.reverted ||
    treasuryResult.reverted
  ) {
    return;
  }

  const totalSupplyResult = PeggedToken.bind(
    peggedTokenResult.value,
  ).try_totalSupply();
  if (totalSupplyResult.reverted) {
    return;
  }

  const treasury = Treasury.bind(treasuryResult.value);
  const whitelistedResult = treasury.try_whitelistedTokens();
  if (whitelistedResult.reverted) {
    return;
  }

  const entity = new TvlHistory(id);
  entity.amoSupply = amoSupplyResult.value;
  entity.gatewayAddress = gatewayAddress;
  entity.timestamp = previousDayTimestamp;
  entity.totalSupply = totalSupplyResult.value;

  entity.save();

  const tokens = whitelistedResult.value;
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    const withdrawableResult = treasury.try_withdrawable(token);
    if (withdrawableResult.reverted) {
      continue;
    }

    const tokenEntity = new TvlTokenHistory(`${id}-${token.toHexString()}`);
    tokenEntity.tokenAddress = token;
    tokenEntity.tvlHistory = id;
    tokenEntity.withdrawable = withdrawableResult.value;

    // Leave the price unset rather than skipping the token: the row is
    // immutable and the day is never revisited, so its withdrawable would be
    // lost for good.
    const priceResult = treasury.try_getPrice(token);
    if (!priceResult.reverted) {
      tokenEntity.price = priceResult.value.get_latestPrice();
      tokenEntity.unitPrice = priceResult.value.get_unitPrice();
    }

    tokenEntity.save();
  }
}
