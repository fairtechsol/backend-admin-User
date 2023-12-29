const { DataSource, getConnection, DefaultNamingStrategy } = require("typeorm");
const TypeORM = require("typeorm");
require("dotenv").config();
require("reflect-metadata");

class PluralNamingStrategy extends DefaultNamingStrategy {
  tableName(className, customName) {
    return customName || this.tableNameWithoutPrefix(className);
  }

  tableNameWithoutPrefix(className) {
    return customPluralizeWord(className); // Assume you have a pluralization function
  }
}

function customPluralizeWord(word) {
  return word + 's'; // Simple rule: add 's' to make it plural
}

const dataSourceOption = {
  type: "postgres",
  host: process.env.POSTGRES_HOST,
  port: parseInt(process.env.POSTGRES_PORT),
  username: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DATABASE,
  synchronize: false,
  entities: [__dirname + "/../**/*.entity.{js,ts}"],
  migrations: [__dirname + "/../**/migrations/*{.js,.ts}"],
  migrationsTableName: "migrations",
  namingStrategy: new PluralNamingStrategy(),
  ssl : true
};

const AppDataSource = new DataSource(dataSourceOption);

AppDataSource.initialize()
  .then(async () => {
    console.log("Database connected successfully");
    let isMigrationPending = await AppDataSource.showMigrations();
    console.log("is migration pending ", isMigrationPending);
    if(isMigrationPending){
        console.log("Database migration pending");
        await AppDataSource.runMigrations();
        console.log("Database migration run success");
    }
  })
  .catch((error) => console.log(`Error in connection:${error}`));

const getDataSource = () => {
  if (AppDataSource.isInitialized) return Promise.resolve(AppDataSource);

  return new Promise((resolve, reject) => {
      if (AppDataSource.isInitialized) resolve(AppDataSource);
      else reject("Failed to create connection with database");
  });
};

module.exports = { getDataSource, AppDataSource };
