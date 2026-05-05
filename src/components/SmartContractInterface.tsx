import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Code, Shield, FileText, ArrowRightLeft, Gavel, Activity } from 'lucide-react';
import { SmartContract } from '@/types';

export default function SmartContractInterface() {
  const [contracts] = useState<SmartContract[]>([
    {
      address: '0x742d35Cc6634C0532925a3b8D4C4Aa4e24B3b2f4',
      type: 'ownership',
      status: 'active',
      createdAt: '2024-09-15',
      parameters: {
        landParcelId: 'LP001',
        owner: 'John Doe',
        registrationDate: '2024-09-15'
      }
    },
    {
      address: '0x8ba1f109551bD432803012645Hac136c5aa3c4F5',
      type: 'transfer',
      status: 'active',
      createdAt: '2024-09-20',
      parameters: {
        from: 'Ahmed Hassan',
        to: 'Priya Sharma',
        amount: 200000,
        escrowPeriod: '30 days'
      }
    },
    {
      address: '0x9cb2g210662cE543904123756Ibd247d6bb4d5G6',
      type: 'dispute',
      status: 'executed',
      createdAt: '2024-08-15',
      parameters: {
        disputeId: 'D001',
        votingPeriod: '14 days',
        quorum: 50
      }
    }
  ]);

  const getContractIcon = (type: string) => {
    switch (type) {
      case 'ownership': return <Shield className="w-5 h-5 text-blue-600" />;
      case 'transfer': return <ArrowRightLeft className="w-5 h-5 text-green-600" />;
      case 'dispute': return <Gavel className="w-5 h-5 text-orange-600" />;
      case 'escrow': return <FileText className="w-5 h-5 text-purple-600" />;
      default: return <Code className="w-5 h-5 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'executed': return 'bg-blue-100 text-blue-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const ownershipContractCode = `pragma solidity ^0.8.0;

contract LandOwnership {
    struct LandParcel {
        string id;
        string title;
        address owner;
        string location;
        uint256 area;
        uint256 registrationDate;
        bool isActive;
    }
    
    mapping(string => LandParcel) public landParcels;
    mapping(address => string[]) public ownerParcels;
    
    event LandRegistered(string indexed parcelId, address indexed owner);
    event OwnershipTransferred(string indexed parcelId, address indexed from, address indexed to);
    
    function registerLand(
        string memory _id,
        string memory _title,
        string memory _location,
        uint256 _area
    ) public {
        require(bytes(landParcels[_id].id).length == 0, "Land already registered");
        
        landParcels[_id] = LandParcel({
            id: _id,
            title: _title,
            owner: msg.sender,
            location: _location,
            area: _area,
            registrationDate: block.timestamp,
            isActive: true
        });
        
        ownerParcels[msg.sender].push(_id);
        emit LandRegistered(_id, msg.sender);
    }
    
    function transferOwnership(string memory _parcelId, address _newOwner) public {
        require(landParcels[_parcelId].owner == msg.sender, "Not the owner");
        require(_newOwner != address(0), "Invalid address");
        
        address previousOwner = landParcels[_parcelId].owner;
        landParcels[_parcelId].owner = _newOwner;
        
        // Update owner mappings
        ownerParcels[_newOwner].push(_parcelId);
        
        emit OwnershipTransferred(_parcelId, previousOwner, _newOwner);
    }
}`;

  const transferContractCode = `pragma solidity ^0.8.0;

contract LandTransfer {
    struct Transfer {
        string parcelId;
        address seller;
        address buyer;
        uint256 amount;
        uint256 escrowDeadline;
        bool isCompleted;
        bool isCancelled;
    }
    
    mapping(bytes32 => Transfer) public transfers;
    mapping(address => uint256) public escrowBalances;
    
    event TransferInitiated(bytes32 indexed transferId, string parcelId, address seller, address buyer);
    event TransferCompleted(bytes32 indexed transferId);
    event TransferCancelled(bytes32 indexed transferId);
    
    function initiateTransfer(
        string memory _parcelId,
        address _seller,
        uint256 _escrowPeriod
    ) public payable {
        require(msg.value > 0, "Transfer amount must be greater than 0");
        
        bytes32 transferId = keccak256(abi.encodePacked(_parcelId, _seller, msg.sender, block.timestamp));
        
        transfers[transferId] = Transfer({
            parcelId: _parcelId,
            seller: _seller,
            buyer: msg.sender,
            amount: msg.value,
            escrowDeadline: block.timestamp + _escrowPeriod,
            isCompleted: false,
            isCancelled: false
        });
        
        escrowBalances[address(this)] += msg.value;
        
        emit TransferInitiated(transferId, _parcelId, _seller, msg.sender);
    }
    
    function completeTransfer(bytes32 _transferId) public {
        Transfer storage transfer = transfers[_transferId];
        require(transfer.seller == msg.sender, "Only seller can complete");
        require(!transfer.isCompleted && !transfer.isCancelled, "Transfer already processed");
        
        transfer.isCompleted = true;
        escrowBalances[address(this)] -= transfer.amount;
        
        payable(transfer.seller).transfer(transfer.amount);
        
        emit TransferCompleted(_transferId);
    }
    
    function cancelTransfer(bytes32 _transferId) public {
        Transfer storage transfer = transfers[_transferId];
        require(transfer.buyer == msg.sender || block.timestamp > transfer.escrowDeadline, "Cannot cancel");
        require(!transfer.isCompleted && !transfer.isCancelled, "Transfer already processed");
        
        transfer.isCancelled = true;
        escrowBalances[address(this)] -= transfer.amount;
        
        payable(transfer.buyer).transfer(transfer.amount);
        
        emit TransferCancelled(_transferId);
    }
}`;

  const disputeContractCode = `pragma solidity ^0.8.0;

contract DisputeResolution {
    struct Dispute {
        string id;
        string parcelId;
        address plaintiff;
        address defendant;
        string description;
        uint256 votingDeadline;
        uint256 supportVotes;
        uint256 againstVotes;
        uint256 abstainVotes;
        bool isResolved;
        string resolution;
    }
    
    mapping(string => Dispute) public disputes;
    mapping(string => mapping(address => bool)) public hasVoted;
    
    event DisputeFiled(string indexed disputeId, string parcelId, address plaintiff);
    event VoteCast(string indexed disputeId, address voter, uint8 vote);
    event DisputeResolved(string indexed disputeId, string resolution);
    
    function fileDispute(
        string memory _disputeId,
        string memory _parcelId,
        address _defendant,
        string memory _description,
        uint256 _votingPeriod
    ) public {
        require(bytes(disputes[_disputeId].id).length == 0, "Dispute already exists");
        
        disputes[_disputeId] = Dispute({
            id: _disputeId,
            parcelId: _parcelId,
            plaintiff: msg.sender,
            defendant: _defendant,
            description: _description,
            votingDeadline: block.timestamp + _votingPeriod,
            supportVotes: 0,
            againstVotes: 0,
            abstainVotes: 0,
            isResolved: false,
            resolution: ""
        });
        
        emit DisputeFiled(_disputeId, _parcelId, msg.sender);
    }
    
    function vote(string memory _disputeId, uint8 _vote) public {
        require(!hasVoted[_disputeId][msg.sender], "Already voted");
        require(block.timestamp <= disputes[_disputeId].votingDeadline, "Voting period ended");
        require(!disputes[_disputeId].isResolved, "Dispute already resolved");
        
        hasVoted[_disputeId][msg.sender] = true;
        
        if (_vote == 0) {
            disputes[_disputeId].supportVotes++;
        } else if (_vote == 1) {
            disputes[_disputeId].againstVotes++;
        } else if (_vote == 2) {
            disputes[_disputeId].abstainVotes++;
        }
        
        emit VoteCast(_disputeId, msg.sender, _vote);
    }
    
    function resolveDispute(string memory _disputeId, string memory _resolution) public {
        require(block.timestamp > disputes[_disputeId].votingDeadline, "Voting still active");
        require(!disputes[_disputeId].isResolved, "Already resolved");
        
        disputes[_disputeId].isResolved = true;
        disputes[_disputeId].resolution = _resolution;
        
        emit DisputeResolved(_disputeId, _resolution);
    }
}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Smart Contract Interface</h2>
        <p className="text-muted-foreground">View and interact with blockchain smart contracts</p>
      </div>

      <Tabs defaultValue="deployed" className="space-y-6">
        <TabsList>
          <TabsTrigger value="deployed" className="flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Deployed Contracts
          </TabsTrigger>
          <TabsTrigger value="source" className="flex items-center gap-2">
            <Code className="w-4 h-4" />
            Source Code
          </TabsTrigger>
        </TabsList>

        <TabsContent value="deployed" className="space-y-6">
          {/* Contract Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="text-center">
              <CardContent className="pt-6">
                <Shield className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                <div className="text-2xl font-bold">3</div>
                <p className="text-sm text-muted-foreground">Ownership Contracts</p>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="pt-6">
                <ArrowRightLeft className="w-8 h-8 text-green-600 mx-auto mb-2" />
                <div className="text-2xl font-bold">1</div>
                <p className="text-sm text-muted-foreground">Transfer Contracts</p>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="pt-6">
                <Gavel className="w-8 h-8 text-orange-600 mx-auto mb-2" />
                <div className="text-2xl font-bold">2</div>
                <p className="text-sm text-muted-foreground">Dispute Contracts</p>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="pt-6">
                <Activity className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                <div className="text-2xl font-bold">99.9%</div>
                <p className="text-sm text-muted-foreground">Uptime</p>
              </CardContent>
            </Card>
          </div>

          {/* Deployed Contracts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {contracts.map((contract) => (
              <Card key={contract.address}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      {getContractIcon(contract.type)}
                      {contract.type.charAt(0).toUpperCase() + contract.type.slice(1)} Contract
                    </CardTitle>
                    <Badge className={getStatusColor(contract.status)}>
                      {contract.status}
                    </Badge>
                  </div>
                  <CardDescription className="font-mono text-xs">
                    {contract.address}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Created</p>
                      <p className="font-medium">{contract.createdAt}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Type</p>
                      <p className="font-medium capitalize">{contract.type}</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Parameters</p>
                    <div className="bg-gray-50 p-3 rounded text-xs font-mono">
                      {Object.entries(contract.parameters).map(([key, value]) => (
                        <div key={key} className="flex justify-between">
                          <span className="text-muted-foreground">{key}:</span>
                          <span>{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1">
                      View on Explorer
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1">
                      Interact
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="source" className="space-y-6">
          <Tabs defaultValue="ownership" className="space-y-4">
            <TabsList>
              <TabsTrigger value="ownership">Land Ownership</TabsTrigger>
              <TabsTrigger value="transfer">Transfer Escrow</TabsTrigger>
              <TabsTrigger value="dispute">Dispute Resolution</TabsTrigger>
            </TabsList>

            <TabsContent value="ownership">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    Land Ownership Contract
                  </CardTitle>
                  <CardDescription>
                    Smart contract for registering and managing land ownership on the blockchain
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-sm overflow-x-auto">
                    <code>{ownershipContractCode}</code>
                  </pre>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="transfer">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ArrowRightLeft className="w-5 h-5" />
                    Land Transfer Contract
                  </CardTitle>
                  <CardDescription>
                    Escrow-based smart contract for secure land ownership transfers
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-sm overflow-x-auto">
                    <code>{transferContractCode}</code>
                  </pre>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="dispute">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Gavel className="w-5 h-5" />
                    Dispute Resolution Contract
                  </CardTitle>
                  <CardDescription>
                    Community-driven dispute resolution with transparent voting mechanisms
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-sm overflow-x-auto">
                    <code>{disputeContractCode}</code>
                  </pre>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>
    </div>
  );
}