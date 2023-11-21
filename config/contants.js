module.exports.userRoleConstant = {
    fairGameWallet: 'fairGameWallet',
    fairGameAdmin: 'fairGameAdmin',
    superAdmin: 'superAdmin',
    admin: 'admin',
    superMaster: 'superMaster',
    master: 'master',
    expert: 'expert',
    user: 'user',
}

module.exports.matchComissionTypeConstant = {
    totalLoss: 'totalLoss',
    entryWise: 'entryWise',
}

module.exports.baseColumnsSchemaPart = {
    id: {
        type: 'uuid',
        primary: true,
        generated: 'uuid',
    },
    createdAt: {
        type: 'timestamp with time zone',
        createDate: true,
    },
    updatedAt: {
        type: 'timestamp with time zone',
        updateDate: true,
    },
    deletedAt: {
        type: 'timestamp with time zone',
        deleteDate: true,
    }
}

// module.exports = { UserRoles };