require("dotenv").config();
require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.24",
  paths: {
    artifacts: "./src",
  },
  networks: {
      amoy: {
      url: process.env.AMOY_API_URL,
      accounts: [process.env.ACCOUNT_PRIVATE_KEY],
      },
  },
};
