import { IsEnum, IsNotEmpty, IsOptional, Min, ValidateNested } from 'class-validator';

export enum ConfigModelAccessoryType {
  
  'switch' = 'switch',
}

export class ConfigModel {

  @ValidateNested({ each: true })
  accessories: ConfigModelAccessory[] = [];
}

export class ConfigModelAccessory {

  @IsNotEmpty()
  name: string;

  @IsEnum(ConfigModelAccessoryType)
  type: ConfigModelAccessoryType;

  @IsNotEmpty()
  deviceId: string;

  @IsNotEmpty()
  serviceId: string;

  @IsNotEmpty()
  characteristicId: string;

  @IsOptional()
  @Min(1000)
  intervalForUpdating: number;
}