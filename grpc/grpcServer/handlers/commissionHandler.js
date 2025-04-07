const grpc = require("@grpc/grpc-js");
const { __mf } = require("i18n");
const { logger } = require("../../../config/logger");
const { commissionReport, commissionMatchReport, settleCommission, insertCommissions } = require("../../../services/commissionService");
const { getUserById, getUserDataWithUserBalance } = require("../../../services/userService");
const { userRoleConstant, matchComissionTypeConstant } = require("../../../config/contants");
const { updateUserBalanceData } = require("../../../services/userBalanceService");
exports.getCommissionReportsMatch = async (call) => {
  try {
    const { userId, query } = call.request;

    let commissionReportData = [];

    const userData = await getUserById(userId, ["id", "roleName"]);

    let queryColumns = ``;

    switch (userData.roleName) {
      case (userRoleConstant.fairGameWallet):

      case (userRoleConstant.fairGameAdmin): {
        queryColumns = ` parentuser.fwPartnership`;
        break;
      }
      case (userRoleConstant.superAdmin): {
        queryColumns = ` parentuser.faPartnership + parentuser.fwPartnership `;
        break;
      }
      case (userRoleConstant.admin): {
        queryColumns = ` parentuser.saPartnership + parentuser.faPartnership + parentuser.fwPartnership `;
        break;
      }
      case (userRoleConstant.superMaster): {
        queryColumns = ` parentuser.aPartnership + parentuser.saPartnership + parentuser.faPartnership + parentuser.fwPartnership`;
        break;
      }
      case (userRoleConstant.master): {
        queryColumns = ` parentuser.smPartnership + parentuser.aPartnership + parentuser.saPartnership + parentuser.faPartnership + parentuser.fwPartnership `;
        break;
      }
      case (userRoleConstant.agent): {
        queryColumns = ` parentuser.mPartnership + parentuser.smPartnership + parentuser.aPartnership + parentuser.saPartnership + parentuser.faPartnership + parentuser.fwPartnership`;
        break;
      }
      case (userRoleConstant.user): {
        queryColumns = `parentuser.agPartnership + parentuser.mPartnership + parentuser.smPartnership + parentuser.aPartnership + parentuser.saPartnership + parentuser.faPartnership + parentuser.fwPartnership`;
        break;
      }
    }

    if (!userData) {
      throw {
        code: grpc.status.NOT_FOUND,
        message: __mf("notFound", { name: "User" }),
      };
    }

    commissionReportData = await commissionReport(userId, JSON.parse(query), queryColumns);

    return { data: JSON.parse(commissionReportData) };

  } catch (error) {
    logger.error({
      context: `error in get commission report`,
      error: error.message,
      stake: error.stack,
    });
    throw {
      code: grpc.status.INTERNAL,
      message: error?.message || __mf("internalServerError"),
    };
  }
}

exports.getCommissionBetPlaced = async (call) => {
  try {
    let { userId, matchId } = call.request;
    let commissionReportData = [];

    const userData = await getUserById(userId, ["id", "roleName"]);

    let queryColumns = ``;

    switch (userData.roleName) {
      case (userRoleConstant.fairGameWallet):

      case (userRoleConstant.fairGameAdmin): {
        queryColumns = ` parentuser.fwPartnership`;
        break;
      }
      case (userRoleConstant.superAdmin): {
        queryColumns = ` parentuser.faPartnership + parentuser.fwPartnership `;
        break;
      }
      case (userRoleConstant.admin): {
        queryColumns = ` parentuser.saPartnership + parentuser.faPartnership + parentuser.fwPartnership `;
        break;
      }
      case (userRoleConstant.superMaster): {
        queryColumns = ` parentuser.aPartnership + parentuser.saPartnership + parentuser.faPartnership + parentuser.fwPartnership`;
        break;
      }
      case (userRoleConstant.master): {
        queryColumns = ` parentuser.smPartnership + parentuser.aPartnership + parentuser.saPartnership + parentuser.faPartnership + parentuser.fwPartnership `;
        break;
      }
      case (userRoleConstant.agent): {
        queryColumns = ` parentuser.mPartnership + parentuser.smPartnership + parentuser.aPartnership + parentuser.saPartnership + parentuser.faPartnership + parentuser.fwPartnership`;
        break;
      }
      case (userRoleConstant.user): {
        queryColumns = `parentuser.agPartnership + parentuser.mPartnership + parentuser.smPartnership + parentuser.aPartnership + parentuser.saPartnership + parentuser.faPartnership + parentuser.fwPartnership`;
        break;
      }
    }

    if (!userData) {
      throw {
        code: grpc.status.NOT_FOUND,
        message: __mf("notFound", { name: "User" }),
      };
    }

    commissionReportData = await commissionMatchReport(userId, matchId, queryColumns);

    return { data: JSON.parse(commissionReportData) };
  } catch (error) {
    logger.error({
      context: `error in get commission report of bet places`,
      error: error.message,
      stake: error.stack,
    });
    throw {
      code: grpc.status.INTERNAL,
      message: error?.message || __mf("internalServerError"),
    };
  }
}

exports.settleCommissions = async (call) => {
  try {
    const { userId } = call.request;
    const userData = await getUserDataWithUserBalance({ id: userId });
    if (userData?.userBal?.totalCommission == 0) {
      throw {
        code: grpc.status.INVALID_ARGUMENT,
        message: __mf("userBalance.commissionAlreadySettled"),
      };
    }
    if (userData) {
      await settleCommission(userId);
      await insertCommissions({
        commissionAmount: userData.userBal.totalCommission,
        createBy: userData.id,
        parentId: userData.id,
        commissionType: matchComissionTypeConstant.settled,
        settled: true
      });

      await updateUserBalanceData(userId, {
        balance: 0,
        totalCommission: -userData.userBal.totalCommission
      });

    }
    return {}

  } catch (error) {
    logger.error({
      message: "Error in settle commission.",
      context: error.message,
      stake: error.stack
    });
    throw {
      code: grpc.status.INTERNAL,
      message: error?.message || __mf("internalServerError"),
    };
  }
}
