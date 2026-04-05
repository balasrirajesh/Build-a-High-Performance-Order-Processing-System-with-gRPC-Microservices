const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const express = require('express');
const { HealthImplementation } = require('grpc-health-check');

// Proto paths
const ORDER_PROTO_PATH = path.resolve(__dirname, 'order.proto');
const INVENTORY_PROTO_PATH = path.resolve(__dirname, 'inventory.proto');
const NOTIFICATION_PROTO_PATH = path.resolve(__dirname, 'notification.proto');

function loadProto(protoPath) {
  const packageDefinition = protoLoader.loadSync(protoPath, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  });
  return grpc.loadPackageDefinition(packageDefinition);
}

const orderProto = loadProto(ORDER_PROTO_PATH).order;
const inventoryProto = loadProto(INVENTORY_PROTO_PATH).inventory;
const notificationProto = loadProto(NOTIFICATION_PROTO_PATH).notification;

// Clients
const inventoryClient = new inventoryProto.InventoryService(
  process.env.INVENTORY_SERVICE_ADDR || 'localhost:50052',
  grpc.credentials.createInsecure()
);

const notificationClient = new notificationProto.NotificationService(
  process.env.NOTIFICATION_SERVICE_ADDR || 'localhost:50053',
  grpc.credentials.createInsecure()
);

// Establish bidi stream for notifications
let notificationStream;
function startNotificationStream() {
  notificationStream = notificationClient.subscribeNotifications();
  notificationStream.on('data', (ack) => {
    console.log(`Notification ack received for order: ${ack.order_id}, status: ${ack.ack_status}`);
  });
  notificationStream.on('error', (err) => {
    console.error('Notification stream error:', err);
    setTimeout(startNotificationStream, 5000); // Reconnect
  });
  notificationStream.on('end', () => {
    console.log('Notification stream ended');
    setTimeout(startNotificationStream, 5000); // Reconnect
  });
}
startNotificationStream();

function createOrder(call, callback) {
  const { product_id, quantity } = call.request;
  console.log(`New order request: ${product_id}, quantity: ${quantity}`);

  // 1. Check inventory
  inventoryClient.checkInventory({ product_id, quantity }, (err, response) => {
    if (err) {
      console.error('Inventory service error:', err);
      return callback({
        code: grpc.status.INTERNAL,
        message: 'Internal server error',
      });
    }

    if (!response.available) {
      console.log(`Order failed: ${product_id} out of stock`);
      return callback({
        code: grpc.status.FAILED_PRECONDITION,
        message: 'Item out of stock',
      });
    }

    // 2. Process order
    const orderId = uuidv4();
    console.log(`Order created: ${orderId}`);

    // 3. Send notification
    notificationStream.write({
      order_id: orderId,
      status: 'CONFIRMED'
    });

    callback(null, {
      order_id: orderId,
      status: 'CONFIRMED',
    });
  });
}

// Health Check
const healthCheckStatusMap = {
  'order.v1.OrderService': 'SERVING',
  '': 'SERVING',
};
const healthImpl = new HealthImplementation(healthCheckStatusMap);

// gRPC Server
function startGrpcServer() {
  const server = new grpc.Server();
  server.addService(orderProto.OrderService.service, {
    createOrder,
  });
  healthImpl.addToServer(server);
  
  const grpcPort = process.env.PORT || '50051';
  server.bindAsync(`0.0.0.0:${grpcPort}`, grpc.ServerCredentials.createInsecure(), (err, port) => {
    if (err) {
      console.error(err);
      return;
    }
    console.log(`Order Service (gRPC) running on port ${port}`);
  });
}

// REST Server (Performance comparison)
function startRestServer() {
  const app = express();
  app.use(express.json());

  app.post('/orders', (req, res) => {
    const { product_id, quantity } = req.body;
    
    inventoryClient.checkInventory({ product_id, quantity }, (err, response) => {
      if (err) return res.status(500).json({ error: 'Internal server error' });
      if (!response.available) return res.status(400).json({ error: 'Item out of stock' });

      const orderId = uuidv4();
      notificationStream.write({
        order_id: orderId,
        status: 'CONFIRMED'
      });

      res.status(201).json({
        order_id: orderId,
        status: 'CONFIRMED',
      });
    });
  });

  const restPort = process.env.REST_PORT || '8080';
  app.listen(restPort, () => {
    console.log(`Order Service (REST) running on port ${restPort}`);
  });
}

startGrpcServer();
startRestServer();
