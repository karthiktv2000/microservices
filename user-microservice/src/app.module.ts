import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { db_host, db_name } from './config';
import { UserModule } from './user/user.module';

@Module({
  imports: [
    MongooseModule.forRoot(`mongodb://${db_host}/${db_name}`),
    UserModule,
  ],
})
export class AppModule {}
