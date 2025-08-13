import { type Data, type DataItem, type Route, ViewType } from '@/types';
import { art } from '@/utils/render';
import cache from '@/utils/cache';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

import { load, type CheerioAPI, type Cheerio } from 'cheerio';
import type { Element } from 'domhandler';
import path from 'node:path';

const baseUrl = 'https://www.gq.com.tw';

const parsePreloadedStateJSON = ($: CheerioAPI) =>
    JSON.parse(
        $('script[type="text/javascript"]')
            .text()
            .match(/window\.__PRELOADED_STATE__ = ({.*?});/)?.[1] ?? '{}'
    );

const largestImage = (sources: Record<string, { width: number; url: string }>, id?: string) => {
    if (!id) {
        let maxWidth = 0;
        let maxUrl = '';
        for (const size of Object.values(sources)) {
            if (size.width > maxWidth) {
                maxWidth = size.width;
                maxUrl = size.url;
            }
        }
        return maxUrl;
    }
    const url = sources[Object.keys(sources)[0]].url;
    const filename = url.slice(url.lastIndexOf('/') + 1);
    return `https://media.gq.com.tw/photos/${id}/${filename}`;
};

export const handler = async (ctx): Promise<Data> => {
    const { caty, subcaty } = ctx.req.param();

    const link = `${baseUrl}${caty ? `/${caty}` : ''}${subcaty ? `/${subcaty}` : ''}`;
    const response = await ofetch<string>(link);
    const $ = load(response);
    const { transformed } = parsePreloadedStateJSON($);

    const list: DataItem[] = transformed.bundle.containers
        .filter((item) => item.items)
        .flatMap((item) =>
            item.items.map((it) => ({
                title: it.source?.hed || it.dangerousHed,
                description: it.source?.dek || it.dangerousDek,
                link: (it.url.startsWith('http') ? it.url : `${baseUrl}${it.url}`).split('#intcid')[0],
                pubDate: parseDate(it.pubDate),
                author: it.contributors.author.items.map((a) => a.name).join(', '),
            }))
        );

    const items: DataItem[] = await Promise.all(
        list.map((item) =>
            cache.tryGet(item.link as string, async () => {
                const detail = await ofetch<string>(item.link as string);
                const $$ = load(detail);
                const data = JSON.parse($$('script[type="application/ld+json"]').first().text());
                const { transformed } = parsePreloadedStateJSON($$);
                const isVideo = data['@type'] === 'VideoObject';

                if (isVideo) {
                    // VideoObject
                    const description = art(path.join(__dirname, 'templates/videoObject.art'), {
                        poster: transformed.video.metaImageUrl,
                        sources: transformed.video.sources,
                        articleBody: data.description,
                    });

                    return {
                        ...item,
                        description,
                    } as DataItem;
                } else {
                    // typical article
                    const md = (await import('markdown-it')).default({ linkify: true });
                    const articleBody$ = load(md.render((data.articleBody as string).replaceAll('{: target="_blank"}', '')).replaceAll('{: #link}', ''), null, false);

                    articleBody$('a').each((_, el) => {
                        const el$ = articleBody$(el) as unknown as Cheerio<Element>;
                        const text = el$.text();
                        if (text.startsWith('#video:') && /youtube/.test(text)) {
                            const match = text.match(/https:\/\/www\.youtube\.com\/embed\/([^\s]+)/);
                            if (match?.[1]) {
                                const videoId = match[1];
                                el$.replaceWith(art(path.join(__dirname, 'templates/youtube.art'), { videoId }));
                            }
                        }
                        if (text.startsWith('![#image:')) {
                            const match = text.match(/!\[#image: \/photos\/(.*?)\]/);
                            const imageId = match?.[1];
                            if (imageId) {
                                const imgInfo = transformed.article.lightboxImages.find((i) => i.id === imageId);
                                if (imgInfo) {
                                    el$.html(
                                        art(path.join(__dirname, 'templates/img.art'), {
                                            src: largestImage(imgInfo.sources, imageId),
                                            alt: imgInfo.dangerousCaption,
                                        })
                                    );
                                }
                            }
                        }
                    });

                    articleBody$('p').each((_, el) => {
                        const el$ = articleBody$(el) as unknown as Cheerio<Element>;
                        const text = el$.text();
                        if (text.startsWith('+++')) {
                            el$.remove();
                            return;
                        }
                        if (text.startsWith('[#image:')) {
                            const match = text.match(/\[#image: \/photos\/(.*?)\]/);
                            const imageId = match?.[1];
                            if (imageId) {
                                const imgInfo = transformed.article.lightboxImages.find((i) => i.id === imageId);
                                if (imgInfo) {
                                    el$.replaceWith(
                                        art(path.join(__dirname, 'templates/img.art'), {
                                            src: largestImage(imgInfo.sources, imageId),
                                            alt: imgInfo.dangerousCaption,
                                        })
                                    );
                                }
                            }
                            return;
                        }
                        if (text.startsWith('[#article:')) {
                            const match = text.match(/\[#article: \/articles\/(.*?)\]/);
                            const articleId = match?.[1];
                            if (articleId) {
                                const embed = transformed.article.body.filter((i) => i[0] === 'inline-embed').find((i) => i[1].ref === articleId);
                                const articleProps = embed?.[1]?.props;
                                if (articleProps) {
                                    el$.replaceWith(
                                        art(path.join(__dirname, 'templates/embed-article.art'), {
                                            url: `${baseUrl}${articleProps.url}`,
                                            text: articleProps.dangerousHed,
                                        })
                                    );
                                }
                            }
                            return;
                        }
                        if (text.startsWith('[#product:')) {
                            const match = text.match(/\[#product: \/products\/(.*?)\]/);
                            const productId = match?.[1];
                            if (productId) {
                                const embed = transformed.article.body.filter((i) => i[0] === 'inline-embed').find((i) => i[1].ref === productId);
                                const productProps = embed?.[1]?.props;
                                if (productProps) {
                                    el$.replaceWith(
                                        art(path.join(__dirname, 'templates/embed-product.art'), {
                                            img: art(path.join(__dirname, 'templates/img.art'), {
                                                src: largestImage(productProps.image.sources as Record<string, { width: number; url: string }>),
                                            }),
                                            productProps,
                                        })
                                    );
                                }
                            }
                            return;
                        }
                        if (text.startsWith('[#instagram:')) {
                            const match = text.match(/\[#instagram: (.*?)\]/);
                            const instagramHref = match?.[1];
                            if (instagramHref) {
                                el$.replaceWith(
                                    art(path.join(__dirname, 'templates/embed-article.art'), {
                                        url: instagramHref,
                                        text: instagramHref,
                                    })
                                );
                            }
                        }
                    });

                    const lede = transformed.article.headerProps.lede;
                    const description = art(path.join(__dirname, 'templates/tw.art'), {
                        dangerousDek: transformed.article.headerProps.dangerousDek,
                        lede: art(path.join(__dirname, 'templates/img.art'), {
                            src: lede?.sources ? largestImage(lede.sources as Record<string, { width: number; url: string }>, lede.id) : null,
                            alt: lede?.caption,
                        }),
                        articleBody: articleBody$.html(),
                    });

                    return {
                        ...item,
                        description,
                    } as DataItem;
                }
            })
        )
    );

    return {
        title: `${transformed.coreDataLayer.content.contentTitle} | ${transformed.coreDataLayer.content.brand}`,
        link,
        image: `${baseUrl}${transformed.logo.sources.sm.url}`,
        item: items,
        allowEmpty: true,
        language: 'zh-TW',
    } satisfies Data;
};

export const route: Route = {
    path: '/tw/:caty?/:subcaty?',
    categories: ['new-media'],
    view: ViewType.Articles,
    example: '/gq/tw/style/fashion',
    parameters: {
        caty: 'Category, e.g., style',
        subcaty: 'Subcategory, e.g., fashion',
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
            source: ['gq.com.tw/:caty?/:subcaty?'],
            target: '/tw/:caty?/:subcaty?',
        },
    ],
    name: 'GQ Taiwan',
    maintainers: ['johan456789'],
    handler,
    description: 'GQ Taiwan 最新內容，可選擇分類與子分類',
};
