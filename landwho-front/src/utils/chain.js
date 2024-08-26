import detectEthereumProvider from '@metamask/detect-provider';

export const connectWallet = async () => {
  if (typeof window.ethereum !== 'undefined') {
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const account = accounts[0];
      return account;
    } catch (error) {
      console.error('User rejected the request.');
      return null;
    }
  } else {
    console.error('MetaMask is not installed!');
    return null;
  }
};