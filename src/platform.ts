import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { validate } from 'class-validator';
import { ConfigModel, ConfigModelAccessory, ConfigModelAccessoryType } from './config.model';
import { HomebridgeSwitchPlatformAccessory } from './accessories/switch.accessory';

const {createBluetooth} = require('node-ble')

/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class BleHomebridgePlatform implements DynamicPlatformPlugin {

  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

  public configModel: ConfigModel;
  public bleDevices: any[] = [];

  // this is used to track restored cached accessories
  public readonly accessories: PlatformAccessory[] = [];

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.log.debug('Finished initializing platform:', this.config.name);

    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    // Dynamic Platform plugins should only register new accessories after this event was fired,
    // in order to ensure they weren't added to homebridge already. This event can also be used
    // to start discovery of new accessories.
    this.api.on('didFinishLaunching', async () => {

      log.debug('Executed didFinishLaunching callback');

      // -----------------------------------------------------------------------
      // Initialize and validate config
      this.configModel = {...new ConfigModel, ...this.config};

      const errors = await validate(this.configModel);

      if (errors.length > 0) {

        this.log.error('Config validation failed');
        this.log.error(JSON.stringify(errors));
        return;
      }

      // -----------------------------------------------------------------------
      // Bluetooth
      const processPerpheral = async (peripheral: any, accessory: ConfigModelAccessory) => {

        // this.log.debug(`[CONNECTING] ble device ([SERVICE-ID: #${peripheral.advertisement.serviceUuids[0]}]) ${peripheral.address} (${peripheral.advertisement.localName}) ...`);


        this.bleDevices.push({

          accessory,
          peripheral,
        });
      };

      const {bluetooth, destroy} = createBluetooth();

      const adapter = await bluetooth.defaultAdapter();

      if (! await adapter.isDiscovering())
        await adapter.startDiscovery()

      for (const accessory of this.configModel.accessories) {

        const peripheral = await adapter.waitDevice(accessory.deviceId);

        this.log.debug(`[FOUND] ble device: ${accessory.deviceId}`);

        await processPerpheral(peripheral, accessory);

        this.discoverDevices();
      }
    });
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to setup event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);

    // add the restored accessory to the accessories cache so we can track if it has already been registered
    this.accessories.push(accessory);
  }

  /**
   * This is an example method showing how to register discovered accessories.
   * Accessories must only be registered once, previously created accessories
   * must not be registered again to prevent "duplicate UUID" errors.
   */
  discoverDevices() {

    const accessories = this.configModel.accessories;

    // this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, this.accessories);
    // return;


    for (const accessoryConfig of accessories) {

      const uuid = this.api.hap.uuid.generate(accessoryConfig.serviceId);


      // see if an accessory with the same uuid has already been registered and restored from
      // the cached devices we stored in the `configureAccessory` method above
      const existingAccessory = this.accessories.find(a => a.UUID === uuid);

      console.log(this.bleDevices.find(d => d.accessory.serviceId === accessoryConfig.serviceId));


      if (existingAccessory) {

        this.log.info('Loading existing accessory from cache:', existingAccessory.displayName);
        // this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [existingAccessory]);
        new HomebridgeSwitchPlatformAccessory(this, existingAccessory, this.bleDevices.find(d => d.accessory.serviceId === accessoryConfig.serviceId));

      } else {

        // the accessory does not yet exist, so we need to create it
        this.log.info('Adding new accessory:' + ` ${accessoryConfig.name} | ${uuid}`);

        // create a new accessory
        const accessory = new this.api.platformAccessory(accessoryConfig.name, uuid);

        // store a copy of the device object in the `accessory.context`
        // the `context` property can be used to store any data about the accessory you may need
        accessory.context.config = accessoryConfig;

        new HomebridgeSwitchPlatformAccessory(this, accessory, this.bleDevices.find(d => d.accessory.serviceId === accessoryConfig.serviceId));

        // create the accessory handler for the newly create accessory
        // this is imported from `platformAccessory.ts`
        // switch (accessoryConfig.type) {

        //   case ConfigModelAccessoryType.switch: console.log('LOVE 2');  new HomebridgeSwitchPlatformAccessory(this, existingAccessory); break;
        // }

        // link the accessory to your platform
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      }
    }
  }
}
