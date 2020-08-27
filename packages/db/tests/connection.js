const test = require('ava');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noPreserveCache();

const sandbox = sinon.createSandbox();

const fakeConnectionConfig = {
  host: 'localhost',
  password: 'fakepassword',
  user: 'someuser',
  database: 'fakedbb',
};
test.afterEach(async () => {
  sandbox.restore();
});

test.before(async (t) => {
  t.context.getSecretConnectionConfigSpy = sandbox.fake.returns(fakeConnectionConfig);
  t.context.getEnvConnectionConfigSpy = sandbox.fake.returns(fakeConnectionConfig);

  const { getKnexFromSecret, getKnexFromEnvironment } = proxyquire('../dist/connection.js', {
    './config': {
      getEnvConnectionConfig: t.context.getEnvConnectionConfigSpy,
      getSecretConnectionConfig: t.context.getSecretConnectionConfigSpy,
    },
  });
  t.context.getKnexFromEnvironment = getKnexFromEnvironment;
  t.context.getKnexFromSecret = getKnexFromSecret;
});

test.serial('getKnexFromSecret returns expected Knex object with migration defined',
  async (t) => {
    const results = await t.context.getKnexFromSecret({
      migrationDir: 'testMigrationDir',
      databaseCredentialSecretArn: 'randomSecret',
      KNEX_ASYNC_STACK_TRACES: 'true',
      KNEX_DEBUG: 'true',
    });
    t.is('testMigrationDir', results.migrate.config.directory);
    t.is('knex_migrations', results.migrate.config.tableName);
    t.deepEqual(fakeConnectionConfig, results.client.config.connection);
    t.is(true, results.client.config.debug);
    t.is(true, results.client.config.asyncStackTraces);
    t.is('pg', results.client.config.client);
    t.is(60000, results.client.config.acquireConnectionTimeout);
  });

test.serial('getKnexFromSecret returns expected Knex object with optional config defined',
  async (t) => {
    const results = await t.context.getKnexFromSecret({
      migrationDir: 'testMigrationDir',
      databaseCredentialSecretArn: 'randomSecret',
      KNEX_DEBUG: 'true',
      KNEX_ASYNC_STACK_TRACES: 'true',
    });
    t.is('testMigrationDir', results.migrate.config.directory);
    t.is('knex_migrations', results.migrate.config.tableName);
  });

test.serial('getKnexFromSecret returns Knex object with a default migration set when env.migrations is not defined',
  async (t) => {
    const results = await t.context.getKnexFromSecret({
      databaseCredentialSecretArn: 'randomSecret',
    });
    t.is('./migrations', results.migrate.config.directory);
    t.is('knex_migrations', results.migrate.config.tableName);
  });

test.serial('getKnexFromEnvironment returns expected Knex object with optional configuraiton and a migration defined',
  async (t) => {
    const results = await t.context.getKnexFromEnvironment({
      migrationDir: 'testMigrationDir',
      PG_HOST: 'localhost',
      PG_USER: 'fakeIser',
      PG_PASSWORD: 'fakePassword',
      PG_DATABASE: 'fakeDb',
      KNEX_ASYNC_STACK_TRACES: 'true',
      KNEX_DEBUG: 'true',
    });
    t.is('testMigrationDir', results.migrate.config.directory);
    t.is('knex_migrations', results.migrate.config.tableName);
    t.deepEqual(fakeConnectionConfig, results.client.config.connection);
    t.is(true, results.client.config.debug);
    t.is(true, results.client.config.asyncStackTraces);
    t.is('pg', results.client.config.client);
    t.is(60000, results.client.config.acquireConnectionTimeout);
  });

test.serial('getKnexFromEnvironment returns Knew object with a default migration set when env.migrations is not defined',
  async (t) => {
    const results = await t.context.getKnexFromEnvironment({
      PG_HOST: 'localhost',
      PG_USER: 'fakeIser',
      PG_PASSWORD: 'fakePassword',
      PG_DATABASE: 'fakeDb',
    });
    t.is('./migrations', results.migrate.config.directory);
    t.is('knex_migrations', results.migrate.config.tableName);
  });
