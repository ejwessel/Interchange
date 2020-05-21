pragma solidity ^0.4.24;
pragma experimental ABIEncoderV2;

import "chainlink/contracts/ChainlinkClient.sol";
import "link_token/contracts/token/linkERC20.sol";
import 'openzeppelin-solidity/contracts/ownership/Ownable.sol';

contract PayoutClient is ChainlinkClient, Ownable {
    address public linkToken;
    address public oracle;
    mapping(bytes32 => bool) public requestIdStatus;

    event RequestPayout(address sender, bytes32 requestId);
    event FulfillPayout(bytes32 requestId);

    constructor(address _link, address _oracle) public {
        setChainlinkToken(_link);
        setChainlinkOracle(_oracle);
        linkToken = _link;
        oracle = _oracle;
    }

    /*
     * @notice Requests to start a new hangman game
     * @dev remits requestId for a given sender
     * @param uint256 the payment to the oracle in order to fetch a random word
     */
    function requestPayout(bytes32 job_id) public {
        require(msg.value > 0, "ETHER_MUST_BE_PROVIDED")
        oracle.transfer(msg.value)

        // newRequest takes a JobID, a callback address, and callback function as input
        Chainlink.Request memory req = buildChainlinkRequest(job_id, this, this.fullfillRequest.selector);
        req.add("body", "{\"receiver_email\":\"sb-nbsys1565094@personal.example.com\",\"value\":\"msg.value\"}");
        bytes32 requestId = sendChainlinkRequest(req, 0);

        emit RequestPayout(msg.sender, requestId);
    }

    /*
     * @notice The method called back when the chainlink oracles has a response
     * @param bytes32 the request id that was returned earlier by the chainlink request
     * @param bytes32 the data requested from the oracle
     */
    function fullfillRequest(bytes32 _requestId, bytes32 _data)
        public
        recordChainlinkFulfillment(_requestId)
        returns (bytes32) {
            requestIdStatus[_requestId] = true;
            //game is now ready to play
            emit FulfillPayout(_requestId);
    }

    /*
     * @notice Withdraws link from the contact address back to the owner of the contract
     * @dev only owner can call this method
     */
    function withdrawLink() public onlyOwner {
        LinkTokenInterface link = LinkTokenInterface(chainlinkTokenAddress());
        require(link.transfer(msg.sender, link.balanceOf(address(this))), "Unable to transfer");
    }

    /*
     * @notice cancels the sent request
     * @dev only owner can call this method
     * @param bytes32 the request id to cancel
     * @param uint256 The amount of LINK sent for the request
     * @param bytes4 The callback function specified for the request
     * @param uint256 The time of the expiration for the request
     *
     */
    function cancelRequest(bytes32 _requestId, uint256 _payment, bytes4 _callbackFunctionId, uint256 _expiration) public onlyOwner {
        cancelChainlinkRequest(_requestId, _payment, _callbackFunctionId, _expiration);
    }
}
