const { assert, expect } = require("chai");
const { deployments, ethers, getNamedAccounts } = require("hardhat");
describe("FundMe", function () {
  let fundMe;
  let fundMeCompilation;
  let deployer;
  let mockV3AggregatorCompilation;
  beforeEach(async function () {
    deployer = (await getNamedAccounts()).deployer;
    await deployments.fixture(["all"]);
    fundMeCompilation = await deployments.get("FundMe");
    mockV3AggregatorCompilation = await deployments.get("MockV3Aggregator");
    // console.log("-------------", mockV3AggregatorCompilation, "-------");
    fundMe = await ethers.getContractAt(
      fundMeCompilation.abi,
      fundMeCompilation.address
    );
    // mockV3Aggregator = await ethers.getContractAt(
    //   mockV3AggregatorCompilation.abi,
    //   mockV3AggregatorCompilation.address
    // );
  });
  describe("constructor", async function () {
    it("sets the aggregator addresses correctly", async function () {
      const response = await fundMe.priceFeed();
      assert.equal(response, mockV3AggregatorCompilation.address);
    });
  });

  describe("fund", async function () {
    it("fails if you don't send enough ETH", async function () {
      await expect(fundMe.fund()).to.be.revertedWith(
        "You need to spend more ETH!"
      );
    });
    it("updated the amount funded data structrue", async function () {
      await fundMe.fund({ value: ethers.parseEther("1") });
      const response = await fundMe.addressToAmountFunded(deployer);
      assert.equal(response, ethers.parseEther("1"));
    });
    it("adds funder to array of funders", async function () {
      await fundMe.fund({ value: ethers.parseEther("1") });
      const funder = await fundMe.funders(0);
      assert.equal(funder, deployer);
    });
  });

  describe("withdraw", async function () {
    beforeEach(async function () {
      await fundMe.fund({ value: ethers.parseEther("1") });
    });
    it("allows us to withdraw with single funder", async function () {
      // Arrange
      const startContractBalance = await ethers.provider.getBalance(
        fundMeCompilation.address
      );
      const startDeployerBalance = await ethers.provider.getBalance(deployer);
      // Act
      const transactionResponse = await fundMe.withdraw();
      const transactionReceipt = await transactionResponse.wait(1);
      const { gasPrice, gasUsed } = transactionReceipt;
      const gasCost = gasPrice * gasUsed;
      const endContractBalance = await ethers.provider.getBalance(
        fundMeCompilation.address
      );
      const endDeployerBalance = await ethers.provider.getBalance(deployer);
      // Assert
      assert.equal(
        endDeployerBalance + gasCost,
        startDeployerBalance + startContractBalance
      );
      assert.equal(endContractBalance, 0);
    });
    it("allows us to withdraw with multiple funders", async function () {
      // Arrange
      const accounts = await ethers.getSigners();
      for (let i = 1; i < 6; i++) {
        const fundMeConnectedContract = fundMe.connect(accounts[i]);
        await fundMeConnectedContract.fund({
          value: ethers.parseEther("1"),
        });
      }
      const startContractBalance = await ethers.provider.getBalance(
        fundMeCompilation.address
      );
      const startDeployerBalance = await ethers.provider.getBalance(deployer);
      // Act
      const transactionResponse = await fundMe.withdraw();
      const transactionReceipt = await transactionResponse.wait(1);
      const { gasPrice, gasUsed } = transactionReceipt;
      const gasCost = gasPrice * gasUsed;
      const endContractBalance = await ethers.provider.getBalance(
        fundMeCompilation.address
      );
      const endDeployerBalance = await ethers.provider.getBalance(deployer);
      // Assert;
      assert.equal(
        endDeployerBalance + gasCost,
        startDeployerBalance + startContractBalance
      );
      assert.equal(endContractBalance, 0);
      // make sure that the funders are reset properly
      await expect(fundMe.funders(0)).to.be.reverted;
      // clear addressToAmountFunded except deployer
      for (let i = 1; i < 6; i++) {
        const amount = await fundMe.addressToAmountFunded(accounts[i]);
        assert.equal(amount, 0);
      }
    });
    it("only let owner to withdraw", async function () {
      const accounts = await ethers.getSigners();
      const fundMeConnectedContract = fundMe.connect(accounts[1]);
      await expect(
        fundMeConnectedContract.withdraw()
      ).to.be.revertedWithCustomError(fundMe, "FundMe__NotOwner");
    });
  });
});
