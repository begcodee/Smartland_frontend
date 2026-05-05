import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { 
  Wallet, Shield, CheckCircle, Clock, 
  AlertTriangle, Coins, Link, Hash 
} from 'lucide-react';
import { toast } from '@/lib/appToast';
import { getEvmNetworkLabel, getEvmTxExplorerUrl } from '@/lib/chainConfig';

interface EthereumIntegrationProps {
  onWalletConnected: (walletData: WalletData) => void;
}

interface WalletData {
  address: string;
  balance: string;
  network: string;
  chainIdHex: string;
  connected: boolean;
}

interface LandData {
  title: string;
  description: string;
  location: {
    address: string;
    coordinates: { lat: number; lng: number };
    region: string;
  };
  area: number;
  price: number;
  type: string;
}

interface EthereumProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
}

export const EthereumIntegration = ({ onWalletConnected }: EthereumIntegrationProps) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [transactionHash, setTransactionHash] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);

  const connectWallet = async () => {
    setIsConnecting(true);
    
    try {
      // Check if MetaMask is installed
      if (typeof window.ethereum === 'undefined') {
        toast.error('MetaMask is not installed. Please install MetaMask to continue.');
        setIsConnecting(false);
        return;
      }

      // Request account access
      const accounts = await window.ethereum.request({ 
        method: 'eth_requestAccounts' 
      }) as string[];

      if (accounts.length === 0) {
        toast.error('No accounts found. Please connect your wallet.');
        setIsConnecting(false);
        return;
      }

      // Get balance
      const balance = await window.ethereum.request({
        method: 'eth_getBalance',
        params: [accounts[0], 'latest']
      }) as string;

      // Convert balance from wei to ETH
      const ethBalance = (parseInt(balance, 16) / Math.pow(10, 18)).toFixed(4);

      // Get network (RPC is whatever MetaMask uses for this chain — not from our .env)
      const chainId = await window.ethereum.request({ method: 'eth_chainId' }) as string;
      const networkName = getEvmNetworkLabel(chainId);

      const wallet: WalletData = {
        address: accounts[0],
        balance: ethBalance,
        network: networkName,
        chainIdHex: chainId,
        connected: true
      };

      setWalletData(wallet);
      onWalletConnected(wallet);
      toast.success('Wallet connected successfully!');
      
    } catch (error) {
      console.error('Error connecting wallet:', error);
      toast.error('Failed to connect wallet. Please try again.');
    } finally {
      setIsConnecting(false);
    }
  };

  const registerOnBlockchain = async (landData: LandData) => {
    if (!walletData) {
      toast.error('Please connect your wallet first.');
      return;
    }

    setIsRegistering(true);

    try {
      // Simulate blockchain transaction
      const transactionParams = {
        to: '0x742d35Cc6634C0532925a3b8D5c9C9b2f6e4C1F2', // Mock contract address
        from: walletData.address,
        value: '0x0',
        data: `0x${Buffer.from(JSON.stringify(landData)).toString('hex')}`, // Encode land data
        gas: '0x5208', // 21000 gas
        gasPrice: '0x09184e72a000' // 10 Gwei
      };

      const txHash = await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [transactionParams]
      }) as string;

      setTransactionHash(txHash);
      toast.success('Land registered on blockchain successfully!');
      
      return {
        success: true,
        transactionHash: txHash,
        blockchainAddress: transactionParams.to,
        gasUsed: '21000'
      };
      
    } catch (error) {
      console.error('Blockchain registration error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error('Failed to register on blockchain. Please try again.');
      return { success: false, error: errorMessage };
    } finally {
      setIsRegistering(false);
    }
  };

  const disconnectWallet = () => {
    setWalletData(null);
    setTransactionHash('');
    toast.success('Wallet disconnected');
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="w-5 h-5" />
          Ethereum Blockchain Integration
        </CardTitle>
        <CardDescription>
          Connect your Ethereum wallet to register land on the blockchain
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!walletData ? (
          <div className="space-y-4">
            <Alert>
              <Shield className="h-4 w-4" />
              <AlertDescription>
                Connect your Ethereum wallet (MetaMask) to enable blockchain-based land registration. 
                This ensures immutable and transparent land ownership records.
              </AlertDescription>
            </Alert>

            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto bg-blue-100 rounded-full flex items-center justify-center">
                <Wallet className="w-8 h-8 text-blue-600" />
              </div>
              
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Connect Your Wallet</h3>
                <p className="text-gray-600 text-sm">
                  Securely connect your Ethereum wallet to register land ownership on the blockchain
                </p>
              </div>

              <Button 
                onClick={connectWallet} 
                disabled={isConnecting}
                className="w-full"
                size="lg"
              >
                {isConnecting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Wallet className="w-4 h-4 mr-2" />
                    Connect MetaMask Wallet
                  </>
                )}
              </Button>

              <div className="text-xs text-gray-500 space-y-1">
                <p>Don't have MetaMask? <a href="https://metamask.io" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Download here</a></p>
                <p>Your wallet will be used to sign transactions and prove ownership</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="font-medium text-green-800">Wallet Connected</span>
              </div>
              
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <Label className="text-green-700">Wallet Address</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="bg-green-100 px-2 py-1 rounded text-xs">
                        {`${walletData.address.slice(0, 6)}...${walletData.address.slice(-4)}`}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigator.clipboard.writeText(walletData.address)}
                        className="h-6 w-6 p-0"
                      >
                        <Hash className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                  
                  <div>
                    <Label className="text-green-700">Balance</Label>
                    <div className="flex items-center gap-1 mt-1">
                      <Coins className="w-4 h-4 text-green-600" />
                      <span className="font-medium">{walletData.balance} ETH</span>
                    </div>
                  </div>
                  
                  <div className="md:col-span-2">
                    <Label className="text-green-700">Network</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-green-700 border-green-300">
                        <Link className="w-3 h-3 mr-1" />
                        {walletData.network}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {transactionHash && (
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-5 h-5 text-blue-600" />
                  <span className="font-medium text-blue-800">Blockchain Transaction</span>
                </div>
                <div className="space-y-2">
                  <Label className="text-blue-700">Transaction Hash</Label>
                  <div className="flex items-center gap-2">
                    <code className="bg-blue-100 px-2 py-1 rounded text-xs break-all">
                      {transactionHash}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigator.clipboard.writeText(transactionHash)}
                      className="h-6 w-6 p-0"
                    >
                      <Hash className="w-3 h-3" />
                    </Button>
                  </div>
                  <p className="text-xs text-blue-600">
                    View on explorer:{' '}
                    <a
                      href={getEvmTxExplorerUrl(walletData.chainIdHex, transactionHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-1 hover:underline"
                    >
                      {`${transactionHash.slice(0, 10)}...`}
                    </a>
                  </p>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <Button 
                variant="outline" 
                onClick={disconnectWallet}
                className="flex-1"
              >
                Disconnect Wallet
              </Button>
              
              <Button 
                onClick={() => registerOnBlockchain({ 
                  title: 'Test Land',
                  description: 'Test description',
                  location: {
                    address: 'Test Address',
                    coordinates: { lat: 5.6037, lng: -0.1870 },
                    region: 'Greater Accra'
                  },
                  area: 1000,
                  price: 50000,
                  type: 'residential'
                })} 
                disabled={isRegistering}
                className="flex-1"
              >
                {isRegistering ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Registering...
                  </>
                ) : (
                  'Test Blockchain Registration'
                )}
              </Button>
            </div>
          </div>
        )}

        <div className="text-xs text-gray-500 space-y-1">
          <p><strong>Security:</strong> Your private keys never leave your wallet</p>
          <p><strong>Transparency:</strong> All transactions are recorded on the Ethereum blockchain</p>
          <p><strong>Immutability:</strong> Land records cannot be altered once registered</p>
        </div>
      </CardContent>
    </Card>
  );
};

// Extend window object for TypeScript
declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}