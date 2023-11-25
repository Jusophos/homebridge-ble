import { IsEnum, IsNotEmpty, ValidateNested } from 'class-validator';

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
  address: string;
}