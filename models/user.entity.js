const { EntitySchema } = require('typeorm');
const { userRoleConstant, matchComissionTypeConstant, baseColumnsSchemaPart } = require("./../config/contants");
const { ColumnNumericTransformer } = require('../services/dbService');

const userSchema = new EntitySchema({
  name: 'user',
  columns: {
    ...baseColumnsSchemaPart,
    userName: {
      type: 'varchar',
      nullable: false,
      unique: true
    },
    fullName: {
      type: 'varchar',
      nullable: true
    },
    password: {
      type: 'varchar',
      nullable: false
    },
    transPassword: {
      type: 'varchar',
      nullable: true
    },
    phoneNumber: {
      type: 'varchar',
      nullable: true
    },
    city: {
      type: 'varchar',
      nullable: true
    },
    remark: {
      type: 'varchar',
      nullable: true
    },
    roleName: {
      type: 'enum',
      enum: Object.values(userRoleConstant),
      nullable: false
    },
    userBlock: {
      type: 'boolean',
      nullable: false,
      default: false
    },
    betBlock: {
      type: 'boolean',
      nullable: false,
      default: false,
    },
    userBlockedBy: {
      type: "uuid",
      nullable: true
    },
    betBlockedBy: {
      type: "uuid",
      nullable: true
    },
    fwPartnership: {
      type: 'int',
      nullable: false,
      default: 0
    },
    faPartnership: {
      type: 'int',
      nullable: false,
      default: 0
    },
    saPartnership: {
      type: 'int',
      nullable: false,
      default: 0
    },
    aPartnership: {
      type: 'int',
      nullable: false,
      default: 0
    },
    smPartnership: {
      type: 'int',
      nullable: false,
      default: 0
    },
    mPartnership: {
      type: 'int',
      nullable: false,
      default: 0
    },
    agPartnership: {
      type: 'int',
      nullable: false,
      default: 0
    },
    exposureLimit: {
      type: 'decimal',
      nullable: false,
      precision: 13,
      scale: 2,
      default: 0,
      transformer: new ColumnNumericTransformer()
    },
    maxBetLimit: {
      type: 'decimal',
      nullable: false,
      precision: 13,
      scale: 2,
      default: 0,
      transformer: new ColumnNumericTransformer()
    },
    minBetLimit: {
      type: 'decimal',
      nullable: false,
      precision: 13,
      scale: 2,
      default: 0,
      transformer: new ColumnNumericTransformer()
    },
    creditRefrence: {
      type: 'decimal',
      nullable: false,
      precision: 13,
      scale: 2,
      default: 0,
      transformer: new ColumnNumericTransformer()
    },
    downLevelCreditRefrence: {
      type: 'decimal',
      nullable: false,
      precision: 13,
      scale: 2,
      default: 0,
      transformer: new ColumnNumericTransformer()
    },
    matchComissionType: {
      type: 'enum',
      enum: Object.values(matchComissionTypeConstant),
      nullable: true
    },
    matchCommission: {
      type: 'float',
      nullable: false,
      default: 0,
      transformer: new ColumnNumericTransformer()
    },
    superParentId: {
      type: "uuid",
      nullable: true
    },
    superParentType:{
      type: 'enum',
      enum: [userRoleConstant.fairGameAdmin, userRoleConstant.fairGameWallet],
      nullable: true
    },
    autoBlock:{
      type: 'boolean',
      nullable: false,
      default: false
    },
    delayTime: {
      type: 'int',
      nullable: false,
      default: 5
    },
    loginAt: {
      type: 'timestamp with time zone',
      nullable: true,
      default: null
    },
    transactionPasswordAttempts:{
      type:"int",
      nullable: false,
      default:0,
    },
    isDemo:{
      type:"boolean",
      default: false,
      nullable: false
    }
  },
  orderBy: {
    "betBlock": "ASC",
    "userBlock": "ASC",
    "userName": "ASC",
  },
  indices: [
    {
      name: 'user_userName',   // index name should be start with the table name
      unique: true, // Optional: Set to true if you want a unique index
      columns: ['id', 'userName'],
    }
  ],
});

module.exports = userSchema;
