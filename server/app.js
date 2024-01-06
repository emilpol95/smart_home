// Importing modules and libraries which are required to run the code
const express = require('express');
const path = require('path');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const readlineSync = require('readline-sync');

//Express definitions for HTML web page
const app = express();
const port = 3000;

// Path for the public folder, where we have html and css
app.use(express.static(path.join(__dirname, 'public')));

//Thermostat definitions
const thermostatDefinition = protoLoader.loadSync("protos/thermostat_control.proto");
const thermostat_proto = grpc.loadPackageDefinition(thermostatDefinition).thermostat;

//Security definitions
const securityDefinition = protoLoader.loadSync("protos/security_control.proto");
const security_proto = grpc.loadPackageDefinition(securityDefinition).security;

//Smart Device definitions
const deviceDefinition = protoLoader.loadSync("protos/device_control.proto");
const device_proto = grpc.loadPackageDefinition(deviceDefinition).device;

// gRPC server instance
const server = new grpc.Server();

// -------------------------------------------------------------------------------------------------------------------------------------
// -------------------------------------------------------------------------------------------------------------------------------------
// -------------------------------------------------------------------------------------------------------------------------------------

// Defining room names and connecting them to each number for temperatures
const roomNames = {
  '1': 'Living Room',
  '2': 'Master Bedroom',
  '3': 'Kids Bedroom',
  '4': 'Kitchen',
  '5': 'Garage'
};

// Each room temp is set to 0 as default
let livingRoomTemp = 0;
let masterBedroomTemp = 0;
let kidsBedroomTemp = 0;
let kitchenTemp = 0;
let garageTemp = 0;


// Thermostat gRPC service
const thermostatService = {
  // Setting temp for a specific room
  SetTemperature: (call, callback) => {
    const { room, temperature } = call.request;

    // Updating temp in each room
    switch (room) {
      case '1':
        livingRoomTemp = temperature;
        break;
      case '2':
        masterBedroomTemp = temperature;
        break;
      case '3':
        kidsBedroomTemp = temperature;
        break;
      case '4':
        kitchenTemp = temperature;
        break;
      case '5':
        garageTemp = temperature;
        break;
      default:
        // Invalid message in case wrong number was selected
        return callback({
          code: grpc.status.INVALID_ARGUMENT,
          details: 'Invalid room number',
        });
    }

    // After temp was selected, we print out the temperature update
    console.log(`Temperature set for ${roomNames[room]}. Current temperature: ${temperature}°C`);
    callback(null, { success: true });
  },

  GetTemperature: (call, callback) => {
    const { room } = call.request;

    // Getting the current temperature from each room
    let currentTemp;
    switch (room) {
      case '1':
        livingRoomTemp = temperature;
        break;
      case '2':
        masterBedroomTemp = temperature;
        break;
      case '3':
        kidsBedroomTemp = temperature;
        break;
      case '4':
        kitchenTemp = temperature;
        break;
      case '5':
        garageTemp = temperature;
        break;
      default:
        return callback({
          code: grpc.status.INVALID_ARGUMENT,
          details: 'Invalid room number',
        });
    }

    // Printing out the current temperature
    console.log(`Current temperature for ${roomNames[room]}: ${currentTemp}°C`);
    callback(null, { success: true, current_temperature: currentTemp });
  },

  // Stream temperature gRPC
  StreamTemperatures: (call) => {
    const { rooms } = call.request;
    let messageCount = 0;
  
    // Mapping the temperatures
    const intervalId = setInterval(() => {
      const temperatures = rooms.map((room) => {
        switch (room) {
          case '1':
            return livingRoomTemp;
          case '2':
            return masterBedroomTemp;
          case '3':
            return kidsBedroomTemp;
          case '4':
            return kitchenTemp;
          case '5':
            return garageTemp;
          default:
            return 0;
        }
      });
  
      // Writing the temperatures to the gRPC
      call.write({ temperatures: temperatures });
      messageCount++;
  
      // After we receive 5 messages from the stream it ends.
      if (messageCount >= 5) {
        clearInterval(intervalId);
        call.end();
      }
    }, 1000);
  
    call.on('cancelled', () => {
      clearInterval(intervalId);
      call.end();
    });
  },
};

// Adding thermostat service to the server
server.addService(thermostat_proto.ThermostatService.service, thermostatService);

// -------------------------------------------------------------------------------------------------------------------------------------
// -------------------------------------------------------------------------------------------------------------------------------------
// -------------------------------------------------------------------------------------------------------------------------------------

// Stream SecurityControl gRPC
const securityControlService = {
  // RPC - LockOnOff - Locking/unlocking a room
  LockOnOff: (call, callback) => {
    const { on } = call.request;
    console.log(`Room lock is ${on ? 'on' : 'off'}`);
    callback(null, { success: true });
  },

  StreamSecurityActions: (call, callback) => {
    // Incoming data from the client is being handled, this was not fully implemented
    call.on('data', (request) => {
      request.actions.forEach(action => {
        switch (action) {
          case security_proto.SecurityAction.LOCK_ON:
            console.log('Received LOCK_ON action');
            break;
          case security_proto.SecurityAction.LOCK_OFF:
            console.log('Received LOCK_OFF action');
            break;
          default:
            console.error('Invalid security action:', action);
        }
      });
    });

    // End of streaming
    call.on('end', () => {

      console.log('Security actions streaming ended');
      callback(null, { success: true });
    });

    // Any errors in streaming
    call.on('error', (error) => {
      console.error('Error in security actions stream:', error);
      callback(error, null);
    });
  },
};

// Adding security service to the server
server.addService(security_proto.SecurityService.service, securityControlService);

// -------------------------------------------------------------------------------------------------------------------------------------
// -------------------------------------------------------------------------------------------------------------------------------------
// -------------------------------------------------------------------------------------------------------------------------------------

// This is to store online devices, when 1 is turned on then another, it will show 2 before one of them is turned off
const onlineDevices = new Map(); 

// Stream DeviceService gRPC
const deviceService = {
  StreamDeviceControl: (call) => {
    // Incoming data
    call.on('data', (request) => {
      const { room, deviceType, action } = request;

      // Printing out received device information
      console.log(`Received device control request for ${roomNames[room]} - ${deviceType}: ${action}`);

      // Updating device is, either on or off
      if (action === 'on') {
        onlineDevices.set(deviceType, room);
      } else if (action === 'off') {
        onlineDevices.delete(deviceType);
      }

      // Shows which devices are currently online
      console.log('Currently online devices:', Array.from(onlineDevices.keys()).join(', '));

      //Responding to the client
      const response = {
        success: true,
      };

      call.write(response);
    });

    // End of streaming
    call.on('end', () => {
      console.log('Device control streaming ended');
      call.end();
    });

    // Error if any in the streaming
    call.on('error', (error) => {
      console.error('Error in device control stream:', error);
      call.end();
    });
  },
};

// Adding device service to the server
server.addService(device_proto.DeviceService.service, deviceService);

// -------------------------------------------------------------------------------------------------------------------------------------
// -------------------------------------------------------------------------------------------------------------------------------------
// -------------------------------------------------------------------------------------------------------------------------------------

//Binding the gRPC server to the address and port
server.bindAsync("0.0.0.0:40000", grpc.ServerCredentials.createInsecure(), function () {
  console.log('gRPC Server is running on port 40000');
  server.start();
});

// Getting the files from the public folder (index.html and style.css)
app.use(express.static('public'));

// Connecting to app.js (for html)
app.get('/app.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'app.js'));
});

// Route for the index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '/public/index.html'));
});

// Making sure the localhost starts up
app.listen(port, () => {
  console.log(`Express Server is running at http://localhost:${port}`);
});
