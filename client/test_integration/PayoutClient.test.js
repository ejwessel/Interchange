const PayoutClient = artifacts.require("PayoutClient");
const Oracle = artifacts.require("Oracle");
const LinkToken = artifacts.require("LinkToken");
const truffleAssert = require('truffle-assertions');
const ethers = require('ethers');
const BigNumber = require('bignumber.js');
const delay = m => new Promise(r => setTimeout(r, m));

const EMPTY_ADDRESS = '0x0000000000000000000000000000000000000000';

//ROPSTEN TESTNET ADDRESS
const LinkTokenAddress = "0x20fE562d797A42Dcb3399062AE9546cd06f63280";
const PayoutOracleAddress = "0x2672708476E5a655B569bB9fB206bADb396C6444";

const ADAPTER_POST_JOB_ID = "1680e8b0e07341b8acf3f6746fdd4dc4";
const PAYMENT = 1;

contract('Payout Integration Tests', async (accounts) => {
  let payoutClient;
  let requestId;
  let requester = accounts[0];

  before('deploy PayoutClient', async() => {
   payoutClient = await PayoutClient.new(
     LinkTokenAddress,
     PayoutOracleAddress
   );
   console.log("PayoutClient Address: " + payoutClient.address)

    // payoutClient = await PayoutClient.at("0x1e63Ccd117cA738e97379F0530B8c63c93327DB5");
  });

  describe("Test initial values", async () => {
    it("Test LinkToken", async() => {
        let val = await payoutClient.linkToken.call();
        assert.equal(val, LinkTokenAddress, "token not properly set");
    })

    it("Test Oracle", async() => {
        let val = await payoutClient.oracle.call();
        assert.equal(val, PayoutOracleAddress, "oracle not properly set");
    })
  });

  describe("Test request", async () => {
    it("Test requestCreateGame is successful in requesting to payout", async() => {
        let paymentAmount = 0
        let trx = await payoutClient.requestPayout(ethers.utils.toUtf8Bytes(ADAPTER_POST_JOB_ID), paymentAmount);

        //listen for event and capture the requestId
        truffleAssert.eventEmitted(trx, 'RequestPayout', (e) => {
            //capture requestId
            requestId = e.requestId;
            return e.sender === requester;
        }); 

        console.log("Request ID: " + requestId)

        // NOTE: at this point the user would be waiting for the oracle to call the contract back
    });
    
    it("Test oracle callback fullfillRequest", async() => {
        //listen for event and capture new game OR poll the contract with requestId

//        let status = await payoutClient.requestIdStatus(requestId);

//        while(owner !== player) {
//          console.log("waiting on change of owner")
//          owner = await hangman.owner.call();
//          console.log("Current Owner: " + owner)
//          console.log("Expected Owner: " + player)
//          await delay(10000); // create a 10 second delay here so we dont over load the network?
//        }
//        const later = Date.now()
//        const diff = Math.abs(now - later);
//        console.log(`polling time: ${diff / 1000} seconds`);
//
//        assert.equal(owner, player, "player is not the owner of hangman contract");
    });
  });
});
