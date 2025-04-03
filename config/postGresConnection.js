const { DataSource, DefaultNamingStrategy } = require("typeorm");
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
  // Connection Pool Configuration
  extra: {
    max: parseInt(process.env.DB_POOL_MAX, 10) || 20, // Max connections in pool
    min: parseInt(process.env.DB_POOL_MIN, 10) || 2,  // Min connections in pool
    idleTimeoutMillis: 30000, // Close idle connections after 30s
    connectionTimeoutMillis: 5000, // Timeout for acquiring connection
    maxUses: 1000, // Max times a connection can be reused
  },
};

if (process.env.NODE_ENV == 'production') {
  dataSourceOption.ssl = {
    rejectUnauthorized: false
  }
  dataSourceOption.logging = false;
}

const AppDataSource = new DataSource(dataSourceOption);

AppDataSource.initialize()
  .then(async () => {
    console.log("Database connected successfully");
    let isMigrationPending = await AppDataSource.showMigrations();
    console.log("is migration pending ", isMigrationPending);
    if (isMigrationPending) {
      console.log("Database migration pending");
      await AppDataSource.runMigrations().then(() => {
        console.log("Database migration run success");

      }).catch(err => {
        console.log("error at migration run ", err);
        process.exit(0);
      });
    }
  })
  .catch((error) => console.log(`Error in connection: ${error}`));

const getDataSource = () => {
  if (AppDataSource.isInitialized) return Promise.resolve(AppDataSource);

  return new Promise((resolve, reject) => {
    if (AppDataSource.isInitialized) resolve(AppDataSource);
    else reject(new Error("Failed to create connection with database"));
  });
};

module.exports = { getDataSource, AppDataSource };
