import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { WebTorrentProvider } from './webtorrent.service';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: WebTorrentProvider,
      useFactory: async (): Promise<WebTorrentProvider> => {
        const provider = new WebTorrentProvider();
        await provider.init();
        return provider;
      },
    },
  ],
  exports: [WebTorrentProvider],
})
export class AppModule {}
