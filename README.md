

landwho bakcend, frontend and contracts

## Frontend Run:

```bash
cd landwho-front
npm install & npm run dev
```

## Backend Run:

```bash
cd landwho-back
node index.js
```

## Deploy Contracts

```bash
cd landwho-contracts
npx hardhat compile
npx hardhat run scripts/deploy.js --network amoy
```