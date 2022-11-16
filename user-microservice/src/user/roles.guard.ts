import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY, Roles } from './entities/roles.decorator';
import { JwtService } from '@nestjs/jwt';
import { HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { userDocument } from './user.schema';
import { Model } from 'mongoose';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    @InjectModel('User')
    private readonly userModel: Model<userDocument>,
    private reflector: Reflector,
    private jwtService: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles) {
      return true;
    }
    try {
      const checkDb = await this.userModel.find();
      if (checkDb.length == 0) return true;
      const request = context.switchToHttp().getRequest();
      if (request.cookies['userlogoutcookie'] === undefined) {
        throw new HttpException('Admin login again  ', HttpStatus.UNAUTHORIZED);
      }
      const verify = this.jwtService.verify(request.cookies.userlogoutcookie);
      if (!verify) {
        throw new HttpException(
          'Unauthorized admin User error ',
          HttpStatus.UNAUTHORIZED,
        );
      }
      return requiredRoles.some((role) => verify.role?.includes(role));
    } catch (error) {
      throw new HttpException(error.message, error.status);
    }
  }
}
