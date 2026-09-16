import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts";
import {
  assert,
  beforeEach,
  clearStore,
  createMockedFunction,
  dataSourceMock,
  describe,
  test,
} from "matchstick-as/assembly/index";

import { TvlTokenHistory } from "../generated/schema";
import { handleBlock } from "../src/tvl";

import { createMockBlock } from "./earn-utils";

const gatewayAddressString = "0x4444444444444444444444444444444444444444";
const gatewayAddress = Address.fromString(gatewayAddressString);
const peggedTokenAddress = Address.fromString(
  "0x5555555555555555555555555555555555555555",
);
const treasuryAddress = Address.fromString(
  "0x6666666666666666666666666666666666666666",
);
const usdtAddressString = "0x7777777777777777777777777777777777777777";
const usdtAddress = Address.fromString(usdtAddressString);
const usdcAddressString = "0x8888888888888888888888888888888888888888";
const usdcAddress = Address.fromString(usdcAddressString);

const daySeconds = BigInt.fromI32(86400);
const unitPrice = BigInt.fromI32(100000000);

const getPriceSignature = "getPrice(address):(uint256,uint256)";
const withdrawableSignature = "withdrawable(address):(uint256)";

function buildHistoryId(timestamp: BigInt): string {
  const dayTimestamp = timestamp.div(daySeconds).times(daySeconds);
  return `${gatewayAddressString}-${dayTimestamp.minus(daySeconds).toString()}`;
}

function mockGatewayCalls(amoSupply: BigInt, totalSupply: BigInt): void {
  createMockedFunction(
    gatewayAddress,
    "PEGGED_TOKEN",
    "PEGGED_TOKEN():(address)",
  )
    .withArgs([])
    .returns([ethereum.Value.fromAddress(peggedTokenAddress)]);
  createMockedFunction(gatewayAddress, "amoSupply", "amoSupply():(uint256)")
    .withArgs([])
    .returns([ethereum.Value.fromUnsignedBigInt(amoSupply)]);
  createMockedFunction(gatewayAddress, "treasury", "treasury():(address)")
    .withArgs([])
    .returns([ethereum.Value.fromAddress(treasuryAddress)]);
  createMockedFunction(
    peggedTokenAddress,
    "totalSupply",
    "totalSupply():(uint256)",
  )
    .withArgs([])
    .returns([ethereum.Value.fromUnsignedBigInt(totalSupply)]);
}

function mockWhitelistedTokens(tokens: Address[]): void {
  createMockedFunction(
    treasuryAddress,
    "whitelistedTokens",
    "whitelistedTokens():(address[])",
  )
    .withArgs([])
    .returns([ethereum.Value.fromAddressArray(tokens)]);
}

function mockGetPrice(token: Address, price: BigInt): void {
  createMockedFunction(treasuryAddress, "getPrice", getPriceSignature)
    .withArgs([ethereum.Value.fromAddress(token)])
    .returns([
      ethereum.Value.fromUnsignedBigInt(price),
      ethereum.Value.fromUnsignedBigInt(unitPrice),
    ]);
}

function mockWithdrawable(token: Address, withdrawable: BigInt): void {
  createMockedFunction(treasuryAddress, "withdrawable", withdrawableSignature)
    .withArgs([ethereum.Value.fromAddress(token)])
    .returns([ethereum.Value.fromUnsignedBigInt(withdrawable)]);
}

function mockTokenCalls(
  token: Address,
  price: BigInt,
  withdrawable: BigInt,
): void {
  mockGetPrice(token, price);
  mockWithdrawable(token, withdrawable);
}

describe("handleBlock", function () {
  beforeEach(function () {
    clearStore();
    dataSourceMock.setAddress(gatewayAddressString);
  });

  test("creates TvlHistory and one TvlTokenHistory per whitelisted token", function () {
    const amoSupply = BigInt.fromString("10000000000000000000");
    const totalSupply = BigInt.fromString("443736408129313428461563");
    const usdtWithdrawable = BigInt.fromString("109581573710");
    const usdtPrice = BigInt.fromI32(99967390);
    const timestamp = BigInt.fromI32(1769731200); // 2026-01-30 00:00:00 UTC

    mockGatewayCalls(amoSupply, totalSupply);
    mockWhitelistedTokens([usdtAddress, usdcAddress]);
    mockTokenCalls(usdtAddress, usdtPrice, usdtWithdrawable);
    mockTokenCalls(
      usdcAddress,
      BigInt.fromI32(99991000),
      BigInt.fromString("258609609875"),
    );

    handleBlock(createMockBlock(BigInt.fromI32(100), timestamp));

    const id = `${gatewayAddressString}-1769644800`;

    assert.entityCount("TvlHistory", 1);
    assert.entityCount("TvlTokenHistory", 2);
    assert.fieldEquals("TvlHistory", id, "amoSupply", amoSupply.toString());
    assert.fieldEquals(
      "TvlHistory",
      id,
      "gatewayAddress",
      gatewayAddressString,
    );
    assert.fieldEquals("TvlHistory", id, "totalSupply", totalSupply.toString());
    assert.fieldEquals("TvlHistory", id, "timestamp", "1769644800");

    const usdtId = `${id}-${usdtAddressString}`;
    assert.fieldEquals(
      "TvlTokenHistory",
      usdtId,
      "price",
      usdtPrice.toString(),
    );
    assert.fieldEquals(
      "TvlTokenHistory",
      usdtId,
      "tokenAddress",
      usdtAddressString,
    );
    assert.fieldEquals("TvlTokenHistory", usdtId, "tvlHistory", id);
    assert.fieldEquals(
      "TvlTokenHistory",
      usdtId,
      "unitPrice",
      unitPrice.toString(),
    );
    assert.fieldEquals(
      "TvlTokenHistory",
      usdtId,
      "withdrawable",
      usdtWithdrawable.toString(),
    );
  });

  test("skips subsequent blocks on the same day", function () {
    const totalSupply = BigInt.fromString("443736408129313428461563");
    const timestamp1 = BigInt.fromI32(1769734800); // 2026-01-30 01:00:00 UTC
    const timestamp2 = BigInt.fromI32(1769774400); // 2026-01-30 12:00:00 UTC

    mockGatewayCalls(BigInt.fromI32(0), totalSupply);
    mockWhitelistedTokens([usdtAddress]);
    mockTokenCalls(
      usdtAddress,
      BigInt.fromI32(99967390),
      BigInt.fromString("109581573710"),
    );

    handleBlock(createMockBlock(BigInt.fromI32(100), timestamp1));

    const id = buildHistoryId(timestamp1);
    assert.entityCount("TvlHistory", 1);

    createMockedFunction(
      peggedTokenAddress,
      "totalSupply",
      "totalSupply():(uint256)",
    )
      .withArgs([])
      .returns([
        ethereum.Value.fromUnsignedBigInt(BigInt.fromString("999999999")),
      ]);

    handleBlock(createMockBlock(BigInt.fromI32(200), timestamp2));

    assert.entityCount("TvlHistory", 1);
    assert.fieldEquals("TvlHistory", id, "totalSupply", totalSupply.toString());
  });

  test("creates a separate record for the next day", function () {
    const dayOne = BigInt.fromI32(1769734800); // 2026-01-30 01:00 UTC
    const dayTwo = BigInt.fromI32(1769821200); // 2026-01-31 01:00 UTC

    mockGatewayCalls(
      BigInt.fromI32(0),
      BigInt.fromString("443736408129313428461563"),
    );
    mockWhitelistedTokens([usdtAddress]);
    mockTokenCalls(
      usdtAddress,
      BigInt.fromI32(99967390),
      BigInt.fromString("109581573710"),
    );

    handleBlock(createMockBlock(BigInt.fromI32(100), dayOne));
    handleBlock(createMockBlock(BigInt.fromI32(200), dayTwo));

    assert.entityCount("TvlHistory", 2);
    assert.entityCount("TvlTokenHistory", 2);
    assert.fieldEquals(
      "TvlHistory",
      `${gatewayAddressString}-1769644800`,
      "timestamp",
      "1769644800",
    );
    assert.fieldEquals(
      "TvlHistory",
      `${gatewayAddressString}-1769731200`,
      "timestamp",
      "1769731200",
    );
  });

  test("records the day even when no token is whitelisted yet", function () {
    const totalSupply = BigInt.fromI32(0);
    const timestamp = BigInt.fromI32(1769731200);

    // Both treasuries start with an empty token set, so this is the state at
    // every gateway's first indexed day.
    mockGatewayCalls(BigInt.fromI32(0), totalSupply);
    mockWhitelistedTokens([]);

    handleBlock(createMockBlock(BigInt.fromI32(100), timestamp));

    const id = buildHistoryId(timestamp);
    assert.entityCount("TvlHistory", 1);
    assert.entityCount("TvlTokenHistory", 0);
    assert.fieldEquals("TvlHistory", id, "totalSupply", "0");
  });

  test("records withdrawable without a price when the oracle read reverts", function () {
    const usdcWithdrawable = BigInt.fromString("258609609875");
    const timestamp = BigInt.fromI32(1769731200);

    mockGatewayCalls(
      BigInt.fromI32(0),
      BigInt.fromString("443736408129313428461563"),
    );
    mockWhitelistedTokens([usdtAddress, usdcAddress]);
    mockTokenCalls(
      usdtAddress,
      BigInt.fromI32(99967390),
      BigInt.fromString("109581573710"),
    );
    mockWithdrawable(usdcAddress, usdcWithdrawable);
    createMockedFunction(treasuryAddress, "getPrice", getPriceSignature)
      .withArgs([ethereum.Value.fromAddress(usdcAddress)])
      .reverts();

    handleBlock(createMockBlock(BigInt.fromI32(100), timestamp));

    const id = buildHistoryId(timestamp);
    const usdcId = `${id}-${usdcAddressString}`;

    assert.entityCount("TvlHistory", 1);
    assert.entityCount("TvlTokenHistory", 2);
    assert.fieldEquals(
      "TvlTokenHistory",
      usdcId,
      "withdrawable",
      usdcWithdrawable.toString(),
    );
    const stored = TvlTokenHistory.load(usdcId)!;
    assert.assertTrue(!stored.isSet("price"));
    assert.assertTrue(!stored.isSet("unitPrice"));
  });

  test("skips a token whose withdrawable read reverts and records the rest", function () {
    const timestamp = BigInt.fromI32(1769731200);

    mockGatewayCalls(
      BigInt.fromI32(0),
      BigInt.fromString("443736408129313428461563"),
    );
    mockWhitelistedTokens([usdtAddress, usdcAddress]);
    mockTokenCalls(
      usdtAddress,
      BigInt.fromI32(99967390),
      BigInt.fromString("109581573710"),
    );
    mockGetPrice(usdcAddress, BigInt.fromI32(99991000));
    createMockedFunction(treasuryAddress, "withdrawable", withdrawableSignature)
      .withArgs([ethereum.Value.fromAddress(usdcAddress)])
      .reverts();

    handleBlock(createMockBlock(BigInt.fromI32(100), timestamp));

    const id = buildHistoryId(timestamp);
    assert.entityCount("TvlHistory", 1);
    assert.entityCount("TvlTokenHistory", 1);
    assert.fieldEquals(
      "TvlTokenHistory",
      `${id}-${usdtAddressString}`,
      "tokenAddress",
      usdtAddressString,
    );
  });

  test("records nothing when the treasury read reverts", function () {
    const timestamp = BigInt.fromI32(1769731200);

    mockGatewayCalls(
      BigInt.fromI32(0),
      BigInt.fromString("443736408129313428461563"),
    );
    createMockedFunction(gatewayAddress, "treasury", "treasury():(address)")
      .withArgs([])
      .reverts();

    handleBlock(createMockBlock(BigInt.fromI32(100), timestamp));

    assert.entityCount("TvlHistory", 0);
    assert.entityCount("TvlTokenHistory", 0);
  });
});
