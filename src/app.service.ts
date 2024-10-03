import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Response, Request } from 'express';
import rangeParser from 'range-parser';
import { Readable } from 'stream';

@Injectable()
export class AppService {
  private async Client() {
    const WebTorrent = await import('webtorrent');

    return new WebTorrent.default();
  }

  async files(magnet: string) {
    try {
      const client = await this.Client();

      return new Promise((resolve) => {
        client.add(magnet, (torrent) => {
          const videos = torrent.files.filter((file) =>
            file.name.endsWith('.mp4'),
          );
          resolve(videos.map((file) => file.name));
          client.destroy();
        });
      });
    } catch (error) {
      throw new HttpException(error, HttpStatus.I_AM_A_TEAPOT);
    }
  }

  async stream(
    magnet: string,
    filename: string,
    request: Request,
    response: Response,
  ) {
    try {
      const client = await this.Client();

      client.add(magnet, (torrent) => {
        const file = torrent.files.find((file) => file.name === filename);

        if (!file) {
          throw new HttpException('File not found', HttpStatus.NOT_FOUND);
        }

        response.set({
          Expires: '0',
          'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
          'Accept-Ranges': 'bytes',
          'Content-Type': 'video/mp4',
        });

        const range = rangeParser(file.length, request.headers.range || '');

        if (Array.isArray(range)) {
          response.status(206);

          response.setHeader(
            'Content-Range',
            `bytes ${range[0].start}-${range[0].end}/${file.length}`,
          );

          response.setHeader(
            'Content-Length',
            range[0].end - range[0].start + 1,
          );
        } else {
          response.status(200);

          response.setHeader('Content-Length', file.length);
        }

        const iterator = file[Symbol.asyncIterator](range?.[0]);

        const stream = Readable.from(iterator);

        stream.pipe(response);

        const destroy = () => {
          stream.destroy();
          client.destroy();
        };

        request.on('close', destroy);
        request.on('end', destroy);

        return response;
      });
    } catch (error) {
      throw new HttpException(error, HttpStatus.I_AM_A_TEAPOT);
    }
  }
}
