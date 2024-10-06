import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { parse, stringify } from 'subtitle';
import { Response, Request } from 'express';
import rangeParser from 'range-parser';
import { WebTorrentProvider } from './webtorrent.service';
import type { Instance, Torrent } from 'webtorrent';
import { Readable } from 'stream';
import { rm } from 'fs';

@Injectable()
export class AppService {
  client: Instance;

  constructor(webtorrent: WebTorrentProvider) {
    this.client = webtorrent.client;
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

  async torrent(magnet: string, request: Request) {
    const torrent = this.client.get(magnet) as unknown as Promise<Torrent>;

    const clearCache = (torrent: Torrent) => {
      const clear = () =>
        rm(
          `${torrent.path}/${torrent.name}`,
          {
            recursive: true,
            force: true,
          },
          (error) => {
            if (!error) return;

            console.log('Remove files error: ', error);
          },
        );

      request.once('close', clear);
      request.once('end', clear);
    };

    return torrent.then(async (torrent) => {
      if (torrent) {
        if (torrent?.ready) return torrent;

        return new Promise<Torrent>((resolve) =>
          torrent.on('ready', () => {
            clearCache(torrent);
            resolve(torrent);
          }),
        );
      }

      return new Promise<Torrent>((resolve) =>
        this.client.add(
          magnet,
          {
            destroyStoreOnDestroy: true,
            storeCacheSlots: 0,
          },
          (torrent) => {
            clearCache(torrent);
            resolve(torrent);
          },
        ),
      );
    });
  }

  async subtitles(magnet: string, request: Request) {
    return new Promise(async (resolve) => {
      const torrent = await this.torrent(magnet, request);

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
    });
  }

  async stream(magnet: string, request: Request, response: Response) {
    const torrent = await this.torrent(magnet, request);

    const video = torrent.files.find((file) => file.name.endsWith('.mp4'));

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

      response.setHeader('Content-Length', range[0].end - range[0].start + 1);
    } else {
      response.status(200);

      response.setHeader('Content-Length', video.length);
    }

    const iterator = video[Symbol.asyncIterator](range?.[0]);

    const stream = Readable.from(iterator);

    stream.pipe(response);
  }
}
