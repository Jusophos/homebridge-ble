import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { validate } from 'class-validator';
import { ConfigModel, ConfigModelAccessoryType } from './config.model';
import { HomebridgeSwitchPlatformAccessory } from './accessories/switch.accessory';

const noble = require('@abandonware/noble');

/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class BleHomebridgePlatform implements DynamicPlatformPlugin {

  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

  public configModel: ConfigModel;

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
      const processPerpheral = (peripheral: any) => {


      };


      noble.on('stateChange', async (state) => {

        if (state === 'poweredOn') {

          await noble.startScanningAsync([], false);
        }
      });
      
      noble.on('discover', async (peripheral) => {

        this.log.info(`${peripheral.address} (${peripheral.advertisement.localName})`);

        if (peripheral && peripheral.advertisement && peripheral.advertisement.serviceUuids && peripheral.advertisement.serviceUuids.length > 0) {

          for (const serviceId of peripheral.advertisement.serviceUuids) {

            for (const accessory of this.configModel.accessories) {

              const processedServiceId = accessory.serviceId.replace(/-/g, '').toLowerCase();

              if (serviceId === processedServiceId) {

                this.log.info(`Found peripheral ([SERVICE-ID: #${accessory.serviceId}]) ${peripheral.address} (${peripheral.advertisement.localName}). Stopping scanning ...`);

                await noble.stopScanningAsync();

                this.log.info(`Scanning stopped.`);

                if (!peripheral.connectable) {

                  this.log.warn(`[WARNING] Peripheral ([SERVICE-ID: #${accessory.serviceId}]) ${peripheral.address} (${peripheral.advertisement.localName}) is not connectable!`);
                  return;
                }

                processPerpheral(peripheral);

              }
            }
          }
        }

        // await noble.stopScanningAsync();
        // await peripheral.connectAsync();
        // const {characteristics} = await peripheral.discoverSomeServicesAndCharacteristicsAsync(['180f'], ['2a19']);
        // const batteryLevel = (await characteristics[0].readAsync())[0];
      
        // this.log.info(`${peripheral.address} (${peripheral.advertisement.localName}): ${batteryLevel}%`);
      
        // await peripheral.disconnectAsync();
        // process.exit(0);
      });

      // noble.startScanningAsync(['180f'], false);

      // run the method to discover / register your devices as accessories
      // this.discoverDevices();
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

    this.log.debug('Discovering devices:', JSON.stringify(this.config));

    for (const accessoryConfig of accessories) {

      const uuid = this.api.hap.uuid.generate(accessoryConfig.serviceId);


      // see if an accessory with the same uuid has already been registered and restored from
      // the cached devices we stored in the `configureAccessory` method above
      const existingAccessory = this.accessories.find(a => a.UUID === uuid);

      if (existingAccessory) {

        this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [existingAccessory]);
        this.log.info('Removing existing accessory from cache:', existingAccessory.displayName);
      }

      // the accessory does not yet exist, so we need to create it
      this.log.info('Adding new accessory:', accessoryConfig.name);

      this.log.info('Adding new accessory:' + ` ${accessoryConfig.name} | ${uuid}`);

      // create a new accessory
      const accessory = new this.api.platformAccessory(accessoryConfig.name, uuid);

      // store a copy of the device object in the `accessory.context`
      // the `context` property can be used to store any data about the accessory you may need
      accessory.context.config = accessoryConfig;

      new HomebridgeSwitchPlatformAccessory(this, accessory)

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
