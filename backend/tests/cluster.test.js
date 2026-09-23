/**
 * Integration tests for cluster detection service.
 * Verifies failureRate calculation, alert creation, and deduplication.
 */

process.env.JWT_SECRET    = 'neerwatch-test-secret';
process.env.BCRYPT_ROUNDS = '4';

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose    = require('mongoose');
const Observation = require('../src/models/Observation');
const Cluster     = require('../src/models/Cluster');
const Alert       = require('../src/models/Alert');
const { runClusterDetection } = require('../src/services/clusterDetection');

let mongoServer;

jest.setTimeout(600000);

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
}, 600000);

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

beforeEach(async () => {
  for (const col of Object.values(mongoose.connection.collections)) {
    await col.deleteMany({});
  }
});

// Coordinates clustered within ~200m of each other (well within 500m radius)
const CLUSTER_COORDS = [
  [76.0000, 9.0000],
  [76.0005, 9.0005],
  [76.0010, 9.0010],
  [76.0015, 9.0015],
];

function makeObs(clientId, result, coords, wardId = 'ward-01') {
  return {
    clientId,
    householdId: 'HH-001',
    testType:    'TDS',
    result,
    testedAt:    new Date(),
    wardId,
    location:    { type: 'Point', coordinates: coords },
  };
}

describe('runClusterDetection()', () => {
  it('creates a cluster and alert when 4+ failing obs are within 500m', async () => {
    // 4 failing TDS (> 500) + 1 passing — all have GPS locations
    await Observation.insertMany([
      makeObs('f1', 600, CLUSTER_COORDS[0]),
      makeObs('f2', 620, CLUSTER_COORDS[1]),
      makeObs('f3', 580, CLUSTER_COORDS[2]),
      makeObs('f4', 610, CLUSTER_COORDS[3]),
      makeObs('p1', 200, CLUSTER_COORDS[0]),  // passing — counted in denominator
    ]);

    await runClusterDetection();

    const clusters = await Cluster.find({});
    expect(clusters).toHaveLength(1);

    const cluster = clusters[0];
    expect(cluster.testType).toBe('TDS');
    expect(cluster.wardId).toBe('ward-01');
    expect(cluster.observationCount).toBe(4);
    expect(cluster.active).toBe(true);

    // failureRate = groupObs.length / observations.length = 4 / 5 = 0.80
    expect(cluster.failureRate).toBe(0.80);

    const alerts = await Alert.find({});
    expect(alerts).toHaveLength(1);
    expect(alerts[0].clusterId.toString()).toBe(cluster._id.toString());
    expect(alerts[0].wardId).toBe('ward-01');
    expect(alerts[0].resolved).toBe(false);
  });

  it('does not create a second cluster on a duplicate run (dedup)', async () => {
    await Observation.insertMany([
      makeObs('f1', 600, CLUSTER_COORDS[0]),
      makeObs('f2', 620, CLUSTER_COORDS[1]),
      makeObs('f3', 580, CLUSTER_COORDS[2]),
      makeObs('f4', 610, CLUSTER_COORDS[3]),
    ]);

    await runClusterDetection();
    await runClusterDetection();

    const clusters = await Cluster.find({});
    expect(clusters).toHaveLength(1);

    const alerts = await Alert.find({});
    expect(alerts).toHaveLength(1);
  });

  it('does not create a cluster when fewer than 3 failing obs exist', async () => {
    await Observation.insertMany([
      makeObs('f1', 600, CLUSTER_COORDS[0]),
      makeObs('f2', 620, CLUSTER_COORDS[1]),
      makeObs('p1', 200, CLUSTER_COORDS[2]),
    ]);

    await runClusterDetection();

    const clusters = await Cluster.find({});
    expect(clusters).toHaveLength(0);
  });

  it('does not create a cluster when failing obs have no GPS location', async () => {
    for (let i = 0; i < 4; i++) {
      await Observation.create({
        clientId: `noloc-${i}`,
        householdId: 'HH-001',
        testType: 'TDS',
        result: 600,
        testedAt: new Date(),
        wardId: 'ward-01',
        // no location field
      });
    }

    await runClusterDetection();

    const clusters = await Cluster.find({});
    expect(clusters).toHaveLength(0);
  });
});
