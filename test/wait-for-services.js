import { waitForMongo, waitForKafka } from './setup.js';

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');

async function main() {
  console.log('Waiting for services to be ready...');

  try {
    console.log('Waiting for MongoDB...');
    await waitForMongo(MONGO_URI);
    console.log('MongoDB is ready');

    console.log('Waiting for Kafka...');
    await waitForKafka(KAFKA_BROKERS);
    console.log('Kafka is ready');

    console.log('All services are ready');
  } catch (error) {
    console.error('Failed to connect to services:', error.message);
    process.exit(1);
  }
}

main();
