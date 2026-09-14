# @vetro-protocol/cli

> [!NOTE]
> This CLI is still under development. Docs may not reflect the actual state yet.

`vetro-cli` — a command-line interface that sits on top of the `@vetro-protocol/*` packages so agents and users can read Vetro state and generate transaction calldata.

## Local development

Run it straight from the source, with no build step:

```sh
node packages/cli/src/cli.ts swap pegged-token --gateway 0x...
```

To run the bundled bin instead:

```sh
pnpm --filter @vetro-protocol/cli bundle   # produces _esm/cli.js (the vetro-cli bin)
node packages/cli/_esm/cli.js swap pegged-token --gateway 0x...
```

The `@vetro-protocol/*` packages are external to that bundle, and inside the monorepo they resolve to workspace source, so this exercises the bundled entrypoint rather than what an npm consumer gets. To check that, pack the tarball and install it in a scratch project.

## Configuration

`--rpc-url <url>` is a global option, accepted anywhere on the command line — before or after the subcommand:

```sh
vetro-cli --rpc-url https://my-node.example swap treasury --gateway 0x...
vetro-cli swap treasury --gateway 0x... --rpc-url https://my-node.example
```

It sets the endpoint every read goes to, and therefore the chain the emitted calldata is stamped with. It also accepts the endpoint via env var, so the resolution order is:

1. `--rpc-url`
2. `RPC_URL`
3. a public Ethereum mainnet RPC (viem's default for mainnet)

Only `http`/`https` endpoints are accepted; anything else is rejected as a usage error before any request is made.

### Supported chains

Vetro is deployed on Ethereum mainnet only, so every command starts by reading the endpoint's `eth_chainId` and fails if it is anything other than:

| Chain ID | Endpoint                           |
| -------- | ---------------------------------- |
| `1`      | Ethereum mainnet                   |
| `31337`  | local fork (anvil/Hardhat default) |

The check runs before any contract read, so pointing at another network fails fast rather than returning state read off the wrong chain. This restriction is temporary and lifts once Vetro is deployed on more chains.

## Output

Successful output is JSON on stdout, so it's directly consumable by an agent.

- Addresses and other strings are emitted as JSON strings; booleans as JSON booleans.
- `uint256` on-chain values are serialized as decimal strings, since `bigint` can't be represented in JSON.

Failures always exit non-zero, but come in two shapes:

- **Runtime errors** (RPC failure, contract revert) are JSON on stderr: `{ "error": "..." }`.
- **Usage errors** (invalid or missing flags, unknown commands) are written by the CLI parser as plain text on stderr.

### Write operations

Write commands touch no keys — they emit a JSON-RPC transaction request and the consumer signs and broadcasts it:

```json
{ "chainId": "0x1", "data": "0x8b6099db…", "to": "0x…gateway", "value": "0x0" }
```

Every numeric field is a hex `QUANTITY`, so the object can be lifted straight into `eth_sendTransaction` or an [ERC-5792](https://eips.ethereum.org/EIPS/eip-5792) `wallet_sendCalls` batch. `value` is always `"0x0"`.

## Token arguments

`--token`, `--from` and `--to` accept either a **symbol** (case-insensitive, e.g. `USDT`) or an **address**. `--from` is the token the operation spends, so it is whitelisted-only on `mint` and pegged-only on `send-to-queue`; `--token` takes either side.

Because a token belongs to exactly one gateway, the gateway is inferred from the token and never passed explicitly. For the same reason `swap mint --to` is optional — the pegged token is whatever that gateway mints.

`--amount` is in human units; decimals are resolved from the token.

To discover the symbols a gateway takes, run `swap whitelisted-tokens --gateway <addr>` — a gateway-level read, so it takes the gateway explicitly instead of inferring it from a token.

## Commands

This is the list of commands available

### `swap` — whitelisted ↔ pegged token

#### Write operations

| Command                                                                                               | Encodes               | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ----------------------------------------------------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vetro-cli swap approve --token <tok> --amount <n>`                                                   | `encodeApproveData`   | Approves the inferred gateway to spend the token — a whitelisted token to `mint`, or a pegged token to `send-to-queue` or to redeem in one step. Prepend it when the allowance is short.                                                                                                                                                                                                                                                    |
| `vetro-cli swap mint --from <tok> [--to <tok>] --amount <n> --receiver <addr> [--slippage <percent>]` | `encodeDeposit`       | Swap-in. `--slippage` is a percent off `previewDeposit`, in `[0, 100]` with at most one decimal (e.g. `0.5`); **it defaults to `0`**, so `minPeggedTokenOut` is the full previewed amount unless a tolerance is given. Fails when the previewed output is above `maxMint`, the gateway's remaining mint capacity, or when the treasury has deposits paused for the token (`tokenConfig.depositActive` is false) — the deposit would revert. |
| `vetro-cli swap send-to-queue --from <tok> --amount <n>`                                              | `encodeRequestRedeem` | Swap-out step 1: locks the pegged token in the gateway and starts the cooldown. The token to redeem into is chosen at step 2, so it is not given here. A second request **adds to the open one and restarts the cooldown on the whole locked amount**, so queue the full amount at once. Fails when the gateway has the redeem queue disabled — the request would revert, and the redeem is one-step instead.                               |

#### Read operations

| Command                                                              | Reads                                                                         | Returns                                                                                                                                                                                                                                                                                                                                          |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `vetro-cli swap allowance --token <tok> --account <addr>`            | `allowance`                                                                   | Gateway's spending allowance, in human units. `<tok>` may be a whitelisted token (swap-in) or a pegged token (swap-out; the gateway pulls the pegged token at `send-to-queue`, or at the redeem itself when it is one step)                                                                                                                      |
| `vetro-cli swap cooldown --gateway <addr>`                           | `getWithdrawalDelayEnabled`, `getWithdrawalDelay`                             | Redeem Queue cooldown of the gateway, in seconds. `0` when the delay is disabled — a redeem is then one-step, with no queue. This is the gateway-wide contract value, not a per-account one.                                                                                                                                                     |
| `vetro-cli swap cooldown-enabled --gateway <addr>`                   | `getWithdrawalDelayEnabled`                                                   | Whether the gateway's Redeem Queue is on. `false` means a redeem is one-step for every account, and `swap send-to-queue` fails.                                                                                                                                                                                                                  |
| `vetro-cli swap is-instant-redeem --account <addr> --gateway <addr>` | `isInstantRedeemWhitelisted`                                                  | Whether `<addr>` is whitelisted to skip the gateway's Redeem Queue. `true` means its redeem is one-step: no `send-to-queue`, no cooldown.                                                                                                                                                                                                        |
| `vetro-cli swap max-out --token <tok>`                               | `getMaxWithdraw`                                                              | Treasury reserves for the whitelisted `<tok>` — its balance plus what its yield vault converts to — in the token's decimals. A liquidity ceiling only.                                                                                                                                                                                           |
| `vetro-cli swap mint-fee --token <tok>`                              | `getMintFee`                                                                  | Mint fee charged on a deposit of the whitelisted `<tok>`, in bps                                                                                                                                                                                                                                                                                 |
| `vetro-cli swap pegged-token --gateway <addr>`                       | `getPeggedToken`                                                              | Gateway's pegged-token address                                                                                                                                                                                                                                                                                                                   |
| `vetro-cli swap preview-mint --from <tok> --amount <n>`              | `previewDeposit`                                                              | Pegged token that a deposit of `<n>` of the whitelisted `<tok>` would mint, in the pegged token's decimals. A quote only: it does not check `maxMint` or `depositActive`, so `swap mint` can still fail for the same amount.                                                                                                                     |
| `vetro-cli swap price --token <tok>`                                 | `getTreasury`, `getPrice`                                                     | Oracle price of the whitelisted `<tok>`, read from the treasury of the inferred gateway. Emits `latestPrice`, the oracle answer for the token, and `unitPrice`, the price of the gateway's peg unit — `latestPrice / unitPrice` is the token's value in peg units.                                                                               |
| `vetro-cli swap redeem-fee --token <tok>`                            | `getRedeemFee`                                                                | Redeem fee charged on a redeem into the whitelisted `<tok>`, in bps                                                                                                                                                                                                                                                                              |
| `vetro-cli swap token-config --token <tok>`                          | `getTreasury`, `getTokenConfig`                                               | Treasury config of the whitelisted `<tok>`, read from the treasury of the inferred gateway: `decimals`, `depositActive` (gates `swap mint`), `oracle`, `stalePeriod` (seconds — a deposit or a redeem reverts once the feed's answer is that old), `vault` (the yield vault the collateral is routed to) and `withdrawActive` (gates the redeem) |
| `vetro-cli swap treasury --gateway <addr>`                           | `getTreasury`                                                                 | Gateway's treasury address                                                                                                                                                                                                                                                                                                                       |
| `vetro-cli swap whitelisted-tokens --gateway <addr>`                 | `getTreasury`, `getWhitelistedTokens`, `getTokenConfig`, `symbol`, `decimals` | Every whitelisted token the gateway accepts. Each entry carries `address`, `decimals`, `depositActive`, `symbol` and `withdrawActive`                                                                                                                                                                                                            |

### Swapping in

```sh
vetro-cli swap allowance --token USDT --account 0xAgent   # "0" → approval needed
vetro-cli swap approve --token USDT --amount 100          # sign + broadcast
vetro-cli swap mint --from USDT --amount 100 --receiver 0xAgent --slippage 0.5
```

### Swapping out, step 1

```sh
vetro-cli swap allowance --token VUSD --account 0xAgent   # "0" → approval needed
vetro-cli swap approve --token VUSD --amount 100          # sign + broadcast
vetro-cli swap send-to-queue --from VUSD --amount 100
```

`send-to-queue` fails on its own when the queue is off, so no preflight read is needed. To read the cooldown itself, `swap cooldown` takes `--gateway`, and the gateway address is the `to` of any write command's output. `swap cooldown` is gateway-wide, so it does not tell you whether _your_ address skips the queue: `swap is-instant-redeem --account <addr> --gateway <addr>` reads that per-account. When it returns `true`, skip `send-to-queue` — the redeem is one step.
