const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
const { HealthImplementation } = require('grpc-health-check');

const PROTO_PATH = path.resolve(__dirname, 'inventory.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});
const inventoryProto = grpc.loadPackageDefinition(packageDefinition).inventory;

// In-memory stock
const stock = {
  'prod-101': 1000,
  'prod-102': 100,
  'prod-103': 0,
};

const subscribers = new Map();

function checkInventory(call, callback) {
  console.log('Received CheckInventory request:', JSON.stringify(call.request));
  const { product_id, quantity } = call.request;
  
  const currentStock = stock[product_id] || 0;
  const available = currentStock >= quantity;
  
  if (available) {
    stock[product_id] -= quantity;
    // Notify subscribers
    notifySubscribers(product_id);
  }
  
  callback(null, {
    available,
    current_stock: stock[product_id] || 0,
  });
}

function subscribeStockUpdates(call) {
  const { product_id } = call.request;
  console.log(`Client subscribed to stock updates for ${product_id}`);
  
  // Send initial stock
  call.write({
    product_id,
    stock_level: stock[product_id] || 0,
  });
  
  // Store subscriber
  if (!subscribers.has(product_id)) {
    subscribers.set(product_id, []);
  }
  subscribers.get(product_id).push(call);
  
  call.on('cancelled', () => {
    console.log(`Client unsubscribed from ${product_id}`);
    const subs = subscribers.get(product_id) || [];
    subscribers.set(product_id, subs.filter(s => s !== call));
  });
}

function notifySubscribers(productId) {
  const subs = subscribers.get(productId) || [];
  subs.forEach(call => {
    call.write({
      product_id: productId,
      stock_level: stock[productId] || 0,
    });
  });
}

// Health Check
const healthCheckStatusMap = {
  'inventory.v1.InventoryService': 'SERVING',
  '': 'SERVING',
};
const healthImpl = new HealthImplementation(healthCheckStatusMap);

function main() {
  const server = new grpc.Server();
  server.addService(inventoryProto.InventoryService.service, {
    checkInventory,
    subscribeStockUpdates,
  });
  
  healthImpl.addToServer(server);
  
  const port = process.env.PORT || '50052';
  server.bindAsync(`0.0.0.0:${port}`, grpc.ServerCredentials.createInsecure(), (err, port) => {
    if (err) {
      console.error(err);
      return;
    }
    console.log(`Inventory Service running on port ${port}`);
  });
}

main();
