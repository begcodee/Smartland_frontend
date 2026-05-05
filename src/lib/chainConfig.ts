/**
 * EVM chain labels and block explorer URLs for wallet-connected flows.
 * This app does not call a dedicated JSON-RPC URL by default — MetaMask (or another
 * injected wallet) uses whatever RPC URL you configured for each network.
 */

export function getEvmNetworkLabel(chainIdHex: string): string {
  const id = chainIdHex.toLowerCase();
  const map: Record<string, string> = {
    '0x1': 'Ethereum Mainnet',
    '0xaa36a7': 'Ethereum Sepolia',
    '0x89': 'Polygon Mainnet',
    '0x13881': 'Polygon Mumbai (deprecated)',
    '0x13882': 'Polygon Amoy Testnet',
  };
  return map[id] || `Unknown network (${chainIdHex})`;
}

export function getEvmTxExplorerUrl(chainIdHex: string, txHash: string): string {
  const id = chainIdHex.toLowerCase();
  if (id === '0x89') return `https://polygonscan.com/tx/${txHash}`;
  if (id === '0x13881') return `https://mumbai.polygonscan.com/tx/${txHash}`;
  if (id === '0x13882') return `https://amoy.polygonscan.com/tx/${txHash}`;
  if (id === '0xaa36a7') return `https://sepolia.etherscan.io/tx/${txHash}`;
  return `https://etherscan.io/tx/${txHash}`;
}
