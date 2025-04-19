require('dotenv').config();
const fs = require('fs');
const { ethers } = require('ethers');
const readline = require('readline');
const { HttpsProxyAgent } = require('https-proxy-agent');
const chalk = require('chalk');
const figlet = require('figlet');
const ora = require('ora');
const Table = require('cli-table3');

// ======== CONFIG CONSTANTS ========
const TOKEN_ADDRESSES = {
  USDC: '0xef84994ef411c4981328ffce5fda41cd3803fae4',
  R2USD: '0x20c54c5f742f123abb49a982bfe0af47edb38756',
  SR2USD: '0xbd6b25c4132f09369c354bee0f7be777d7d434fa'
};

const CONTRACT_ADDRESSES = {
  USDC_TO_R2USD: '0x20c54c5f742f123abb49a982bfe0af47edb38756',
  R2USD_TO_USDC: '0x07abd582df3d3472aa687a0489729f9f0424b1e3',
  STAKE_R2USD: '0xbd6b25c4132f09369c354bee0f7be777d7d434fa'
};

const METHOD_IDS = {
  USDC_TO_R2USD: '0x095e7a95',
  R2USD_TO_USDC: '0x3df02124',
  STAKE_R2USD: '0x1a5f0f00'
};

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function balanceOf(address account) external view returns (uint256)',
  'function decimals() external view returns (uint8)'
];

const SWAP_ABI = [
  'function swap(uint256,uint256,uint256) external returns (uint256)'
];

const RPC_URL = 'https://ethereum-sepolia-rpc.publicnode.com';

// ======== UTILITY FUNCTIONS ========
const logger = {
  info: (message) => console.log(chalk.blue('ℹ️ ') + chalk.white(message)),
  success: (message) => console.log(chalk.green('✅ ') + chalk.white(message)),
  warning: (message) => console.log(chalk.yellow('⚠️ ') + chalk.yellow(message)),
  error: (message, error) => {
    console.log(chalk.red('❌ ') + chalk.red(message));
    if (error) console.error(chalk.dim(error.message || error));
  },
  money: (message) => console.log(chalk.green('💰 ') + chalk.white(message)),
  swap: (message) => console.log(chalk.yellow('🔄 ') + chalk.white(message)),
  stake: (message) => console.log(chalk.magenta('📌 ') + chalk.white(message)),
  wallet: (message) => console.log(chalk.cyan('👛 ') + chalk.white(message))
};

// Create loading spinner
const spinner = (text) => {
  return ora({
    text,
    color: 'yellow',
    spinner: 'dots'
  });
};

// Format transaction link
const txLink = (hash) => `https://sepolia.etherscan.io/tx/${hash}`;

// Validate private key format
function isValidPrivateKey(key) {
  const cleanKey = key.startsWith('0x') ? key.slice(2) : key;
  return /^[0-9a-fA-F]{64}$/.test(cleanKey);
}

// Format proxy string for use
function formatProxy(proxyString) {
  if (!proxyString) return null;
  
  let proxy = proxyString.trim();
  if (proxy.includes('://')) {
    proxy = proxy.split('://')[1];
  }
  
  let auth = '';
  let address = proxy;
  
  if (proxy.includes('@')) {
    const parts = proxy.split('@');
    auth = parts[0];
    address = parts[1];
  }
  
  const [host, port] = address.split(':');
  
  let username = '';
  let password = '';
  if (auth) {
    const authParts = auth.split(':');
    username = authParts[0];
    password = authParts.length > 1 ? authParts[1] : '';
  }
  
  return {
    host,
    port: parseInt(port, 10),
    auth: auth ? { username, password } : undefined
  };
}

// ======== WALLET FUNCTIONS ========
async function loadWallets() {
  // Load proxies
  let proxies = [];
  try {
    if (fs.existsSync('./proxies.txt')) {
      proxies = fs.readFileSync('./proxies.txt', 'utf8')
        .split('\n')
        .filter(line => line.trim().length > 0);
      logger.info(`Loaded ${proxies.length} proxies from proxies.txt`);
    } else {
      logger.warning('proxies.txt not found. Will connect directly.');
    }
  } catch (error) {
    logger.error('Failed to load proxies:', error);
  }

  // Load private keys
  let privateKeys = [];
  try {
    const envKeys = Object.keys(process.env).filter(key => key.startsWith('PRIVATE_KEY_'));
    if (envKeys.length > 0) {
      privateKeys = envKeys
        .map(key => process.env[key])
        .filter(key => key && key.trim().length > 0)
        .filter(key => {
          if (!isValidPrivateKey(key)) {
            logger.error(`Invalid private key format for ${key.slice(0, 6)}...: must be 64 hex characters`);
            return false;
          }
          return true;
        });
      logger.info(`Loaded ${privateKeys.length} private keys from .env`);
    }
    if (privateKeys.length === 0) {
      logger.error('No valid private keys found in .env (PRIVATE_KEY_*)');
      process.exit(1);
    }
  } catch (error) {
    logger.error('Failed to load private keys from .env:', error);
    process.exit(1);
  }

  // Initialize wallets
  const wallets = [];
  for (const privateKey of privateKeys) {
    try {
      const wallet = await initializeWallet(privateKey, getRandomProxy(proxies));
      wallets.push(wallet);
    } catch (error) {
      logger.error(`Failed to initialize wallet for key ${privateKey.slice(0, 6)}...`, error);
    }
  }

  return wallets;
}

function getRandomProxy(proxies) {
  if (!proxies || proxies.length === 0) return null;
  return proxies[Math.floor(Math.random() * proxies.length)];
}

async function initializeWallet(privateKey, proxyString) {
  try {
    logger.info(`Connecting to Sepolia testnet via: ${RPC_URL}`);
    
    let provider;
    if (proxyString) {
      const proxyConfig = formatProxy(proxyString);
      logger.info(`Using proxy: ${proxyString}`);
      
      const agent = new HttpsProxyAgent({
        host: proxyConfig.host,
        port: proxyConfig.port,
        auth: proxyConfig.auth ? `${proxyConfig.auth.username}:${proxyConfig.auth.password}` : undefined
      });
      
      provider = new ethers.providers.JsonRpcProvider(
        {
          url: RPC_URL,
          agent
        },
        {
          name: 'sepolia',
          chainId: 11155111
        }
      );
    } else {
      provider = new ethers.providers.JsonRpcProvider(RPC_URL, {
        name: 'sepolia',
        chainId: 11155111
      });
    }
    
    const network = await provider.getNetwork();
    logger.success(`Connected to network: ${network.name} (chainId: ${network.chainId})`);
    
    const wallet = new ethers.Wallet(privateKey, provider);
    logger.wallet(`Connected with wallet: ${wallet.address}`);
    return wallet;
  } catch (error) {
    logger.error(`Failed to initialize wallet for private key ${privateKey.slice(0, 6)}...`, error);
    throw error;
  }
}

// ======== BALANCE FUNCTIONS ========
async function getBalances(wallet) {
  const ethBalance = await checkEthBalance(wallet);
  const usdcBalance = await checkTokenBalance(wallet, TOKEN_ADDRESSES.USDC);
  const r2usdBalance = await checkTokenBalance(wallet, TOKEN_ADDRESSES.R2USD);
  const sr2usdBalance = await checkTokenBalance(wallet, TOKEN_ADDRESSES.SR2USD);
  
  return {
    eth: ethBalance,
    usdc: usdcBalance,
    r2usd: r2usdBalance,
    sr2usd: sr2usdBalance
  };
}

async function checkTokenBalance(wallet, tokenAddress) {
  try {
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, wallet);
    const balance = await tokenContract.balanceOf(wallet.address);
    const decimals = await tokenContract.decimals();
    return ethers.utils.formatUnits(balance, decimals);
  } catch (error) {
    logger.error(`Failed to check balance for token ${tokenAddress}:`, error);
    return '0';
  }
}

async function checkEthBalance(wallet) {
  try {
    const balance = await wallet.provider.getBalance(wallet.address);
    return ethers.utils.formatEther(balance);
  } catch (error) {
    logger.error('Failed to check ETH balance:', error);
    return '0';
  }
}

async function displayBalances(wallets) {
  const spin = spinner('Fetching balances for all wallets...').start();
  
  try {
    const results = [];
    for (const wallet of wallets) {
      const balances = await getBalances(wallet);
      results.push({
        wallet: wallet.address,
        balances
      });
    }
    spin.succeed('Balances fetched successfully');
    
    // Display balances in a table format
    for (const result of results) {
      console.log(chalk.bold(`\nWallet: ${result.wallet}`));
      
      const table = new Table({
        head: [chalk.cyan('Token'), chalk.cyan('Balance')],
        colWidths: [15, 25],
        style: {
          head: [], 
          border: []
        }
      });
      
      table.push(
        ['ETH', chalk.green(result.balances.eth)],
        ['USDC', chalk.green(result.balances.usdc)],
        ['R2USD', chalk.green(result.balances.r2usd)],
        ['sR2USD', chalk.green(result.balances.sr2usd)]
      );
      
      console.log(table.toString());
    }
  } catch (error) {
    spin.fail('Failed to fetch balances');
    logger.error('Error fetching balances:', error);
  }
}
// Add to CONFIG CONSTANTS section
const DEFAULT_GAS_SETTINGS = {
    maxFeePerGas: '50', // gwei
    maxPriorityFeePerGas: '2', // gwei
    gasLimit: {
      approval: 100000,
      swap: 500000,
      stake: 100000
    }
  };

  let customGasSettings = { ...DEFAULT_GAS_SETTINGS };

function setCustomGasSettings(settings) {
  customGasSettings = { 
    ...customGasSettings,
    ...settings
  };
  logger.info(`Gas settings updated: Max fee ${customGasSettings.maxFeePerGas} gwei, Priority fee ${customGasSettings.maxPriorityFeePerGas} gwei`);
}

// ======== TRANSACTION FUNCTIONS ========
async function estimateGasFees(provider) {
    try {
      const feeData = await provider.getFeeData();
      return {
        maxFeePerGas: ethers.utils.parseUnits(customGasSettings.maxFeePerGas, 'gwei'),
        maxPriorityFeePerGas: ethers.utils.parseUnits(customGasSettings.maxPriorityFeePerGas, 'gwei')
      };
    } catch (error) {
      logger.warning('Failed to estimate gas fees, using custom settings:', error);
      return {
        maxFeePerGas: ethers.utils.parseUnits(customGasSettings.maxFeePerGas, 'gwei'),
        maxPriorityFeePerGas: ethers.utils.parseUnits(customGasSettings.maxPriorityFeePerGas, 'gwei')
      };
    }
  }

async function approveToken(wallet, tokenAddress, spenderAddress, amount) {
  try {
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, wallet);
    const decimals = await tokenContract.decimals();
    const currentAllowance = await tokenContract.allowance(wallet.address, spenderAddress);
    
    if (currentAllowance.gte(ethers.utils.parseUnits(amount.toString(), decimals))) {
      logger.info('Sufficient allowance already exists');
      return true;
    }
    
    const spin = spinner(`Approving ${amount} tokens for spending...`).start();
    const amountInWei = ethers.utils.parseUnits(amount.toString(), decimals);
    const gasFees = await estimateGasFees(wallet.provider);
    
    const tx = await tokenContract.approve(spenderAddress, amountInWei, { 
      gasLimit: parseInt(customGasSettings.gasLimit.approval),
      ...gasFees
    });
    
    spin.text = `Approval transaction sent: ${tx.hash}`;
    logger.info(`Check on Sepolia Explorer: ${txLink(tx.hash)}`);
    
    await tx.wait();
    spin.succeed('Approval confirmed');
    return true;
  } catch (error) {
    logger.error('Failed to approve token:', error);
    return false;
  }
}

async function autoSwapAndStake(wallet, amount) {
    try {
      logger.info(`Starting auto sequence: Swap ${amount} USDC → R2USD, then stake R2USD`);
      
      // First swap USDC to R2USD
      const swapSuccess = await swapUSDCtoR2USD(wallet, amount);
      if (!swapSuccess) {
        logger.error('Auto sequence failed at swap step');
        return false;
      }
      
      logger.success('Swap completed successfully, proceeding to stake');
      
      // Get current R2USD balance
      const r2usdBalance = await checkTokenBalance(wallet, TOKEN_ADDRESSES.R2USD);
      logger.money(`Current R2USD balance: ${r2usdBalance}`);
      
      // Stake R2USD
      const stakeSuccess = await stakeR2USD(wallet, r2usdBalance);
      if (!stakeSuccess) {
        logger.error('Auto sequence failed at stake step');
        return false;
      }
      
      logger.success('Auto sequence completed successfully!');
      return true;
    } catch (error) {
      logger.error('Failed to execute auto sequence:', error);
      return false;
    }
  }

async function swapUSDCtoR2USD(wallet, amount) {
  try {
    const usdcBalance = await checkTokenBalance(wallet, TOKEN_ADDRESSES.USDC);
    logger.money(`Current USDC balance: ${usdcBalance}`);
    
    if (parseFloat(usdcBalance) < parseFloat(amount)) {
      logger.error(`Insufficient USDC balance. You have ${usdcBalance} USDC but trying to swap ${amount} USDC.`);
      return false;
    }
    
    const approved = await approveToken(wallet, TOKEN_ADDRESSES.USDC, CONTRACT_ADDRESSES.USDC_TO_R2USD, amount);
    if (!approved) return false;
    
    const usdcContract = new ethers.Contract(TOKEN_ADDRESSES.USDC, ERC20_ABI, wallet);
    const decimals = await usdcContract.decimals();
    const amountInWei = ethers.utils.parseUnits(amount.toString(), decimals);
    
    const data = ethers.utils.hexConcat([
      METHOD_IDS.USDC_TO_R2USD,
      ethers.utils.defaultAbiCoder.encode(
        ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256'],
        [wallet.address, amountInWei, 0, 0, 0, 0, 0]
      )
    ]);
    
    const spin = spinner(`Swapping ${amount} USDC to R2USD...`).start();
    const gasFees = await estimateGasFees(wallet.provider);
    
    const tx = await wallet.sendTransaction({
      to: CONTRACT_ADDRESSES.USDC_TO_R2USD,
      data: data,
      gasLimit: 500000,
      ...gasFees
    });
    
    spin.text = `Transaction sent: ${tx.hash}`;
    logger.info(`Check on Sepolia Explorer: ${txLink(tx.hash)}`);
    
    await tx.wait();
    spin.succeed('Swap confirmed!');
    
    const newUSDCBalance = await checkTokenBalance(wallet, TOKEN_ADDRESSES.USDC);
    const newR2USDBalance = await checkTokenBalance(wallet, TOKEN_ADDRESSES.R2USD);
    
    logger.money(`New USDC balance: ${newUSDCBalance}`);
    logger.money(`New R2USD balance: ${newR2USDBalance}`);
    
    return true;
  } catch (error) {
    logger.error('Failed to swap USDC to R2USD:', error);
    return false;
  }
}

async function swapR2USDtoUSDC(wallet, amount) {
  try {
    const r2usdBalance = await checkTokenBalance(wallet, TOKEN_ADDRESSES.R2USD);
    logger.money(`Current R2USD balance: ${r2usdBalance}`);
    
    if (parseFloat(r2usdBalance) < parseFloat(amount)) {
      logger.error(`Insufficient R2USD balance. You have ${r2usdBalance} R2USD but trying to swap ${amount} R2USD.`);
      return false;
    }
    
    const approved = await approveToken(wallet, TOKEN_ADDRESSES.R2USD, CONTRACT_ADDRESSES.R2USD_TO_USDC, amount);
    if (!approved) return false;
    
    const r2usdContract = new ethers.Contract(TOKEN_ADDRESSES.R2USD, ERC20_ABI, wallet);
    const decimals = await r2usdContract.decimals();
    const amountInWei = ethers.utils.parseUnits(amount.toString(), decimals);
    const minOutput = amountInWei.mul(97).div(100);
    
    logger.info(`Swapping ${amount} R2USD, expecting at least ${ethers.utils.formatUnits(minOutput, decimals)} USDC`);
    
    const data = METHOD_IDS.R2USD_TO_USDC +
                 '0000000000000000000000000000000000000000000000000000000000000000' +
                 '0000000000000000000000000000000000000000000000000000000000000001' +
                 amountInWei.toHexString().slice(2).padStart(64, '0') +
                 minOutput.toHexString().slice(2).padStart(64, '0');
    
    const spin = spinner(`Swapping ${amount} R2USD to USDC...`).start();
    const gasFees = await estimateGasFees(wallet.provider);
    
    const tx = await wallet.sendTransaction({
      to: CONTRACT_ADDRESSES.R2USD_TO_USDC,
      data: data,
      gasLimit: 500000,
      ...gasFees
    });
    
    spin.text = `Transaction sent: ${tx.hash}`;
    logger.info(`Check on Sepolia Explorer: ${txLink(tx.hash)}`);
    
    const receipt = await tx.wait();
    if (receipt.status === 0) {
      throw new Error('Transaction failed. The contract reverted the execution.');
    }
    
    spin.succeed('Swap confirmed!');
    
    const newUSDCBalance = await checkTokenBalance(wallet, TOKEN_ADDRESSES.USDC);
    const newR2USDBalance = await checkTokenBalance(wallet, TOKEN_ADDRESSES.R2USD);
    
    logger.money(`New USDC balance: ${newUSDCBalance}`);
    logger.money(`New R2USD balance: ${newR2USDBalance}`);
    
    return true;
  } catch (error) {
    logger.error('Failed to swap R2USD to USDC:', error);
    if (error.transaction) {
      logger.error('Transaction details:', {
        hash: error.transaction.hash,
        to: error.transaction.to,
        from: error.transaction.from,
        data: error.transaction.data
      });
    }
    return false;
  }
}

async function stakeR2USD(wallet, amount) {
  try {
    const r2usdBalance = await checkTokenBalance(wallet, TOKEN_ADDRESSES.R2USD);
    logger.money(`Current R2USD balance: ${r2usdBalance}`);
    
    if (parseFloat(r2usdBalance) < parseFloat(amount)) {
      logger.error(`Insufficient R2USD balance. You have ${r2usdBalance} R2USD but trying to stake ${amount} R2USD.`);
      return false;
    }
    
    const r2usdContract = new ethers.Contract(TOKEN_ADDRESSES.R2USD, ERC20_ABI, wallet);
    const decimals = await r2usdContract.decimals();
    const amountInWei = ethers.utils.parseUnits(amount.toString(), decimals);
    
    const currentAllowance = await r2usdContract.allowance(wallet.address, CONTRACT_ADDRESSES.STAKE_R2USD);
    logger.info(`Current R2USD allowance for staking contract: ${ethers.utils.formatUnits(currentAllowance, decimals)}`);
    
    if (currentAllowance.lt(amountInWei)) {
      const spin = spinner(`Approving ${amount} R2USD for staking contract...`).start();
      const approveTx = await r2usdContract.approve(CONTRACT_ADDRESSES.STAKE_R2USD, amountInWei, { gasLimit: 100000 });
      
      spin.text = `Approval transaction sent: ${approveTx.hash}`;
      logger.info(`Check on Sepolia Explorer: ${txLink(approveTx.hash)}`);
      
      await approveTx.wait();
      spin.succeed('Approval confirmed');
    } else {
      logger.info('Sufficient allowance already exists');
    }
    
    const data = METHOD_IDS.STAKE_R2USD +
                amountInWei.toHexString().slice(2).padStart(64, '0') +
                '0'.repeat(576); 
    
    logger.info(`Constructed data: ${data}`);
    
    const spin = spinner(`Staking ${amount} R2USD to sR2USD...`).start();
    const gasFees = await estimateGasFees(wallet.provider);
    
    const tx = await wallet.sendTransaction({
      to: CONTRACT_ADDRESSES.STAKE_R2USD,
      data: data,
      gasLimit: 100000,
      ...gasFees
    });
    
    spin.text = `Transaction sent: ${tx.hash}`;
    logger.info(`Check on Sepolia Explorer: ${txLink(tx.hash)}`);
    
    const receipt = await tx.wait();
    if (receipt.status === 0) {
      throw new Error('Transaction failed. The contract reverted the execution.');
    }
    
    spin.succeed('Staking confirmed!');
    
    const newR2USDBalance = await checkTokenBalance(wallet, TOKEN_ADDRESSES.R2USD);
    const newSR2USDBalance = await checkTokenBalance(wallet, TOKEN_ADDRESSES.SR2USD);
    
    logger.money(`New R2USD balance: ${newR2USDBalance}`);
    logger.money(`New sR2USD balance: ${newSR2USDBalance}`);
    
    return true;
  } catch (error) {
    logger.error('Failed to stake R2USD:', error);
    if (error.transaction) {
      logger.error('Transaction details:', {
        hash: error.transaction.hash,
        to: error.transaction.to,
        from: error.transaction.from,
        data: error.transaction.data
      });
    }
    return false;
  }
}

// ======== UI FUNCTIONS ========
function displayHeader() {
  console.clear();
  console.log('\n');
  console.log(chalk.cyan(figlet.textSync('R2 Money Bot', { font: 'ANSI Shadow' })));
  console.log(chalk.dim('                                        by Zacky Mrf'));
  console.log('\n' + chalk.yellow('=' . repeat(70)) + '\n');
}

function renderMainMenu() {
    const menu = [
      { number: 1, icon: '🔄', text: 'Swap USDC to R2USD', color: 'yellow' },
      { number: 2, icon: '🔄', text: 'Swap R2USD to USDC', color: 'yellow' },
      { number: 3, icon: '📌', text: 'Stake R2USD to sR2USD', color: 'magenta' },
      { number: 4, icon: '💰', text: 'Check balances', color: 'green' },
      { number: 5, icon: '⚡', text: 'Auto Mode (Swap → Stake)', color: 'blue' },
      { number: 6, icon: '⚙️', text: 'Gas Settings', color: 'white' },
      { number: 7, icon: '🚪', text: 'Exit', color: 'red' }
    ];
  
    console.log(chalk.bold.white('MAIN MENU'));
    
    menu.forEach(item => {
      console.log(chalk[item.color](`  ${item.number}. ${item.icon}  ${item.text}`));
    });
    
    console.log('\n' + chalk.dim('Select an option (1-7):'));
  }

async function selectWallet(wallets) {
  if (wallets.length === 1) {
    logger.wallet(`Using wallet: ${wallets[0].address}`);
    return wallets[0];
  }
  
  console.log(chalk.bold.white('\nAvailable wallets:'));
  
  const table = new Table({
    head: [chalk.cyan('#'), chalk.cyan('Wallet Address')],
    colWidths: [5, 45],
    style: {
      head: [], 
      border: []
    }
  });
  
  wallets.forEach((wallet, index) => {
    table.push([index + 1, wallet.address]);
  });
  
  console.log(table.toString());
  console.log(chalk.dim('\nYou can enter a wallet number or type "all" to use all wallets'));
  
  return new Promise((resolve) => {
    rl.question(chalk.bold.white('Selection: '), (input) => {
      if (input.toLowerCase() === 'all') {
        logger.info('Using all wallets');
        resolve(wallets);
      } else {
        const index = parseInt(input) - 1;
        if (isNaN(index) || index < 0 || index >= wallets.length) {
          logger.warning('Invalid selection. Using first wallet.');
          resolve(wallets[0]);
        } else {
          logger.wallet(`Using wallet: ${wallets[index].address}`);
          resolve(wallets[index]);
        }
      }
    });
  });
}

// ======== HANDLERS ========

async function handleAutoMode(wallets) {
    try {
      const selectedWallets = await selectWallet(wallets);
      const isAllWallets = Array.isArray(selectedWallets);
      const walletList = isAllWallets ? selectedWallets : [selectedWallets];
      
      console.log(chalk.yellow('\nCurrent USDC Balances:'));
      const table = new Table({
        head: [chalk.cyan('Wallet'), chalk.cyan('USDC Balance')],
        colWidths: [45, 20],
        style: {
          head: [], 
          border: []
        }
      });
      
      for (const wallet of walletList) {
        const usdcBalance = await checkTokenBalance(wallet, TOKEN_ADDRESSES.USDC);
        table.push([wallet.address, usdcBalance]);
      }
      
      console.log(table.toString());
      
      const amountPrompt = chalk.bold.white('\nEnter amount of USDC to swap and stake (or "back" to return to menu): ');
      rl.question(amountPrompt, async (amount) => {
        if (amount.toLowerCase() === 'back') {
          await showMenu(wallets);
          return;
        }
        
        const parsedAmount = parseFloat(amount);
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
          logger.error('Invalid amount. Please enter a positive number.');
          await handleAutoMode(wallets);
          return;
        }
        
        const txPrompt = chalk.bold.white('Enter number of auto sequences per wallet (or "skip" to return to menu): ');
        rl.question(txPrompt, async (numTxs) => {
          if (numTxs.toLowerCase() === 'skip') {
            await showMenu(wallets);
            return;
          }
          
          const parsedNumTxs = parseInt(numTxs);
          if (isNaN(parsedNumTxs) || parsedNumTxs <= 0) {
            logger.error('Invalid number. Please enter a positive integer.');
            await handleAutoMode(wallets);
            return;
          }
          
          for (const wallet of walletList) {
            console.log(chalk.bold.white(`\nProcessing wallet: ${wallet.address}`));
            
            for (let i = 1; i <= parsedNumTxs; i++) {
              const progressBar = `[${i}/${parsedNumTxs}]`;
              logger.info(`${progressBar} Executing auto sequence (Amount: ${parsedAmount} USDC)`);
              
              const success = await autoSwapAndStake(wallet, parsedAmount);
              
              if (success) {
                logger.success(`${progressBar} Auto sequence completed successfully!`);
              } else {
                logger.error(`${progressBar} Auto sequence failed. Continuing to next transaction.`);
              }
            }
            
            logger.success(`Completed ${parsedNumTxs} auto sequence(s) for wallet ${wallet.address}.`);
          }
          
          await showMenu(wallets);
        });
      });
    } catch (error) {
      logger.error('An error occurred during auto mode process:', error);
      await showMenu(wallets);
    }
  }
  
  async function handleGasSettings(wallets) {
    console.log(chalk.yellow('\nCurrent Gas Settings:'));
    
    const table = new Table({
      head: [chalk.cyan('Setting'), chalk.cyan('Value')],
      colWidths: [25, 20],
      style: {
        head: [], 
        border: []
      }
    });
    
    table.push(
      ['Max Fee (gwei)', customGasSettings.maxFeePerGas],
      ['Priority Fee (gwei)', customGasSettings.maxPriorityFeePerGas],
      ['Gas Limit - Approval', customGasSettings.gasLimit.approval],
      ['Gas Limit - Swap', customGasSettings.gasLimit.swap],
      ['Gas Limit - Stake', customGasSettings.gasLimit.stake]
    );
    
    console.log(table.toString());
    
    console.log(chalk.dim('\nEnter new values or press Enter to keep current values'));
    
    rl.question(chalk.bold.white('Max Fee (gwei): '), (maxFee) => {
      if (maxFee && !isNaN(parseFloat(maxFee)) && parseFloat(maxFee) > 0) {
        customGasSettings.maxFeePerGas = maxFee;
      }
      
      rl.question(chalk.bold.white('Priority Fee (gwei): '), (priorityFee) => {
        if (priorityFee && !isNaN(parseFloat(priorityFee)) && parseFloat(priorityFee) > 0) {
          customGasSettings.maxPriorityFeePerGas = priorityFee;
        }
        
        rl.question(chalk.bold.white('Gas Limit - Approval: '), (approvalLimit) => {
          if (approvalLimit && !isNaN(parseInt(approvalLimit)) && parseInt(approvalLimit) > 0) {
            customGasSettings.gasLimit.approval = parseInt(approvalLimit);
          }
          
          rl.question(chalk.bold.white('Gas Limit - Swap: '), (swapLimit) => {
            if (swapLimit && !isNaN(parseInt(swapLimit)) && parseInt(swapLimit) > 0) {
              customGasSettings.gasLimit.swap = parseInt(swapLimit);
            }
            
            rl.question(chalk.bold.white('Gas Limit - Stake: '), (stakeLimit) => {
              if (stakeLimit && !isNaN(parseInt(stakeLimit)) && parseInt(stakeLimit) > 0) {
                customGasSettings.gasLimit.stake = parseInt(stakeLimit);
              }
              
              logger.success('Gas settings updated successfully!');
              logger.info(`Max Fee: ${customGasSettings.maxFeePerGas} gwei, Priority Fee: ${customGasSettings.maxPriorityFeePerGas} gwei`);
              logger.info(`Gas Limits - Approval: ${customGasSettings.gasLimit.approval}, Swap: ${customGasSettings.gasLimit.swap}, Stake: ${customGasSettings.gasLimit.stake}`);
              
              setTimeout(() => showMenu(wallets), 2000);
            });
          });
        });
      });
    });
  }
async function handleUSDCtoR2USDSwap(wallets) {
  try {
    const selectedWallets = await selectWallet(wallets);
    const isAllWallets = Array.isArray(selectedWallets);
    const walletList = isAllWallets ? selectedWallets : [selectedWallets];
    
    console.log(chalk.yellow('\nCurrent USDC Balances:'));
    const table = new Table({
      head: [chalk.cyan('Wallet'), chalk.cyan('USDC Balance')],
      colWidths: [45, 20],
      style: {
        head: [], 
        border: []
      }
    });
    
    for (const wallet of walletList) {
      const usdcBalance = await checkTokenBalance(wallet, TOKEN_ADDRESSES.USDC);
      table.push([wallet.address, usdcBalance]);
    }
    
    console.log(table.toString());
    
    const amountPrompt = chalk.bold.white('\nEnter amount of USDC to swap (or "back" to return to menu): ');
    rl.question(amountPrompt, async (amount) => {
      if (amount.toLowerCase() === 'back') {
        await showMenu(wallets);
        return;
      }
      
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        logger.error('Invalid amount. Please enter a positive number.');
        await handleUSDCtoR2USDSwap(wallets);
        return;
      }
      
      const txPrompt = chalk.bold.white('Enter number of swap transactions per wallet (or "skip" to return to menu): ');
      rl.question(txPrompt, async (numTxs) => {
        if (numTxs.toLowerCase() === 'skip') {
          await showMenu(wallets);
          return;
        }
        
        const parsedNumTxs = parseInt(numTxs);
        if (isNaN(parsedNumTxs) || parsedNumTxs <= 0) {
          logger.error('Invalid number. Please enter a positive integer.');
          await handleUSDCtoR2USDSwap(wallets);
          return;
        }
        
        for (const wallet of walletList) {
          console.log(chalk.bold.white(`\nProcessing wallet: ${wallet.address}`));
          
          for (let i = 1; i <= parsedNumTxs; i++) {
            const progressBar = `[${i}/${parsedNumTxs}]`;
            logger.info(`${progressBar} Executing USDC to R2USD swap (Amount: ${parsedAmount} USDC)`);
            
            const success = await swapUSDCtoR2USD(wallet, parsedAmount);
            
            if (success) {
              logger.success(`${progressBar} Swap transaction completed successfully!`);
            } else {
              logger.error(`${progressBar} Swap transaction failed. Continuing to next transaction.`);
            }
          }
          
          logger.success(`Completed ${parsedNumTxs} USDC to R2USD swap transaction(s) for wallet ${wallet.address}.`);
        }
        
        await showMenu(wallets);
      });
    });
  } catch (error) {
    logger.error('An error occurred during USDC to R2USD swap process:', error);
    await showMenu(wallets);
  }
}

async function handleR2USDtoUSDCSwap(wallets) {
  try {
    const selectedWallets = await selectWallet(wallets);
    const isAllWallets = Array.isArray(selectedWallets);
    const walletList = isAllWallets ? selectedWallets : [selectedWallets];
    
    console.log(chalk.yellow('\nCurrent R2USD Balances:'));
    const table = new Table({
      head: [chalk.cyan('Wallet'), chalk.cyan('R2USD Balance')],
      colWidths: [45, 20],
      style: {
        head: [], 
        border: []
      }
    });
    
    for (const wallet of walletList) {
      const r2usdBalance = await checkTokenBalance(wallet, TOKEN_ADDRESSES.R2USD);
      table.push([wallet.address, r2usdBalance]);
    }
    
    console.log(table.toString());
    
    const amountPrompt = chalk.bold.white('\nEnter amount of R2USD to swap (or "back" to return to menu): ');
    rl.question(amountPrompt, async (amount) => {
      if (amount.toLowerCase() === 'back') {
        await showMenu(wallets);
        return;
      }
      
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        logger.error('Invalid amount. Please enter a positive number.');
        await handleR2USDtoUSDCSwap(wallets);
        return;
      }
      
      const txPrompt = chalk.bold.white('Enter number of swap transactions per wallet (or "skip" to return to menu): ');
      rl.question(txPrompt, async (numTxs) => {
        if (numTxs.toLowerCase() === 'skip') {
          await showMenu(wallets);
          return;
        }
        
        const parsedNumTxs = parseInt(numTxs);
        if (isNaN(parsedNumTxs) || parsedNumTxs <= 0) {
          logger.error('Invalid number. Please enter a positive integer.');
          await handleR2USDtoUSDCSwap(wallets);
          return;
        }
        
        for (const wallet of walletList) {
          console.log(chalk.bold.white(`\nProcessing wallet: ${wallet.address}`));
          
          for (let i = 1; i <= parsedNumTxs; i++) {
            const progressBar = `[${i}/${parsedNumTxs}]`;
            logger.info(`${progressBar} Executing R2USD to USDC swap (Amount: ${parsedAmount} R2USD)`);
            
            const success = await swapR2USDtoUSDC(wallet, parsedAmount);
            
            if (success) {
              logger.success(`${progressBar} Swap transaction completed successfully!`);
            } else {
              logger.error(`${progressBar} Swap transaction failed. Continuing to next transaction.`);
            }
          }
          
          logger.success(`Completed ${parsedNumTxs} R2USD to USDC swap transaction(s) for wallet ${wallet.address}.`);
        }
        
        await showMenu(wallets);
      });
    });
  } catch (error) {
    logger.error('An error occurred during R2USD to USDC swap process:', error);
    await showMenu(wallets);
  }
}

async function handleStakeR2USD(wallets) {
  try {
    const selectedWallets = await selectWallet(wallets);
    const isAllWallets = Array.isArray(selectedWallets);
    const walletList = isAllWallets ? selectedWallets : [selectedWallets];
    
    console.log(chalk.yellow('\nCurrent R2USD Balances:'));
    const table = new Table({
      head: [chalk.cyan('Wallet'), chalk.cyan('R2USD Balance')],
      colWidths: [45, 20],
      style: {
        head: [], 
        border: []
      }
    });
    
    for (const wallet of walletList) {
      const r2usdBalance = await checkTokenBalance(wallet, TOKEN_ADDRESSES.R2USD);
      table.push([wallet.address, r2usdBalance]);
    }
    
    console.log(table.toString());
    
    const amountPrompt = chalk.bold.white('\nEnter amount of R2USD to stake (or "back" to return to menu): ');
    rl.question(amountPrompt, async (amount) => {
      if (amount.toLowerCase() === 'back') {
        await showMenu(wallets);
        return;
      }
      
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        logger.error('Invalid amount. Please enter a positive number.');
        await handleStakeR2USD(wallets);
        return;
      }
      
      const txPrompt = chalk.bold.white('Enter number of staking transactions per wallet (or "skip" to return to menu): ');
      rl.question(txPrompt, async (numTxs) => {
        if (numTxs.toLowerCase() === 'skip') {
          await showMenu(wallets);
          return;
        }
        
        const parsedNumTxs = parseInt(numTxs);
        if (isNaN(parsedNumTxs) || parsedNumTxs <= 0) {
          logger.error('Invalid number. Please enter a positive integer.');
          await handleStakeR2USD(wallets);
          return;
        }
        
        for (const wallet of walletList) {
          console.log(chalk.bold.white(`\nProcessing wallet: ${wallet.address}`));
          
          for (let i = 1; i <= parsedNumTxs; i++) {
            const progressBar = `[${i}/${parsedNumTxs}]`;
            logger.info(`${progressBar} Executing staking transaction (Amount: ${parsedAmount} R2USD)`);
            
            const success = await stakeR2USD(wallet, parsedAmount);
            
            if (success) {
              logger.success(`${progressBar} Staking transaction completed successfully!`);
            } else {
              logger.error(`${progressBar} Staking transaction failed. Continuing to next transaction.`);
            }
          }
          
          logger.success(`Completed ${parsedNumTxs} staking transaction(s) for wallet ${wallet.address}.`);
        }
        
        await showMenu(wallets);
      });
    });
  } catch (error) {
    logger.error('An error occurred during R2USD staking process:', error);
    await showMenu(wallets);
  }
}

async function showMenu(wallets) {
    displayHeader();
    renderMainMenu();
    
    rl.question('', async (option) => {
      switch (option) {
        case '1':
          await handleUSDCtoR2USDSwap(wallets);
          break;
        case '2':
          await handleR2USDtoUSDCSwap(wallets);
          break;
        case '3':
          await handleStakeR2USD(wallets);
          break;
        case '4':
          await displayBalances(wallets);
          setTimeout(() => showMenu(wallets), 2000);
          break;
        case '5':
          await handleAutoMode(wallets);
          break;
        case '6':
          await handleGasSettings(wallets);
          break;
        case '7':
          logger.info('Exiting the application!');
          rl.close();
          return;
        default:
          logger.warning('Invalid option. Please select a number between 1 and 7.');
          setTimeout(() => showMenu(wallets), 1000);
          break;
      }
    });
  }

// ======== MAIN ========
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.on('close', () => {
  console.log(chalk.dim('Application exited.'));
  process.exit(0);
});

async function main() {
  try {
    displayHeader();
    logger.info('USDC/R2USD/sR2USD Bot Starting on Sepolia Testnet...');
    
    const wallets = await loadWallets();
    
    if (wallets.length === 0) {
      logger.error('No valid wallets initialized. Exiting.');
      process.exit(1);
    }
    
    await showMenu(wallets);
  } catch (error) {
    logger.error('An error occurred:', error);
    rl.close();
  }
}

main();