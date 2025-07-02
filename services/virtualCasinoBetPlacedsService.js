const { AppDataSource } = require("../config/postGresConnection");
const virtualCasinoBetPlacedSchema = require("../models/virtualCasinoBetPlaceds.entity");
const ApiFeature = require("../utils/apiFeatures");
const VirtualCasino = AppDataSource.getRepository(virtualCasinoBetPlacedSchema);

exports.getVirtualCasinoBetPlaceds = async (where, query, subQuery) => {
    let pgQuery = VirtualCasino.createQueryBuilder()
        .innerJoinAndMapOne("virtualCasinoBetPlaced.user", 'user', 'user', `virtualCasinoBetPlaced.userId = user.id and virtualCasinoBetPlaced.userId in (${subQuery})`)
        .where(where)
        .select([
            'virtualCasinoBetPlaced', // Selects all columns from the main table
            'user.userName'          // Specific column from the joined table
        ]);

    pgQuery = new ApiFeature(
        pgQuery,
        query
    )
        .search()
        .filter()
        .sort()
        .paginate()
        .getResult();

    const [bets, count] = await pgQuery;
    return { bets, count };
}

exports.addVirtualCasinoBetPlaced = async (body) => {
    let userBet = await VirtualCasino.save(body);
    return userBet;
}

exports.deleteVirtualCasinoBetPlaced = async (body) => {
    let userBet = await VirtualCasino.remove(body);
    return userBet;
}

exports.updateVirtualCasinoBetPlaced = async (conditionObj, updateColumsObj) => {
    return await VirtualCasino.update(conditionObj, updateColumsObj);
}

exports.getVirtualCasinoBetPlaced = async (where, select) => {
    return await VirtualCasino.findOne({ where: where, select: select });
}

exports.getVirtualCasinoExposureSum = async (where) => {
    const count = await VirtualCasino.createQueryBuilder().where(where).select("SUM(amount)", "totalAmount").getRawOne();
    const list = await VirtualCasino.createQueryBuilder().where(where).select("SUM(amount)", "totalAmount").addSelect(['virtualCasinoBetPlaced.gameName as "gameName"', 'virtualCasinoBetPlaced.providerName as "providerName"']).groupBy("virtualCasinoBetPlaced.gameName").addGroupBy("virtualCasinoBetPlaced.providerName").getRawMany();
    return { count, list };
}

exports.getTotalProfitLossLiveCasino = async (where, startDate, endDate, totalLoss, subQuery) => {
    let query = VirtualCasino.createQueryBuilder('placeBet')
        .innerJoinAndMapOne("placeBet.user", 'user', 'user', `placeBet.userId = user.id and placeBet.userId in (${subQuery})`)
        .where(where)
        .andWhere({
            settled: true,
            isRollback: false
        });
    if (startDate) {
        query = query.andWhere('placeBet.createdAt >= :from', { from: new Date(startDate) })
    }
    if (endDate) {
        let newDate = new Date(endDate);
        newDate.setHours(23, 59, 59, 999);
        query = query.andWhere('placeBet.createdAt <= :to', { to: newDate })
    }
    query = query
        .select([
            totalLoss,
            'placeBet.providerName as "eventType"',
            'COUNT(placeBet.id) as "totalBet"'
        ])
        .groupBy('placeBet.providerName')
    let result = await query.getRawMany();
    return result
}

exports.getAllLiveCasinoMatchTotalProfitLoss = async (where, startDate, endDate, selectArray, subQuery) => {
    let query = VirtualCasino.createQueryBuilder('placeBet')
        .innerJoinAndMapOne("placeBet.user", 'user', 'user', `placeBet.userId = user.id and placeBet.userId in (${subQuery})`)
        .where(where)
        .andWhere({
            settled: true,
            isRollback: false,
        });

    if (startDate) {
        let newDate = new Date(startDate);
        newDate.setHours(0, 0, 0, 0);
        query = query.andWhere('placeBet.createdAt >= :from', { from: new Date(newDate) })
    }
    if (endDate) {
        let newDate = new Date(endDate);
        newDate.setHours(23, 59, 59, 999);
        query = query.andWhere('placeBet.createdAt <= :to', { to: newDate })
    }

    query = query
        .select([
            ...selectArray,
            'COUNT(placeBet.id) as "totalBet"',
            'placeBet.gameName as "gameName"',
            "placeBet.providerName as type",
            'placeBet.gameId as "gameId"',
        ])
        .groupBy('placeBet.gameName, placeBet.providerName, placeBet.gameId').orderBy('MAX(placeBet.createdAt)', 'DESC');

    let result = await query.getRawMany();

    return { result };
}

exports.getLiveCasinoBetsProfitLoss = async (where, totalLoss, subQuery, domain, startDate, endDate) => {
    let query = VirtualCasino.createQueryBuilder('placeBet')
        .innerJoinAndMapOne("placeBet.user", 'user', 'user', `placeBet.userId = user.id and placeBet.userId in (${subQuery})`)
        .where(where)
        .andWhere({ settled: true, isRollback: false });


    if (startDate) {
        let newDate = new Date(startDate);
        newDate.setHours(0, 0, 0, 0);
        query = query.andWhere('placeBet.createdAt >= :from', { from: new Date(newDate) })
    }
    if (endDate) {
        let newDate = new Date(endDate);
        newDate.setHours(23, 59, 59, 999);
        query = query.andWhere('placeBet.createdAt <= :to', { to: newDate })
    }


    query = query
        .select([
            totalLoss,
            'placeBet.id as "id"',
            'placeBet.userId as "userId"',
            'placeBet.betType  as "betType"',
            'placeBet.providerName  as "providerName"',
            'placeBet.gameName  as "gameName"',
            'placeBet.amount  as "amount"',
            'placeBet.gameId  as "gameId"',
            'placeBet.roundId  as "roundId"',
            'placeBet.runnerName as "runnerName"',
            'placeBet.createdAt as "createdAt"',
            'user.userName as userName',
        ])
        .addSelect(`'${domain}'`, `domain`)
        .groupBy('placeBet.id, user.userName').orderBy('placeBet.createdAt', 'DESC');
    let result = await query.getRawMany();

    return result;
}

exports.getUserWiseProfitLossLiveCasino = async (where, select, startDate, endDate) => {
    let query = VirtualCasino.createQueryBuilder('placeBet')
        .leftJoinAndMapOne("placeBet.user", 'user', 'user', 'placeBet.userId = user.id')
        .where(where)
        .andWhere({ settled: true, isRollback: false })


    if (startDate) {
        let newDate = new Date(startDate);
        newDate.setHours(0, 0, 0, 0);
        query = query.andWhere('placeBet.createdAt >= :from', { from: new Date(newDate) })
    }
    if (endDate) {
        let newDate = new Date(endDate);
        newDate.setHours(23, 59, 59, 999);
        query = query.andWhere('placeBet.createdAt <= :to', { to: newDate })
    }

    query = query
        .select(select);

    let result = await query.getRawOne();
    return result;
}