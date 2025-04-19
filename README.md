# R2 Money Bot

<div align="center">
  
![R2 Money Bot](https://img.shields.io/badge/R2%20Money%20Bot-v1.0.0-blue)
![Ethereum](https://img.shields.io/badge/Network-Sepolia-brightgreen)
![License](https://img.shields.io/badge/License-MIT-yellow)

</div>

A powerful command-line trading bot for automating operations with USDC, R2USD, and sR2USD tokens on the Ethereum Sepolia testnet.

## ✨ Features

### 🚀 Core Operations
| Feature | Description |
|---------|-------------|
| **Token Swapping** | Easily swap between USDC and R2USD with customizable parameters |
| **Token Staking** | Stake R2USD to receive sR2USD and earn rewards |
| **Auto Mode** | Single-click to swap and stake in one seamless operation |
| **Balance Checking** | Quick overview of all token balances across wallets |

### 🔧 Advanced Tools
| Feature | Description |
|---------|-------------|
| **Batch Operations** | Queue and execute multiple operations in sequence |
| **Transaction Scheduler** | Set operations to execute at specific times |
| **AI Trading Assistant** | Get personalized recommendations based on your portfolio |
| **Gas Optimization** | Fine-tune gas settings for each transaction type |

### 💼 Management
| Feature | Description |
|---------|-------------|
| **Multi-Wallet Support** | Operate with multiple wallets simultaneously |
| **Proxy Integration** | Enhanced privacy with HTTP/HTTPS proxy support |
| **Transaction History** | Track all your past operations in one place |

## 📋 Installation

```bash
# Clone the repository
git clone https://github.com/zackymrf/r2.git

# Navigate to the project directory
cd r2

# Install dependencies
npm install
```

## ⚙️ Configuration

### Private Keys

Create a `.env` file in the project root with your private keys:

```
PRIVATE_KEY_1=0xyourprivatekeyhere
PRIVATE_KEY_2=0xyoursecondprivatekeyhere
# Add as many as needed
```

### Proxies (Optional)

Create a `proxies.txt` file with one proxy per line:

```
http://username:password@host:port
host:port
```

## 🚀 Usage

Start the bot with:

```bash
npm start
```

### Main Menu

```
R2 Money Bot

=======================================================================

  MAIN MENU
  1. 🔄  Swap USDC to R2USD
  2. 🔄  Swap R2USD to USDC
  3. 📌  Stake R2USD to sR2USD
  4. 💰  Check balances
  5. ⚡  Auto Mode (Swap → Stake)
  6. 📦  Batch Operations
  7. ⏰  Transaction Scheduler
  8. 🤖  AI Trading Assistant
  9. ⚙️  Gas Settings
  10. 🚪  Exit

  Select an option (1-10):
```

## 🔍 Feature Details

### Token Swapping
Swap between USDC and R2USD tokens with customizable amounts:
- Set the exact amount to swap
- Define number of transactions to execute
- Choose which wallet(s) to use

### Token Staking
Stake your R2USD tokens to earn rewards:
- Stake any amount of R2USD to receive sR2USD
- Track your staked balance
- Execute multiple staking operations in sequence

### Auto Mode
Automatically swap USDC to R2USD and then stake the received tokens in a single operation:
- Streamline the two-step process
- Optimize gas usage
- Perfect for regular DeFi interactions

### Batch Operations
Create sequences of operations that execute in order:
- Combine different transaction types
- Set amounts for each operation
- Execute the entire batch with one command

### Transaction Scheduler
Schedule transactions to run at specific times:
- Set future execution times
- Queue multiple scheduled operations
- Monitor pending and completed scheduled tasks

### AI Trading Assistant
Get personalized recommendations based on your wallet:
- Portfolio analysis
- Strategy suggestions
- Market insights
- Optimal timing recommendations

### Gas Settings
Customize transaction gas parameters:
- Set max fee per gas
- Set priority fee per gas
- Define gas limits for different transaction types
- Optimize for cost or speed

## ⚠️ Important Notes

- This bot is designed for the **Sepolia testnet**, not mainnet
- You need Sepolia ETH for gas fees (get from [Sepolia Faucet](https://sepoliafaucet.com/))
- Never share your `.env` file or private keys
- Ensure you have a stable internet connection for reliable transactions

## 🔗 Resources

- [Etherscan Sepolia](https://sepolia.etherscan.io/) - Track your transactions
- [Sepolia Faucet](https://sepoliafaucet.com/) - Get testnet ETH

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

<div align="center">
  <p>Made with ❤️ by Zacky Mrf</p>
</div>