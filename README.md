

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

## WIP
- need business plan:
    - marketplace, others can mint parcels
    - whole nft land logic
    - cover commission fee for minting to charge server wallet