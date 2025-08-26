# 🌍 Transparent Medical Aid Donation Tracker

Welcome to a blockchain-powered solution for transparent donation tracking in disaster-struck regions! This project uses the Stacks blockchain and Clarity smart contracts to ensure donations for medical aid—especially pharmaceuticals—are tracked from donor to delivery, verifying authenticity and preventing mismanagement. It solves real-world issues like lack of trust in aid distribution, fraud in supply chains, and unverified deliveries in crisis zones.

## ✨ Features

🔍 Full transparency: Track every step of donations on an immutable ledger  
💰 Secure donations: Accept STX or custom tokens with automated refunds if goals unmet  
📦 Verified deliveries: Use oracles and multi-signature confirmations for pharmaceutical shipments  
🏥 Region-specific allocation: Funds earmarked for disaster areas with real-time reporting  
🔒 Audit trails: Independent verifiers can audit the entire process  
🚨 Emergency alerts: Automated notifications for low funds or delivery delays  
✅ Donor rewards: Optional NFTs for contributors as proof of impact  
❌ Fraud prevention: Prevent double-spending or unauthorized claims

## 🛠 How It Works

This system involves 8 Clarity smart contracts for modularity, security, and scalability. Donors contribute funds, NGOs allocate them, suppliers handle logistics, and verifiers confirm outcomes—all on-chain for trustless operation.

### Smart Contracts Overview

1. **DonationContract.clar**: Handles incoming donations, tracks totals, and issues receipts (as NFTs). Includes refund logic if campaigns fail.  
2. **FundAllocationContract.clar**: Allocates donated funds to specific disaster regions or needs (e.g., pharmaceuticals). Uses voting or admin approval for distribution.  
3. **SupplierRegistryContract.clar**: Registers verified suppliers, stores their credentials, and allows bidding on supply requests. Prevents unverified entities from participating.  
4. **DeliveryOracleContract.clar**: Integrates external oracles (e.g., via APIs or trusted signers) to confirm shipment deliveries, updating on-chain status.  
5. **VerificationMultiSigContract.clar**: Manages multi-signature approvals from NGOs, suppliers, and locals to verify pharmaceutical receipt and quality.  
6. **RecipientClaimContract.clar**: Allows authorized recipients (e.g., hospitals in disaster zones) to claim allocated funds or goods, with usage reporting.  
7. **AuditLogContract.clar**: Logs all transactions and events for public auditing, enabling queries for transparency reports.  
8. **GovernanceContract.clar**: Manages system updates, admin roles, and dispute resolutions through DAO-like voting.

### For Donors

- Connect your wallet and call `donate` on DonationContract with amount and campaign ID.  
- Receive an NFT receipt via the contract.  
- Track your donation's journey using `get-allocation-details` on FundAllocationContract or `query-audit-log` on AuditLogContract.  

Boom! Your contribution is traceable and impactful.

### For NGOs/Admins

- Create a campaign via FundAllocationContract with details like region and needs.  
- Allocate funds to suppliers using `allocate-funds`.  
- Confirm deliveries by signing in VerificationMultiSigContract.  

Efficient coordination with built-in alerts.

### For Suppliers

- Register via SupplierRegistryContract with proof of credentials.  
- Bid on requests and fulfill orders, then submit delivery proof to DeliveryOracleContract.  
- Get paid automatically upon multi-sig verification.  

Secure and incentivized supply chain.

### For Verifiers/Auditors

- Query any contract (e.g., `verify-delivery` on DeliveryOracleContract) to check statuses.  
- Use AuditLogContract for comprehensive reports on fund flows and deliveries.  

Instant, tamper-proof verification for donors and regulators.

## 🚀 Getting Started

Deploy the contracts on Stacks using Clarinet. Start with DonationContract as the entry point. Test end-to-end flows in a dev environment to simulate disasters and deliveries.

This project empowers global aid with blockchain's transparency—let's make disaster relief trustworthy!