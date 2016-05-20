//-------------------------------------------------------------------------
// Logging 


function error(text) {
  log("ERROR:" + text);
}

function info(text) {
  log("INFO: " + text);
}

function log(line) {
  console.log(line);
  textarea = document.getElementById('consoleTextArea');
  if (textarea) {
    previous_text = textarea.innerHTML;
    textarea.innerHTML = previous_text + line + "\n";
    textarea.scrollTop = textarea.scrollHeight;
  }
}

window.onerror = function(msg, url, lineNumber, columnNumber, err) {
  error(msg + ' Script: ' + url + ' Line: ' + lineNumber);
  return false;
};


//-------------------------------------------------------------------------
// App starts when DOM is ready

$(document).ready(function() {
  info("App started");
  // UI Input handlers

  $('#connectButton').click(connectPressed);
  $('#lightSwitch').click(switchPressed);

  updateDisplay();
});


//-------------------------------------------------------------------------
// Constants


// Bluetooth 

// These 128-Bit ID's correspond to the python-bluezero light switch example
var SERVICE_UUID = '12341000-1234-1234-1234-123456789abc';
var CHAR_RX_UUID = '12341002-1234-1234-1234-123456789abc';
var CHAR_TX_UUID = '12341001-1234-1234-1234-123456789abc';

var LIGHT_OFF = [0x00];
var LIGHT_ON = [0x01];



//-------------------------------------------------------------------------
// App State

var isLightOn = false;
var connected = false;



//-------------------------------------------------------------------------
// Bluetooth state and connection setup
var bleDevice = null;
var gattServer = null;
var gattService = null;
var writeCharacteristic = null;
var readCharacteristic = null;


function setupBluetooth() {

  if (navigator.bluetooth === undefined) {
    error('Web Bluetooth support not found, please see: https://goo.gl/5p4zNM');
    return;
  }

  if (gattServer !== null && gattServer.connected) {
    info('(not yet) Disconnecting...');
    // TODO: inspect platform support, and/or
    // TODO: listen for an actual BLE event#
    //gattServer.disconnect();
    //updateBluetoothState(false); 

  } else {
    info('Connecting...');
    if (readCharacteristic === null) {
      navigator.bluetooth.requestDevice({
          filters: [{
            services: [SERVICE_UUID]
          }]
        })
        .then(function(device) {
          info('DeviceName=' + device.name);
          info('Connecting to GATT Server...');
          bleDevice = device;
          if (device.gatt)
            return device.gatt.connect(); // Connect to GATT Server on  device
          else
            return device.connectGATT();  // deprecated but a fallback
        }).then(function(server) {
          info('Found GATT server');
          gattServer = server;
          return gattServer.getPrimaryService(SERVICE_UUID); // Get  service
        }).then(function(service) {
          info('Found service');
          gattService = service;
          return gattService.getCharacteristic(CHAR_TX_UUID); // Get write characteristic
        }).then(function(characteristic) {
          info('Found write characteristic');
          writeCharacteristic = characteristic;
          return gattService.getCharacteristic(CHAR_RX_UUID); // Get read characteristic

        }).then(function(characteristic) {
          connected = true;
          info('Found read characteristic');
          readCharacteristic = characteristic;
          updateBluetoothState(true);


          // Listen to device notifications
          return readCharacteristic.startNotifications().then(function() {

            readCharacteristic.addEventListener('characteristicvaluechanged', function(event) {
              info('characteristicvaluechanged = ' + event.target.value + ' [' + event.target.value.byteLength + ']');
              if (event.target.value.byteLength > 0) {
                var data = new Uint8Array(event.target.value);
                onDataReceived(data);
              }
            });
          });
        }).catch(handleError);
    }
  }
}


function handleError(err) {
  error(err);
  updateBluetoothState(false);
  
}

//-------------------------------------------------------------------------
// Bluetooth sending and receiving


function send(data) {
  info("Sending: " + data);
  try {
    if (writeCharacteristic)
      writeCharacteristic.writeValue(new Uint8Array(data));
    else
      error("writeCharacteristic is not set");
  } catch (err) {
    error("Couldn't send, not connected? error was: " + err);
  }
}

function onDataReceived(data) {
  info("Recv data: " + data);

  if (data.length === 0)
    return;

  updateLightState(data[0] == 0x01);
}


//-------------------------------------------------------------------------
// UI Inputs


function connectPressed() {
  setupBluetooth();
}


function switchPressed() {
  isLightOn = !isLightOn;
  updateLightState(isLightOn);
}


//-------------------------------------------------------------------------
// UI Display

function updateDisplay() {
  updateBluetoothDisplay();
  updateLightDisplay();
}

function updateBluetoothDisplay() {
  if (connected)
    $('#bluetoothSwitch').removeClass('fa-toggle-off').addClass('fa-toggle-on');
  else
    $('#bluetoothSwitch').removeClass('fa-toggle-on').addClass('fa-toggle-off');
}

function updateLightDisplay() {
  if (isLightOn) {
    $('#lightBulb').removeClass('lightBulbOff').addClass('lightBulbOn');
    $('#lightSwitch').removeClass('fa-toggle-off').addClass('fa-toggle-on');
  } else {
    $('#lightBulb').removeClass('lightBulbOn').addClass('lightBulbOff');
    $('#lightSwitch').removeClass('fa-toggle-on').addClass('fa-toggle-off');
  }
}



//-------------------------------------------------------------------------
// State handling

function updateBluetoothState(newConnectedState) {
  connected=newConnectedState;
  updateBluetoothDisplay();
}

function updateLightState(newIsLightOnState) {
  if (newIsLightOnState) {
    isLightOn = true;
    send(LIGHT_ON);

  } else {
    isLightOn = false;
    send(LIGHT_OFF);
  }
  updateLightDisplay();
}
