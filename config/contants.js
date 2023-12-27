module.exports.userRoleConstant = {
  fairGameWallet: "fairGameWallet",
  fairGameAdmin: "fairGameAdmin",
  superAdmin: "superAdmin",
  admin: "admin",
  superMaster: "superMaster",
  master: "master",
  expert: "expert",
  user: "user",
};

module.exports.blockType={
    userBlock:"userBlock",
    betBlock:"betBlock"
}

module.exports.fileType = {
  pdf: "pdf",
  excel: "excel",
};

module.exports.redisTimeOut = 24 * 60 * 60;

module.exports.matchComissionTypeConstant = {
  totalLoss: "totalLoss",
  entryWise: "entryWise",
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
  win : "win",
  loss : "loss",
  creditRefer : "creditReference"
};

module.exports.partnershipPrefixByRole = {
  [this.userRoleConstant.master]: "m",
  [this.userRoleConstant.superMaster]: "sm",
  [this.userRoleConstant.admin]: "a",
  [this.userRoleConstant.superAdmin]: "sa",
  [this.userRoleConstant.fairGameAdmin]: "fa",
  [this.userRoleConstant.fairGameWallet]: "fw",
};

module.exports.differLoginTypeByRoles = {
  admin: [
    this.userRoleConstant.admin,
    this.userRoleConstant.superAdmin,
    this.userRoleConstant.master,
    this.userRoleConstant.superMaster,
  ],
  wallet:[
    this.userRoleConstant.fairGameAdmin,
    this.userRoleConstant.fairGameWallet,
  ]
};
module.exports.defaultButtonValue = {buttons: '{"25000":"25000","50000":"50000","100000":"100000","200000":"200000","300000":"300000","500000":"500000","1000000":"1000000","2500000":"2500000"}'}
module.exports.sessiontButtonValue = {buttons: '{"5000":"5000","10000":"10000","15000":"15000","25000":"25000","50000":"50000","100000":"100000","200000":"200000","500000":"500000"}'}
module.exports.buttonType = {
    MATCH : 'Match',
    SESSION : 'Session'
}


module.exports.walletDescription = {
    userCreate : "CREDIT REFRENCE as user create",
}

module.exports.socketData ={
  userBalanceUpdateEvent : "userBalanceUpdate",
  logoutUserForceEvent : "logoutUserForce",
  betBlockEvent : "userBetBlock",
};