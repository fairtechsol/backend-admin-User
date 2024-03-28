module.exports.expertDomain = process.env.EXPERT_DOMAIN_URL || "http://localhost:6060";
module.exports.walletDomain = process.env.WALLET_DOMAIN_URL || "http://localhost:5050";
module.exports.microServiceDomain = process.env.MICROSERVICEURL || "http://localhost:3200";
module.exports.oldBetFairDomain = process.env.OLD_BETFAIR_DOMAIN_URL || 'http://localhost:5001';


module.exports.resultType = {
  tie: "Tie",
  noResult: "No Result",
};
module.exports.gameType = {
  cricket: "cricket",
  football: "football",
}
module.exports.tiedManualTeamName = {
  yes: "YES",
  no: "NO"
}

module.exports.userRoleConstant = {
  fairGameWallet: "fairGameWallet",
  fairGameAdmin: "fairGameAdmin",
  superAdmin: "superAdmin",
  admin: "admin",
  superMaster: "superMaster",
  master: "master",
  agent: "agent",
  expert: "expert",
  user: "user",
};

module.exports.blockType = {
  userBlock: "userBlock",
  betBlock: "betBlock",
};

module.exports.fileType = {
  pdf: "pdf",
  excel: "excel",
};

module.exports.redisTimeOut = 24 * 60 * 60;

module.exports.matchComissionTypeConstant = {
  totalLoss: "totalLoss",
  entryWise: "entryWise",
  settled: "settled"
};

module.exports.baseColumnsSchemaPart = {
  id: {
    type: "uuid",
    primary: true,
    generated: "uuid",
  },
  createBy: {
    type: "uuid",
    nullable: true,
  },
  createdAt: {
    type: "timestamp with time zone",
    createDate: true,
  },
  updatedAt: {
    type: "timestamp with time zone",
    updateDate: true,
  },
  deletedAt: {
    type: "timestamp with time zone",
    deleteDate: true,
  },
};

module.exports.transType = {
  add: "add",
  withDraw: "withDraw",
  win: "win",
  loss: "loss",
  creditRefer: "creditReference",
  bet: 'bet'
};

module.exports.partnershipPrefixByRole = {
  [this.userRoleConstant.agent]: "ag",
  [this.userRoleConstant.master]: "m",
  [this.userRoleConstant.superMaster]: "sm",
  [this.userRoleConstant.admin]: "a",
  [this.userRoleConstant.superAdmin]: "sa",
  [this.userRoleConstant.fairGameAdmin]: "fa",
  [this.userRoleConstant.fairGameWallet]: "fw",
  [this.userRoleConstant.expert]: "fw",
};

module.exports.differLoginTypeByRoles = {
  admin: [
    this.userRoleConstant.admin,
    this.userRoleConstant.superAdmin,
    this.userRoleConstant.master,
    this.userRoleConstant.superMaster,
    this.userRoleConstant.agent,
  ],
  wallet: [
    this.userRoleConstant.fairGameAdmin,
    this.userRoleConstant.fairGameWallet,
  ],
};
module.exports.defaultButtonValue = {
  buttons:
    '{"25000":"25000","50000":"50000","100000":"100000","200000":"200000","300000":"300000","500000":"500000","1000000":"1000000","2500000":"2500000"}',
};
module.exports.sessiontButtonValue = {
  buttons:
    '{"5000":"5000","10000":"10000","15000":"15000","25000":"25000","50000":"50000","100000":"100000","200000":"200000","500000":"500000"}',
};
module.exports.buttonType = {
  MATCH: "Match",
  SESSION: "Session",
};

module.exports.walletDescription = {
  userCreate: "CREDIT REFRENCE as user create",
};

module.exports.betType = {
  YES: "YES",
  NO: "NO",
  BACK: "BACK",
  LAY: "LAY",
};

module.exports.marketType = {
  SESSION: "SESSION",
  MATCHBETTING: "MATCHBETTING",
};

module.exports.betStatusType = {
  save: "save",
  live: "live",
  result: "result",
  close: "close",
};

module.exports.teamStatus = {
  suspended: "suspended",
  active: "active",
  closed: "closed",
  ballStart: "ball start",
  ballStop: "ball stop",
  ballRunning: "ball running",
};

module.exports.accountStatementType = {
  game: "game",
  addWithdraw: "addWithdraw",
};
module.exports.matchBettingType = {
  matchOdd: "matchOdd",
  bookmaker: "bookmaker",
  quickbookmaker1: "quickbookmaker1",
  quickbookmaker2: "quickbookmaker2",
  quickbookmaker3: "quickbookmaker3",
  tiedMatch1: "tiedMatch1",
  tiedMatch2: "tiedMatch2",
  completeMatch: "completeMatch",
  completeManual: "completeManual",
  ...(Array.from({ length: 20 }, (_, index) => index).reduce((prev, curr) => {
    prev[`overUnder${curr}.5`] = `overUnder${curr}.5`
    return prev;
  }, {})),
  ...(Array.from({ length: 20 }, (_, index) => index).reduce((prev, curr) => {
    prev[`firstHalfGoal${curr}.5`] = `firstHalfGoal${curr}.5`
    return prev;
  }, {})),
  halfTime: "halfTime"
};

module.exports.tieCompleteBetType = {
  tiedMatch1: "tiedMatch1",
  tiedMatch2: "tiedMatch2",
  completeMatch: "completeMatch",
  completeManual: "completeManual",
};

module.exports.rateCuttingBetType = {
  matchOdd: "matchOdd",
  ...(Array.from({ length: 20 }, (_, index) => index).reduce((prev, curr) => {
    prev[`overUnder${curr}.5`] = `overUnder${curr}.5`
    return prev;
  }, {})),
  ...(Array.from({ length: 20 }, (_, index) => index).reduce((prev, curr) => {
    prev[`firstHalfGoal${curr}.5`] = `firstHalfGoal${curr}.5`
    return prev;
  }, {})),
  halfTime: "halfTime"
}

module.exports.marketBettingTypeByBettingType = {
  [this.matchBettingType.matchOdd]: "matchOdd",
  [this.matchBettingType.bookmaker]: "marketBookmaker",
  [this.matchBettingType.tiedMatch1]: "marketTiedMatch",
  [this.matchBettingType.completeMatch]: "marketCompleteMatch",
  ...(Array.from({ length: 20 }, (_, index) => index).reduce((prev, curr) => {
    prev[`overUnder${curr}.5`] = `overUnder${curr}.5`
    return prev;
  }, {})),
  ...(Array.from({ length: 20 }, (_, index) => index).reduce((prev, curr) => {
    prev[`firstHalfGoal${curr}.5`] = `firstHalfGoal${curr}.5`
    return prev;
  }, {})),
  [this.matchBettingType.halfTime]: "halfTime"
}

module.exports.redisKeys = {
  userAllExposure: "exposure",
  userMatchExposure: "matchExposure_",
  userSessionExposure: "sessionExposure_",
  userTeamARate: "teamARate_",
  userTeamBRate: "teamBRate_",
  userTeamCRate: "teamCRate_",
  userExposureLimit: "exposureLimit",
  yesRateTie: "yesRateTie_",
  noRateTie: "noRateTie_",
  yesRateComplete: "yesRateComplete_",
  noRateComplete: "noRateComplete_",

  ...(Array.from({ length: 20 }, (_, index) => index).reduce((prev, curr) => {
    prev[`yesRateUnderOver${curr}.5`] = `yesRateUnderOver${curr}.5_`;
    prev[`noRateUnderOver${curr}.5`] = `noRateUnderOver${curr}.5_`;
    return prev;
  }, {})),
  ...(Array.from({ length: 20 }, (_, index) => index).reduce((prev, curr) => {
    prev[`yesRateFirstHalfGoal${curr}.5`] = `yesRateFirstHalfGoal${curr}.5_`;
    prev[`noRateFirstHalfGoal${curr}.5`] = `noRateFirstHalfGoal${curr}.5_`;
    return prev;
  }, {})),

  userTeamARateHalfTime: "userTeamARateHalfTime_",
  userTeamBRateHalfTime: "userTeamBRateHalfTime_",
  userTeamCRateHalfTime: "userTeamCRateHalfTime_",
  profitLoss: "_profitLoss"
}
module.exports.redisKeysMatchWise = {
  [this.gameType.cricket]: [this.redisKeys.userTeamARate, this.redisKeys.userTeamBRate, this.redisKeys.userTeamCRate, this.redisKeys.noRateComplete, this.redisKeys.yesRateComplete, this.redisKeys.noRateTie, this.redisKeys.yesRateTie],
  [this.gameType.football]: [this.redisKeys.userTeamARate, this.redisKeys.userTeamBRate, this.redisKeys.userTeamCRate, this.redisKeys.userTeamARateHalfTime, this.redisKeys.userTeamBRateHalfTime, this.redisKeys.userTeamCRateHalfTime, ...Array.from({ length: 20 }, (_, index) => this.redisKeys[`yesRateUnderOver${index}.5`]),
  ...Array.from({ length: 20 }, (_, index) => this.redisKeys[`noRateUnderOver${index}.5`]),
  ...Array.from({ length: 20 }, (_, index) => this.redisKeys[`yesRateFirstHalfGoal${index}.5`]),
  ...Array.from({ length: 20 }, (_, index) => this.redisKeys[`noRateFirstHalfGoal${index}.5`])]
}

module.exports.otherEventMatchBettingRedisKey = {
  [this.matchBettingType.matchOdd]: {
    "a": this.redisKeys.userTeamARate,
    "b": this.redisKeys.userTeamBRate,
    "c": this.redisKeys.userTeamCRate,
  },
  [this.matchBettingType.bookmaker]: {
    "a": this.redisKeys.userTeamARate,
    "b": this.redisKeys.userTeamBRate,
    "c": this.redisKeys.userTeamCRate,
  },
  [this.matchBettingType.quickbookmaker1]: {
    "a": this.redisKeys.userTeamARate,
    "b": this.redisKeys.userTeamBRate,
    "c": this.redisKeys.userTeamCRate,
  },
  [this.matchBettingType.quickbookmaker2]: {
    "a": this.redisKeys.userTeamARate,
    "b": this.redisKeys.userTeamBRate,
    "c": this.redisKeys.userTeamCRate,
  },
  [this.matchBettingType.quickbookmaker3]: {
    "a": this.redisKeys.userTeamARate,
    "b": this.redisKeys.userTeamBRate,
    "c": this.redisKeys.userTeamCRate,
  },
  [this.matchBettingType.tiedMatch1]: {
    "a": this.redisKeys.yesRateTie,
    "b": this.redisKeys.noRateTie
  },
  [this.matchBettingType.tiedMatch2]: {
    "a": this.redisKeys.yesRateTie,
    "b": this.redisKeys.noRateTie
  },
  [this.matchBettingType.completeMatch]: {
    "a": this.redisKeys.yesRateComplete,
    "b": this.redisKeys.noRateComplete
  },
  [this.matchBettingType.completeManual]: {
    "a": this.redisKeys.yesRateComplete,
    "b": this.redisKeys.noRateComplete
  },
  ...(Array.from({ length: 20 }, (_, index) => index).reduce((prev, curr) => {
    prev[`overUnder${curr}.5`] = {
      "a": this.redisKeys[`yesRateUnderOver${curr}.5`],
      "b": this.redisKeys[`noRateUnderOver${curr}.5`]
    }
    return prev;
  }, {})),
  ...(Array.from({ length: 20 }, (_, index) => index).reduce((prev, curr) => {
    prev[`firstHalfGoal${curr}.5`] = {
      "a": this.redisKeys[`yesRateFirstHalfGoal${curr}.5`],
      "b": this.redisKeys[`noRateFirstHalfGoal${curr}.5`]
    }
    return prev;
  }, {})),
  [this.matchBettingType.halfTime]: {
    "a": this.redisKeys.userTeamARateHalfTime,
    "b": this.redisKeys.userTeamBRateHalfTime,
    "c": this.redisKeys.userTeamCRateHalfTime,
  }
};

module.exports.betResultStatus = {
  UNDECLARE: "UNDECLARE",
  PENDING: "PENDING",
  WIN: "WIN",
  LOSS: "LOSS",
  TIE: "TIE"
}
module.exports.passwordRegex = /^(?=.*[A-Z])(?=.*[a-zA-Z].*[a-zA-Z].*[a-zA-Z].*[a-zA-Z])(?=.*\d.*\d.*\d.*\d).{8,}$/;

module.exports.socketData = {
  expertRoomSocket: "expertRoom",
  MatchBetPlaced: "userMatchBetPlaced",
  SessionBetPlaced: "userSessionBetPlaced",
  userAllExposure: "exposure",
  userMatchExposure: "matchExposure_",
  userSessionExposure: "sessionExposure_",
  userBalanceUpdateEvent: "updateUserBalance",
  userTeamARate: "teamARate_",
  userTeamBRate: "teamBRate_",
  userTeamCRate: "teamCRate_",
  userExposureLimit: "exposureLimit",
  sessionResult: "sessionResult",
  sessionNoResult: "sessionNoResult",
  sessionResultUnDeclare: "sessionResultUnDeclare",
  matchResult: "matchResult",
  matchResultUnDeclare: "matchResultUnDeclare",
  sessionDeleteBet: "sessionDeleteBet",
  matchDeleteBet: "matchDeleteBet",
  logoutUserForceEvent: "logoutUserForce",
  betBlockEvent: "userBetBlock",
};

exports.marketBetType = {
  SESSION: "SESSION",
  MATCHBETTING: "MATCHBETTING",
};

module.exports.manualMatchBettingType = [
  "quickbookmaker1",
  "quickbookmaker2",
  "quickbookmaker3",
  "tiedMatch2",
  "completeManual"
];

module.exports.report = {
  queryType: "creditRefrence"
}

module.exports.matchWiseBlockType = {
  match: "match",
  session: "session",
};