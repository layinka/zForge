# zForge - Yield Tokenization Protocol

A full-stack decentralized application for yield tokenization, inspired by Pendle and Spectra protocols. zForge allows users to wrap yield-bearing assets into standardized SY tokens, which can be split into Principal Tokens (PT) and Yield Tokens (YT) for advanced DeFi strategies.

## 🌟 Features

- **Yield Tokenization**: Wrap yield-bearing assets (e.g., stCORE) into standardized SY tokens
- **Principal/Yield Splitting**: Split SY tokens into tradable PT and YT tokens
- **Fixed Yield Trading**: Trade PT tokens for fixed yield strategies
- **Yield Speculation**: Trade YT tokens for yield speculation and leverage
- **Token Recomposition**: Merge PT + YT back into SY tokens
- **Automated Expiry**: Handle token maturity and redemption automatically
- **Modern UI**: Beautiful Angular 19 frontend with purple-themed design
- **Multi-chain Support**: Deployed on Core and Core Testnet

## 🏗️ Architecture

### Smart Contracts (Hardhat + TypeScript)
- **SYToken**: ERC-20 wrapper for yield-bearing assets with maturity tracking
- **PTToken**: Principal tokens redeemable 1:1 for underlying after maturity
- **YTToken**: Yield tokens that can claim yield until expiry
- **SYFactory**: Main factory contract for wrapping, splitting, and merging operations
- **MockStCORE**: Mock staked CORE token for testing

### Frontend (Angular 19)
- **Modern UI**: Built with Angular 19, ngBootstrap, and custom purple theme
- **Web3 Integration**: MetaMask wallet connection with @reown/appKit
- **Reactive Design**: Angular Signals for reactive state management
- **Multi-page App**: Tokenize, PT/YT management, and Pools pages
- **Real-time Updates**: Live balance and yield tracking

### Backend (Express + TypeORM + SQLite) - Optional
- **Token Tracking**: Database storage for SY, PT, and YT token information
- **Yield Calculation**: Historical yield data and analytics
- **REST API**: Endpoints for token information and user positions
- **Automated Tasks**: Scheduled jobs for maturity checking

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- MetaMask wallet
- Git

### 1. Clone the Repository
```bash
git clone <repository-url>
cd zPendle
```

### 2. Install Dependencies

#### Smart Contracts
```bash
# Install contract dependencies
npm install

# Compile contracts
npm run compile

# Run tests
npm run test
```

#### Frontend
```bash
cd frontend
npm install
```

#### Backend (Optional)
```bash
cd backend
npm install
```

### 3. Deploy Smart Contracts

#### Local Development
```bash
# Start local Hardhat node
npm run node

# Deploy to local network (in another terminal)
npm run deploy:localhost
```

#### Core Testnet
```bash
# Set your private key in .env
echo "PRIVATE_KEY=your_private_key_here" > .env

# Deploy to Core Testnet
npm run deploy:core-testnet
```

#### Core Mainnet
```bash
# Deploy to Core Mainnet
npm run deploy:core
```

### 4. Start Frontend
```bash
cd frontend
npm start
```

The frontend will be available at `http://localhost:4200`

### 5. Start Backend (Optional)
```bash
cd backend
npm run dev
```

The backend API will be available at `http://localhost:3000`

## 📖 Usage Guide

### 1. Connect Wallet
- Click "Connect Wallet" in the top navigation
- Approve MetaMask connection
- Ensure you're on Core or Core Testnet

### 2. Get Test Tokens
- Use the MockStCORE faucet to get test tokens
- Call the `faucet()` function on the MockStCORE contract

### 3. Wrap Assets
- Go to the "Tokenize" page
- Select stCORE from the dropdown
- Enter amount to wrap
- Approve and wrap to receive SY tokens

### 4. Split SY Tokens
- On the same page, select your SY token
- Enter amount to split
- Receive equal amounts of PT and YT tokens

### 5. Manage PT/YT Tokens
- Go to "PT/YT" page to view your positions
- Claim yield from YT tokens
- Redeem PT tokens after maturity
- Merge PT + YT back to SY tokens

### 6. Trade on DEXs
- Visit the "Pools" page
- View available trading pools
- Click external links to trade on Uniswap V3 or other DEXs

## 🔧 Configuration

### Contract Addresses
Update contract addresses in:
- `frontend/src/environments/environment.ts`
- `frontend/src/app/services/blockchain.service.ts`
- `backend/src/server.ts` (if using backend)

### Network Configuration
Supported networks are configured in:
- `hardhat.config.ts`
- `frontend/src/environments/environment.ts`

## 🧪 Testing

### Smart Contract Tests
```bash
# Run all tests
npm run test

# Run with gas reporting
REPORT_GAS=true npm run test

# Run with coverage
npm run coverage
```

### Frontend Tests
```bash
cd frontend
npm run test
```

## 📊 API Documentation

### Backend Endpoints (if using optional backend)

#### SY Tokens
- `GET /api/sy-tokens` - Get all SY tokens
- `GET /api/sy-tokens/:address` - Get SY token by address
- `POST /api/sy-tokens` - Create new SY token
- `PUT /api/sy-tokens/:address` - Update SY token

#### PT/YT Tokens
- `GET /api/ptyt-info/:syTokenAddress` - Get PT/YT info for SY token
- `GET /api/pt-tokens` - Get all PT tokens
- `GET /api/yt-tokens` - Get all YT tokens
- `GET /api/pt-tokens/redeemable` - Get redeemable PT tokens
- `GET /api/yt-tokens/active` - Get active YT tokens

## 🎨 UI/UX Features

- **Purple Theme**: Modern purple gradient design
- **Responsive Design**: Works on desktop and mobile
- **Loading States**: Spinners and progress indicators
- **Toast Notifications**: Success/error feedback
- **Real-time Updates**: Live balance and yield updates
- **Wallet Integration**: Seamless MetaMask connection
- **Transaction Tracking**: Visual transaction status

## 🔒 Security Features

- **Reentrancy Protection**: All state-changing functions protected
- **Access Control**: Owner-only functions for critical operations
- **Input Validation**: Comprehensive input validation and sanitization
- **Maturity Enforcement**: Automatic expiry and maturity handling
- **Safe Math**: Using OpenZeppelin's safe math operations

## 🌐 Deployment

### Frontend Deployment
```bash
cd frontend
npm run build
# Deploy dist/ folder to your hosting provider
```

### Backend Deployment
```bash
cd backend
npm run build
# Deploy to your server or cloud provider
```

### Contract Verification
```bash
# Verify on Core Explorer
npx hardhat verify --network core <contract-address> <constructor-args>
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Inspired by [Pendle Protocol](https://pendle.finance/)
- Built with [OpenZeppelin](https://openzeppelin.com/) contracts
- UI components from [ng-bootstrap](https://ng-bootstrap.github.io/)
- Blockchain integration with [ethers.js](https://ethers.org/)

## 📞 Support

For questions and support:
- Create an issue on GitHub
- Join our Discord community
- Follow us on Twitter

---

**⚠️ Disclaimer**: This is experimental software. Use at your own risk. Always do your own research before interacting with smart contracts.
