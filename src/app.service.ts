import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { parse, stringify } from 'subtitle';
import { Response, Request } from 'express';
import rangeParser from 'range-parser';
import { Readable } from 'stream';

@Injectable()
export class AppService {
  private async Client() {
    const WebTorrent = await import('webtorrent');

    return new WebTorrent.default({ utp: false });
  }

  async convertSrtStreamToVtt({
    stream,
    name,
  }: {
    stream: NodeJS.ReadableStream;
    name: string;
  }): Promise<{ name: string; content: string }> {
    const chunks: Buffer[] = [];

    return new Promise((resolve, reject) =>
      stream
        .pipe(parse())
        .pipe(stringify({ format: 'WebVTT' }))
        .on('data', (chunk) =>
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)),
        )
        .on('end', () =>
          resolve({ content: Buffer.concat(chunks).toString('utf8'), name }),
        )
        .on('error', reject),
    );
  }

  async convertSrtStreamsToVttList(
    files: { stream: NodeJS.ReadableStream; name: string }[],
  ): Promise<{ name: string; content: string }[]> {
    const vttList: { name: string; content: string }[] = [];

    for (const file of files) {
      try {
        vttList.push(await this.convertSrtStreamToVtt(file));
      } catch (error) {
        throw new HttpException(error, HttpStatus.I_AM_A_TEAPOT);
      }
    }

    return vttList;
  }

  async subtitles(magnet: string) {
    try {
      const client = await this.Client();

      return new Promise((resolve) => {
        client.add(
          magnet,
          { storeCacheSlots: 0, destroyStoreOnDestroy: true },
          (torrent) => {
            resolve(
              this.convertSrtStreamsToVttList(
                torrent.files
                  .filter((file) => file.name.endsWith('.srt'))
                  .map((file) => ({
                    name: file.name,
                    stream: file.createReadStream(),
                  })),
              ),
            );
          },
        );
      });
    } catch (error) {
      throw new HttpException(error, HttpStatus.I_AM_A_TEAPOT);
    }
  }

  async stream(magnet: string, request: Request, response: Response) {
    try {
      const client = await this.Client();

      client.add(
        magnet,
        { storeCacheSlots: 0, destroyStoreOnDestroy: true },
        (torrent) => {
          const video = torrent.files.find((file) =>
            file.name.endsWith('.mp4'),
          );

          if (!video) {
            response.status(404);

            return response.end();
          }

          response.set({
            Expires: '0',
            'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
            'Accept-Ranges': 'bytes',
            'Content-Type': 'video/mp4',
          });

          const range = rangeParser(video.length, request.headers.range || '');

          if (Array.isArray(range)) {
            response.status(206);

            response.setHeader(
              'Content-Range',
              `bytes ${range[0].start}-${range[0].end}/${video.length}`,
            );

            response.setHeader(
              'Content-Length',
              range[0].end - range[0].start + 1,
            );
          } else {
            response.status(200);

            response.setHeader('Content-Length', video.length);
          }

          const iterator = video[Symbol.asyncIterator](range?.[0]);

          const stream = Readable.from(iterator);

          stream.pipe(response);

          const destroy = () => {
            stream.destroy();
            client.destroy();
          };

          request.on('close', destroy);
          request.on('end', destroy);

          return response;
        },
      );
    } catch (error) {
      throw new HttpException(error, HttpStatus.I_AM_A_TEAPOT);
    }
  }
}
