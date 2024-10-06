import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import { AppService } from './app.service';
import { Response, Request } from 'express';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('/subtitles')
  subtitles(@Query('magnet') magnet: string, @Req() request: Request) {
    return this.appService.subtitles(magnet, request);
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
