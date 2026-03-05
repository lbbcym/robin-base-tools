import { Interface, JsonRpcProvider, TransactionResponse } from 'ethers';
import { BaseChainConfig, L2BridgeConfig, Transaction } from './types';

export class BaseChain {
  private readonly provider: JsonRpcProvider;

  constructor(private readonly config: BaseChainConfig) {
    this.provider = new JsonRpcProvider(config.rpcUrl);
  }

  async getL2Status(): Promise<boolean> {
    try {
      await this.provider.getNetwork();
      return true;
    } catch {
      return false;
    }
  }

  async sendTransaction(tx: Transaction): Promise<TransactionResponse> {
    const signer = await this.provider.getSigner(tx.from);
    return signer.sendTransaction(tx);
  }

  async bridgeToL2(
    bridgeConfig: L2BridgeConfig,
    amount: string,
  ): Promise<TransactionResponse> {
    const bridgeInterface = new Interface([
      'function depositERC20(address l1Token, address l2Token, uint256 amount)',
    ]);

    const data = bridgeInterface.encodeFunctionData('depositERC20', [
      bridgeConfig.tokenAddress,
      bridgeConfig.l2BridgeAddress,
      amount,
    ]);

    const signer = await this.provider.getSigner();
    const from = await signer.getAddress();

    return this.sendTransaction({
      to: bridgeConfig.l1BridgeAddress,
      from,
      value: '0',
      data,
    });
  }
}
