import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import { AppService } from './app.service';
import { Response, Request } from 'express';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('/files')
  files(@Query('magnet') magnet: string) {
    return this.appService.files(magnet);
  }

  @Get('/stream')
  stream(
    @Query('magnet') magnet: string,
    @Query('filename') filename: string,
    @Res() response: Response,
    @Req() request: Request,
  ) {
    return this.appService.stream(magnet, filename, request, response);
  }
}
