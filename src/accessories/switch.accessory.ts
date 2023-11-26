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
  private readonly characteristic:any;
  private readonly peripheral:any;

  constructor(
    private readonly platform: BleHomebridgePlatform,
    private readonly accessory: PlatformAccessory,
    private readonly device: any,
  ) {

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

    // Bluetooth connection
    this.peripheral = this.device.peripheral;
    this.characteristic = this.device.characteristic;

    // console.log(characteristic);

    this.peripheral.on('disconnect', () => {

      this.platform.log.info(`[${this.accessory.context.config.name}] (by:BLE) -> disconnected`);

    });

    this.peripheral.on('disconnect', () => {

      this.platform.log.info(`[${this.accessory.context.config.name}] (by:BLE) -> connected`);
    });

    this.characteristic.on('data', ((data: any, isNotification: any) => {

      if (!isNotification) {

        return;
      }

      this.service.getCharacteristic(this.platform.Characteristic.On).updateValue(data.readUInt8(0) === 1);

      this.platform.log.info(`[${this.accessory.context.config.name}] (by:BLE) -> ${data.readUInt8(0) === 1 ? 'ON' : 'OFF'}`);

    }).bind(this));



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

    if (!await this._ble_checkForConnection()) { return; }

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
      console.log(status);

    } catch (error) {

      this.platform.log.error(`[${this.accessory.context.config.name}] (by:Homekit) -> [ERROR] could not read from BLE device`);
      this.platform.log.error(error);
      return;
    }

    this.platform.log.debug(`[${this.accessory.context.config.name}] (by:Homekit) -> device read requested: ${status? 'ON' : 'OFF'}]`);

    // if you need to return an error to show the device as "Not Responding" in the Home app:
    // throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);

    return status;
  }

  protected async _ble_checkForConnection(): Promise<boolean> {

    if (this.peripheral.state !== 'connected') {

      this.platform.log.warn(`[${this.accessory.context.config.name}] (by:BLE) -> peripheral not connected, trying to reconnect`);

      if (!await this._ble_connect()) {

        return false;
      }
    }

    return true;
  }

  protected async _ble_connect(): Promise<boolean> {

    try {
      
      await this.peripheral.connectAsync();

      return true;

    } catch (e) {

      this.platform.log.error(`[${this.accessory.context.config.name}] (by:BLE) -> [ERROR] could not connect to BLE device`);
      this.platform.log.error(e);

      return false;
    }
  }

}
