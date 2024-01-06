// Importing modules and libraries which are required to run the code
const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const readlineSync = require('readline-sync');

// Loading thermostat proto definitions
const thermostatDefinition = protoLoader.loadSync("protos/thermostat_control.proto");
const thermostat_proto = grpc.loadPackageDefinition(thermostatDefinition).thermostat;

// Loading security proto definitions
const securityDefinition = protoLoader.loadSync("protos/security_control.proto");
const security_proto = grpc.loadPackageDefinition(securityDefinition).security;

// Loading device proto definitions
const deviceDefinition = protoLoader.loadSync("protos/device_control.proto");
const device_proto = grpc.loadPackageDefinition(deviceDefinition).device;

// Creating Thermostat and Security and Device clients
const thermostatClient = new thermostat_proto.ThermostatService("0.0.0.0:40000", grpc.credentials.createInsecure());
const securityClient = new security_proto.SecurityService("0.0.0.0:40000", grpc.credentials.createInsecure());
const deviceClient = new device_proto.DeviceService("0.0.0.0:40000", grpc.credentials.createInsecure());

// -------------------------------------------------------------------------------------------------------------------------------------
// -------------------------------------------------------------------------------------------------------------------------------------
// -------------------------------------------------------------------------------------------------------------------------------------

// Room names mapping
const roomNames = {
  '1': 'Living Room',
  '2': 'Master Bedroom',
  '3': 'Kids Bedroom',
  '4': 'Kitchen',
  '5': 'Garage'
};

// Default temperature for each room
let livingRoomTemp = 0;
let masterBedroomTemp = 0;
let kidsBedroomTemp = 0;
let kitchenTemp = 0;
let garageTemp = 0;

// Function for setting the temperature for a specific room
function setTemperature(room, temperature) {
  thermostatClient.SetTemperature({ room, temperature }, (error, response) => {
    if (!error) {
      if (response.success) {
        switch (room) {
          case '1':
            livingRoomTemp = response.currentTemp;
            break;
          case '2':
            masterBedroomTemp = response.currentTemp;
            break;
          case '3':
            kidsBedroomTemp = response.currentTemp;
            break;
          case '4':
            kitchenTemp = response.currentTemp;
            break;
          case '5':
            garageTemp = response.currentTemp;
            break;
          default:
            console.error(`Invalid room number: ${room}`);
            return;
        }
        console.log(`Temperature set successfully for ${roomNames[room]}`);
      } else {
        console.error(`Error setting temperature for ${roomNames[room]}`, response.error);
      }
    } else {
      console.error(`Error setting temperature for ${roomNames[room]}`, error);
    }
  });
}

// -------------------------------------------------------------------------------------------------------------------------------------
// -------------------------------------------------------------------------------------------------------------------------------------
// -------------------------------------------------------------------------------------------------------------------------------------

// Function for getting the current temperature for each room
function getTemperature() {
  console.log("Current temperatures in each room:");
  console.log("\t Living Room: " + (livingRoomTemp === 0 ? "Temperature is not set." : livingRoomTemp + "°C"));
  console.log("\t Master Bedroom: " + (masterBedroomTemp === 0 ? "Temperature is not set." : masterBedroomTemp + "°C"));
  console.log("\t Kids Bedroom: " + (kidsBedroomTemp === 0 ? "Temperature is not set." : kidsBedroomTemp + "°C"));
  console.log("\t Kitchen: " + (kitchenTemp === 0 ? "Temperature is not set." : kitchenTemp + "°C"));
  console.log("\t Garage: " + (garageTemp === 0 ? "Temperature is not set." : garageTemp + "°C"));
}

// -------------------------------------------------------------------------------------------------------------------------------------
// -------------------------------------------------------------------------------------------------------------------------------------
// -------------------------------------------------------------------------------------------------------------------------------------

// Function to stream temperatures
function streamTemperatures() {
  const roomToStream = readlineSync.question("Enter the room number to stream: ");
  const stream = thermostatClient.StreamTemperatures({ rooms: [roomToStream] });

  // Taking on data which comes in
  stream.on('data', (data) => {
    console.log(`Received temperature update for ${roomNames[data.room]}: ${data.current_temperature}°C`);
  });

  // Handling end of the stream
  stream.on('end', () => {
    console.log("Temperature stream ended.");
  });

  // Errors in the stream
  stream.on('error', (error) => {
    console.error("Error in temperature stream:", error);
  });
}

// -------------------------------------------------------------------------------------------------------------------------------------
// -------------------------------------------------------------------------------------------------------------------------------------
// -------------------------------------------------------------------------------------------------------------------------------------

// Function to lock any room of user's choice
function lockRoom(room) {
  securityClient.LockOnOff({ on: true, room }, (error, response) => {
    if (!error && response.success) {
      console.log(`The ${roomNames[room]} is locked successfully`);
    } else {
      console.error(`Error in locking the ${roomNames[room]}`, error);
    }
  });
}

// -------------------------------------------------------------------------------------------------------------------------------------
// -------------------------------------------------------------------------------------------------------------------------------------
// -------------------------------------------------------------------------------------------------------------------------------------

// Function which streams security actions for chosen room
function streamSecurityActions(actions, room) {
  const stream = securityClient.StreamSecurityActions((error, response) => {
    if (!error && response.success) {
      console.log(`Security actions streamed successfully for ${roomNames[room]}`);
    } else {
      console.error(`Error in streaming security actions for ${roomNames[room]}:`, error || response);
    }
  });

  // Writing stream
  stream.write({ actions: actions.map(action => ({ action, room })) });

  // Ending stream
  stream.end();
}

// -------------------------------------------------------------------------------------------------------------------------------------
// -------------------------------------------------------------------------------------------------------------------------------------
// -------------------------------------------------------------------------------------------------------------------------------------

// Creating an array of smart devices
const smartDevices = ['TV', 'Smart Speaker', 'Smart Light'];

// Function fo streaming devices
function streamDeviceControl() {
  const room = readlineSync.question("Enter the room number to control devices: ");
  
  // Giving an option to select a specific device from the device list 
  const deviceTypeIndex = readlineSync.keyInSelect(smartDevices, 'Select a device type:');
  if (deviceTypeIndex === -1) {
    console.log('Device control canceled.');
    return;
  }

  // Putting user input into temporary const so the stream can show if its online
  const deviceType = smartDevices[deviceTypeIndex];
  const action = readlineSync.question("Enter the action to perform (on/off): ");

  // Creating a stream for the device
  const stream = deviceClient.StreamDeviceControl();

  // Writing the stream
  stream.write({ room, deviceType, action });
  
  // Takes on incoming data from the stream
  stream.on('data', (response) => {
    console.log(`Device control response for "${deviceType}": ${response.success ? 'Success' : 'Failure'}`);
  });

  // Ends the stream
  stream.end();
}

// -------------------------------------------------------------------------------------------------------------------------------------
// -------------------------------------------------------------------------------------------------------------------------------------
// -------------------------------------------------------------------------------------------------------------------------------------

// Function to start the client
function startClient() {
  //This message shows that we are connected to the server
  console.log('Connected to the server');
  while (true) {
    // This is the first list with user selection to choose from
    const action = readlineSync.question(
      "What would you like to do?\n"
      + "\t [1] Set Temperature\n"
      + "\t [2] Get Temperature\n"
      + "\t [3] Security Settings\n"
      + "\t [4] Temperature Streaming\n"
      + "\t [5] Security Streaming\n"
      + "\t [6] Smart Device Bidirectional Streaming\n"
      + "\t [7] Exit\n");

    // If we choose 7 it will exit the client with the following message   
    if (action === '7') {
      console.log("Goodbye");
      break;
    }

    // This is message is there to show if any invalid option was chosen
    if (action !== '1' && action !== '2' && action !== '3' && action !== '4' && action !== '5' && action !== '6' && action !== '7') {
      console.log("Invalid entry. Please choose a valid option.");
      continue;
    }

    if (action === '1') {
      // Setting the temp
      let roomType;

      do {
        roomType = readlineSync.question("Which room would you like to set the temperature in?\n"
          + "\t [1] Living Room\n"
          + "\t [2] Master Bedroom\n"
          + "\t [3] Kids Bedroom\n"
          + "\t [4] Kitchen\n"
          + "\t [5] Garage\n");

        if (!['1', '2', '3', '4', '5'].includes(roomType)) {
          console.error(`Invalid room selection: ${roomType}. Please choose a valid room (1 to 5).`);
        }
      } while (!['1', '2', '3', '4', '5'].includes(roomType));

      const temperature = readlineSync.question(`Enter the temperature for ${roomNames[roomType]} (in °C): `);
      // Calling the setTemperature function
      setTemperature(roomType, parseFloat(temperature));

      // The temperature is updated depending on the user input
      switch (roomType) {
        case '1':
          livingRoomTemp = parseFloat(temperature);
          break;
        case '2':
          masterBedroomTemp = parseFloat(temperature);
          break;
        case '3':
          kidsBedroomTemp = parseFloat(temperature);
          break;
        case '4':
          kitchenTemp = parseFloat(temperature);
          break;
        case '5':
          garageTemp = parseFloat(temperature);
          break;
      }
    } else if (action === '2') {
      // Calling the getTemperature function
      getTemperature();

    } else if (action === '3') {
      // Asking the user to select an option to lock a room or to go back
      const securityAction = readlineSync.question(
        "What security action would you like to perform?\n"
        + "\t [1] Lock Room\n"
        + "\t [2] Go back\n"
      );

      // Then if we select option 1, we select which room we would like to lock
      if (securityAction === '1') {
        const roomToLock = readlineSync.question("Enter the room number to lock: ");
        lockRoom(roomToLock);
      } else if (securityAction === '2') {
        // Go Back
      }

    } else if (action === '4') {
      // Temperature Streaming option
      const roomsToStream = readlineSync.question("Enter rooms to stream (comma-separated): ");
      const roomsArray = roomsToStream.split(',').map(room => room.trim());
      streamTemperatures(roomsArray);

    } else if (action === '5') {
      //Security Streaming option
      const securityActions = readlineSync.question(
        'Enter security actions (comma-separated, e.g., LOCK_ON,LOCK_OFF): '
      ).split(',').map(action => action.trim());
      const roomToStreamSecurity = readlineSync.question("Enter the room number to stream security actions: ");
      streamSecurityActions(securityActions, roomToStreamSecurity);

    } else if (action === '6') {
      // Calling the streamDeviceControl function
      streamDeviceControl();
    }
  }
}

// Waiting for the server side to be ready, if the server will not start, the client will not start either
thermostatClient.waitForReady(Date.now() + 5000, (error) => {
  if (!error) {
    console.log('Connected to the server');
    startClient();
  } else {
    console.error('Error connecting to the server:', error);
    console.error('Please make sure the server is started.');
    process.exit(1);
  }
});
