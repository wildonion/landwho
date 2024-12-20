const hre = require("hardhat");

async function main() {
    const deployedContract = await hre.ethers.deployContract("LandRegistry");
    await deployedContract.waitForDeployment();
    console.log(
        `Counter contract deployed to address ${deployedContract.target}`
    );
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});