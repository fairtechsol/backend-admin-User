const grpc = require("@grpc/grpc-js");
const { __mf } = require("i18n");
const { logger } = require("../../../config/logger");
const { commissionReport, commissionMatchReport } = require("../../../services/commissionService");
const { getUserById } = require("../../../services/userService");
const { userRoleConstant } = require("../../../config/contants");
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