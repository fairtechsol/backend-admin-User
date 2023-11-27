const { userRoleConstant,transType,defaultButtonValue,sessiontButtonValue,buttonType } = require('../config/contants');
const { getUserById, addUser, getUserByUserName } = require('../services/userService');
const { ErrorResponse, SuccessResponse } = require('../utils/response')
const {insertTransactions} = require('../services/transactionService')
const {insertButton} = require('../services/buttonService')

exports.createUser = async (req, res) => {
    try {
        let {userName,fullName,password,phoneNumber,city,roleName,myPartnership,createdBy} = req.body;
        let creator = req.user || await getUserById(createdBy);
        if(!creator) return ErrorResponse({statusCode : 400,message : {msg:"invalidData"}},req,res);
        creator.myPartnership = parseInt(myPartnership)
        userName = userName.toUpperCase();
        let userExist = await getUserByUserName(userName);
        if(userExist) return ErrorResponse({statusCode : 400,message : {msg:"userExist"}},req,res);
        let userData = {
            userName,
            fullName,
            password,
            phoneNumber,
            city,
            roleName,
            userBlock : creator.userBlock,
            betBlock : creator.betBlock,
            createdBy
        }

        let partnerships = await calculatePartnership(userData,creator)
        userData = {...userData,...partnerships};        
        let insertUser = await addUser(userData);
        console.log(insertUser)
        let walletArray = [{
            actionBy : insertUser.createdBy,
            searchId : insertUser.createdBy,
            userId : insertUser.id,
            amount : 0,
            transType : transType.add,
            currentAmount : insertUser.creditRefer,
            description : "CREDIT REFRENCE as user create"
        }]
        if (insertUser.createdBy != insertUser.id) {
            // wallet entry for the login user
            walletArray.push({
                actionBy : insertUser.createdBy,
                searchId : insertUser.id,
                userId : insertUser.id,
                amount : 0,
                transType : transType.withDraw,
                currentAmount : insertUser.creditRefer,
                description : "CREDIT REFRENCE as user create"
            });
        }

        const transactioninserted = await insertTransactions(walletArray);
        console.log(transactioninserted)
        if (insertUser.roleName == userRoleConstant.user) {
            let buttonValue = [
                {
                type : buttonType.MATCH,
                value : defaultButtonValue.buttons,
                createBy : insertUser.id
                }
        ]
        let insertedButton = await insertButton(buttonValue)
        console.log(insertedButton)
        }
        return SuccessResponse({ statusCode: 200, message: { msg: "login" }, data: insertUser }, req, res)
    } catch (err) {
        return ErrorResponse(err, req, res);
    }
};

const calculatePartnership =async (userData, creator) =>{
  
    let fwPartnership = creator.fwPartnership;
    let faPartnership = creator.faPartnership;
    let saPartnership = creator.saPartnership;
    let aPartnership = creator.aPartnership;
    let smPartnership = creator.smPartnership;
    let mPartnership = creator.mPartnership;

    let setPartnership = {
        [userRoleConstant.fairGameWallet] : () =>{
            fwPartnership = creator.myPartnership
        },
        [userRoleConstant.fairGameAdmin] : () =>{
            faPartnership = creator.myPartnership
        },
        [userRoleConstant.superAdmin] : () =>{
            saPartnership = creator.myPartnership
        },
        [userRoleConstant.admin] : () =>{
            aPartnership = creator.myPartnership
        },
        [userRoleConstant.superMaster] : () =>{
            smPartnership = creator.myPartnership
        },
        [userRoleConstant.master] : () =>{
            mPartnership = creator.myPartnership
        }
    }
    setPartnership[creator.roleName]();

    let calculatePartnership = {
        [userRoleConstant.fairGameAdmin] : () =>{
            faPartnership = 100 - parseInt(creator.myPartnership);
            // saPartnership = 100 - parseInt(creator.myPartnership);
            // aPartnership = 100 - parseInt(creator.myPartnership);
            // smPartnership = 100 - parseInt(creator.myPartnership);
            // mPartnership = 100 - parseInt(creator.myPartnership);
        },
        [userRoleConstant.superAdmin] : () =>{
            saPartnership = 100 - parseInt(creator.myPartnership);
            // aPartnership = 100 - parseInt(creator.myPartnership);
            // smPartnership = 100 - parseInt(creator.myPartnership);
            // mPartnership = 100 - parseInt(creator.myPartnership);
        },
        [userRoleConstant.admin] : () =>{
            aPartnership = 100 - parseInt(creator.myPartnership);
            // smPartnership = 100 - parseInt(creator.myPartnership);
            // mPartnership = 100 - parseInt(creator.myPartnership);
        },
        [userRoleConstant.superMaster] : () =>{
            smPartnership = 100 - parseInt(creator.myPartnership);
            // mPartnership = 100 - parseInt(creator.myPartnership);
        },
        [userRoleConstant.master] : () =>{
            mPartnership = 100 - parseInt(creator.myPartnership);
        }
    }
    setPartnership = {
        [userRoleConstant.fairGameWallet] : () =>{
            calculatePartnership[userData.roleName]();
        },
        [userRoleConstant.fairGameAdmin] : () =>{
            calculatePartnership[userData.roleName]();
        },
        [userRoleConstant.superAdmin] : () =>{
            calculatePartnership[userData.roleName]();
        },
        [userRoleConstant.admin] : () =>{
            calculatePartnership[userData.roleName]()
        },
        [userRoleConstant.superMaster] : () =>{
            calculatePartnership[userData.roleName]()
        },
        [userRoleConstant.master] : () =>{
            calculatePartnership[userData.roleName]()
        }
    }
    setPartnership[creator.roleName]()
    console.log({
        fwPartnership,
        faPartnership,
        saPartnership,
        aPartnership,
        smPartnership,
        mPartnership
    
    })
    if (userData.roleName != userRoleConstant.expert && fwPartnership + faPartnership + saPartnership + aPartnership + smPartnership + mPartnership != 100) {
        throw new Error("user.partnershipNotValid");
    }
    return {
        fwPartnership,
        faPartnership,
        saPartnership,
        aPartnership,
        smPartnership,
        mPartnership
    }
}

exports.insertWallet = async (req,res) =>{
    try {
        let wallet = {
            userName : "fgWallet",
            fullName : "fair game wallet",
            password : "123456",
            phoneNumber : "1234567890",
            city : "india",
            roleName : userRoleConstant.fairGameWallet,
            userBlock : false,
            betBlock : false,
            createdBy : null,
            fwPartnership : 0,
            faPartnership : 0,
            saPartnership : 0,
            aPartnership : 0,
            smPartnership : 0,
            mPartnership : 0
        }
        let user = await getUserByUserName(wallet.userName);
        if(user) return ErrorResponse({statusCode : 400,message : {msg:"userExist"}},req,res);
        let insertUser = await addUser(wallet);
        console.log(insertUser)
        return SuccessResponse({ statusCode: 200, message: { msg: "login" }, data: insertUser }, req, res)
    } catch (err) {
        return ErrorResponse(err, req, res);
    }
}