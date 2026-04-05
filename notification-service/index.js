const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
const { HealthImplementation } = require('grpc-health-check');

const PROTO_PATH = path.resolve(__dirname, 'notification.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});
const notificationProto = grpc.loadPackageDefinition(packageDefinition).notification;

function subscribeNotifications(call) {
  console.log('Notification stream established');
  
  call.on('data', (request) => {
    console.log(`Received notification request for order: ${request.order_id}, status: ${request.status}`);
    
    // Send acknowledgement
    call.write({
      order_id: request.order_id,
      ack_status: 'RECEIVED'
    });
  });
  
  call.on('end', () => {
    console.log('Notification stream ended');
    call.end();
  });
  
  call.on('error', (err) => {
    console.error('Notification stream error:', err);
  });
}

// Health Check
const healthCheckStatusMap = {
  'notification.v1.NotificationService': 'SERVING',
  '': 'SERVING',
};
const healthImpl = new HealthImplementation(healthCheckStatusMap);

function main() {
  const server = new grpc.Server();
  server.addService(notificationProto.NotificationService.service, {
    subscribeNotifications,
  });
  
  healthImpl.addToServer(server);
  
  const port = process.env.PORT || '50053';
  server.bindAsync(`0.0.0.0:${port}`, grpc.ServerCredentials.createInsecure(), (err, port) => {
    if (err) {
      console.error(err);
      return;
    }
    console.log(`Notification Service running on port ${port}`);
  });
}

main();
