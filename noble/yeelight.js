/*
 * Copyright (c) 2014. Knowledge Media Institute - The Open University
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * NodeRed node with support for interaction with BLEs
 *
 * @author <a href="mailto:carlos.pedrinaci@open.ac.uk">Carlos Pedrinaci</a> (KMi - The Open University)
 * based on the initial node by Charalampos Doukas http://blog.buildinginternetofthings.com/2013/10/12/using-node-red-to-scan-for-ble-devices/
 */

module.exports = function(RED) {

    "use strict";
    var noble = require('noble');
    var util = require('util');
    //var os = require('os');

    var SERVICE_UUID                = 'fff0';  // for yeeLight service
    var CONTROL_UUID                = 'fff1';  // for control
    var DELAY_UUID                  = 'fff2';  // set delay on/off for LED
    var DELAY_STATUS_QUERY_UUID     = 'fff3';  // query the status of delay on/off
    var DELAY_STATUS_RESPONSE_UUID  = 'fff4';  // notify the status of delay on/off
    var STATUS_QUERY_UUID_UUID      = 'fff5';  // query thhe status of delay on/off
    var STATUS_RESPONSE_UUID        = 'fff6';  // notify the status LED
    var COLORFLOW_UUID              = 'fff7';  // set the color flow for LED
    var LED_NAME_UUID               = 'fff8';  // set the name of LED
    var LED_NAME_RESPONSE_UUID      = 'fff9';  // notify the name of LED
    var EFFECT_UUID                 = 'fffc';  // set the effect of color change

    var allServices = [ CONTROL_UUID,
    DELAY_UUID,
    DELAY_STATUS_QUERY_UUID,
    DELAY_STATUS_RESPONSE_UUID,
    STATUS_QUERY_UUID_UUID,
    STATUS_RESPONSE_UUID,
    COLORFLOW_UUID,
    LED_NAME_UUID,
    LED_NAME_RESPONSE_UUID,
    EFFECT_UUID             ];

    var device = []; 
    
    // The main node definition - most things happen in here
    function Yeelight(n) {
        // Create a RED node
        RED.nodes.createNode(this,n);

        // Store local copies of the node configuration (as defined in the .html)
        this.duplicates = n.duplicates;
        this.uuids = [];
        if (n.uuids != undefined && n.uuids !== "") {
            this.uuids = n.uuids.split(',');    //obtain array of uuids
        }

        var node = this;
        //var machineId = os.hostname();
        var scanning = false;

        noble.on('discover', function(peripheral) {
            /*
            var msg = { payload:{peripheralUuid:peripheral.uuid, localName: peripheral.advertisement.localName} };
            msg.peripheralUuid = peripheral.uuid;
            msg.localName = peripheral.advertisement.localName;
            msg.detectedAt = new Date().getTime();
            //msg.detectedBy = machineId;
            msg.advertisement = peripheral.advertisement;
            msg.rssi = peripheral.rssi;
            */
            var localName = peripheral.advertisement.localName;           
            if(localName!="Yeelight Blue II") {
                return
            }
            setTimeout(function(){            
                peripheral.connect(function(error){ 
                    if(error){console.log(error);} 
                    peripheral.discoverServices([SERVICE_UUID], function(error, services) { 
                        var deviceInformationService = services[0]; 
                        deviceInformationService.discoverCharacteristics(allServices, function(error, characteristics) { 
                            
                            for (var i in characteristics) { 
                                device.push(characteristics[i]); 
                            } 
                            //node.log (device);
                            //allDevices.push(device); 
                            //numberOfYeelights++; 
                            //server.numberOfYeelightsChanges(numberOfYeelights); 
                   
                        }); 
                    }); 
                });   
            },300);

            // Check the BLE follows iBeacon spec
            if (peripheral.manufacturerData) {
                // http://www.theregister.co.uk/2013/11/29/feature_diy_apple_ibeacons/
                if (peripheral.manufacturerData.length >= 25) {
                    var proxUuid = peripheral.manufacturerData.slice(4, 20).toString('hex');
                    var major = peripheral.manufacturerData.readUInt16BE(20);
                    var minor = peripheral.manufacturerData.readUInt16BE(22);
                    var measuredPower = peripheral.manufacturerData.readInt8(24);

                    var accuracy = Math.pow(12.0, 1.5 * ((rssi / measuredPower) - 1));
                    var proximity = null;

                    if (accuracy < 0) {
                        proximity = 'unknown';
                    } else if (accuracy < 0.5) {
                        proximity = 'immediate';
                    } else if (accuracy < 4.0) {
                        proximity = 'near';
                    } else {
                        proximity = 'far';
                    }

                    msg.manufacturerUuid = proxUuid;
                    msg.major = major;
                    msg.minor = minor;
                    msg.measuredPower = measuredPower;
                    msg.accuracy = accuracy;
                    msg.proximity = proximity;
                }
            }

            // Generate output event
            //node.send(msg);
        });

        // Take care of starting the scan and sending the status message
        function startScan(stateChange, error) {
            if (!node.scanning) {
                node.scanning = true;
                // send status message
                var msg = {
                    statusUpdate: true,
                    error: error,
                    stateChange: stateChange,
                    state: noble.state
                };
                node.send(msg);
                // start the scan
                //noble.startScanning(node.uuids, node.duplicates);
                noble.startScanning(SERVICE_UUID);
                node.log("Scanning for BLEs started. UUIDs: " + node.uuids + " - Duplicates allowed: " + node.duplicates);
            }
        }

        // Take care of stopping the scan and sending the status message
        function stopScan(stateChange, error) {
            if (node.scanning) {
                node.scanning = false;
                // send status message
                var msg = {
                    statusUpdate: true,
                    error: error,
                    stateChange: stateChange,
                    state: noble.state
                };
                node.send(msg);
                // start the scan
                noble.stopScanning();
                if (error) {
                    node.warn('BLE scanning stopped due to change in adapter state.');
                } else {
                    node.info('BLE scanning stopped.');
                }
            }
        }

        function findForCharacters(characters,Service_UUID){
            for(var index in characters){
                if(characters[index].uuid==Service_UUID){
                    return characters[index];
                    }
                }
        };

        function turnOn(){
        //for(var index in allDevices){

            var chcharacter=findForCharacters(device,CONTROL_UUID);
            controlLight(chcharacter,255,255,255,100);
            //     var command = util.format('%d,%d,%d,%d', red, green, blue, brightness);
            //     for (var j = command.length; j < 18; j++) {
            //       command += ',';
            //     }
            //    chcharacter.write(new Buffer("CLTMP 6500,45,,,,,,%"), false, function(error) {
            //      if(error){console.log(error);}
            //    });

            //CLTMP 6500,45,,,,,,%
            //}
        };

        function turnOff(){
        //for(var index in allDevices){
            var chcharacter=findForCharacters(device,CONTROL_UUID);
            controlLight(chcharacter,null,null,null,0);
            //}
        };

        function controlLight(characteristics,red,green,blue,brightness){
        var command = util.format('%d,%d,%d,%d', red, green, blue, brightness);
            for (var j = command.length; j < 18; j++) {
            command += ',';
            }
            characteristics.write(new Buffer(command), false, function(error) {
            if(error){console.log(error);}
            });
        }

        function changeColor(red,green,blue,brightness){
        //for(var index in allDevices){
            var chcharacter=findForCharacters(device,CONTROL_UUID);
            controlLight(chcharacter,red,green,blue,brightness);
            //})
        }

        function colorFlow(){
        //for(var index in allDevices){
            var chcharacter=findForCharacters(device,COLORFLOW_UUID);
            //controlLight(chcharacter,red,green,blue,brightness);
            //})
            var command = util.format('%d,%d,%d,%d,%d,%d', 0, 0, 255, 0, 100, 1);
            for (var j = command.length; j < 20; j++) {
            command += ',';
            }
            chcharacter.write(new Buffer(command), false, function(error) {
            if(error){console.log(error);}
            });

            command = util.format('%d,%d,%d,%d,%d,%d', 1, 255, 255, 255, 100, 1);
            for (var j = command.length; j < 20; j++) {
            command += ',';
            }
            chcharacter.write(new Buffer(command), false, function(error) {
            if(error){console.log(error);}
            });

            command = util.format('%s', "CB");
            for (var j = command.length; j < 20; j++) {
            command += ',';
            }
            chcharacter.write(new Buffer(command), false, function(error) {
            if(error){console.log(error);}
            });
        }

        // deal with state changes
        noble.on('stateChange', function(state) {
            if (state === 'poweredOn') {
                startScan(true, false);
            } else {
                if (node.scanning) {
                    stopScan(true, true);
                }
            }
        });

        // start initially
        if (noble.state === 'poweredOn') {
            startScan(false, false);
        } else {
            // send status message
            var msg = {
                statusUpdate: true,
                error: true,
                stateChange: false,
                state: noble.state
            };

            // TODO: Catch a global event instead eventually
            setTimeout(function(){
                node.send(msg);
            }, 3000);

            node.warn('Unable to start BLE scan. Adapter state: ' + noble.state);
        }
    
        this.on("close", function() {
            // Called when the node is shutdown - eg on redeploy.
            // Allows ports to be closed, connections dropped etc.
            // eg: this.client.disconnect();
            stopScan(false, false);
        });


	this.on('input', function(msg) {
        node.send(msg);// do something with 'msg'
        if(msg.payload == "on")
            turnOn();
        else if (msg.payload == "off")
            turnOff();
        else if (msg.payload == "red")
            changeColor(255,0,0,100);
        else if (msg.payload == "green")
            changeColor(0,255,0,100);
        else if (msg.payload == "blue")
            changeColor(0,0,255,100);
        else if (msg.payload == "flow")
            colorFlow();


    		
	});


        //noble.on('scanStart', function() {
        //    node.debug("Scan of BLEs started");
        //});
        //
        //noble.on('scanStop', function() {
        //    node.debug("Scan of BLEs stopped");
        //});
    }
    
    // Register the node by name. This must be called before overriding any of the
    // Node functions.
    RED.nodes.registerType("yeelight",Yeelight);

}
