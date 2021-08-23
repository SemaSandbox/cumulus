const test = require('ava');
const cryptoRandomString = require('crypto-random-string');

const { migrationDir } = require('../../../../lambdas/db-migration/dist/lambda');

const {
  generateLocalTestDb,
  destroyLocalTestDb,
  FilePgModel,
  QuerySearchClient,
  GranulePgModel,
  CollectionPgModel,
  fakeCollectionRecordFactory,
  fakeGranuleRecordFactory,
  getFilesAndGranuleInfoQuery,
} = require('../../dist');

test.before(async (t) => {
  t.context.testDbName = `query_client_${cryptoRandomString({ length: 10 })}`;

  const { knexAdmin, knex } = await generateLocalTestDb(
    t.context.testDbName,
    migrationDir
  );
  t.context.knexAdmin = knexAdmin;
  t.context.knex = knex;

  t.context.collectionPgModel = new CollectionPgModel();
  t.context.filePgModel = new FilePgModel();
  t.context.granulePgModel = new GranulePgModel();

  const testCollection = fakeCollectionRecordFactory();
  const [collectionCumulusId] = await t.context.collectionPgModel.create(
    t.context.knex,
    testCollection
  );

  t.context.testGranule = fakeGranuleRecordFactory({
    collection_cumulus_id: collectionCumulusId,
  });
  [t.context.granuleCumulusId] = await t.context.granulePgModel.create(
    t.context.knex,
    t.context.testGranule
  );
});

test.after.always(async (t) => {
  await destroyLocalTestDb({
    ...t.context,
  });
});

test('QuerySearchClient.getNextRecord() returns next record correctly', async (t) => {
  const { filePgModel, granuleCumulusId, knex, testGranule } = t.context;

  const bucket = cryptoRandomString({ length: 10 });
  const firstKey = `a_${cryptoRandomString({ length: 10 })}`;
  await filePgModel.create(knex, {
    bucket,
    key: firstKey,
    granule_cumulus_id: granuleCumulusId,
  });
  const secondKey = `b_${cryptoRandomString({ length: 10 })}`;
  await filePgModel.create(knex, {
    bucket,
    key: secondKey,
    granule_cumulus_id: granuleCumulusId,
  });

  const query = getFilesAndGranuleInfoQuery({
    knex,
    searchParams: { bucket },
    sortColumns: ['bucket', 'key'],
    granuleColumns: ['granule_id'],
  });
  const querySearchClient = new QuerySearchClient(
    query
  );
  t.like(
    await querySearchClient.getNextRecord(),
    {
      bucket,
      key: firstKey,
      granule_id: testGranule.granule_id,
    }
  );
  t.like(
    await querySearchClient.getNextRecord(),
    {
      bucket,
      key: secondKey,
      granule_id: testGranule.granule_id,
    }
  );
});

test('QuerySearchClient.hasNextRecord() correctly returns true if next record exists', async (t) => {
  const { knex, filePgModel, granuleCumulusId } = t.context;

  const bucket = cryptoRandomString({ length: 10 });
  const key = cryptoRandomString({ length: 10 });
  await filePgModel.create(knex, {
    bucket,
    key,
    granule_cumulus_id: granuleCumulusId,
  });

  const query = getFilesAndGranuleInfoQuery({
    knex,
    searchParams: { bucket },
    sortColumns: ['bucket', 'key'],
    granuleColumns: ['granule_id'],
  });
  const fileSearchClient = new QuerySearchClient(
    query
  );
  t.true(
    await fileSearchClient.hasNextRecord()
  );
});

test('QuerySearchClient.hasNextRecord() correctly returns false if next record does not exist', async (t) => {
  const { knex } = t.context;

  const bucket = cryptoRandomString({ length: 10 });

  const query = getFilesAndGranuleInfoQuery({
    knex,
    searchParams: { bucket },
    sortColumns: ['bucket', 'key'],
    granuleColumns: ['granule_id'],
  });
  const fileSearchClient = new QuerySearchClient(
    query
  );
  t.false(
    await fileSearchClient.hasNextRecord()
  );
});
