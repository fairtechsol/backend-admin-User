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

const isProduction = process.env.NODE_ENV === 'production';

const dataSourceOption = {
  type: "postgres",
  host: process.env.POSTGRES_HOST,
  port: parseInt(process.env.POSTGRES_PORT, 10),
  username: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DATABASE,
  synchronize: false,
  logging: !isProduction,
  entities: [__dirname + "/../**/*.entity.{js,ts}"],
  migrations: [__dirname + "/../**/migrations/*{.js,.ts}"],
  migrationsTableName: "migrations",
  namingStrategy: new PluralNamingStrategy(),
  // Connection Pool Configuration
  extra: {
    max: parseInt(process.env.DB_POOL_MAX || '10', 10),  // shrink max pool for safety
    min: parseInt(process.env.DB_POOL_MIN || '1', 10),
    idleTimeoutMillis: 10000,    // close idle clients after 10 sec
    connectionTimeoutMillis: 8000,  // wait max 8 sec for a connection
    statement_timeout: 60000,     // server-side: cancel query if > 5 sec
    query_timeout: 60000,         // client-side: wait max 5 sec for a query response
  },
};

if (isProduction) {
  dataSourceOption.ssl = { rejectUnauthorized: false };
}

const AppDataSource = new DataSource(dataSourceOption);

AppDataSource.initialize()
.then(async () => {
  console.log("✅ Database connected successfully");
  const isMigrationPending = await AppDataSource.showMigrations();
  console.log("🔍 Migration pending:", isMigrationPending);

  if (isMigrationPending) {
    console.log("🚀 Running migrations...");
    await AppDataSource.runMigrations()
      .then(() => console.log("✅ Migrations applied successfully"))
      .catch(err => {
        console.error("❌ Migration error:", err);
        process.exit(1);
      });
  }
})
.catch((error) => console.error("❌ DB connection error:", error));

const getDataSource = () => {
  if (AppDataSource.isInitialized) return Promise.resolve(AppDataSource);

  return new Promise((resolve, reject) => {
    if (AppDataSource.isInitialized) resolve(AppDataSource);
    else reject(new Error("❌ Failed to create connection with database"));
  });
};

module.exports = { getDataSource, AppDataSource };
