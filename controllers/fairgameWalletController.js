const { IsNull, In } = require("typeorm");
const {
  transType,
  walletDescription,
  userRoleConstant,
  socketData,
  betType,
  betResultStatus,
  redisKeys,
  partnershipPrefixByRole,
  resultType,
  matchBettingType,
  tiedManualTeamName,
} = require("../config/contants");
const { logger } = require("../config/logger");
const { getMatchBetPlaceWithUser, addNewBet, getMultipleAccountProfitLoss, getDistinctUserBetPlaced, findAllPlacedBetWithUserIdAndBetId, updatePlaceBet, getBet, getMultipleAccountMatchProfitLoss } = require("../services/betPlacedService");
const {
  forceLogoutIfLogin,
  forceLogoutUser,
  calculateProfitLossForSessionToResult,
  calculatePLAllBet,
  calculateProfitLossSession,
  calculateProfitLossForMatchToResult,
} = require("../services/commonService");
const {
  getDomainDataById,
  updateDomainData,
  addDomainData,
  getDomainDataByDomain,
  getDomainDataByUserId,
} = require("../services/domainDataService");
const { updateUserDataRedis, hasUserInCache, getUserRedisData, deleteKeyFromUserRedis } = require("../services/redis/commonfunction");
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

    const { betId,score,matchId,sessionDetails,userId }=req.body;

    const betPlaced = await getMatchBetPlaceWithUser([betId])
    
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


        let users = await getDistinctUserBetPlaced(betId);


        let upperUserObj = {};
        let bulkWalletRecord = [];
        const profitLossData = await calculateProfitLossSessionForUserDeclare(
          users,
          betId,
          matchId,
          0,
          sessionDetails,
          socketData.sessionResult,
          userId,
          bulkWalletRecord,
          upperUserObj,
          score
        );

        insertTransactions(bulkWalletRecord);
        logger.info({
          message:"Upper user for this bet.",
          data:{upperUserObj,betId}
        })


        for (let [key, value] of Object.entries(upperUserObj)) {
          let parentUser = await getUserBalanceDataByUserId(key);

          let parentUserRedisData = await getUserRedisData(parentUser.userId);

          let parentProfitLoss = parentUser?.profitLoss || 0;
          if (parentUserRedisData?.profitLoss) {
            parentProfitLoss = parseFloat(parentUserRedisData.profitLoss);
          }
          let parentMyProfitLoss = parentUser?.myProfitLoss || 0;
          if (parentUserRedisData?.myProfitLoss) {
            parentMyProfitLoss = parseFloat(parentUserRedisData.myProfitLoss);
          }
          let parentExposure = parentUser?.exposure || 0;
          if (parentUserRedisData?.exposure) {
            parentExposure = parseFloat(parentUserRedisData?.exposure);
          }

          parentUser.profitLoss = parentProfitLoss - value?.["profitLoss"];
          parentUser.myProfitLoss = parentMyProfitLoss - value["myProfitLoss"];
          parentUser.exposure = parentExposure - value["exposure"];
          if (parentExposure < 0) {
            logger.info({
              message: "Exposure in negative for user: ",
              data: {
                betId,
                matchId,
                parentUser,
              },
            });
            parentUser.exposure = 0;
          }
          addInitialUserBalance(parentUser);
          logger.info({
            message: "Declare result db update for parent ",
            data: {
              betId,
              parentUser,
            },
          });
          if (parentUserRedisData?.exposure) {
            updateUserDataRedis(key, {
              exposure: parentUser.exposure,
              profitLoss: parentUser.profitLoss,
              myProfitLoss: parentUser.myProfitLoss,
            });
          }
          const redisSessionExposureName =
            redisKeys.userSessionExposure + matchId;
          let parentRedisUpdateObj = {};
          let sessionExposure = 0;
          if (parentUserRedisData?.[redisSessionExposureName]) {
            sessionExposure =
              parseFloat(parentUserRedisData[redisSessionExposureName]) || 0;
          }
          if (parentUserRedisData?.[betId + "_profitLoss"]) {
            let redisData = JSON.parse(parentUserRedisData[betId + "_profitLoss"]);
            sessionExposure = sessionExposure - (redisData.maxLoss || 0);
            parentRedisUpdateObj[redisSessionExposureName] = sessionExposure;
          }
          await deleteKeyFromUserRedis(key, betId + "_profitLoss");

          sendMessageToUser(key, socketData.sessionResult, {
            ...parentUser,
            betId,
            matchId,
            sessionExposure: sessionExposure,
          });
        }


        return SuccessResponse(
          {
            statusCode: 200,
            message: { msg: "bet.resultDeclared" },
            data: profitLossData
          },
          req,
          res
        );
    
    
  } catch (error) {
    logger.error({
      error: `Error at declare session result for the user.`,
      stack: error.stack,
      message: error.message,
    });
    // Handle any errors and return an error response
    return ErrorResponse(error, req, res);
  }
}

const calculateProfitLossSessionForUserDeclare=async (users, betId,matchId, fwProfitLoss, resultDeclare, redisEventName, userId, bulkWalletRecord, upperUserObj,score) =>{
 
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
    redisSesionExposureValue = parseFloat(userRedisData?.[redisSesionExposureName]||0);
    logger.info({ message: "Updated users", data: user.user });
    logger.info({
      redisSessionExposureValue: redisSesionExposureValue,
      sessionBet: true,
    });
   
      // check if data is already present in the redis or not
      if (userRedisData?.[betId+'_profitLoss']) {
        let redisData = JSON.parse(userRedisData[betId+'_profitLoss']);
        maxLoss = redisData.maxLoss || 0;
      } else {
        // if data is not available in the redis then get data from redis and find max loss amount for all placed bet by user
        let redisData = await calculateProfitLossForSessionToResult(betId, user.user?.id);
        maxLoss = redisData.maxLoss || 0;
      }
      redisSesionExposureValue = redisSesionExposureValue - maxLoss;
      if (userRedisData?.exposure) {
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

    getWinAmount = getMultipleAmount[0].winamount;
    getLossAmount = getMultipleAmount[0].lossamount;
    profitLoss = parseFloat(getWinAmount.toString()) - parseFloat(getLossAmount.toString());

 

    fwProfitLoss = parseFloat(fwProfitLoss.toString()) + parseFloat(((-profitLoss * user.user.fwPartnership) / 100).toString());

    if (profitLoss > 0) {
      transTypes = transType.win;
      description = `${user?.eventType}/${user?.eventName}/${resultDeclare?.type}-${score}`;
    } else {
      transTypes = transType.loss;
      description = `${user?.eventType}/${user?.eventName}/${resultDeclare?.type}-${score}`;
    }

    const userCurrBalance=Number(user.user.userBalance.currentBalance+profitLoss).toFixed(2);
    let userBalanceData={
      currentBalance:userCurrBalance,
      profitLoss:user.user.userBalance.profitLoss+profitLoss,
      myProfitLoss:user.user.userBalance.myProfitLoss+profitLoss,
      exposure: user.user.userBalance.exposure
    }

     await updateUserBalanceByUserId(user.user.id,userBalanceData);
    
    if (userRedisData?.exposure) {
      updateUserDataRedis(user.user.id,userBalanceData);
      await deleteKeyFromUserRedis(user.user.id, betId + "_profitLoss");

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
      
      if (upperUserObj[patentUser.id]) {
        upperUserObj[patentUser.id].profitLoss = upperUserObj[patentUser.id].profitLoss + profitLoss;
        upperUserObj[patentUser.id].myProfitLoss = upperUserObj[patentUser.id].myProfitLoss + myProfitLoss;
        upperUserObj[patentUser.id].exposure = upperUserObj[patentUser.id].exposure + maxLoss;
      } else {
        upperUserObj[patentUser.id] = { profitLoss: profitLoss,myProfitLoss: myProfitLoss,exposure: maxLoss };
      }
    }
    faAdminCal={
      profitLoss: profitLoss + (faAdminCal?.profitLoss||0),
      exposure: maxLoss+(faAdminCal?.exposure||0),
      myProfitLoss: +((profitLoss + (faAdminCal?.profitLoss||0))*parseFloat(user.user.fwPartnership)/100).toFixed(2)
    }
  };
  return {fwProfitLoss,faAdminCal};
}

exports.declareSessionNoResult = async (req,res)=>{
  try {

    const { betId, score, matchId }=req.body;

    
    logger.info({
      message:"Session no result declared.",
      data:{
        betId,score
      }
    });

       
        let users = await getDistinctUserBetPlaced(betId);


        let upperUserObj = {};
        const profitLossData = await calculateMaxLossSessionForUserNoResult(
          users,
          betId,
          matchId,
          socketData.sessionNoResult,
          upperUserObj
        );

        
        logger.info({
          message:"Upper user for this bet.",
          data:{upperUserObj,betId}
        })


        for (let [key, value] of Object.entries(upperUserObj)) {
          let parentUser = await getUserBalanceDataByUserId(key);

          let parentUserRedisData = await getUserRedisData(parentUser.userId);

          
          let parentExposure = parentUser?.exposure || 0;
          if (parentUserRedisData?.exposure) {
            parentExposure = parseFloat(parentUserRedisData?.exposure);
          }

          parentUser.exposure = parentExposure - value["exposure"];
          if (parentExposure < 0) {
            logger.info({
              message: "Exposure in negative for user: ",
              data: {
                betId,
                matchId,
                parentUser,
              },
            });
            parentUser.exposure = 0;
          }
          addInitialUserBalance(parentUser);
          logger.info({
            message: "Declare result db update for parent ",
            data: {
              betId,
              parentUser,
            },
          });
          let parentRedisUpdateObj = {};
          if (parentUserRedisData?.exposure) {
            parentRedisUpdateObj= {
              exposure: parentUser.exposure
            };
          }
          const redisSessionExposureName =
            redisKeys.userSessionExposure + matchId;
          let sessionExposure = 0;
          if (parentUserRedisData?.[redisSessionExposureName]) {
            sessionExposure =
              parseFloat(parentUserRedisData[redisSessionExposureName]) || 0;
          }
          if (parentUserRedisData?.[betId + "_profitLoss"]) {
            let redisData = JSON.parse(
              parentUserRedisData[betId + "_profitLoss"]
            );
            sessionExposure = sessionExposure - (redisData.maxLoss || 0);
            parentRedisUpdateObj[redisSessionExposureName] = sessionExposure;
          }
          await deleteKeyFromUserRedis(key, betId + "_profitLoss");

          if (
            parentUserRedisData?.exposure &&
            Object.keys(parentRedisUpdateObj).length > 0
          ) {
            updateUserDataRedis(key, parentRedisUpdateObj);
          }
          sendMessageToUser(key, socketData.sessionResult, {
            ...parentUser,
            betId,
            matchId,
            sessionExposure: sessionExposure,
          });
        }


        return SuccessResponse(
          {
            statusCode: 200,
            message: { msg: "bet.resultDeclared" },
            data: profitLossData
          },
          req,
          res
        );
    
    
  } catch (error) {
    logger.error({
      error: `Error at declare session no result for the user.`,
      stack: error.stack,
      message: error.message,
    });
    // Handle any errors and return an error response
    return ErrorResponse(error, req, res);
  }
}

const calculateMaxLossSessionForUserNoResult = async (
  users,
  betId,
  matchId,
  redisEventName,
  upperUserObj
) => {
  for (const user of users) {
    let userRedisData = await getUserRedisData(user.user.id);
    let maxLoss = 0;
    let redisSesionExposureValue = 0;
    let redisSesionExposureName = redisKeys.userSessionExposure + matchId;
    redisSesionExposureValue = parseFloat(
      userRedisData?.[redisSesionExposureName] || 0
    );

    logger.info({ message: "Updated users", data: user.user });
    logger.info({
      redisSessionExposureValue: redisSesionExposureValue,
      sessionBet: true,
    });

    // check if data is already present in the redis or not
    if (userRedisData?.[betId + "_profitLoss"]) {
      let redisData = JSON.parse(userRedisData[betId + "_profitLoss"]);
      maxLoss = redisData.maxLoss || 0;
    } else {
      // if data is not available in the redis then get data from redis and find max loss amount for all placed bet by user
      let redisData = await calculateProfitLossForSessionToResult(
        betId,
        user.user?.id
      );
      maxLoss = redisData.maxLoss || 0;
    }
    redisSesionExposureValue = redisSesionExposureValue - maxLoss;

    user.user.userBalance.exposure = user.user.userBalance.exposure - maxLoss;

    logger.info({
      message: "Update user exposure.",
      data: {
        userExposure: user.user.exposure,
        maxLoss: maxLoss,
        userExposure: redisSesionExposureValue,
      },
    });

    if (userRedisData?.exposure) {
      updateUserDataRedis(user.user.id, {
        exposure: user.user.userBalance.exposure,
        [redisSesionExposureName]: redisSesionExposureValue,
      });
      await deleteKeyFromUserRedis(user.user.id, betId + "_profitLoss");
    }
    await addUser(user.user);

    sendMessageToUser(user.user.id, redisEventName, {
      ...user.user,
      betId,
      matchId,
      sessionExposure: redisSesionExposureValue,
    });

    let parentUsers = await getParentsWithBalance(user.user.id);

    for (const patentUser of parentUsers) {
      if (upperUserObj[patentUser.id]) {
        upperUserObj[patentUser.id].exposure =
          upperUserObj[patentUser.id].exposure + maxLoss;
      } else {
        upperUserObj[patentUser.id] = { exposure: maxLoss };
      }
    }
    faAdminCal = {
      exposure: maxLoss,
    };
  }
  return faAdminCal;
};

exports.unDeclareSessionResult = async (req,res)=>{
  try {

    const { betId,matchId,sessionDetails,userId }=req.body;

    
    
    logger.info({
      message:"Session result un declared.",
      data:{
        betId
      }
    });



        let users = await getDistinctUserBetPlaced(betId);


        let upperUserObj = {};
        let bulkWalletRecord = [];
        const profitLossData = await calculateProfitLossSessionForUserUnDeclare(
          users,
          betId,
          matchId,
          0,
          sessionDetails,
          socketData.sessionResultUnDeclare,
          userId,
          bulkWalletRecord,
          upperUserObj
        );

        insertTransactions(bulkWalletRecord);
        logger.info({
          message:"Upper user for this bet.",
          data:{upperUserObj,betId}
        });


        for (let [key, value] of Object.entries(upperUserObj)) {
          let parentUser = await getUserBalanceDataByUserId(key);

          let parentUserRedisData = await getUserRedisData(parentUser.userId);

          let parentProfitLoss = parentUser?.profitLoss || 0;
          if (parentUserRedisData?.profitLoss) {
            parentProfitLoss = parseFloat(parentUserRedisData.profitLoss);
          }
          let parentMyProfitLoss = parentUser?.myProfitLoss || 0;
          if (parentUserRedisData?.myProfitLoss) {
            parentMyProfitLoss = parseFloat(parentUserRedisData.myProfitLoss);
          }
          let parentExposure = parentUser?.exposure || 0;
          if (parentUserRedisData?.exposure) {
            parentExposure = parseFloat(parentUserRedisData?.exposure);
          }
          

          parentUser.profitLoss = parentProfitLoss + value?.["profitLoss"];
          parentUser.myProfitLoss = parentMyProfitLoss + value["myProfitLoss"];
          parentUser.exposure = parentExposure + value["exposure"];
          if (parentExposure < 0) {
            logger.info({
              message: "Exposure in negative for user: ",
              data: {
                betId,
                matchId,
                parentUser,
              },
            });
            parentUser.exposure = 0;
          }
          addInitialUserBalance(parentUser);
          logger.info({
            message: "Declare result db update for parent ",
            data: {
              betId,
              parentUser,
            },
          });
          let parentRedisUpdateObj = {};

          if (parentUserRedisData?.exposure) {
            parentRedisUpdateObj= {
              exposure: parentUser.exposure,
              profitLoss: parentUser.profitLoss,
              myProfitLoss: parentUser.myProfitLoss,
              [betId+redisKeys.profitLoss]:JSON.stringify(value?.profitLossObj)
            };
          }
          const redisSessionExposureName =
            redisKeys.userSessionExposure + matchId;
          let sessionExposure = 0;
          if (parentUserRedisData?.[redisSessionExposureName]) {
            sessionExposure =
              parseFloat(parentUserRedisData[redisSessionExposureName]) || 0;
          }
          
            sessionExposure = sessionExposure + (value?.profitLossObj?.maxLoss || 0);
            parentRedisUpdateObj[redisSessionExposureName] = sessionExposure;
          

          if (
            parentUserRedisData?.exposure &&
            Object.keys(parentRedisUpdateObj).length > 0
          ) {
            updateUserDataRedis(key, parentRedisUpdateObj);
          }
          sendMessageToUser(key, socketData.sessionResultUnDeclare, {
            ...parentUser,
            betId,
            matchId,
            sessionExposure: sessionExposure,
          });
        }


        await updatePlaceBet(
          {
            betId: betId,
            deleteReason: IsNull(),
          },
          {
            result: betResultStatus.PENDING,
          }
        );


        return SuccessResponse(
          {
            statusCode: 200,
            message: { msg: "bet.resultUnDeclared" },
            data: profitLossData
          },
          req,
          res
        );
    
    
  } catch (error) {
    logger.error({
      error: `Error at un declare session result for the user.`,
      stack: error.stack,
      message: error.message,
    });
    // Handle any errors and return an error response
    return ErrorResponse(error, req, res);
  }
}

const calculateProfitLossSessionForUserUnDeclare=async (users, betId,matchId, fwProfitLoss, resultDeclare, redisEventName, userId, bulkWalletRecord, upperUserObj) =>{
 
  let faAdminCal={};

  for (const user of users) {
    let getWinAmount = 0;
    let getLossAmount = 0;
    let profitLoss = 0;
    let userRedisData = await getUserRedisData(user.user.id);
    let getMultipleAmount = await getMultipleAccountProfitLoss(betId,user.user.id);
    let maxLoss = 0;
    let redisSesionExposureValue = 0;
    let redisSesionExposureName = redisKeys.userSessionExposure + matchId;
    redisSesionExposureValue = parseFloat(userRedisData?.[redisSesionExposureName]||0);
    logger.info({ message: "Updated users", data: user.user });
    logger.info({
      redisSessionExposureValue: redisSesionExposureValue,
      sessionBet: true,
    });
   
      
        // if data is not available in the redis then get data from redis and find max loss amount for all placed bet by user
        let betPlace = await findAllPlacedBetWithUserIdAndBetId(user?.user?.id,betId);
        let redisData = await calculatePLAllBet(betPlace,100);
        maxLoss = redisData.maxLoss || 0;
      
      redisSesionExposureValue = redisSesionExposureValue + maxLoss;
      if (userRedisData?.exposure) {
        await updateUserDataRedis(user.user.id, { [redisSesionExposureName]: redisSesionExposureValue });
      }
    

    logger.info({
      maxLoss:maxLoss,
      userExposure:redisSesionExposureValue
    });

    user.user.userBalance.exposure = user.user.userBalance.exposure + maxLoss;

    logger.info({
      message:"Update user exposure.",
      data:user.user.exposure
    });

    getWinAmount = getMultipleAmount[0].winamount;
    getLossAmount = getMultipleAmount[0].lossamount;
    profitLoss = parseFloat(getWinAmount.toString()) - parseFloat(getLossAmount.toString());

 

    fwProfitLoss = parseFloat(fwProfitLoss.toString()) - parseFloat(((-profitLoss * user.user.fwPartnership) / 100).toString());

    

    const userCurrBalance = Number(
      (user.user.userBalance.currentBalance - profitLoss).toFixed(2)
    );

    let userBalanceData = {
      currentBalance: userCurrBalance,
      profitLoss: user.user.userBalance.profitLoss - profitLoss,
      myProfitLoss: user.user.userBalance.myProfitLoss - profitLoss,
      exposure: user.user.userBalance.exposure,
    }

    await updateUserBalanceByUserId(user.user.id, userBalanceData);

    if (userRedisData?.exposure) {
      updateUserDataRedis(user.user.id, {
       ...userBalanceData,
        [betId + redisKeys.profitLoss]: JSON.stringify({
          upperLimitOdds: redisData?.betData?.[redisData?.betData?.length-1]?.odds,
          lowerLimitOdds: redisData?.betData?.[0]?.odds,
          betPlaced: redisData?.betData,
          maxLoss: redisData?.maxLoss,
        }),
      });
    }
    await addUser(user.user);
    logger.info({
      message:"user save at un declare result",
      data:user
    })

    sendMessageToUser(user.user.id, redisEventName, { ...user.user, betId, matchId, sessionExposure: redisSesionExposureValue });

    bulkWalletRecord.push(
      {matchId:matchId,
        actionBy: userId,
        searchId: user.user.id,
        userId: user.user.id,
        amount: -profitLoss,
        transType: transType.bet,
        currentAmount: userCurrBalance,
        description: `${user?.eventType}/${user?.eventName}/${resultDeclare?.type}`,
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
      
      if (upperUserObj[patentUser.id]) {
        upperUserObj[patentUser.id].profitLoss = upperUserObj[patentUser.id].profitLoss + profitLoss;
        upperUserObj[patentUser.id].myProfitLoss = upperUserObj[patentUser.id].myProfitLoss + myProfitLoss;
        upperUserObj[patentUser.id].exposure = upperUserObj[patentUser.id].exposure + maxLoss;


        for(const placedBets of betPlace){
          upperUserObj[patentUser.id].profitLossObj = await calculateProfitLossSession( upperUserObj[patentUser.id].profitLossObj,{
              betPlacedData: {
                betType: placedBets?.betType,
                odds: placedBets?.odds,
              },
              loseAmount: placedBets?.lossAmount,
              winAmount: placedBets?.winAmount,
            },user?.user[`${partnershipPrefixByRole[patentUser?.roleName]}Partnership`]);
        }
      } else {
        upperUserObj[patentUser.id] = { profitLoss: profitLoss,myProfitLoss: myProfitLoss ,exposure: maxLoss};

        const betPlaceProfitLoss=await calculatePLAllBet(betPlace,-user?.user[`${partnershipPrefixByRole[patentUser?.roleName]}Partnership`]);

        upperUserObj[patentUser.id] = {...upperUserObj[patentUser.id], profitLossObj: {
          upperLimitOdds: betPlaceProfitLoss?.betData?.[redisData?.betData?.length-1]?.odds,
          lowerLimitOdds: betPlaceProfitLoss?.betData?.[0]?.odds,
          betPlaced: betPlaceProfitLoss?.betData,
          maxLoss: betPlaceProfitLoss?.maxLoss,
        }};

      }
    }


    if (faAdminCal.profitLossObjWallet) {
      const betPlaceProfitLoss = await calculatePLAllBet(
        betPlace,
        -user?.user[`fwPartnership`]
      );
      faAdminCal.profitLossObjWallet = {
        upperLimitOdds: betPlaceProfitLoss?.betData?.[redisData?.betData?.length - 1]?.odds,
        lowerLimitOdds: betPlaceProfitLoss?.betData?.[0]?.odds,
        betPlaced: betPlaceProfitLoss?.betData,
        maxLoss: betPlaceProfitLoss?.maxLoss,
      };
    } else {
      for (const placedBets of betPlace) {
        faAdminCal.profitLossObjWallet = await calculateProfitLossSession(
          faAdminCal.profitLossObjWallet,
          {
            betPlacedData: {
              betType: placedBets?.betType,
              odds: placedBets?.odds,
            },
            loseAmount: placedBets?.lossAmount,
            winAmount: placedBets?.winAmount,
          },
          user?.user[`fwPartnership`]
        );
      }
    }

    if (faAdminCal.profitLossObjAdmin) {
      const betPlaceProfitLoss = await calculatePLAllBet(
        betPlace,
        -user?.user[`faPartnership`]
      );
      faAdminCal.profitLossObjAdmin = {
        upperLimitOdds: betPlaceProfitLoss?.betData?.[redisData?.betData?.length - 1]?.odds,
        lowerLimitOdds: betPlaceProfitLoss?.betData?.[0]?.odds,
        betPlaced: betPlaceProfitLoss?.betData,
        maxLoss: betPlaceProfitLoss?.maxLoss,
      };
    } else {
      for (const placedBets of betPlace) {
        faAdminCal.profitLossObjAdmin = await calculateProfitLossSession(
          faAdminCal.profitLossObjAdmin,
          {
            betPlacedData: {
              betType: placedBets?.betType,
              odds: placedBets?.odds,
            },
            loseAmount: placedBets?.lossAmount,
            winAmount: placedBets?.winAmount,
          },
          user?.user[`faPartnership`]
        );
      }
    }

   

    faAdminCal={
      ...faAdminCal,
      profitLoss: profitLoss + (faAdminCal?.profitLoss||0),
      exposure: maxLoss+(faAdminCal?.exposure||0),
      myProfitLoss: parseFloat((parseFloat(faAdminCal?.myProfitLoss || 0) + (parseFloat(profitLoss) * parseFloat(user.user.fwPartnership) /100 )).toFixed(2))
    }
  };
  return {fwProfitLoss,faAdminCal};
}

exports.getBetWallet = async (req, res) => {
  try {
    let query = req.query;
    let result;
    let select = [
      "betPlaced.id", "betPlaced.eventName", "betPlaced.teamName", "betPlaced.betType", "betPlaced.amount", "betPlaced.rate", "betPlaced.winAmount", "betPlaced.lossAmount", "betPlaced.createdAt", "betPlaced.eventType", "betPlaced.marketType", "betPlaced.odds", "betPlaced.marketBetType", "betPlaced.result", "betPlaced.matchId", "betPlaced.betId"
    ];
    
      select.push("user.id", "user.userName", "user.fwPartnership");
      result = await getBet({}, query, null, select);


      if (!result[1]){
        return SuccessResponse(
          {
            statusCode: 200,
            message: { msg: "fetched", keys: { type: "Bet" } },
            data: { count: 0, rows: [] },
          },
          req,
          res
        );
      }
        const domainUrl = `${req.protocol}://${req.get("host")}`;
        result[0] = result?.[0]?.map((item) => {
          return {
            ...item,
            domain: domainUrl,
          };
        });
      

    return SuccessResponse({
      statusCode: 200, message: { msg: "fetched", keys: { type: "Bet" } }, data: {
        count: result[1],
        rows: result[0]
      }
    }, req, res)
  } catch (err) {
    logger.error({
      error:"Error in get bet for wallet",
      stack: err.stack,
      message: err.message,
    })
    return ErrorResponse(err, req, res);
    
  }

};

exports.declareMatchResult = async (req, res) => {
  try {
    const { result, matchDetails, userId, matchId, match } = req.body;

    const betIds = matchDetails?.map((item) => item?.id);
    const betPlaced = await getMatchBetPlaceWithUser(betIds);

    logger.info({
      message: "Match result declared.",
      data: {
        betIds,
        result,
      },
    });

    

      let updateRecords = [];

      for (let item of betPlaced) {
        if (result === resultType.tie) {
          if ((item.betType === betType.BACK && item.teamName === tiedManualTeamName.yes) || (item.betType === betType.LAY && item.teamName === tiedManualTeamName.no)) {
            item.result = betResultStatus.WIN;
          }
          else if ((item.betType === betType.LAY && item.teamName === tiedManualTeamName.yes) || (item.betType === betType.BACK && item.teamName === tiedManualTeamName.no)) {
            item.result = betResultStatus.LOSS;
          }
        } else if (result === resultType.noResult) {
          if (!(item.marketBetType === matchBettingType.tiedMatch1 || item.marketBetType === matchBettingType.tiedMatch2)) {
            if ((item.betType === betType.BACK && item.teamName === tiedManualTeamName.yes) || (item.betType === betType.LAY && item.teamName === tiedManualTeamName.no)) {
              betResultStatus.LOSS;
            }
            else if ((item.betType === betType.LAY && item.teamName === tiedManualTeamName.yes) || (item.betType === betType.BACK && item.teamName === tiedManualTeamName.no)) {
              betResultStatus.WIN
            };
          }
        } else {
          const isWinCondition = (item.betType === betType.BACK && item.teamName === result) || (item.betType === betType.LAY && item.teamName !== result);
          const isTiedMatchCondition = (item.marketBetType === matchBettingType.tiedMatch1 || item.marketBetType === matchBettingType.tiedMatch2) && ((item.betType === betType.BACK && item.teamName === tiedManualTeamName.no) || (item.betType === betType.LAY && item.teamName !== tiedManualTeamName.yes));
          const isCompleteMatchCondition = (item.marketBetType === matchBettingType.completeMatch) && ((item.betType === betType.BACK && item.teamName === tiedManualTeamName.yes) || (item.betType === betType.LAY && item.teamName !== tiedManualTeamName.no));
          item.result = isWinCondition || isTiedMatchCondition || isCompleteMatchCondition ? betResultStatus.WIN : betResultStatus.LOSS;
        }
        updateRecords.push(item);
      }

    await addNewBet(updateRecords);
  

    let users = await getDistinctUserBetPlaced(In(betIds));

    let upperUserObj = {};
    let bulkWalletRecord = [];
    const profitLossData = await calculateProfitLossMatchForUserDeclare(
      users,
      betIds,
      matchId,
      0,
      socketData.matchResult,
      userId,
      bulkWalletRecord,
      upperUserObj,
      result,
      match
    );

    insertTransactions(bulkWalletRecord);
    logger.info({
      message: "Upper user for this bet.",
      data: { upperUserObj, betIds },
    });

    for (let [key, value] of Object.entries(upperUserObj)) {
      let parentUser = await getUserBalanceDataByUserId(key);

      let parentUserRedisData = await getUserRedisData(parentUser.userId);

      let parentProfitLoss = parentUser?.profitLoss || 0;
      if (parentUserRedisData?.profitLoss) {
        parentProfitLoss = parseFloat(parentUserRedisData.profitLoss);
      }
      let parentMyProfitLoss = parentUser?.myProfitLoss || 0;
      if (parentUserRedisData?.myProfitLoss) {
        parentMyProfitLoss = parseFloat(parentUserRedisData.myProfitLoss);
      }
      let parentExposure = parentUser?.exposure || 0;
      if (parentUserRedisData?.exposure) {
        parentExposure = parseFloat(parentUserRedisData?.exposure);
      }

      parentUser.profitLoss = parentProfitLoss - value?.["profitLoss"];
      parentUser.myProfitLoss = parentMyProfitLoss - value["myProfitLoss"];
      parentUser.exposure = parentExposure - value["exposure"];
      if (parentExposure < 0) {
        logger.info({
          message: "Exposure in negative for user: ",
          data: {
            betIds,
            matchId,
            parentUser,
          },
        });
        parentUser.exposure = 0;
      }
      addInitialUserBalance(parentUser);
      logger.info({
        message: "Declare result db update for parent ",
        data: {
          betIds,
          parentUser,
        },
      });
      if (parentUserRedisData?.exposure) {
        updateUserDataRedis(key, {
          exposure: parentUser.exposure,
          profitLoss: parentUser.profitLoss,
          myProfitLoss: parentUser.myProfitLoss,
        });
      }
     
      await deleteKeyFromUserRedis(key,redisKeys.userTeamARate + matchId,redisKeys.userTeamBRate + matchId,redisKeys.userTeamCRate + matchId,redisKeys.yesRateTie + matchId,redisKeys.noRateTie + matchId,redisKeys.yesRateComplete + matchId,redisKeys.noRateComplete + matchId);

      sendMessageToUser(key, socketData.matchResult, {
        ...parentUser,
        betIds,
        matchId
      });
    }

    return SuccessResponse(
      {
        statusCode: 200,
        message: { msg: "bet.resultDeclared" },
        data: profitLossData,
      },
      req,
      res
    );
  } catch (error) {
    logger.error({
      error: `Error at declare session result for the user.`,
      stack: error.stack,
      message: error.message,
    });
    // Handle any errors and return an error response
    return ErrorResponse(error, req, res);
  }
};


const calculateProfitLossMatchForUserDeclare = async (users, betId, matchId, fwProfitLoss, redisEventName, userId, bulkWalletRecord, upperUserObj, result, matchData) => {

  let faAdminCal = {};

  for (const user of users) {
    let getWinAmount = 0;
    let getLossAmount = 0;
    let profitLoss = 0;
    let userRedisData = await getUserRedisData(user.user.id);
    let getMultipleAmount = await getMultipleAccountMatchProfitLoss(betId, user.user.id);

    Object.keys(getMultipleAmount)?.map((item) => {
      getMultipleAmount[item] = parseFloat(parseFloat(getMultipleAmount[item]).toFixed(2));
    });

    let maxLoss = 0;
    logger.info({ message: "Updated users", data: user.user });


    // check if data is already present in the redis or not
    if (userRedisData?.[redisKeys.userTeamARate + matchId]) {

      let teamARate = userRedisData[redisKeys.userTeamARate + matchId] ?? Number.MAX_VALUE;
      let teamBRate = userRedisData[redisKeys.userTeamBRate + matchId] ?? Number.MAX_VALUE;
      let teamCRate = userRedisData[redisKeys.userTeamCRate + matchId] ?? Number.MAX_VALUE;

      let teamNoRateTie = userRedisData[redisKeys.noRateTie + matchId] ?? Number.MAX_VALUE;
      let teamYesRateTie = userRedisData[redisKeys.yesRateTie + matchId] ?? Number.MAX_VALUE;

      let teamNoRateComplete = userRedisData[redisKeys.noRateComplete + matchId] ?? Number.MAX_VALUE;
      let teamYesRateComplete = userRedisData[redisKeys.yesRateComplete + matchId] ?? Number.MAX_VALUE;

      maxLoss = (Math.abs(Math.min(teamARate, teamBRate, isNaN(teamCRate) ? 0 : teamCRate, 0)) + Math.abs(Math.min(teamNoRateTie, teamYesRateTie, 0)) + Math.abs(Math.min(teamNoRateComplete, teamYesRateComplete, 0))) || 0;

    }
    else {
      // if data is not available in the redis then get data from redis and find max loss amount for all placed bet by user
      let redisData = await calculateProfitLossForMatchToResult(betId, user.user?.id, matchData);

      let teamARate = redisData?.teamARate ?? Number.MAX_VALUE;
      let teamBRate = redisData?.teamBRate ?? Number.MAX_VALUE;
      let teamCRate = redisData?.teamCRate ?? Number.MAX_VALUE;

      let teamNoRateTie = redisData?.teamNoRateTie ?? Number.MAX_VALUE;
      let teamYesRateTie = redisData?.teamYesRateTie ?? Number.MAX_VALUE;

      let teamNoRateComplete = redisData?.teamNoRateComplete ?? Number.MAX_VALUE;
      let teamYesRateComplete = redisData?.teamYesRateComplete ?? Number.MAX_VALUE;

      maxLoss = (Math.abs(Math.min(teamARate, teamBRate, isNaN(teamCRate) ? 0 : teamCRate, 0)) + Math.abs(Math.min(teamNoRateTie, teamYesRateTie, 0)) + Math.abs(Math.min(teamNoRateComplete, teamYesRateComplete, 0))) || 0;

    }


    user.user.userBalance.exposure = user.user.userBalance.exposure - maxLoss;

    logger.info({
      message: "Update user exposure.",
      data: user.user.userBalance.exposure
    });


    if (result == resultType.tie) {
      getWinAmount = getMultipleAmount.winAmountTied + getMultipleAmount.winAmountComplete;
      getLossAmount = getMultipleAmount.lossAmountTied + getMultipleAmount.lossAmountComplete;
    }
    else if (result == resultType.noResult) {
      getWinAmount = getMultipleAmount.winAmountComplete;
      getLossAmount = getMultipleAmount.lossAmountComplete;
    }
    else {
      getWinAmount = getMultipleAmount.winAmount + getMultipleAmount.winAmountTied + getMultipleAmount.winAmountComplete;
      getLossAmount = getMultipleAmount.lossAmount + getMultipleAmount.lossAmountTied + getMultipleAmount.lossAmountComplete;
    }

    profitLoss = parseFloat(getWinAmount.toString()) - parseFloat(getLossAmount.toString());

    fwProfitLoss = parseFloat(fwProfitLoss.toString()) + parseFloat(((-profitLoss * user.user.fwPartnership) / 100).toString());



    const userCurrBalance = Number(user.user.userBalance.currentBalance + profitLoss).toFixed(2);
    let userBalanceData = {
      currentBalance: userCurrBalance,
      profitLoss: user.user.userBalance.profitLoss + profitLoss,
      myProfitLoss: user.user.userBalance.myProfitLoss + profitLoss,
      exposure: user.user.userBalance.exposure
    }

    await updateUserBalanceByUserId(user.user.id, userBalanceData);

    if (userRedisData?.exposure) {
      updateUserDataRedis(user.user.id, userBalanceData);

    }
    await addUser(user.user);

    sendMessageToUser(user.user.id, redisEventName, { ...user.user, betId, matchId });
   
    let currBal=user.user.userBalance.currentBalance;

    bulkWalletRecord.push(
      ...[
        ...(result != resultType.tie && result != resultType.noResult ? [{
          winAmount: parseFloat(getMultipleAmount.winAmount),
          lossAmount: parseFloat(getMultipleAmount.lossAmount),
          type: "MATCH ODDS",
          result: result
        }] : []),
        ...(result != resultType.noResult ? [{
          winAmount: parseFloat(getMultipleAmount.winAmountTied),
          lossAmount: parseFloat(getMultipleAmount.lossAmountTied),
          type: "Tied Match",
          result: result == resultType.tie ? "YES" : "NO"
        }] : []),
        {
          winAmount: parseFloat(getMultipleAmount.winAmountComplete),
          lossAmount: parseFloat(getMultipleAmount.lossAmountComplete),
          type: "Complete Match",
          result: "YES"
        }
      ]?.map((item) => {
        currBal = currBal + item.winAmount - item.lossAmount;

        return {
          matchId: matchId,
          actionBy: userId,
          searchId: user.user.id,
          userId: user.user.id,
          amount: item.winAmount - item.lossAmount,
          transType: item.winAmount - item.lossAmount > 0 ? transType.win : transType.loss,
          currentAmount: currBal,
          description: `${user?.eventType}/${user?.eventName}/${item.type}-${item.result}`,
        }
      })
    );
    await deleteKeyFromUserRedis(user.user.id,redisKeys.userMatchExposure + matchId, redisKeys.userTeamARate + matchId, redisKeys.userTeamBRate + matchId, redisKeys.userTeamCRate + matchId, redisKeys.yesRateTie + matchId, redisKeys.noRateTie + matchId, redisKeys.yesRateComplete + matchId, redisKeys.noRateComplete + matchId);

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

      if (upperUserObj[patentUser.id]) {
        upperUserObj[patentUser.id].profitLoss = upperUserObj[patentUser.id].profitLoss + profitLoss;
        upperUserObj[patentUser.id].myProfitLoss = upperUserObj[patentUser.id].myProfitLoss + myProfitLoss;
        upperUserObj[patentUser.id].exposure = upperUserObj[patentUser.id].exposure + maxLoss;
      } else {
        upperUserObj[patentUser.id] = { profitLoss: profitLoss, myProfitLoss: myProfitLoss, exposure: maxLoss };
      }
    }
    faAdminCal = {
      profitLoss: profitLoss + (faAdminCal?.profitLoss || 0),
      exposure: maxLoss + (faAdminCal?.exposure || 0),
      myProfitLoss: +((profitLoss + (faAdminCal?.profitLoss || 0)) * parseFloat(user.user.fwPartnership) / 100).toFixed(2)
    }
  };
  return { fwProfitLoss, faAdminCal };
}

exports.unDeclareMatchResult = async (req, res) => {
  try {

    const { matchId, match, matchBetting, userId } = req.body;

    const betIds = matchBetting?.map((item) => item?.id);
    let users = await getDistinctUserBetPlaced(In(betIds));

    logger.info({
      message: "Match result un declared.",
      data: {
        betIds
      }
    });

    let upperUserObj = {};
    let bulkWalletRecord = [];
    const profitLossData = await calculateProfitLossMatchForUserUnDeclare(
      users,
      betIds,
      matchId,
      0,
      matchBetting,
      socketData.matchResultUnDeclare,
      userId,
      bulkWalletRecord,
      upperUserObj,
      match
    );

    insertTransactions(bulkWalletRecord);
    logger.info({
      message: "Upper user for this bet.",
      data: { upperUserObj, betIds }
    });


    for (let [key, value] of Object.entries(upperUserObj)) {
      let parentUser = await getUserBalanceDataByUserId(key);

      let parentUserRedisData = await getUserRedisData(parentUser.userId);

      let parentProfitLoss = parentUser?.profitLoss || 0;
      if (parentUserRedisData?.profitLoss) {
        parentProfitLoss = parseFloat(parentUserRedisData.profitLoss);
      }
      let parentMyProfitLoss = parentUser?.myProfitLoss || 0;
      if (parentUserRedisData?.myProfitLoss) {
        parentMyProfitLoss = parseFloat(parentUserRedisData.myProfitLoss);
      }
      let parentExposure = parentUser?.exposure || 0;
      if (parentUserRedisData?.exposure) {
        parentExposure = parseFloat(parentUserRedisData?.exposure);
      }


      parentUser.profitLoss = parentProfitLoss + value?.["profitLoss"];
      parentUser.myProfitLoss = parentMyProfitLoss + value["myProfitLoss"];
      parentUser.exposure = parentExposure + value["exposure"];
      if (parentExposure < 0) {
        logger.info({
          message: "Exposure in negative for user: ",
          data: {
            matchId,
            parentUser,
          },
        });
        parentUser.exposure = 0;
      }
      addInitialUserBalance(parentUser);
      logger.info({
        message: "Declare result db update for parent ",
        data: {
          parentUser,
        },
      });


      if (parentUserRedisData?.exposure) {
        parentRedisUpdateObj = {
          ...value,
          exposure: parentUser.exposure,
          profitLoss: parentUser.profitLoss,
          myProfitLoss: parentUser.myProfitLoss,
        };
        updateUserDataRedis(key, parentRedisUpdateObj);
      }

      sendMessageToUser(key, socketData.matchResultUnDeclare, {
        ...parentUser,
        matchId
      });
    }


    await updatePlaceBet(
      {
        betId: In(betIds),
        deleteReason: IsNull(),
      },
      {
        result: betResultStatus.PENDING,
      }
    );


    return SuccessResponse(
      {
        statusCode: 200,
        message: { msg: "bet.resultUnDeclared" },
        data: profitLossData
      },
      req,
      res
    );


  } catch (error) {
    logger.error({
      error: `Error at un declare match result for the user.`,
      stack: error.stack,
      message: error.message,
    });
    // Handle any errors and return an error response
    return ErrorResponse(error, req, res);
  }
}

const calculateProfitLossMatchForUserUnDeclare=async (users, betId,matchId, fwProfitLoss, resultDeclare, redisEventName, userId, bulkWalletRecord, upperUserObj, matchData) =>{
 
  let faAdminCal={
    admin:{},
    wallet:{}
  };

  for (const user of users) {
    let getWinAmount = 0;
    let getLossAmount = 0;
    let profitLoss = 0;
    let userRedisData = await getUserRedisData(user.user.id);
    let getMultipleAmount = await getMultipleAccountMatchProfitLoss(betId,user.user.id);

    Object.keys(getMultipleAmount)?.map((item) => {
      getMultipleAmount[item] = parseFloat(parseFloat(getMultipleAmount[item]).toFixed(2));
    });
    let maxLoss = 0;
   
    logger.info({ message: "Updated users", data: user.user });

   
      
        // if data is not available in the redis then get data from redis and find max loss amount for all placed bet by user
      let redisData = await calculateProfitLossForMatchToResult(betId, user.user?.id, matchData);

      let teamARate = redisData?.teamARate ?? Number.MAX_VALUE;
      let teamBRate = redisData?.teamBRate ?? Number.MAX_VALUE;
      let teamCRate = redisData?.teamCRate ?? Number.MAX_VALUE;

      let teamNoRateTie = redisData?.teamNoRateTie ?? Number.MAX_VALUE;
      let teamYesRateTie = redisData?.teamYesRateTie ?? Number.MAX_VALUE;

      let teamNoRateComplete = redisData?.teamNoRateComplete ?? Number.MAX_VALUE;
      let teamYesRateComplete = redisData?.teamYesRateComplete ?? Number.MAX_VALUE;

    maxLoss = (Math.abs(Math.min(teamARate, teamBRate, isNaN(teamCRate) ? 0 : teamCRate, 0)) + Math.abs(Math.min(teamNoRateTie, teamYesRateTie, 0)) + Math.abs(Math.min(teamNoRateComplete, teamYesRateComplete, 0))) || 0;
      
    logger.info({
      maxLoss:maxLoss
    });

    user.user.userBalance.exposure = user.user.userBalance.exposure + maxLoss;

    logger.info({
      message:"Update user exposure.",
      data:user.user.exposure
    });

    let result= resultDeclare?.[0]?.result;
    if (result == resultType.tie) {
      getWinAmount = getMultipleAmount.winAmountTied + getMultipleAmount.winAmountComplete;
      getLossAmount = getMultipleAmount.lossAmountTied + getMultipleAmount.lossAmountComplete;
    }
    else if (result == resultType.noResult) {
      getWinAmount = getMultipleAmount.winAmountComplete;
      getLossAmount = getMultipleAmount.lossAmountComplete;
    }
    else {
      getWinAmount = getMultipleAmount.winAmount + getMultipleAmount.winAmountTied + getMultipleAmount.winAmountComplete;
      getLossAmount = getMultipleAmount.lossAmount + getMultipleAmount.lossAmountTied + getMultipleAmount.lossAmountComplete;
    }


    profitLoss = parseFloat(getWinAmount.toString()) - parseFloat(getLossAmount.toString());

 

    fwProfitLoss = parseFloat((parseFloat(fwProfitLoss.toString()) - parseFloat(((-profitLoss * user.user.fwPartnership) / 100).toString())).toFixed(2));

    

    const userCurrBalance = Number(
      (user.user.userBalance.currentBalance - profitLoss).toFixed(2)
    );

    let userBalanceData = {
      currentBalance: userCurrBalance,
      profitLoss: user.user.userBalance.profitLoss - profitLoss,
      myProfitLoss: user.user.userBalance.myProfitLoss - profitLoss,
      exposure: user.user.userBalance.exposure,
    }

    await updateUserBalanceByUserId(user.user.id, userBalanceData);


    const matchTeamRates = {
      ...(teamARate != Number.MAX_VALUE && teamARate!= null && teamARate!=undefined ? { [redisKeys.userTeamARate + matchId]: teamARate } : {}),
      ...(teamBRate != Number.MAX_VALUE && teamBRate!= null && teamBRate!= undefined ?  { [redisKeys.userTeamBRate + matchId]: teamBRate } : {}),
      ...(teamCRate != Number.MAX_VALUE && teamCRate!= null && teamCRate!= undefined ? { [redisKeys.userTeamCRate + matchId]: teamCRate } : {}),
      ...(teamYesRateTie != Number.MAX_VALUE && teamYesRateTie!= null && teamYesRateTie!= undefined ? { [redisKeys.yesRateTie + matchId]: teamYesRateTie } : {}),
      ...(teamNoRateTie != Number.MAX_VALUE && teamNoRateTie!= null && teamNoRateTie!= undefined ? { [redisKeys.noRateTie + matchId]: teamNoRateTie } : {}),
      ...(teamYesRateComplete != Number.MAX_VALUE && teamYesRateComplete!= null && teamYesRateComplete!= undefined ? { [redisKeys.yesRateComplete + matchId]: teamYesRateComplete } : {}),
      ...(teamNoRateComplete != Number.MAX_VALUE && teamNoRateComplete!= null && teamNoRateComplete!= undefined ? { [redisKeys.noRateComplete + matchId]: teamNoRateComplete } : {})
    }
    
    if (userRedisData?.exposure) {
      updateUserDataRedis(user.user.id, {
        ...matchTeamRates,
        ...userBalanceData,
        [redisKeys.userMatchExposure + matchId]: maxLoss
      });
    }
    await addUser(user.user);
    logger.info({
      message:"user save at un declare result",
      data:user
    })

    sendMessageToUser(user.user.id, redisEventName, { ...user.user, betId, matchId, matchExposure: maxLoss });

    let currBal=user.user.userBalance.currentBalance;
     bulkWalletRecord.push(
      ...[
        ...(result != resultType.tie && result != resultType.noResult ? [{
          winAmount: parseFloat(parseFloat(getMultipleAmount.winAmount).toFixed(2)),
          lossAmount: parseFloat(parseFloat(getMultipleAmount.lossAmount).toFixed(2)),
          type: "MATCH ODDS",
          result: result
        }] : []),
        ...(result != resultType.noResult ? [{
          winAmount: parseFloat(parseFloat(getMultipleAmount.winAmountTied).toFixed(2)),
          lossAmount: parseFloat(parseFloat(getMultipleAmount.lossAmountTied).toFixed(2)),
          type: "Tied Match",
          result: result == resultType.tie ? "YES" : "NO"
        }] : []),
        {
          winAmount: parseFloat(parseFloat(getMultipleAmount.winAmountComplete).toFixed(2)),
          lossAmount: parseFloat(parseFloat(getMultipleAmount.lossAmountComplete).toFixed(2)),
          type: "Complete Match",
          result: "YES"
        }
      ]?.map((item) => {
        currBal = currBal - item.winAmount + item.lossAmount;
        return {
          matchId: matchId,
          actionBy: userId,
          searchId: user.user.id,
          userId: user.user.id,
          amount: -(item.winAmount - item.lossAmount),
          transType: transType.bet,
          currentAmount: currBal,
          description: `${user?.eventType}/${user?.eventName}/${item.type}-${item.result}`,
        }
      })
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
      
      if (upperUserObj[patentUser.id]) {
        upperUserObj[patentUser.id].profitLoss = upperUserObj[patentUser.id].profitLoss + profitLoss;
        upperUserObj[patentUser.id].myProfitLoss = upperUserObj[patentUser.id].myProfitLoss + myProfitLoss;
        upperUserObj[patentUser.id].exposure = upperUserObj[patentUser.id].exposure + maxLoss;

        Object.keys(matchTeamRates)?.forEach((item)=>{
          if(matchTeamRates[item] && upperUserObj[patentUser.id][item]){
            upperUserObj[patentUser.id][item] += -parseFloat((parseFloat(matchTeamRates[item]) * parseFloat(user?.user[`${partnershipPrefixByRole[patentUser?.roleName]}Partnership`]) / 100).toFixed(2))
          }
          else{
            upperUserObj[patentUser.id][item] = -parseFloat((parseFloat(matchTeamRates[item]) * parseFloat(user?.user[`${partnershipPrefixByRole[patentUser?.roleName]}Partnership`]) / 100).toFixed(2))
          }
        });
       
      } else {
        upperUserObj[patentUser.id] = { profitLoss: profitLoss,myProfitLoss: myProfitLoss ,exposure: maxLoss};
        
        Object.keys(matchTeamRates)?.forEach((item)=>{
          if(matchTeamRates[item]){
            upperUserObj[patentUser.id][item] = -parseFloat((parseFloat(matchTeamRates[item]) * parseFloat(user?.user[`${partnershipPrefixByRole[patentUser?.roleName]}Partnership`]) / 100).toFixed(2))
          }
        });
      }
    }


    Object.keys(matchTeamRates)?.forEach((item)=>{
      if(faAdminCal.admin[item] && matchTeamRates[item]){
        faAdminCal.admin[item] += -parseFloat((parseFloat(matchTeamRates[item]) * parseFloat(user?.user[`faPartnership`]) / 100).toFixed(2))
      }
      else{
        faAdminCal.admin[item] = -parseFloat((parseFloat(matchTeamRates[item]) * parseFloat(user?.user[`faPartnership`]) / 100).toFixed(2))
      }
      if(faAdminCal.wallet[item] && matchTeamRates[item]){
        faAdminCal.wallet[item] += -parseFloat((parseFloat(matchTeamRates[item]) * parseFloat(user?.user[`fwPartnership`]) / 100).toFixed(2))
      }
      else{
        faAdminCal.wallet[item] = -parseFloat((parseFloat(matchTeamRates[item]) * parseFloat(user?.user[`fwPartnership`]) / 100).toFixed(2))
      }
    });

   

   

    faAdminCal = {
      ...faAdminCal,
      profitLoss: profitLoss + (faAdminCal?.profitLoss || 0),
      exposure: maxLoss + (faAdminCal?.exposure || 0),
      myProfitLoss: parseFloat((parseFloat(faAdminCal?.myProfitLoss || 0) + (parseFloat(profitLoss) * parseFloat(user.user.fwPartnership) / 100)).toFixed(2))
    }
  };
  return {fwProfitLoss,faAdminCal};
}