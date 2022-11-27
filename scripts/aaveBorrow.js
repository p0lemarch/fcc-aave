const { getNamedAccounts, ethers } = require("hardhat")
const { getWeth, AMOUNT } = require("../scripts/getWeth")

async function main() {
    // the protocol treats everything as an ERC20 token
    await getWeth()
    const { deployer } = await getNamedAccounts()

    //lending pool address provider: 0xb53c1a33016b2dc2ff3653530bff1848a515c8c5
    //lending pool address
    const lendingPool = await getLendingPool(deployer)
    console.log(`LendingPool address ${lendingPool.address}`)

    //depost = approve and then call
    const wethTokenAddress = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"
    await approveErc20(wethTokenAddress, lendingPool.address, AMOUNT, deployer)
    console.log("Depositing ...")
    await lendingPool.deposit(wethTokenAddress, AMOUNT, deployer, 0)
    console.log("deposited")

    //Borrow time !
    let { availableBorrowsETH, totalDebtETH } = await getBorrowUserData(lendingPool, deployer)
    const daiETHPrice = await getDAIPrice()
    const AmountDaiToBorrow = availableBorrowsETH.toString() * 0.95 * (1 / daiETHPrice.toNumber())
    console.log(`You can borrow ${AmountDaiToBorrow} worth of DAI`)
    const AmountDaiToBorrowWei = ethers.utils.parseEther(AmountDaiToBorrow.toString())
    const daiTokenAddress = "0x6B175474E89094C44Da98b954EedeAC495271d0F"
    await borrowDai(daiTokenAddress, lendingPool, AmountDaiToBorrowWei, deployer)
    await getBorrowUserData(lendingPool, deployer)
    await repay(AmountDaiToBorrowWei, daiTokenAddress, lendingPool, deployer)
    await getBorrowUserData(lendingPool, deployer)
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })

async function repay(amount, daiAddress, lendingPool, account) {
    await approveErc20(daiAddress, lendingPool.address, amount, account)
    const repayTx = await lendingPool.repay(daiAddress, amount, 1, account)
    await repayTx.wait(1)
    console.log("repaid")
}

async function borrowDai(daiAddress, lendingPool, AmountDaiToBorrowWei, account) {
    const borrowTx = await lendingPool.borrow(daiAddress, AmountDaiToBorrowWei, 1, 0, account)
    await borrowTx.wait(1)
    console.log("You borrowed")
}

async function getLendingPool(account) {
    const lendingPoolAddressesProvider = await ethers.getContractAt(
        "ILendingPoolAddressesProvider",
        "0xb53c1a33016b2dc2ff3653530bff1848a515c8c5",
        account
    )
    const lendingPoolAddress = await lendingPoolAddressesProvider.getLendingPool()
    const lendingPool = await ethers.getContractAt("ILendingPool", lendingPoolAddress, account)
    return lendingPool
}

async function approveErc20(tokenAddress, spenderAddress, amountToSpend, account) {
    const erc20Token = await ethers.getContractAt("IERC20", tokenAddress, account)
    const tx = await erc20Token.approve(spenderAddress, amountToSpend)
    await tx.wait(1)
    console.log("approved")
}

async function getBorrowUserData(lendingPool, account) {
    const { totalCollateralETH, totalDebtETH, availableBorrowsETH } =
        await lendingPool.getUserAccountData(account)
    console.log(`You have ${totalCollateralETH} worth of ETH deposited`)
    console.log(`You have ${totalDebtETH} worth of ETH borrowed`)
    console.log(`You can borrow ${availableBorrowsETH} worth of ETH`)
    return { availableBorrowsETH, totalDebtETH }
}

async function getDAIPrice() {
    const daiETHPrice = await ethers.getContractAt(
        "contracts/interfaces/AggregatorV3Interface.sol/AggregatorV3Interface",
        "0x773616E4d11A78F511299002da57A0a94577F1f4"
    )
    const price = (await daiETHPrice.latestRoundData())[1]
    console.log(`dai price = ${daiETHPrice}`)
    return price
}
