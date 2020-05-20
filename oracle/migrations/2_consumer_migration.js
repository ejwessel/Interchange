const Consumer = artifacts.require("TestnetConsumer");

module.exports = async (deployer, network) => {
  //await deployer.deploy(Consumer)
  //let consumer = await Consumer.deployed()
  let consumer = await Consumer.at("0x7Ca48229C29CF9A2BB6b774898F24Ec1435eEDd0")
  // oracle, jobid
  // NOTE: before calling this method the Consumer must have LINK and the chainlink node must have eth to perform a trx
  await consumer.requestEthereumPrice("0x2672708476E5a655B569bB9fB206bADb396C6444","eeb286efc8ed46079cb66b1def9fa508")
  let currentPrice = await consumer.currentPrice.call()
  console.log(currentPrice.toNumber())
};
