'use strict';

const test = require('ava');
const sinon = require('sinon');
const aws = require('@cumulus/common/aws');
const { randomString } = require('@cumulus/common/test-utils');
const models = require('../../../models');
const bootstrap = require('../../../lambdas/bootstrap');
const collectionsEndpoint = require('../../../endpoints/collections');
const {
  fakeCollectionFactory,
  fakeUserFactory,
  testEndpoint
} = require('../../../lib/testUtils');
const EsCollection = require('../../../es/collections');
const { Search } = require('../../../es/search');
const assertions = require('../../../lib/assertions');

process.env.CollectionsTable = randomString();
process.env.UsersTable = randomString();
process.env.stackName = randomString();
process.env.internal = randomString();

const esIndex = randomString();
let esClient;

let authHeaders;
let collectionModel;
let userModel;

test.before(async () => {
  await bootstrap.bootstrapElasticSearch('fakehost', esIndex);
  await aws.s3().createBucket({ Bucket: process.env.internal }).promise();

  collectionModel = new models.Collection({ tableName: process.env.CollectionsTable });
  await collectionModel.createTable();

  // create fake Users table
  userModel = new models.User();
  await userModel.createTable();

  const authToken = (await userModel.create(fakeUserFactory())).password;
  authHeaders = {
    Authorization: `Bearer ${authToken}`
  };

  esClient = await Search.es('fakehost');
});

test.beforeEach(async (t) => {
  t.context.testCollection = fakeCollectionFactory();
  await collectionModel.create(t.context.testCollection);
});

test.after.always(async () => {
  await collectionModel.deleteTable();
  await userModel.deleteTable();
  await aws.recursivelyDeleteS3Bucket(process.env.internal);
  await esClient.indices.delete({ index: esIndex });
});

test('CUMULUS-911 GET with pathParameters and without an Authorization header returns an Authorization Missing response', async (t) => {
  const request = {
    httpMethod: 'GET',
    pathParameters: {
      collectionName: 'asdf',
      version: 'asdf'
    },
    headers: {}
  };

  return testEndpoint(collectionsEndpoint, request, (response) => {
    assertions.isAuthorizationMissingResponse(t, response);
  });
});

test('CUMULUS-912 GET with pathParameters and with an unauthorized user returns an unauthorized response', async (t) => {
  const request = {
    httpMethod: 'GET',
    pathParameters: {
      collectionName: 'asdf',
      version: 'asdf'
    },
    headers: {
      Authorization: 'Bearer ThisIsAnInvalidAuthorizationToken'
    }
  };

  return testEndpoint(collectionsEndpoint, request, (response) => {
    assertions.isUnauthorizedUserResponse(t, response);
  });
});

test.serial('GET returns an existing collection', (t) => {
  const getEvent = {
    httpMethod: 'GET',
    headers: authHeaders,
    pathParameters: {
      collectionName: t.context.testCollection.name,
      version: t.context.testCollection.version
    }
  };
  const stub = sinon.stub(EsCollection.prototype, 'getStats').returns([t.context.testCollection]);
  return testEndpoint(collectionsEndpoint, getEvent, (response) => {
    const { name } = JSON.parse(response.body);
    stub.restore();
    t.is(name, t.context.testCollection.name);
  });
});
