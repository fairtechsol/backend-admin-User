const { EntitySchema } = require('typeorm');
const {baseColumnsSchemaPart } = require("../config/contants");
const domainDataSchema = new EntitySchema({
  name: 'domainData',
  columns: {
    ...baseColumnsSchemaPart,
    userName: {
      type: 'varchar',
      nullable: false,
      unique: true
    },
    userId : {
      type: 'varchar',
      nullable: false,
      unique: true
    },
    domain: {
      type: 'varchar',
      nullable: false,
      unique: true
    },
    logo: {
      type: 'varchar',
      nullable: false
    },
    headerColor: {
      type: 'varchar',
      nullable: false
    },
    sidebarColor: {
      type: 'varchar',
      nullable: false
    },
    footerColor: {
      type: 'varchar',
      nullable: false
    },
  },
  orderBy: {
    "userName": "ASC"
  },
  indices: [
    {
      name: 'domainData_userName',   // index name should be start with the table name
      unique: true, // Optional: Set to true if you want a unique index
      columns: ['id', 'userName'],
    }
  ],
});
module.exports = domainDataSchema;