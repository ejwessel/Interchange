const PayoutClient = artifacts.require("PayoutClient");

module.exports = async function(deployer) {

  //ROPSTEN TESTNET ADDRESSES
  const LinkTokenAddress = "0x20fE562d797A42Dcb3399062AE9546cd06f63280";
  const PayoutOracleAddress = "0x2672708476E5a655B569bB9fB206bADb396C6444";
  const url = "https://chainlink-node-274617.uc.r.appspot.com/payout";

//  await deployer.deploy(
//    PayoutClient,
//    LinkTokenAddress, 
//    PayoutOracleAddress, 
//    url
//  );
};
