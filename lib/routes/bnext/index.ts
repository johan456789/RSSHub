import { Route } from '@/types';

export const route: Route = {
    path: '/articles',
    categories: ['new-media'],
    example: '/bnext/articles',
    parameters: {},
    features: {
        requireConfig: false,
        requirePuppeteer: false,
        antiCrawler: false,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    radar: [
        {
            source: ['www.bnext.com.tw/articles'],
        },
    ],
    name: '最新文章',
    maintainers: ['jules-v'],
    handler,
};

import got from '@/utils/got';
import { load } from 'cheerio';
import { parseDate } from '@/utils/parse-date';

async function handler(ctx) {
    const rootUrl = 'https://www.bnext.com.tw';
    const currentUrl = `${rootUrl}/articles`;
    const { data } = await got(currentUrl);
    const $ = load(data);

    const list = $('.grid-list .item')
        .toArray()
        .map((item) => {
            const $item = $(item);
            const a = $item.find('a');
            const title = $item.find('h2.title').text();
            const link = a.attr('href');
            const description = $item.find('p.excerpt').text();
            const pubDate = parseDate($item.find('span.date').text());

            return {
                title,
                link,
                description,
                pubDate,
            };
        });

    ctx.set('data', {
        title: '數位時代 BusinessNext - 最新文章',
        link: currentUrl,
        item: list,
    });
}
