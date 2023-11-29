import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { BleHomebridgePlatform } from '../platform';


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
    this.peripheral.on('disconnect', () => {

      this.platform.log.info(`[${this.accessory.context.config.name}] (by:BLE) -> disconnected. Trying to reconnect every 10 seconds ...`);

      if (this.reconnectInterval !== null) {

        clearInterval(this.reconnectInterval);
        this.reconnectInterval = null;
      }

      this.reconnectInterval = setInterval(async () => {

        if (await this._ble_connect()) {

          clearInterval(this.reconnectInterval);
          this.reconnectInterval = null;
        }

      }, 10000);
    });

    this.peripheral.on('connect', async () => {

      if (this.peripheral.state !== 'connected') {
        
        return;
      }
      
      this.platform.log.info(`[${this.accessory.context.config.name}] (by:BLE) -> connected`);

      if (this.reconnectInterval !== null) {

        clearInterval(this.reconnectInterval);
        this.reconnectInterval = null;
      }

      await this._ble_initialize();
    });

    this._ble_connect().then(async () => {

      // await this._ble_initialize();
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

      await this.characteristic.writeAsync(data, false);
      

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
    
      const data = await this.characteristic.readAsync();
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

  async onData(data: any, isNotification: any) {

    if (!isNotification) {

      return;
    }

    this.service.getCharacteristic(this.platform.Characteristic.On).updateValue(data.readUInt8(0) === 1);

    this.platform.log.info(`[${this.accessory.context.config.name}] (by:BLE) -> ${data.readUInt8(0) === 1 ? 'ON' : 'OFF'}`);
  }

  protected async _ble_checkForConnection(): Promise<boolean> {

    if (this.peripheral.state !== 'connected') {

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

      if (this.peripheral.state === 'connected') {

        this.platform.log.debug(`[${this.accessory.context.config.name}] (by:BLE) -> connection already established.`);

        return true;
      }

      await this.peripheral.cancelConnect();

      if (this.peripheral.state === 'connecting') {

        this.platform.log.debug(`[${this.accessory.context.config.name}] (by:BLE) -> already trying to connect ...`);

        return false;
      }

      await this.peripheral.connectAsync();

      return true;

    } catch (e) {

      this.platform.log.debug(`[${this.accessory.context.config.name}] (by:BLE) -> [ERROR] could not connect to BLE device`);
      // this.platform.log.debug(e);

      if (this.reconnectInterval === null) {

        this.reconnectInterval = setInterval(async () => {

          if (await this._ble_connect()) {

            clearInterval(this.reconnectInterval);
            this.reconnectInterval = null;
          }

        }, 10000);
      }

      return false;
    }
  }

  protected async _ble_initialize(): Promise<boolean> {

    // HERE WE NEED TO DISCOVER THE CHARACTERISTIC
    if (this.characteristic !== null) {

      this.characteristic.unsubscribe();
      this.characteristic.removeAllListeners();
    }

    this.characteristic = null;
    let characteristic = null;

    this.platform.log.debug(`[${this.accessory.context.config.name}] (by:BLE) -> discovering services ...`);

    try {
    
      const {characteristics} = await this.peripheral.discoverSomeServicesAndCharacteristicsAsync([]);

      if (!characteristics || characteristics.length === 0) {

        this.platform.log.warn(`[${this.accessory.context.config.name}] (by:BLE) -> no characteristics found!`);
        return;
      }

      for (const c of characteristics) {

        const compareCharacteristicId = this.accessory.context.config.characteristicId.replace(/-/g, '').toLowerCase();

        if (compareCharacteristicId === c.uuid) {

          characteristic = c;
          this.platform.log.info(`[${this.accessory.context.config.name}] (by:BLE) -> characteristic found: #${this.accessory.context.config.serviceId}`);
          break;
        }
      }

      if (!characteristic) {

        this.platform.log.warn(`[${this.accessory.context.config.name}] (by:BLE) -> registered characteristic NOT found. Your config says id: #${this.accessory.context.config.serviceId}!`);
        return;
      }

    } catch (error) {

      this.platform.log.error(`[${this.accessory.context.config.name}] (by:BLE) -> error while discovering services:`);
      this.platform.log.error(error);
      return;
    }

    characteristic.unsubscribe((e) => {

      console.log(e);
    });

    characteristic.subscribe((error: any) => { 

      if (error !== null) {

        this.platform.log.error(`[${this.accessory.context.config.name}] (by:BLE) -> error while subscribing to characteristic: ${this.accessory.context.config.characteristicId}: `);
        this.platform.log.error(error);
      }

      this.platform.log.debug(`[${this.accessory.context.config.name}] (by:BLE) -> binding event handlers`);
      this.platform.log.info(`[${this.accessory.context.config.name}] (by:BLE) -> connection successfully established.`);
    });


    characteristic.on('data', this.onData.bind(this));

    this.platform.log.debug(`[${this.accessory.context.config.name}] (by:BLE) -> RDY?`);

    this.characteristic = characteristic;
  }

}
