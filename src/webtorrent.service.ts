import { Injectable } from '@nestjs/common';

import type { Instance } from 'webtorrent';

@Injectable()
export class WebTorrentProvider {
  private instance: Instance;

  async init() {
    const WebTorrent = await import('webtorrent');

    this.instance = new WebTorrent.default({ utp: false });
  }

  get client(): Instance {
    return this.instance;
  }
}
