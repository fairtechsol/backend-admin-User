const {
  transType,
  walletDescription,
  userRoleConstant,
  socketData,
  betType,
  betResultStatus,
  redisKeys,
} = require("../config/contants");
const internalRedis = require("../config/internalRedisConnection");
const { logger } = require("../config/logger");
const { getMatchBetPlaceWithUser, addNewBet, getMultipleAccountProfitLoss } = require("../services/betPlacedService");
const {
  forceLogoutIfLogin,
  forceLogoutUser,
} = require("../services/commonService");
const {
  getDomainDataById,
  updateDomainData,
  addDomainData,
  getDomainDataByDomain,
  getDomainDataByUserId,
} = require("../services/domainDataService");
const { updateUserDataRedis, hasUserInCache, getUserRedisData } = require("../services/redis/commonfunction");
const { insertTransactions } = require("../services/transactionService");
const {
  addInitialUserBalance,
  getUserBalanceDataByUserId,
  updateUserBalanceByUserId,
} = require("../services/userBalanceService");
const {
  addUser,
  getUser,
  getChildUser,
  getUserById,
  updateUser,
  getUserByUserName,
  userBlockUnblock,
  betBlockUnblock,
  getParentsWithBalance,
} = require("../services/userService");
const { sendMessageToUser } = require("../sockets/socketManager");
const { ErrorResponse, SuccessResponse } = require("../utils/response");
const lodash = require("lodash");

exports.createSuperAdmin = async (req, res) => {
  try {
    const {
      userName,
      fullName,
      password,
      phoneNumber,
      city,
      betBlock,
      userBlock,
      roleName,
      fwPartnership,
      faPartnership,
      saPartnership,
      aPartnership,
      smPartnership,
      mPartnership,
      id,
      creditRefrence,
      exposureLimit,
      maxBetLimit,
      minBetLimit,
      domain,
    } = req.body;

    const isUserPresent = await getUserByUserName(userName, ["id"]);
    const isDomainExist = await getDomainDataByDomain(domain?.domain);
    if (isUserPresent) {
      return ErrorResponse(
        {
          statusCode: 400,
          message: {
            msg: "user.userExist",
          },
        },
        req,
        res
      );
    }

    if (isDomainExist) {
      return ErrorResponse(
        {
          statusCode: 400,
          message: {
            msg: "alreadyExist",
            keys: {
              name: "Domain",
            },
          },
        },
        req,
        res
      );
    }

    if (roleName != userRoleConstant.superAdmin) {
      return ErrorResponse(
        {
          statusCode: 403,
          message: {
            msg: "auth.unauthorizeRole",
          },
        },
        req,
        res
      );
    }

    await addDomainData({
      ...domain,
      userName,
      userId: id,
    });

    let userData = {
      userName,
      fullName,
      password,
      phoneNumber,
      city,
      betBlock,
      userBlock,
      roleName,
      fwPartnership,
      faPartnership,
      saPartnership,
      aPartnership,
      smPartnership,
      mPartnership,
      id,
      creditRefrence,
      exposureLimit,
      maxBetLimit,
      minBetLimit,
      createBy: id,
    };
    let insertUser = await addUser(userData);

    let transactionArray = [
      {
        actionBy: id,
        searchId: id,
        userId: id,
        amount: 0,
        transType: transType.add,
        currentAmount: creditRefrence,
        description: walletDescription.userCreate,
      },
    ];

    await insertTransactions(transactionArray);
    let insertUserBalanceData = {
      currentBalance: 0,
      userId: insertUser.id,
      profitLoss: 0,
      myProfitLoss: 0,
      downLevelBalance: 0,
      exposure: 0,
    };
    insertUserBalanceData = await addInitialUserBalance(insertUserBalanceData);

    return SuccessResponse(
      {
        statusCode: 200,
        message: {
          msg: "created",
          keys: {
            name: "Super admin",
          },
        },
      },
      req,
      res
    );
  } catch (err) {
    return ErrorResponse(err, req, res);
  }
};

exports.updateSuperAdmin = async (req, res) => {
  try {
    let { user, domain, id } = req.body;
    let isDomainData = await getDomainDataByUserId(id, ["id"]);
    if (!isDomainData) {
      return ErrorResponse(
        { statusCode: 400, message: { msg: "invalidData" } },
        req,
        res
      );
    }

    await updateDomainData(id, domain);
    await updateUser(id, user);

    return SuccessResponse(
      {
        statusCode: 200,
        message: {
          msg: "update",
          keys: {
            name: "User",
          },
        },
      },
      req,
      res
    );
  } catch (err) {
    return ErrorResponse(err, req, res);
  }
};

exports.updateSuperAdminBalance = async (req, res) => {
  try {
    let { userId, transactionType, amount, remark } = req.body;
    amount = parseFloat(amount);

    let user = await getUser({ id: userId }, ["id"]);
    const userExistRedis=await hasUserInCache(user.id);
    if (!user)
      return ErrorResponse(
        { statusCode: 400, message: { msg: "invalidData" } },
        req,
        res
      );

    let userBalanceData = await getUserBalanceDataByUserId(user.id);

    if (!userBalanceData)
      return ErrorResponse(
        { statusCode: 400, message: { msg: "invalidData" } },
        req,
        res
      );
        let updateData = {}
    if (transactionType == transType.add) {
      updateData = {
        currentBalance: parseFloat(userBalanceData.currentBalance) + parseFloat(amount),
        profitLoss: parseFloat(userBalanceData.profitLoss) + parseFloat(amount),
      }
      await updateUserBalanceByUserId(user.id, updateData);
      if(userExistRedis){

        await updateUserDataRedis(user.id, updateData);
      }
    } else if (transactionType == transType.withDraw) {
      if (amount > userBalanceData.currentBalance)
        return ErrorResponse(
          {
            statusCode: 400,
            message: { msg: "userBalance.insufficientBalance" },
          },
          req,
          res
        );
      updateData = {
        currentBalance: parseFloat(userBalanceData.currentBalance) - parseFloat(amount),
        profitLoss: parseFloat(userBalanceData.profitLoss) - parseFloat(amount),
      }
      await updateUserBalanceByUserId(user.id,updateData );
      if(userExistRedis){

        await updateUserDataRedis(user.id, updateData);
      }
    } else {
      return ErrorResponse(
        { statusCode: 400, message: { msg: "invalidData" } },
        req,
        res
      );
    }

    let transactionArray = [
      {
        actionBy: userId,
        searchId: userId,
        userId: userId,
        amount: transactionType == transType.add ? amount : -amount,
        transType: transactionType,
        currentAmount: userBalanceData.currentBalance,
        description: remark,
      },
    ];

    await insertTransactions(transactionArray);
    sendMessageToUser(userId,socketData.userBalanceUpdateEvent,updateData);
    return SuccessResponse(
      {
        statusCode: 200,
        message: { msg: "userBalance.BalanceAddedSuccessfully" },
        data: { user },
      },
      req,
      res
    );
  } catch (error) {
    return ErrorResponse(error, req, res);
  }
};

exports.setExposureLimitSuperAdmin = async (req, res, next) => {
  try {
    let { exposureLimit, id } = req.body;

    let user = await getUser({ id }, ["id", "exposureLimit"]);

    if (!user)
      return ErrorResponse(
        { statusCode: 400, message: { msg: "invalidData" } },
        req,
        res
      );

    exposureLimit = parseInt(exposureLimit);
    user.exposureLimit = exposureLimit;
    let childUsers = await getChildUser(user.id);

    childUsers.map(async (childObj) => {
      let childUser = await getUserById(childObj.id);
      if (
        childUser.exposureLimit > exposureLimit ||
        childUser.exposureLimit == 0
      ) {
        childUser.exposureLimit = exposureLimit;
        await addUser(childUser);
      }
    });
    await addUser(user);
    return SuccessResponse(
      {
        statusCode: 200,
        message: { msg: "user.ExposurelimitSet" },
      },
      req,
      res
    );
  } catch (error) {
    return ErrorResponse(error, req, res);
  }
};

exports.setCreditReferrenceSuperAdmin = async (req, res, next) => {
  try {
    let { userId, amount, remark } = req.body;

    amount = parseFloat(amount);

    let user = await getUser({ id: userId }, [
      "id",
      "creditRefrence",
      "roleName",
    ]);
    if (!user)
      return ErrorResponse(
        { statusCode: 400, message: { msg: "invalidData" } },
        req,
        res
      );

    let userBalance = await getUserBalanceDataByUserId(user.id);
    if (!userBalance)
      return ErrorResponse(
        { statusCode: 400, message: { msg: "invalidData" } },
        req,
        res
      );
    let previousCreditReference = user.creditRefrence;
    let updateData = {
      creditRefrence: amount,
    };

    let profitLoss = userBalance.profitLoss + previousCreditReference - amount;
    await updateUserBalanceByUserId(user.id, { profitLoss });
    const userExistRedis=await hasUserInCache(user.id);

    if(userExistRedis){

      await updateUserDataRedis(user.id, { profitLoss });
    }

    let transactionArray = [
      {
        actionBy: user.id,
        searchId: user.id,
        userId: user.id,
        amount: previousCreditReference,
        transType: transType.creditRefer,
        currentAmount: user.creditRefrence,
        description: "CREDIT REFRENCE " + remark,
      },
    ];

    await insertTransactions(transactionArray);
    await updateUser(user.id, updateData);
    return SuccessResponse(
      {
        statusCode: 200,
        message: { msg: "userBalance.BalanceAddedSuccessfully" },
        data: { user },
      },
      req,
      res
    );
  } catch (error) {
    return ErrorResponse(error, req, res);
  }
};

exports.lockUnlockSuperAdmin = async (req, res, next) => {
  try {
    // Extract relevant data from the request body and user object
    const { userId, betBlock, userBlock, loginId } = req.body;

    // Fetch details of the user who is performing the block/unblock operation,
    // including the hierarchy and block information
    const blockingUserDetail = await getUserById(userId, [
      "createBy",
      "userBlock",
      "betBlock",
    ]);

    if (!blockingUserDetail) {
      return ErrorResponse(
        {
          statusCode: 400,
          message: {
            msg: "notFound",
            keys: { name: "User" },
          },
        },
        req,
        res
      );
    }

    // Check if the user is already blocked or unblocked (prevent redundant operations)
    if (blockingUserDetail?.userBlock != userBlock&&userBlock!=null) {
      // Perform the user block/unblock operation
      const blockedUsers = await userBlockUnblock(userId, loginId, userBlock);
      //   if blocktype is user and its block then user would be logout by socket
      if (userBlock) {
        blockedUsers?.[0]?.forEach(async (item) => {
          await forceLogoutUser(item?.id);
        });
      }
    }

    // Check if the user is already bet-blocked or unblocked (prevent redundant operations)
    if (blockingUserDetail?.betBlock != betBlock&&betBlock!=null) {
      // Perform the bet block/unblock operation

      const blockedBets = await betBlockUnblock(userId, loginId, betBlock);

      blockedBets?.[0]?.filter((item)=>item?.roleName==userRoleConstant.user)?.forEach((item) => {
        sendMessageToUser(item?.id, socketData.betBlockEvent, {
          betBlock: betBlock,
        });
      });
    }

    // Return success response
    return SuccessResponse(
      { statusCode: 200, message: { msg: "user.lock/unlockSuccessfully" } },
      req,
      res
    );
  } catch (error) {
    return ErrorResponse(
      {
        statusCode: 500,
        message: error.message,
      },
      req,
      res
    );
  }
};

// API endpoint for changing password
exports.changePasswordSuperAdmin = async (req, res, next) => {
  try {
    // Destructure request body
    const { userId, password } = req.body;

    const userDetail = await getUserById(userId, ["id"]);

    if (!userDetail) {
      return ErrorResponse(
        {
          statusCode: 400,
          message: {
            msg: "notFound",
            keys: { name: "User" },
          },
        },
        req,
        res
      );
    }

    // Update loginAt, password, and reset transactionPassword
    await updateUser(userId, {
      loginAt: null,
      password,
      transPassword: null,
    });

    // deleting token for logout
    await forceLogoutUser(userId);
    return SuccessResponse(
      {
        statusCode: 200,
        message: { msg: "auth.passwordChanged" },
      },
      req,
      res
    );
  } catch (error) {
    // Log any errors that occur
    return ErrorResponse(
      {
        statusCode: 500,
        message: error.message,
      },
      req,
      res
    );
  }
};



exports.declareSessionResult = async (req,res)=>{
  try {

    const { betId,score }=req.body;

    const betPlaced = await getMatchBetPlaceWithUser(betId,['BetPlaced.id', 'BetPlaced.userId', "BetPlaced.betId",  'BetPlaced.amount', 'BetPlaced.winAmount', 'BetPlaced.lossAmount', 'BetPlaced.betType', 'BetPlaced.odds',  'user.id', 'user.createBy', 'user.fwPartnership'])
    
    logger.info({
      message:"Session result declared.",
      data:{
        betId,score
      }
    });

        let updateRecords = [];

        for (let item of betPlaced) {
          if ((item.betType == betType.YES && item.odds <= score) || (item.betType == betType.NO && item.odds > score)) {
            item.result = betResultStatus.WIN;
          } else if ((item.betType == betType.YES && item.odds > score) || (item.betType == betType.NO && item.odds <= score)) {
            item.result = betResultStatus.LOSS;
          }
          updateRecords.push(item);
        }

        await addNewBet(updateRecords);

    
    
  } catch (error) {
    logger.error({
      error: `Error at declare session result for the expert.`,
      stack: error.stack,
      message: error.message,
    });
    // Handle any errors and return an error response
    return ErrorResponse(error, req, res);
  }
}




const calculateProfitLossForUserDeclare=async (users, betId,matchId, fwProfitLoss, resultDeclare, redisEventName, userId, bulkWalletRecord, upperUserObj) =>{
 
  let faAdminCal={};

  for (const user of users) {
    let description = '';
    let getWinAmount = 0;
    let getLossAmount = 0;
    let profitLoss = 0;
    let transTypes;
    let userRedisData = await getUserRedisData(user.user.id);
    let getMultipleAmount = await getMultipleAccountProfitLoss(betId,user.user.id);
    let maxLoss = 0;
    let redisSesionExposureValue = 0;
    let redisSesionExposureName = redisKeys.userSessionExposure + matchId;
    redisSesionExposureValue = parseFloat(userRedisData[redisSesionExposureName]);
    logger.info({ message: "Updated users", data: user.user });
    logger.info({
      redisSessionExposureValue: redisSesionExposureValue,
      sessionBet: sessionBet,
    });
   
      // check if data is already present in the redis or not
      if (userRedisData[betId+'_profitLoss']) {
        let redisData = JSON.parse(userRedisData[betId+'_profitLoss']);
        maxLoss = redisData.maxLoss || 0;
      } else {
        // if data is not available in the redis then get data from redis and find max loss amount for all placed bet by user
        let redisData = await this.calculateProfitLossForSessionToResult(betId, user.user);
        maxLoss = redisData.maxLoss || 0;
      }
      redisSesionExposureValue = redisSesionExposureValue - maxLoss;
      if (userRedisData.exposure) {
        await updateUserDataRedis(user.user.id, { [redisSesionExposureName]: redisSesionExposureValue });
      }
    

    logger.info({
      maxLoss:maxLoss,
      userExposure:redisSesionExposureValue
    });

    user.user.userBalance.exposure = user.user.userBalance.exposure - maxLoss;

    logger.info({
      message:"Update user exposure.",
      data:user.user.exposure
    });

    getWinAmount = getMultipleAmount[0].winAmount;
    getLossAmount = getMultipleAmount[0].lossAmount;
    profitLoss = parseFloat(getWinAmount.toString()) - parseFloat(getLossAmount.toString());

 

    fwProfitLoss = parseFloat(fwProfitLoss.toString()) + parseFloat(((-profitLoss * user.user.fwPartnership) / 100).toString());

    if (profitLoss > 0) {
      transTypes = transType.win;
      description = `User win the session bet ${resultDeclare.name}`;
    } else {
      transTypes = transType.loss;
      description = `User loss the  session bet ${resultDeclare.name}`;
    }

    const userCurrBalance=Number(user.user.userBalance.currentBalance+profitLoss).toFixed(2);
    user.user.userBalance = await updateUserBalanceByUserId({
      currentBalance:userCurrBalance,
      profitLoss:user.user.userBalance.profitLoss+profitLoss,
      myProfitLoss:user.user.userBalance.myProfitLoss+profitLoss,
      exposure: user.user.userBalance.exposure
    })
    
    if (userRedisData.exposure) {
      updateUserDataRedis(user.user.id)
      this.redis.hmset(user.user.id, { exposure: user.user.userBalance.exposure, myProfitLoss: user.user.userBalance.myProfitLoss, currentBalance:  userCurrBalance });
    }
    await addUser(user.user);

    sendMessageToUser(user.user.id, redisEventName, { ...user.user, betId, matchId, sessionExposure: redisSesionExposureValue });

    bulkWalletRecord.push(
      {matchId:matchId,
        actionBy: userId,
        searchId: user.user.id,
        userId: user.user.id,
        amount: profitLoss,
        transType: transTypes,
        currentAmount: userCurrBalance,
        description: description,
      }
    );
   
    let parentUsers = await getParentsWithBalance(user.user.id);
    
    for (const patentUser of parentUsers) {
      let upLinePartnership = 100;
       if (patentUser.roleName === userRoleConstant.superAdmin) {
        upLinePartnership = user.user.fwPartnership + user.user.faPartnership;
      } else if (patentUser.roleName === userRoleConstant.admin) {
        upLinePartnership = user.user.fwPartnership + user.user.faPartnership + user.user.saPartnership;
      } else if (patentUser.roleName === userRoleConstant.superMaster) {
        upLinePartnership = user.user.fwPartnership + user.user.faPartnership + user.user.saPartnership + user.user.aPartnership;
      } else if (patentUser.roleName === userRoleConstant.master) {
        upLinePartnership = user.user.fwPartnership + user.user.faPartnership + user.user.saPartnership + user.user.aPartnership + user.user.smPartnership;
      }
      let myProfitLoss = parseFloat(
        ((profitLoss * upLinePartnership) / 100).toString()
      );
      
      if (upperUserObj[parentUsers.id]) {
        upperUserObj[parentUsers.id].profitLoss = upperUserObj[parentUsers.id].profitLoss + profitLoss;
        upperUserObj[parentUsers.id].myProfitLoss = upperUserObj[parentUsers.id].myProfitLoss + myProfitLoss;
        upperUserObj[parentUsers.id].exposure = upperUserObj[parentUsers.id].exposure + maxLoss;
      } else {
        upperUserObj[parentUsers.id] = { profitLoss: profitLoss };
        upperUserObj[parentUsers.id].myProfitLoss = myProfitLoss;
        upperUserObj[parentUsers.id].exposure = maxLoss; }
    }
    faAdminCal={
      profitLoss: profitLoss ,
      myProfitLoss:parseFloat(
        ((profitLoss * user.user.fwPartnership) / 100).toString()
      ),
      exposure: maxLoss
    }
  };
  return {fwProfitLoss,faAdminCal};
}