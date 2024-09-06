

landwho bakcend, frontend and contracts

## Frontend Run:

```bash
cd landwho-front
npm install & npm run dev
```

## Backend Run:

create database `landwho` and import `landwho.sql` located in `landwho-backend` into the db.

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
    - marketplace
    - whole nft land logic
    - cover commission fee for minting to charge server wallet