import { Controller, Get, Query, Req, Res } from '@nestjs/common';

import { Response, Request } from 'express';

import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('/subtitles')
  subtitles(@Query('magnet') magnet: string) {
    return this.appService.subtitles(magnet);
  }

  @Get('/stream')
  stream(
    @Query('magnet') magnet: string,
    @Res() response: Response,
    @Req() request: Request,
  ) {
    return this.appService.stream(magnet, request, response);
  }
}
