// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";

contract LandRegistry is ERC721URIStorage, Ownable {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIdCounter;

    struct Land {
        address owner;
        string ipfsHash;
        uint256 price;
        uint256 royalty; // stored as a percentage (e.g., 10 for 10%)
    }

    // Mapping from tokenId to land data
    mapping(uint256 => Land) public lands;

    event LandMinted(uint256 tokenId, address owner, string ipfsHash, uint256 price, uint256 royalty);
    event LandTransferred(uint256 tokenId, address from, address to);
    event LandBurned(uint256 tokenId);

    constructor() ERC721("LandRegistry", "LAND") {}

    /**
     * @dev Mint a new land NFT
     * @param ipfsHash The IPFS hash pointing to the land's metadata
     * @param price The price of the land in wei
     * @param royalty The royalty percentage (e.g., 10 for 10%)
     */
    function mintLand(string memory ipfsHash, uint256 price, uint256 royalty) public {
        require(royalty <= 10000, "Royalty cannot exceed 100%");

        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();

        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, ipfsHash);

        lands[tokenId] = Land({
            owner: msg.sender,
            ipfsHash: ipfsHash,
            price: price,
            royalty: royalty
        });

        emit LandMinted(tokenId, msg.sender, ipfsHash, price, royalty);
    }

    /**
     * @dev Transfer land ownership
     * @param to The address to transfer the land to
     * @param tokenId The ID of the land token
     */
    function transferLand(address to, uint256 tokenId) public {
        require(_isApprovedOrOwner(msg.sender, tokenId), "Caller is not owner nor approved");
        _transfer(msg.sender, to, tokenId);

        // Update the land ownership
        lands[tokenId].owner = to;

        emit LandTransferred(tokenId, msg.sender, to);
    }

    /**
     * @dev Get the details of a land
     * @param tokenId The ID of the land token
     * @return owner The address of the land owner
     * @return ipfsHash The IPFS hash of the land's metadata
     * @return price The price of the land
     * @return royalty The royalty percentage
     */
    function getLand(uint256 tokenId) public view returns (address owner, string memory ipfsHash, uint256 price, uint256 royalty) {
        require(_exists(tokenId), "Token does not exist");
        Land memory land = lands[tokenId];
        return (land.owner, land.ipfsHash, land.price, land.royalty);
    }

    /**
     * @dev Burn a land NFT and remove its data from the contract
     * @param tokenId The ID of the land token to burn
     */
    function burnLand(uint256 tokenId) public {
        require(_isApprovedOrOwner(msg.sender, tokenId), "Caller is not owner nor approved");
        _burn(tokenId);

        // Remove the land data from the mapping
        delete lands[tokenId];

        emit LandBurned(tokenId);
    }

    /**
     * @dev Update the price of a land
     * @param tokenId The ID of the land token
     * @param newPrice The new price of the land in wei
     */
    function updateLandPrice(uint256 tokenId, uint256 newPrice) public {
        require(_isApprovedOrOwner(msg.sender, tokenId), "Caller is not owner nor approved");
        lands[tokenId].price = newPrice;
    }

    /**
     * @dev Update the royalty percentage of a land
     * @param tokenId The ID of the land token
     * @param newRoyalty The new royalty percentage
     */
    function updateLandRoyalty(uint256 tokenId, uint256 newRoyalty) public {
        require(_isApprovedOrOwner(msg.sender, tokenId), "Caller is not owner nor approved");
        require(newRoyalty <= 10000, "Royalty cannot exceed 100%");
        lands[tokenId].royalty = newRoyalty;
    }
}
