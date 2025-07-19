import { MongoMemoryServer } from 'mongodb-memory-server';

export default async function globalSetup() {
  const mongoServer = await MongoMemoryServer.create({ replSet: { count: 1 } });
  global.__MONGOINSTANCE__ = mongoServer;
  process.env.MONGO_URI = mongoServer.getUri();
} 