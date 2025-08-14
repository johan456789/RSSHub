import { Context } from 'hono';
import ofetch from '@/utils/ofetch';
import { load } from 'cheerio';
import { parseDate } from '@/utils/parse-date';
import { art } from '@/utils/render';
import path from 'node:path';
import cache from '@/utils/cache';

export const handler = async (ctx: Context) => {
    const { category = '' } = ctx.req.param();
    const baseUrl = 'https://www.hudsonrivertrading.com/hrtbeat/';

    const response = await ofetch(baseUrl);
    const $ = load(response);

    let articles = $('#latest .dsm-blog-carousel-item').toArray();

    if (category) {
        articles = $(`#${category} .dsm-blog-carousel-item`).toArray();
    }

    const items = await Promise.all(
        articles.map((item) => {
            const link = $(item).find('.dsm-entry-title a').attr('href');

            return cache.tryGet(link, async () => {
                const detailResponse = await ofetch(link);
                const content = load(detailResponse);

                const title = content('.entry-title').text();
                const author = content('.author-name').text();
                const description = art(path.join(__dirname, 'templates/description.art'), {
                    image: content('.et_post_meta_wrapper img').attr('src'),
                    description: content('.entry-content').html(),
                });
                const pubDate = parseDate(content('meta[property="article:published_time"]').attr('content'));

                return {
                    title,
                    link,
                    author,
                    description,
                    pubDate,
                };
            });
        })
    );

    return {
        title: 'HRT Tech Blog',
        link: baseUrl,
        item: items,
    };
};
