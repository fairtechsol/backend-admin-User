
const { Not } = require("typeorm");
const { getAccessUserById, getAccessUsers, getAccessUserByUserName, addAccessUser, updateAccessUser } = require("../services/accessUserService");
const { addPermission, updatePermission } = require("../services/permissionService");
const { getUserById, getUserByUserName } = require("../services/userService");
const { ErrorResponse, SuccessResponse } = require("../utils/response");
const bcrypt = require("bcryptjs");
const { logger } = require("../config/logger");

exports.createAccessUser = async (req, res) => {
    try {
        const { userName, fullName, password, permission, id } = req.body;
        let reqUser = req.user || {};

        if (id) {
            const accessUser = await getAccessUserById(id, ["id", "permission"]);
            if (!accessUser) {
                return ErrorResponse({ statusCode: 400, message: { msg: "notFound", keys: { name: "USer" } } }, req, res);
            }
            await updateAccessUser({ id: id }, {
                fullName
            });
            await updatePermission({ id: accessUser.permission }, permission);
            return SuccessResponse({ statusCode: 200, message: { msg: "updated", keys: { name: "User" } } }, req, res);
        }

        const accessUser = await getAccessUserById(reqUser.id, ["id", "mainParentId"]);
        const creator = await getUserById(reqUser.id, ["id"]);

        if (!creator && !accessUser)
            return ErrorResponse({ statusCode: 400, message: { msg: "notFound", keys: { name: "Login user" } } }, req, res);

        const upperCaseUserName = userName?.toUpperCase();
        const userExist = (!!(await getUserByUserName(upperCaseUserName, ["id"])) || !!(await getAccessUserByUserName(upperCaseUserName, ["id"])));
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
        await addAccessUser(userData);

        return SuccessResponse({ statusCode: 200, message: { msg: "created", keys: { type: "User" } } }, req, res);
    } catch (err) {
        logger.error({
            error: `Error at creating access user: ${err.message} `,
            stack: err.stack,
            message: err.message,
        });
        return ErrorResponse(err, req, res);
    }
};

exports.getAccessUser = async (req, res) => {
    try {
        const { id, childId } = req.user;
        const accessUser = await getAccessUsers({ mainParentId: id, ...(childId ? { id: Not(childId) } : {}) });
        return SuccessResponse({ statusCode: 200, data: accessUser }, req, res);
    } catch (err) {
        return ErrorResponse(err, req, res);
    }
};

exports.lockUnlockAccessUser = async (req, res) => {
    try {
        const { id, isBlock } = req.body;
        let reqUser = req.user || {};

        await updateAccessUser({ id: id }, { userBlock: isBlock, userBlockedBy: isBlock ? reqUser.childId || reqUser?.id : null })
        return SuccessResponse({ statusCode: 200, message: { msg: "user.lock/unlockSuccessfully" } }, req, res);
    } catch (err) {
        logger.error({
            error: `Error at lock/unlock access user: ${err.message} `,
            stack: err.stack,
            message: err.message,
        });
        return ErrorResponse(err, req, res);
    }
};

exports.changeAccessUserPassword = async (req, res) => {
    try {
        const { password, id } = req.body;

        const hashedPassword = await bcrypt.hash(password, process.env.BCRYPTSALT || 10);
        await updateAccessUser({ id: id }, {
            password: hashedPassword
        });

        return SuccessResponse({ statusCode: 200, message: { msg: "auth.passwordChanged" } }, req, res);
    } catch (err) {
        logger.error({
            error: `Error at change password: ${err.message} `,
            stack: err.stack,
            message: err.message,
        });
        return ErrorResponse(err, req, res);
    }
};