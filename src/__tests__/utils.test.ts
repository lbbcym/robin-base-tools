import { formatWei, parseWei, isValidAddress, getBaseChainId, getBaseTestnetChainId } from '../utils';

describe('Utils', () => {
  test('formatWei should format wei to ether', () => {
    expect(formatWei('1000000000000000000')).toBe('1.0');
  });

  test('parseWei should parse ether to wei', () => {
    expect(parseWei('1.0')).toBe('1000000000000000000');
  });

  test('isValidAddress should validate ethereum addresses', () => {
    expect(isValidAddress('0x742d35Cc6634C0532925a3b844Bc454e4438f44e')).toBe(true);
    expect(isValidAddress('invalid-address')).toBe(false);
  });

  test('getBaseChainId should return correct chain ID', () => {
    expect(getBaseChainId()).toBe(8453);
  });

  test('getBaseTestnetChainId should return correct testnet chain ID', () => {
    expect(getBaseTestnetChainId()).toBe(84531);
  });
});