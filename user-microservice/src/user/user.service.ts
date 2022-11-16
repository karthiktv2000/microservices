import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { user, UserDesignation, userDocument } from './user.schema';
import * as bcrypt from 'bcrypt';
import { UserDto } from './dto/user.dto';
import { loginDto } from './dto/login.dto';
import { UpdateDto } from './dto/update.dto';
import { EmployeeDto } from './dto/employee.dto';
import { randomBytes } from 'crypto';
import { forgotDto } from './dto/forgot.dto';
import { resetDto } from './dto/reset.dto';
import { ClientProxy } from '@nestjs/microservices';
import { leaveDto } from './dto/leave.dto';
import { map } from 'rxjs';
const userProjection = {
  __v: false,
  _id: false,
  approveLink: false,
  rejectLink: false,
};

@Injectable()
export class UserService {
  constructor(
    @InjectModel('User')
    private readonly userModel: Model<userDocument>,
    private jwtService: JwtService,
    @Inject('LEAVE') private readonly leaveClient: ClientProxy,
  ) {}

  functionVerify = async (token: string | undefined) => {
    try {
      if (token === undefined) {
        throw new HttpException('Please Login Again ', HttpStatus.NOT_FOUND);
      }
      const verifyUser = await this.jwtService.verify(token);
      if (!verifyUser) {
        throw new HttpException(
          'Unauthorized  User error ',
          HttpStatus.UNAUTHORIZED,
        );
      }
      return verifyUser;
    } catch (error) {
      throw new HttpException(error.message, error.status);
    }
  };

  async signup(userDto: UserDto): Promise<UserDto> {
    try {
      const designationKey = Object.keys(UserDesignation).find(
        (key) => key === userDto.designation,
      );
      if (designationKey === undefined) {
        throw new HttpException('Designation Not Found', HttpStatus.NOT_FOUND);
      }
      const existingUser = await this.userModel.findOne({
        email: userDto.email,
      });
      if (existingUser) {
        throw new HttpException('Email already taken', HttpStatus.CONFLICT);
      }
      const createdUser = new this.userModel(userDto);
      const salt = await bcrypt.genSalt();
      createdUser.password = await bcrypt.hash(createdUser.password, salt);
      createdUser.designation = UserDesignation[userDto.designation];
      return await createdUser.save();
    } catch (error) {
      throw new HttpException(error.message, error.status);
    }
  }

  async signin(req, userDto: loginDto, res): Promise<string> {
    try {
      if (req.cookies['userlogoutcookie'] !== undefined) {
        const checkAlredySignin = await this.functionVerify(
          req.cookies['userlogoutcookie'],
        );
        if (checkAlredySignin.Email === userDto.email) {
          throw new HttpException(
            'You are already signed In',
            HttpStatus.FORBIDDEN,
          );
        }
      }
      const checkUser = await this.userModel.findOne({
        email: userDto.email,
      });
      if (!checkUser) {
        throw new HttpException(
          'Incorrect Email',
          HttpStatus.NON_AUTHORITATIVE_INFORMATION,
        );
      }
      if (checkUser.status == false) {
        throw new HttpException('Employee Not found', HttpStatus.NOT_FOUND);
      }
      const passwordCheck = await bcrypt.compare(
        userDto.password,
        checkUser.password,
      );
      if (!passwordCheck) {
        throw new HttpException('Incorrect Password', HttpStatus.BAD_REQUEST);
      }
      const token = this.generateJwt(
        checkUser.userId,
        checkUser.name,
        checkUser.email,
        checkUser.role,
      );
      res.cookie('userlogoutcookie', token);
      return token;
    } catch (error) {
      throw new HttpException(error.message, error.status);
    }
  }
  generateJwt(userId: string, name: string, email: string, role: string[]) {
    return this.jwtService.sign({
      userId: userId,
      Name: name,
      Email: email,
      role: role,
    });
  }

  public async signout(req, res): Promise<void> {
    try {
      if (req.cookies['userlogoutcookie'] === undefined) {
        throw new HttpException(
          'You are already signed out',
          HttpStatus.FORBIDDEN,
        );
      }
      res.clearCookie('userlogoutcookie');
      res.end('User signed out successfully');
    } catch (error) {
      throw new HttpException(error.message, error.status);
    }
  }

  async getEmployee(req): Promise<user[]> {
    try {
      await this.functionVerify(req.cookies['userlogoutcookie']);
      return this.userModel.find().exec();
    } catch (error) {
      throw new HttpException(error.message, error.status);
    }
  }

  async getEmployeeByEmail(req, res, Email: string) {
    try {
      await this.functionVerify(req.cookies['userlogoutcookie']);
      return this.userModel.findOne({ email: Email }).exec();
    } catch (error) {
      throw new HttpException(error.message, error.status);
    }
  }

  async updateEmployee(
    req,
    res,
    Email: string,
    userDto: UpdateDto,
  ): Promise<void> {
    try {
      if (userDto.designation) {
        const designationKey = Object.keys(UserDesignation).find(
          (key) => key === userDto.designation,
        );
        if (designationKey === undefined) {
          throw new HttpException(
            'Designation Not Found',
            HttpStatus.NOT_FOUND,
          );
        }
      }
      await this.functionVerify(req.cookies['userlogoutcookie']);
      const existUser = await this.userModel.findOneAndUpdate(
        { email: Email },
        {
          userId: userDto.userId,
          name: userDto.name,
          phonenumber: userDto.phonenumber,
          salary: userDto.salary,
          designation: UserDesignation[userDto.designation],
          address: userDto.address,
          availableLeaves: userDto.availableLeaves,
        },
      );
      if (!existUser) {
        throw new HttpException(
          'Invalid User Email',
          HttpStatus.NON_AUTHORITATIVE_INFORMATION,
        );
      }
    } catch (error) {
      throw new HttpException(error.message, error.status);
    }
  }

  async updateOwnInfo(req, res, employeeDto: EmployeeDto): Promise<void> {
    try {
      const verifyUser = await this.functionVerify(
        req.cookies['userlogoutcookie'],
      );
      const existUser = await this.userModel.findOneAndUpdate(
        { email: verifyUser.Email },
        {
          name: employeeDto.name,
          phonenumber: employeeDto.phonenumber,
          address: employeeDto.address,
        },
      );
      if (!existUser) {
        throw new HttpException('Invalid User Email', HttpStatus.NOT_FOUND);
      }
    } catch (error) {
      throw new HttpException(error.message, error.status);
    }
  }

  async viewOwnDetails(req, res): Promise<void> {
    try {
      const verifyUser = await this.functionVerify(
        req.cookies['userlogoutcookie'],
      );
      const existUser = await this.userModel
        .find(
          {
            email: verifyUser.Email,
          },
          userProjection,
        )
        .exec();
      if (!existUser) {
        throw new HttpException('Invalid User ', HttpStatus.NOT_FOUND);
      }
      res.status(HttpStatus.OK).json({
        message: `Details of user with status ${verifyUser.Email}`,
        result: existUser,
      });
    } catch (error) {
      throw new HttpException(error.message, error.status);
    }
  }

  public async forgotPassword(body: forgotDto, req, res): Promise<void> {
    try {
      const user = await this.userModel.findOne({ email: body.email });
      if (!user) {
        res.status(HttpStatus.NOT_FOUND).send('Email not found');
      }
      const salt = await bcrypt.genSalt();
      const resetHash = await bcrypt.hash(
        randomBytes(32).toString('hex'),
        salt,
      );
      await this.userModel.updateOne(
        { email: body.email },
        { resetToken: resetHash },
      );
      res.json({
        link: `http://localhost:3000/user/reset-password?resetId=${resetHash}`,
      });
    } catch (error) {
      throw new HttpException(error.message, error.status);
    }
  }

  public async resetPassword(body: resetDto, req, res, query): Promise<void> {
    try {
      this.userModel.findOne(
        { resetToken: query.resetId },
        async (error, data) => {
          if (error) throw error;
          const salt = await bcrypt.genSalt();
          const newPassword = await bcrypt.hash(body.password, salt);
          await this.userModel.updateOne(
            { resetToken: query.resetId },
            { password: newPassword, resetToken: 0 },
          );
          res.json({ message: 'password updated successfuly login again' });
        },
      );
    } catch (error) {
      throw new HttpException(error.message, error.status);
    }
  }

  async deactivateEmployee(Email: string, req): Promise<user> {
    try {
      await this.functionVerify(req.cookies['userlogoutcookie']);
      const existUser = await this.userModel.findOne({ email: Email });
      if (!existUser) {
        throw new HttpException('Invalid User Email ', HttpStatus.NOT_FOUND);
      }
      if (existUser.status === false) {
        throw new HttpException(
          'Account is already deactivated ',
          HttpStatus.FORBIDDEN,
        );
      }
      existUser.status = false;
      existUser.save();

      return existUser;
    } catch (error) {
      throw new HttpException(error.message, error.status);
    }
  }

  async activateEmployee(Email: string, req): Promise<user> {
    try {
      await this.functionVerify(req.cookies['userlogoutcookie']);
      const existUser = await this.userModel.findOne({ email: Email });
      if (!existUser) {
        throw new HttpException('Invalid User Email ', HttpStatus.NOT_FOUND);
      }
      if (existUser.status === true) {
        throw new HttpException(
          'Account is already active ',
          HttpStatus.FORBIDDEN,
        );
      }
      existUser.status = true;
      existUser.save();

      return existUser;
    } catch (error) {
      throw new HttpException(error.message, error.status);
    }
  }

  async applyLeave(req, leaveDto: leaveDto): Promise<any> {
    try {
      const verifyUser = await this.functionVerify(
        req.cookies['userlogoutcookie'],
      );
      if ('status' in leaveDto) {
        throw new HttpException(
          ' `Status` access in forbidden',
          HttpStatus.FORBIDDEN,
        );
      }
      const user = await this.userModel
        .findOne({ email: verifyUser.Email })
        .exec();
      if (
        !new Date(leaveDto.leaveDate).getTime() ||
        leaveDto.leaveDate.length < 10
      ) {
        throw new HttpException(
          ' `leaveDate` must be in the format yyyy-mm-dd',
          HttpStatus.BAD_REQUEST,
        );
      }
      const newDate = new Date(leaveDto.leaveDate);
      if (newDate.getTime() < Date.now() || user.availableLeaves < 1) {
        throw new HttpException(
          'Cannot apply leave for older dates or No leaves available',
          HttpStatus.NOT_ACCEPTABLE,
        );
      }
      const pattern = { cmd: 'applyLeave' };
      const payload = {
        email: verifyUser.Email,
        leaveDate: leaveDto.leaveDate,
      };
      //   return this.leaveClient.send(pattern, payload);
      return this.leaveClient.send(pattern, payload).pipe(
        map((output: any) => {
          if (output.status !== HttpStatus.OK) {
            throw new HttpException(output.message, output.status);
          } else {
            return {
              status: output.status,
              message: output.message,
            };
          }
        }),
      );
    } catch (error) {
      throw new HttpException(error.message, error.status);
    }
  }

  async checkEmployeeLeave(req): Promise<any> {
    try {
      await this.functionVerify(req.cookies['userlogoutcookie']);
      const pattern = { cmd: 'checkEmployeeLeave' };
      const payload = {};
      const dummy = this.leaveClient.send(pattern, payload);
      return dummy;

      //   return this.leaveModel.find({}, userProjection).exec();
    } catch (error) {
      throw new HttpException(error.message, error.status);
    }
  }

  async viewOwnLeave(req): Promise<any> {
    try {
      const verifyUser = await this.functionVerify(
        req.cookies['userlogoutcookie'],
      );
      const pattern = { cmd: 'viewOwnLeave' };
      const payload = { email: verifyUser.Email };
      return this.leaveClient.send<string>(pattern, payload).pipe(
        map((output: any) => {
          if (output.status !== HttpStatus.OK) {
            throw new HttpException(output.message, output.status);
          } else {
            return {
              status: output.status,
              message: output.message,
              result: output.result,
            };
          }
        }),
      );
    } catch (error) {
      throw new HttpException(error.message, error.status);
    }
  }

  async viewEmployeePendingLeaveByEmail(req, Email): Promise<any> {
    try {
      await this.functionVerify(req.cookies['userlogoutcookie']);
      const pattern = { cmd: 'viewEmployeePendingLeaveByEmail' };
      const payload = { email: Email };
      return this.leaveClient.send<string>(pattern, payload).pipe(
        map((output: any) => {
          if (output.status !== HttpStatus.OK) {
            throw new HttpException(output.message, output.status);
          } else {
            return {
              status: output.status,
              message: output.message,
              result: output.result,
            };
          }
        }),
      );
    } catch (error) {
      throw new HttpException(error.message, error.status);
    }
  }

  async viewEmployeePendingLeave(req, Status: string): Promise<any> {
    try {
      await this.functionVerify(req.cookies['userlogoutcookie']);
      const pattern = { cmd: 'viewEmployeePendingLeave' };
      const payload = { status: Status };
      return this.leaveClient.send<string>(pattern, payload).pipe(
        map((output: any) => {
          if (output.status !== HttpStatus.OK) {
            throw new HttpException(output.message, output.status);
          } else {
            return {
              status: output.status,
              message: output.message,
              result: output.result,
            };
          }
        }),
      );
    } catch (error) {
      throw new HttpException(error.message, error.status);
    }
  }

  async approveEmployeeLeaves(Email: string, date: string, req): Promise<any> {
    try {
      await this.functionVerify(req.cookies['userlogoutcookie']);
      const emp = await this.userModel.findOne({
        email: Email,
      });
      const pattern = { cmd: 'approveEmployeeLeaves' };
      const payload = { email: Email, date: date };

      return this.leaveClient.send<string>(pattern, payload).pipe(
        map((output: any) => {
          if (output.status === HttpStatus.OK) {
            emp.availableLeaves = emp.availableLeaves - 1;
            emp.save();
            return {
              status: output.status,
              message: output.message,
            };
          } else {
            throw new HttpException(output.message, output.status);
          }
        }),
      );
    } catch (error) {
      throw new HttpException(error.message, error.status);
    }
  }

  async rejectEmployeeLeaves(Email: string, date: string, req): Promise<any> {
    try {
      await this.functionVerify(req.cookies['userlogoutcookie']);
      const pattern = { cmd: 'rejectEmployeeLeaves' };
      const payload = { email: Email, date: date };

      return this.leaveClient.send<string>(pattern, payload).pipe(
        map((output: any) => {
          if (output.status === HttpStatus.OK) {
            return {
              status: output.status,
              message: output.message,
            };
          } else {
            throw new HttpException(output.message, output.status);
          }
        }),
      );
    } catch (error) {
      throw new HttpException(error.message, error.status);
    }
  }
}
