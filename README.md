# R2 Money Bot

<div align="center">
  
![R2 Money Bot](https://img.shields.io/badge/R2%20Money%20Bot-v1.0.0-blue)
![Ethereum](https://img.shields.io/badge/Network-Sepolia-brightgreen)
![License](https://img.shields.io/badge/License-MIT-yellow)

</div>

A powerful command-line trading bot for automating operations with USDC, R2USD, and sR2USD tokens on the Ethereum Sepolia testnet.

link 
https://r2.money?code=QETSZ

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
git clone https://github.com/ZackyMrf/R2-bot

# Navigate to the project directory
cd R2-bot

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
  6. ⚙️  Gas Settings
  8. 🚪  Exit

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

