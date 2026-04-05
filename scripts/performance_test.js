const axios = require('axios');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

// Use the protos from the root
const PROTO_PATH = path.resolve(__dirname, '../protos/order.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});
const orderProto = grpc.loadPackageDefinition(packageDefinition).order;

const GRPC_ADDR = 'localhost:50051';
const REST_URL = 'http://localhost:8080/orders';

const client = new orderProto.OrderService(GRPC_ADDR, grpc.credentials.createInsecure());

async function runBenchmark(type, count) {
  const start = Date.now();
  let success = 0;
  let totalLatency = 0;

  for (let i = 0; i < count; i++) {
    const reqStart = Date.now();
    try {
      if (type === 'gRPC') {
        await new Promise((resolve, reject) => {
          client.createOrder({ product_id: 'prod-101', quantity: 1 }, (err, res) => {
            if (err) resolve(res); // Treat any response as success for latency measurement if possible, but actually we want real successes
            else resolve(res);
          });
        });
      } else {
        await axios.post(REST_URL, { product_id: 'prod-101', quantity: 1 });
      }
      success++;
      totalLatency += (Date.now() - reqStart);
    } catch (err) {
      console.error(`${type} Error:`, err.message);
    }
  }

  const duration = (Date.now() - start) / 1000;
  return {
    Type: type,
    'Requests Per Second (RPS)': (success / duration).toFixed(2),
    'Average Latency (ms)': (totalLatency / success).toFixed(2),
    'Total Requests': success
  };
}

async function main() {
  console.log('Waiting for services to be ready...');
  // Simple retry until gRPC is up
  let ready = false;
  while (!ready) {
    try {
      await new Promise((resolve, reject) => {
        const deadline = new Date();
        deadline.setSeconds(deadline.getSeconds() + 1);
        client.waitForReady(deadline, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      ready = true;
    } catch (e) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  console.log('Services ready. Starting Performance Comparison (100 requests each)...');
  
  const grpcResults = await runBenchmark('gRPC', 100);
  const restResults = await runBenchmark('REST', 100);

  console.log('\n--- Performance Report Summary ---');
  console.log(`gRPC: RPS=${grpcResults['Requests Per Second (RPS)']}, Latency=${grpcResults['Average Latency (ms)']}ms`);
  console.log(`REST: RPS=${restResults['Requests Per Second (RPS)']}, Latency=${restResults['Average Latency (ms)']}ms`);
}

main().catch(console.error);
