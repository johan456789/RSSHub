import type { CheerioAPI } from 'cheerio';
import { load } from 'cheerio';

import InvalidParameterError from '@/errors/types/invalid-parameter';
import type { Data, DataItem, Route } from '@/types';
import cache from '@/utils/cache';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';
import timezone from '@/utils/timezone';

export const route: Route = {
    path: '/blog/:id/:categoryId?',
    categories: ['blog'],
    example: '/pixnet/blog/wildflower',
    parameters: {
        id: 'Blog ID, the subdomain of the blog, e.g. `wildflower` for `https://wildflower.pixnet.net/blog`',
        categoryId: 'Category ID, found in the category URL, e.g. `1001523602` for `https://wildflower.pixnet.net/blog/categories/1001523602`. All posts if omitted',
    },
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
            source: ['www.pixnet.net/pcard/:id'],
            target: '/blog/:id',
        },
    ],
    name: 'Blog',
    maintainers: ['johan456789'],
    handler,
    description: `Replacement for the official \`feed.pixnet.net/blog/posts/rss/:id\` feed.

| Blog | Category |
| ---- | -------- |
| \`https://:id.pixnet.net/blog\` | \`https://:id.pixnet.net/blog/categories/:categoryId\` |
| \`/pixnet/blog/:id\` | \`/pixnet/blog/:id/:categoryId\` |`,
};

const getJsonLd = ($: CheerioAPI) =>
    $('script[type="application/ld+json"]')
        .toArray()
        .flatMap((el) => {
            try {
                const data = JSON.parse($(el).text());
                return data['@graph'] ?? [data];
            } catch {
                return [];
            }
        });

async function handler(ctx): Promise<Data> {
    const { id, categoryId } = ctx.req.param();
    if (!/^[\w-]+$/.test(id) || (categoryId && !/^\d+$/.test(categoryId))) {
        throw new InvalidParameterError('Invalid blog ID or category ID');
    }

    const blogUrl = `https://${id}.pixnet.net/blog`;
    const link = categoryId ? `${blogUrl}/categories/${categoryId}` : blogUrl;

    const response = await ofetch(link);
    const $ = load(response);

    if (!$('#pixnet-vars').length) {
        throw new InvalidParameterError(`Pixnet blog "${id}" does not exist or has been deleted`);
    }

    const list = $('#article-box .article')
        .toArray()
        .map((el): DataItem => {
            const $item = $(el);
            const $publish = $item.find('.publish');
            const date = ['month', 'date', 'year', 'time'].map((name) => $publish.find(`.${name}`).text().trim()).join(' ');

            return {
                title: $item.find('.title h2 a').text().trim(),
                link: $item.find('.title h2 a').attr('href'),
                pubDate: timezone(parseDate(date, 'MMM DD YYYY HH:mm'), 8),
                author: $item.find('p.author').text().split('發表在')[0].trim() || undefined,
                category: $item
                    .find('.tag__link')
                    .toArray()
                    .map((tag) => $(tag).text().trim()),
            };
        })
        .filter((item) => item.link);

    const items = await Promise.all(
        list.map((item) =>
            cache.tryGet(item.link!, async () => {
                const $post = load(await ofetch(item.link!));
                const article = getJsonLd($post).find((node) => node['@type'] === 'BlogPosting');

                item.description = $post('#article-content-inner').html()?.trim();
                if (article?.datePublished) {
                    item.pubDate = parseDate(article.datePublished);
                }
                if (article?.dateModified) {
                    item.updated = parseDate(article.dateModified);
                }
                const category = [article?.articleSection, ...(article?.keywords ?? [])].filter(Boolean);
                if (category.length) {
                    item.category = [...new Set(category)];
                }

                return item;
            })
        )
    );

    const jsonLd = getJsonLd($);
    const blog = jsonLd.find((node) => node['@type'] === 'Blog');
    const person = jsonLd.find((node) => node['@type'] === 'Person');
    const categoryName = categoryId ? $(`.refer a[href$="/categories/${categoryId}"]`).first().text().trim() : '';
    const blogName = blog?.name ?? id;

    return {
        title: categoryName ? `${blogName} - ${categoryName}` : blogName,
        description: blog?.description,
        link,
        image: person?.image?.url,
        language: 'zh-TW',
        item: items as DataItem[],
    };
}
