import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthenticatedUser } from './auth.types';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { Cookies } from './decorators/cookies.decorator';

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    const user = await this.authService.register(dto);
    return { user };
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto, {});
    res.cookie('refresh_token', result.refreshToken, REFRESH_COOKIE_OPTIONS);
    return { accessToken: result.accessToken, user: result.user };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Cookies() cookies: { refresh_token: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.refresh(cookies.refresh_token);
    res.cookie('refresh_token', result.refreshToken, REFRESH_COOKIE_OPTIONS);
    return { accessToken: result.accessToken, user: result.user };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('refresh_token');
    return { message: 'Logged out successfully' };
  }

  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return { user };
  }
}
