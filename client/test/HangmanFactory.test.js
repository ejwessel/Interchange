const HangmanFactory = artifacts.require("HangmanFactory");
const Hangman = artifacts.require("Hangman");
const MockContract = artifacts.require("MockContract");
const Oracle = artifacts.require("Oracle");
const LinkToken = artifacts.require("LinkToken");
const helper = require('ganache-time-traveler');
const truffleAssert = require('truffle-assertions');
const ethers = require('ethers');

const EMPTY_ADDRESS = '0x0000000000000000000000000000000000000000';
const CHAINLINK_HTTP_GET_JOB_ID = "013f25963613411badc2ece3a92d0800"; //this is mainnet jobid
const PAYMENT = 1;

contract('HangmanFactory', async (accounts) => {
  let hangmanFactory;
  let linkTokenTemplate;
  let mockLinkToken;
  let mockOracle = accounts[9];
  let player = accounts[0];
  let url = "https://en.wikipedia.org/api/rest_v1/page/random/title";
  let path = ["items", "0", "title"];
  let snapshotId;

  before('deploy HangmanFactory', async() => {
      linkTokenTemplate = await LinkToken.new();
      mockLinkToken = await MockContract.new();

      //mock LinkToken.transferAndCall()
      let mockLink_transferAndCall = 
        linkTokenTemplate.contract.methods
          .transferAndCall(EMPTY_ADDRESS, 0, ethers.utils.toUtf8Bytes("0"))
          .encodeABI();
      await mockLinkToken.givenMethodReturnBool(mockLink_transferAndCall, true);

      //mock LinkToken.balanceOf()
      let mockLink_balanceOf = 
        linkTokenTemplate.contract.methods
        .balanceOf(EMPTY_ADDRESS)
        .encodeABI();
      await mockLinkToken.givenMethodReturnUint(mockLink_balanceOf, 1);

      //mock LinkToken.transfer()
      let mockLink_transferFrom = 
      linkTokenTemplate.contract.methods
        .transferFrom(EMPTY_ADDRESS, EMPTY_ADDRESS, 0)
        .encodeABI();
      await mockLinkToken.givenMethodReturnBool(mockLink_transferFrom, true);

      let mockLink_allowance = 
      linkTokenTemplate.contract.methods
        .allowance(EMPTY_ADDRESS, EMPTY_ADDRESS)
        .encodeABI();
      await mockLinkToken.givenMethodReturnUint(mockLink_allowance, 1);

      hangmanFactory = await HangmanFactory.new(mockLinkToken.address, mockOracle, url, path);
  });

  beforeEach(async() => {
    let snapShot = await helper.takeSnapshot();
    snapshotId = snapShot['result'];
  });

  afterEach(async() => {
      await helper.revertToSnapshot(snapshotId);
  });

  describe("Test initial values", async () => {
    it("Test url", async() => {
        let val = await hangmanFactory.url.call();
        assert.equal(val, url, "url not properly set");
    })

    it("Test path", async() => {
        let val_0 = await hangmanFactory.path.call(0);
        assert.equal(val_0, path[0], "path not properly set");
        let val_1 = await hangmanFactory.path.call(1);
        assert.equal(val_1, path[1], "path not properly set");
        let val_2 = await hangmanFactory.path.call(2);
        assert.equal(val_2, path[2], "path not properly set");
    })
  });

  describe("Test creation of hangman contract game", async () => {
    it("Test requestCreateGame is successful in requesting to start a game", async() => {
        let trx = await hangmanFactory.requestCreateGame(ethers.utils.toUtf8Bytes(CHAINLINK_HTTP_GET_JOB_ID), PAYMENT);

        //listen for event and capture the requestId
        let requestId
        truffleAssert.eventEmitted(trx, 'RequestCreateGame', (e) => {
            //capture requestId
            requestId = e.requestId;
            return e.owner === player;
        });

        let game = await hangmanFactory.requestIdToGame.call(requestId);
        assert.equal(game[0], player, "saving game instance was unsuccessful");
        assert.notEqual(game[1], EMPTY_ADDRESS, "saving game instance was unsuccessful");

        // NOTE: at this point the user would be waiting for the oracle to call the contract back
    });

    it("Test requestCreateGame without LINK allowance", async() => {
      let mockLink_allowance = 
      linkTokenTemplate.contract.methods
        .allowance(EMPTY_ADDRESS, EMPTY_ADDRESS)
        .encodeABI();
      await mockLinkToken.givenMethodReturnUint(mockLink_allowance, 0);

      await truffleAssert.reverts(
        hangmanFactory.requestCreateGame(ethers.utils.toUtf8Bytes(CHAINLINK_HTTP_GET_JOB_ID), PAYMENT),
        "CONTRACT_APPROVAL_ERROR"
      );
    });

    it("Test requestCreateGame with insufficent LINK balance", async() => {
        let mockLink_balanceOf = 
          linkTokenTemplate.contract.methods
          .balanceOf(EMPTY_ADDRESS)
          .encodeABI();
        await mockLinkToken.givenMethodReturnUint(mockLink_balanceOf, 0);

        await truffleAssert.reverts(
          hangmanFactory.requestCreateGame(ethers.utils.toUtf8Bytes(CHAINLINK_HTTP_GET_JOB_ID), PAYMENT),
          "USER_INSUFFICIENT_FUNDS"
        );
    });

    it("Test requestCreateGame with unsuccessful LINK transfer", async() => {
        let mockLink_transferFrom = 
        linkTokenTemplate.contract.methods
          .transferFrom(EMPTY_ADDRESS, EMPTY_ADDRESS, 0)
          .encodeABI();
        await mockLinkToken.givenMethodReturnBool(mockLink_transferFrom, false);

        await truffleAssert.reverts(
          hangmanFactory.requestCreateGame(ethers.utils.toUtf8Bytes(CHAINLINK_HTTP_GET_JOB_ID), PAYMENT),
          "TRANSFER_FUNDS_ERROR"
        );
    });

    it("Test fullfillCreateGame is successful in creating a Hangman contract", async() => {
        let trx = await hangmanFactory.requestCreateGame(ethers.utils.toUtf8Bytes(CHAINLINK_HTTP_GET_JOB_ID), PAYMENT);

        //listen for event and capture the requestId
        let requestId
        truffleAssert.eventEmitted(trx, 'RequestCreateGame', (e) => {
            //capture requestId
            requestId = e.requestId;
            return e.owner === player;
        }); 

        // NOTE: at this point the user would be waiting for the oracle to call the contract back
      
        //call the fullfillCreateGame with data that mocks
        let givenWord = "testing";
        let bytesVal = ethers.utils.toUtf8Bytes(givenWord);
        trx = await hangmanFactory.fullfillCreateGame(requestId, bytesVal, { from: mockOracle });

        //listen for event and capture new game
        truffleAssert.eventEmitted(trx, 'FulfillCreateGame', (e) => {
            return e.owner === player && e.requestId === requestId;
        }); 

        let game = await hangmanFactory.requestIdToGame(requestId);
        assert.equal(game[0], player, "saving game instance was unsuccessful");
        assert.isOk(game[1], "saving game instance was unsuccessful");

        let hangman = await Hangman.at(game[1]);
        let owner = await hangman.owner.call();
        assert.equal(owner, player, "player is not the owner of hangman contract");

        trx = await hangman.makeWordGuess(ethers.utils.toUtf8Bytes("testing"));
        truffleAssert.eventEmitted(trx, "GameWin");
    });
  });
});
