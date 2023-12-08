import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { BleHomebridgePlatform } from '../platform';

import { noble } from '../noble';

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class HomebridgeSwitchPlatformAccessory {
  private service: Service;

  /**
   * These are just used to create a working example
   * You should implement your own code to track the state of your accessory
   */
  private characteristic:any = null;
  private peripheral:any = null;

  protected reconnectInterval: NodeJS.Timeout = null;
  protected updateInterval: NodeJS.Timeout = null;

  constructor(
    private readonly platform: BleHomebridgePlatform,
    private readonly accessory: PlatformAccessory,
    private readonly device: any,
  ) {

    this.platform.log.debug(`[${this.accessory.context.config.name}] (by:Homekit) -> initializing switch ...`);

    // set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Default-Manufacturer')
      .setCharacteristic(this.platform.Characteristic.Model, 'Default-Model')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, 'Default-Serial');

    // get the LightBulb service if it exists, otherwise create a new LightBulb service
    // you can create multiple services for each accessory
    this.service = this.accessory.getService(this.platform.Service.Switch) || this.accessory.addService(this.platform.Service.Switch);

    // set the service name, this is what is displayed as the default name on the Home app
    // in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
    
    

    this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.config.name);

    this.peripheral = device.peripheral;

    // console.log(this.peripheral);

    this.platform.log.debug(`[${this.accessory.context.config.name}] (by:BLE) -> adding listener for disconnect ...`);
    this.peripheral.on('disconnect', this._ble_onDisconnect.bind(this));  
    // this.peripheral.on('disconnect', async () => {

    //   this.platform.log.info(`[${this.accessory.context.config.name}] (by:BLE) -> disconnected. Trying to reconnect ...`);

    //   setTimeout((async () => {

    //     await this._ble_connect();

    //   }).bind(this), 3000);
    // });

    // this.peripheral.on('connect', async () => {

    //   if (!await this.peripheral.isConnected()) {
        
    //     return;
    //   }
      
    //   this.platform.log.info(`[${this.accessory.context.config.name}] (by:BLE) -> connected`);

    //   if (this.reconnectInterval !== null) {

    //     clearTimeout(this.reconnectInterval);
    //     this.reconnectInterval = null;
    //   }

    //   // await this._ble_initialize();
    // });

    this._ble_connect().then(async () => {

      await this._ble_initialize();
    });

    // register handlers for the On/Off Characteristic
    this.service.getCharacteristic(this.platform.Characteristic.On)
      .onSet(this.setOn.bind(this))                // SET - bind to the `setOn` method below
      .onGet(this.getOn.bind(this));               // GET - bind to the `getOn` method below
  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, turning on a Light bulb.
   */
  async setOn(value: CharacteristicValue) {
    // implement your own code to turn your device on/off
    const status = value as boolean;

    this.platform.log.info(`[${this.accessory.context.config.name}] (by:Homekit) -> ${status? 'ON' : 'OFF'}`);

    if (!await this._ble_checkForConnection()) { 
     
      return;
    }

    try {

      const data = Buffer.alloc(1);
      data.writeUInt8(status ? 1 : 0, 0);      
      
      this.platform.log.debug(`[${this.accessory.context.config.name}] (by:BLE) -> writing to BLE device (${data}) ...`);

      await this.characteristic.writeValue(data);

      this.platform.log.debug(`[${this.accessory.context.config.name}] (by:BLE) -> written!`);

      const readData = await this.characteristic.readValue();
      const s = readData.readUInt8(0) === 1;

      this.platform.log.debug(`[${this.accessory.context.config.name}] (by:BLE) -> read: ${s? 'ON' : 'OFF'}`);
      
      

    } catch (error) {

      this.platform.log.error(`[${this.accessory.context.config.name}] (by:Homekit) -> [ERROR] could not write to BLE device`);
      this.platform.log.error(error);
      return;
    }    
  }

  /**
   * Handle the "GET" requests from HomeKit
   * These are sent when HomeKit wants to know the current state of the accessory, for example, checking if a Light bulb is on.
   *
   * GET requests should return as fast as possbile. A long delay here will result in
   * HomeKit being unresponsive and a bad user experience in general.
   *
   * If your device takes time to respond you should update the status of your device
   * asynchronously instead using the `updateCharacteristic` method instead.

   * @example
   * this.service.updateCharacteristic(this.platform.Characteristic.On, true)
   */
  async getOn(): Promise<CharacteristicValue> {

    let status = false;

    if (!await this._ble_checkForConnection()) { return false; }

    try {
    
      const data = await this.characteristic.readValue();
      const status = data.readUInt8(0) === 1;

    } catch (error) {

      this.platform.log.error(`[${this.accessory.context.config.name}] (by:Homekit) -> [ERROR] could not read from BLE device`);
      this.platform.log.error(error);
      return;
    }

    this.platform.log.debug(`[${this.accessory.context.config.name}] (by:Homekit) -> device read requested. Status: ${status? 'ON' : 'OFF'}`);

    // if you need to return an error to show the device as "Not Responding" in the Home app:
    // throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);

    return status;
  }

  async onData(data: any) {

    this.service.getCharacteristic(this.platform.Characteristic.On).updateValue(data.readUInt8(0) === 1);

    this.platform.log.info(`[${this.accessory.context.config.name}] (by:BLE) -> ${data.readUInt8(0) === 1 ? 'ON' : 'OFF'}`);
  }

  protected async _ble_checkForConnection(): Promise<boolean> {

    if (!this.peripheral || !await this.peripheral.isConnected()) {

      this.platform.log.warn(`[${this.accessory.context.config.name}] (by:BLE) -> peripheral not connected. Could not perform any action.`);

      return false;
    }

    if (this.characteristic === null) {

      this.platform.log.warn(`[${this.accessory.context.config.name}] (by:BLE) -> characteristic not found. Could not perform any action.`);

      return false;
    }

    return true;
  }

  protected async _ble_connect(): Promise<boolean> {

    this.platform.log.debug(`[${this.accessory.context.config.name}] (by:BLE) trying to connect ...`);

    try {

      if (await this.peripheral.isConnected()) {

        this.platform.log.debug(`[${this.accessory.context.config.name}] (by:BLE) -> connection already established.`);

        return true;
      }

      // if (this.peripheral.state === 'connecting') {

      //   this.platform.log.debug(`[${this.accessory.context.config.name}] (by:BLE) -> already trying to connect ...`);

      //   return false;
      // }

      await this.peripheral.connect();

      this.platform.log.info(`[${this.accessory.context.config.name}] (by:BLE) -> connected`);

      return true;

    } catch (e) {

      this.platform.log.debug(`[${this.accessory.context.config.name}] (by:BLE) -> [ERROR] could not connect to BLE device. Retry in 10 seconds.`);
      this.platform.log.debug(e);

      if (this.reconnectInterval === null) {

        this.reconnectInterval = setTimeout(async () => {

          if (await this._ble_connect()) {

            clearTimeout(this.reconnectInterval);
            this.reconnectInterval = null;
          }

        }, 10000);
      }

      return false;
    }
  }

  protected async _ble_onDisconnect() {

    this.platform.log.info(`[${this.accessory.context.config.name}] (by:BLE) -> disconnected. Trying to reconnect ...`);

    setTimeout((async () => {

      await this._ble_connect();

    }).bind(this), 3000);
  }

  protected async _ble_initialize(): Promise<boolean> {

    // HERE WE NEED TO DISCOVER THE CHARACTERISTIC
    if (this.characteristic !== null) {

      // await this.characteristic.stopNotifications();
      this.characteristic = null;
    }

    this.characteristic = null;
    let characteristic = null;

    this.platform.log.debug(`[${this.accessory.context.config.name}] (by:BLE) -> discovering services ...`);

    try {
    
      const gattServer = await this.peripheral.gatt();


      const service = await gattServer.getPrimaryService(this.accessory.context.config.serviceId.toLowerCase())
      characteristic = await service.getCharacteristic(this.accessory.context.config.characteristicId.toLowerCase())

      if (!characteristic) {

        this.platform.log.warn(`[${this.accessory.context.config.name}] (by:BLE) -> registered characteristic NOT found. Your config says id: #${this.accessory.context.config.serviceId}!`);
        return;
      }

    } catch (error) {

      this.platform.log.error(`[${this.accessory.context.config.name}] (by:BLE) -> error while discovering services:`);
      this.platform.log.error(error);
      return;
    }

    // characteristic.unsubscribe((e) => {

    //   console.log(e);
    // });

    // console.log(this.accessory.context.config);

    if (this.accessory.context.config.intervalForUpdating !== null && this.accessory.context.config.intervalForUpdating > 999) {

      this.platform.log.warn(`[${this.accessory.context.config.name}] (by:BLE) -> you are using update interval instead of notifications. This is not recommended! Interval: ${this.accessory.context.config.intervalForUpdating}ms`);

      this.updateInterval = setInterval(async () => {

        const data = await this.characteristic.readValue();

        this.onData(data);

      }, this.accessory.context.config.intervalForUpdating);

    } else {

      await characteristic.startNotifications();
      characteristic.on('valuechanged', this.onData.bind(this));
    }

    // this.platform.log.debug(`[${this.accessory.context.config.name}] (by:BLE) -> RDY?`);

    this.characteristic = characteristic;
  }
}
