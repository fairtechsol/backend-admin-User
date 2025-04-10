
const { Not } = require("typeorm");
const { getAccessUserById, getAccessUsers, getAccessUserByUserName } = require("../services/accessUserService");
const { addPermission } = require("../services/permissionService");
const { getUserById, getUserByUserName, addUser } = require("../services/userService");
const { ErrorResponse, SuccessResponse } = require("../utils/response");
const bcrypt=require("bcryptjs");

exports.createAccessUser = async (req, res) => {
    try {
        const { userName, fullName, password, permission } = req.body;
        let reqUser = req.user || {};

        const accessUser = await getAccessUserById(reqUser.id, ["id", "mainParentId"]);
        const creator = await getUserById(reqUser.id, ["id"]);

        if (!creator && !accessUser)
            return ErrorResponse({ statusCode: 400, message: { msg: "notFound", keys: { name: "Login user" } } }, req, res);

        const upperCaseUserName = userName?.toUpperCase();
        const userExist = (!!(await getUserByUserName(upperCaseUserName,["id"])) || !!(await getAccessUserByUserName(upperCaseUserName,["id"])));
        if (userExist)
            return ErrorResponse({ statusCode: 400, message: { msg: "user.userExist" } }, req, res);

        const hashedPassword = await bcrypt.hash(password, process.env.BCRYPTSALT || 10);

        const permissionData = await addPermission(permission);

        const userData = {
            userName: upperCaseUserName,
            fullName: fullName,
            password: hashedPassword,
            parentId: creator ? creator?.id : accessUser?.id,
            mainParentId: creator ? creator?.id : accessUser.mainParentId,
            permission: permissionData?.id
        };
        await addUser(userData);

        return SuccessResponse({ statusCode: 200, message: { msg: "created", keys: { type: "User" } } }, req, res);
    } catch (err) {
        return ErrorResponse(err, req, res);
    }
};

exports.getAccessUser = async (req, res) => {
    try {
        const { id, childId } = req.user;
        const accessUser = await getAccessUsers({ mainParentId: id, id: Not(childId) });
        return SuccessResponse({ statusCode: 200, data: accessUser }, req, res);
    } catch (err) {
        return ErrorResponse(err, req, res);
    }
};
